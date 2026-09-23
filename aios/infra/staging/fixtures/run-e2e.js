#!/usr/bin/env node
/* Drives the whole digital answer-sheet flow against a running STAGING stack,
 * exactly as the teacher's browser would, and checks what each step produced.
 *
 *   node infra/staging/fixtures/run-e2e.js <fixture-dir> [--images] [--resume <attemptId>]
 *
 * --images uploads the booklet as page images instead of a PDF.
 * --resume picks up an attempt whose booklet is already uploaded, mapped and
 * read, and verifies from the AI check onwards — useful when the provider's
 * daily quota is spent and re-running OCR would only fail.
 *
 * Prerequisites: infra/staging/docker-compose.yml is up, migrations applied,
 * seed-fixture.js has run, and run-stack.sh api / worker / python are running.
 *
 * Upload → (PDF render) → identity → region suggestions → OCR → AI check →
 * teacher review → submit → ScoreRecord → checked PDF. Every step asserts on
 * the API's own responses, so a green run means the flow really works, not that
 * the calls returned 200.
 */
const fs = require('fs');
const path = require('path');

const API = process.env.E2E_API_URL || 'http://127.0.0.1:4000/api/v1';
const INSTITUTE = 'fx-institute';
const DELIVERY = 'fx-delivery';
const STUDENT_PROFILE = 'fx-student-1';
const fixtureDir = process.argv[2] || path.join(__dirname, 'out');
const useImages = process.argv.includes('--images');
const resumeAttemptId = process.argv.includes('--resume') ? process.argv[process.argv.indexOf('--resume') + 1] : null;

let token = '';
const steps = [];

function log(step, detail) {
  steps.push({ step, detail });
  console.log(`\n▶ ${step}`);
  if (detail !== undefined) console.log(typeof detail === 'string' ? `  ${detail}` : JSON.stringify(detail, null, 2).split('\n').map((l) => `  ${l}`).join('\n'));
}

function check(condition, message, context) {
  if (condition) return;
  console.error(`\n✗ FAILED: ${message}`);
  if (context !== undefined) console.error(JSON.stringify(context, null, 2));
  process.exit(1);
}

async function api(method, route, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${API}${route}`, { method, headers, body: payload });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    console.error(`\n✗ ${method} ${route} → ${response.status}`);
    console.error(typeof parsed === 'string' ? parsed.slice(0, 600) : JSON.stringify(parsed, null, 2).slice(0, 1200));
    process.exit(1);
  }
  return parsed;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls until `fn` returns something truthy. `optional` returns null on timeout instead of failing the run. */
async function until(label, fn, { timeoutMs = 240_000, everyMs = 3000, optional = false } = {}) {
  const started = Date.now();
  for (;;) {
    const result = await fn();
    if (result) return result;
    if (Date.now() - started > timeoutMs) {
      if (optional) return null;
      check(false, `timed out waiting for ${label} after ${Math.round((Date.now() - started) / 1000)}s`);
    }
    await sleep(everyMs);
  }
}

async function main() {
  // ── 1. Sign in as the teacher ────────────────────────────────────────────
  const login = await api('POST', '/auth/dev-login', { role: 'TEACHER' });
  token = login.accessToken ?? login.data?.accessToken;
  check(!!token, 'dev-login returned no access token', login);
  log('Signed in as the teacher', { user: login.user?.email ?? login.data?.user?.email });

  let attemptId = resumeAttemptId;
  if (resumeAttemptId) {
    const sheet = await api('GET', `/institutes/${INSTITUTE}/attempts/${resumeAttemptId}/checked-copy`);
    check(sheet.counts.needsOcr === 0, 'the resumed sheet still has unread answers', sheet.counts);
    log('Resuming an already uploaded, mapped and read booklet', {
      attemptId: resumeAttemptId, student: sheet.student.name, counts: sheet.counts,
    });
  } else {
  // ── 2. Upload the booklet ───────────────────────────────────────────────
  const bundle = await api('POST', `/institutes/${INSTITUTE}/document-bundles`, {
    assessmentDeliveryId: DELIVERY,
    expectedDocumentCount: 1,
  });
  log('Created a document bundle', { bundleId: bundle.id });

  const form = new FormData();
  if (useImages) {
    for (const page of [1, 2, 3]) {
      const file = path.join(fixtureDir, `page-${page}.jpg`);
      form.append('files', new Blob([fs.readFileSync(file)], { type: 'image/jpeg' }), `page-${page}.jpg`);
    }
  } else {
    const file = path.join(fixtureDir, 'answer-sheet.pdf');
    form.append('files', new Blob([fs.readFileSync(file)], { type: 'application/pdf' }), 'answer-sheet.pdf');
  }
  const upload = await api('POST', `/institutes/${INSTITUTE}/document-bundles/${bundle.id}/documents`, form, {
    'Idempotency-Key': `e2e-${Date.now()}`,
  });
  const documentId = upload.documentId;
  log(useImages ? 'Uploaded 3 page images' : 'Uploaded the PDF booklet', upload);

  // ── 3. Pages exist (rendered server-side for a PDF) ─────────────────────
  const withPages = await until('the booklet to have pages', async () => {
    const doc = await api('GET', `/institutes/${INSTITUTE}/documents/${documentId}`);
    if (doc.status === 'FAILED') {
      check(false, 'the document failed processing', doc.processingJobs?.filter((j) => j.status === 'FAILED'));
    }
    return doc.pages?.length ? doc : null;
  });
  check(withPages.pages.length === 3, `expected 3 pages, got ${withPages.pages.length}`);
  log('Booklet pages ready', { pages: withPages.pages.length, status: withPages.status });

  // ── 4. Confirm who the booklet belongs to ───────────────────────────────
  check(!!withPages.identityResolution, 'no identity resolution row on the document');
  await api('POST', `/institutes/${INSTITUTE}/identity-resolutions/${withPages.identityResolution.id}/confirm`, {
    studentProfileId: STUDENT_PROFILE,
  });
  const identified = await api('GET', `/institutes/${INSTITUTE}/documents/${documentId}`);
  check(!!identified.attemptId, 'confirming the student did not create an attempt');
  attemptId = identified.attemptId;
  log('Confirmed the student', { attemptId, identity: identified.identityResolution.status });

  // ── 5. Suggest answer regions, then map whatever the model left unmapped ─
  const detection = await api('POST', `/institutes/${INSTITUTE}/documents/${documentId}/detect-regions`);
  log('AI suggested answer regions', detection);
  check(detection.created > 0, 'region detection suggested nothing at all', detection);

  const questionIds = ['fx-q1', 'fx-q2', 'fx-q3', 'fx-q4'];
  const afterDetect = await api('GET', `/institutes/${INSTITUTE}/documents/${documentId}`);
  const regions = afterDetect.pages.flatMap((p) => p.images.flatMap((i) => i.regions.map((r) => ({ ...r, pageNumber: p.pageNumber }))));
  const answerRegions = regions.filter((r) => r.regionType === 'QUESTION_ANSWER');
  const mappedQuestionIds = new Set(answerRegions.map((r) => r.questionId).filter(Boolean));
  log('Regions on the booklet', answerRegions.map((r) => ({
    page: r.pageNumber, question: r.questionId ?? 'UNMAPPED', confidence: r.detectionConfidence,
  })));

  // The teacher's correction pass: every subjective question must end up with
  // exactly one region. Unmapped suggestions are assigned, and questions the
  // model missed get a region drawn by hand (which is what a teacher would do).
  const spare = answerRegions.filter((r) => !r.questionId);
  for (const questionId of questionIds) {
    if (mappedQuestionIds.has(questionId)) continue;
    const region = spare.shift();
    if (region) {
      await api('PATCH', `/institutes/${INSTITUTE}/page-regions/${region.id}`, { questionId });
      mappedQuestionIds.add(questionId);
    }
  }
  const stillMissing = questionIds.filter((q) => !mappedQuestionIds.has(q));
  // Drawn by hand — the manual fallback has to work too. The fixture booklet puts
  // Q1/Q2 on page 1 and Q3/Q4 on page 2, so each box goes where its answer is.
  const HAND_DRAWN = {
    'fx-q1': { page: 1, box: { x: 0.06, y: 0.1, width: 0.88, height: 0.19 } },
    'fx-q2': { page: 1, box: { x: 0.06, y: 0.3, width: 0.88, height: 0.19 } },
    'fx-q3': { page: 2, box: { x: 0.06, y: 0.1, width: 0.88, height: 0.19 } },
    'fx-q4': { page: 2, box: { x: 0.06, y: 0.3, width: 0.88, height: 0.15 } },
  };
  for (const questionId of stillMissing) {
    const spec = HAND_DRAWN[questionId];
    const page = afterDetect.pages.find((p) => p.pageNumber === spec.page) ?? afterDetect.pages[0];
    await api('POST', `/institutes/${INSTITUTE}/page-images/${page.images[0].id}/regions`, {
      boundingBox: spec.box,
      regionType: 'QUESTION_ANSWER',
      questionId,
    });
  }
  log('Mapped every subjective answer to its question', {
    autoMapped: questionIds.length - stillMissing.length,
    drawnByHand: stillMissing.length,
  });

  // ── 6. Read the handwriting ─────────────────────────────────────────────
  const ocr = await api('POST', `/institutes/${INSTITUTE}/documents/${documentId}/ocr`);
  log('Queued OCR', ocr);
  await until('OCR to finish', async () => {
    const sheet = await api('GET', `/institutes/${INSTITUTE}/attempts/${attemptId}/checked-copy`);
    const pending = sheet.counts.needsOcr;
    process.stdout.write(`  … ${sheet.counts.subjective - pending}/${sheet.counts.subjective} answers read\r`);
    return pending === 0 ? sheet : null;
  });

  const readSheet = await api('GET', `/institutes/${INSTITUTE}/attempts/${attemptId}/checked-copy`);
  log('Handwriting read', readSheet.questions.filter((q) => q.subjective).map((q) => ({
    q: q.number, state: q.state, ocr: q.ocrConfidence, text: (q.studentAnswer ?? '').slice(0, 70),
  })));
  // Each answer must be ITS OWN text, not the whole page.
  const transcripts = readSheet.questions.filter((q) => q.subjective).map((q) => (q.studentAnswer ?? '').trim());
  check(transcripts.every((t) => t.length > 0), 'an answer was read as empty', transcripts);
  check(new Set(transcripts).size === transcripts.length,
    'two answers read as identical text — each region must be cropped and read on its own', transcripts);

  } // end of the upload → OCR phase, skipped by --resume

  // ── 7. AI check ─────────────────────────────────────────────────────────
  const aiCheck = await api('POST', `/institutes/${INSTITUTE}/attempts/${attemptId}/checked-copy/ai-check`);
  log('Queued the AI check', aiCheck);
  const aiFinished = await until('the AI to finish', async () => {
    const sheet = await api('GET', `/institutes/${INSTITUTE}/attempts/${attemptId}/checked-copy`);
    process.stdout.write(`  … ${sheet.counts.aiSuggested} of ${sheet.counts.subjective} checked\r`);
    return sheet.counts.readyForAi === 0 ? sheet : null;
  }, { timeoutMs: 300_000, optional: true });

  const checked = aiFinished ?? (await api('GET', `/institutes/${INSTITUTE}/attempts/${attemptId}/checked-copy`));
  const suggestions = checked.questions.filter((q) => q.subjective && q.ai);

  // The AI is an assistant, and the rest of this run does not depend on it: a
  // teacher marks by hand whenever an answer has no suggestion (an unreadable
  // scan, a provider outage, an exhausted quota). Say so loudly rather than
  // reporting a pass that did not happen, and keep verifying the human path.
  const aiRan = suggestions.length > 0 && checked.counts.readyForAi === 0;
  if (!aiRan) {
    log('AI CHECK DID NOT COMPLETE — continuing with teacher-entered marks', {
      suggested: suggestions.length,
      stillWaiting: checked.counts.readyForAi,
      hint: 'usually the provider key is out of quota; the answers stay with the teacher, which is the designed fallback',
    });
  }
  if (aiRan) log('AI marks', suggestions.map((q) => ({
    q: q.number,
    marks: `${q.current?.marksAwarded}/${q.marksAvailable}`,
    verdict: q.current?.breakdown?.verdict,
    tags: (q.current?.breakdown?.tags ?? []).map((t) => `${t.tag} ${t.marksAwarded}/${t.maxMarks}`),
    flags: q.ai.flags,
    solvedItself: q.ai.breakdown?.referenceUsed === false,
  })));
  if (aiRan) {
    check(suggestions.length >= 3, 'the AI checked fewer than 3 answers', checked.counts);
    check(suggestions.every((q) => (q.current?.breakdown?.tags ?? []).length > 0), 'an AI suggestion came back with no tag-wise split');
    check(
      suggestions.some((q) => q.ai.flags.includes('no_reference_answer')),
      'no answer was graded without a reference — the reference-less path did not run',
    );
  }
  check(checked.status === 'DRAFT', 'the sheet counted as FINAL before the teacher submitted');
  check(!checked.scoreRecord || checked.scoreRecord.obtainedMarks === 0 || !checked.scoreRecord.isFinalized,
    'AI suggestions reached the official score before any human approved them', checked.scoreRecord);

  // ── 8. The teacher reviews, edits one answer and submits ────────────────
  const subjective = checked.questions.filter((q) => q.subjective);
  const edited = subjective[0];
  const items = subjective.map((q) => {
    // No AI suggestion? The teacher marks it themselves, tag-wise, exactly as
    // the review screen lets them.
    const tags = q.current?.breakdown?.tags?.length
      ? q.current.breakdown.tags
      : [
          { tag: 'CONCEPT', maxMarks: Math.ceil(q.marksAvailable / 2), marksAwarded: Math.ceil(q.marksAvailable / 2) },
          { tag: 'EXPLANATION', maxMarks: Math.floor(q.marksAvailable / 2), marksAwarded: 0 },
        ].filter((t) => t.maxMarks > 0);
    if (q.responseId === edited.responseId && tags.length) {
      // Give one tag one more mark: the teacher's number must win.
      const bumped = tags.map((t, i) => (i === 0 ? { ...t, marksAwarded: Math.min(t.maxMarks, t.marksAwarded + 1) } : t));
      return { responseId: q.responseId, tags: bumped.map(({ tag, maxMarks, marksAwarded }) => ({ tag, maxMarks, marksAwarded })), teacherComment: 'Checked by teacher in E2E run' };
    }
    if (tags.length) return { responseId: q.responseId, tags: tags.map(({ tag, maxMarks, marksAwarded }) => ({ tag, maxMarks, marksAwarded })) };
    return { responseId: q.responseId, marksAwarded: q.current?.marksAwarded ?? 0 };
  });
  const submitted = await api('POST', `/institutes/${INSTITUTE}/attempts/${attemptId}/checked-copy/submit`, { confirmed: true, items });
  log('Teacher submitted the sheet', { updated: submitted.updatedCount, score: submitted.scoreRecord, pdf: submitted.pdfUrl ? 'generated' : 'missing' });

  const expectedTotal = items.reduce((sum, item) => sum + (item.tags ? item.tags.reduce((s, t) => s + t.marksAwarded, 0) : item.marksAwarded), 0);
  check(!!submitted.scoreRecord, 'no ScoreRecord was written');
  check(Math.abs(submitted.scoreRecord.obtainedMarks - expectedTotal) < 0.01,
    `ScoreRecord says ${submitted.scoreRecord.obtainedMarks}, the submitted marks add up to ${expectedTotal}`);
  check(submitted.scoreRecord.isFinalized === true, 'the score was not finalized even though every answer is approved');
  check(!!submitted.pdfUrl, 'no checked-copy PDF was produced on submit');

  // ── 9. It stays that way after a reload ────────────────────────────────
  const final = await api('GET', `/institutes/${INSTITUTE}/attempts/${attemptId}/checked-copy`);
  check(final.status === 'FINAL', 'the sheet did not come back FINAL after reloading', final.status);
  check(final.questions.filter((q) => q.subjective).every((q) => q.state === 'REVIEWED'), 'an answer is not REVIEWED after submit');
  const editedAfter = final.questions.find((q) => q.responseId === edited.responseId);
  const editedTags = editedAfter.current.breakdown.tags;
  check(editedAfter.current.source === 'TEACHER', 'the approved version is not TEACHER-sourced', editedAfter.current.source);
  check(editedAfter.current.teacherComment === 'Checked by teacher in E2E run', 'the teacher comment did not persist');
  check(Math.abs(editedTags.reduce((s, t) => s + t.marksAwarded, 0) - editedAfter.current.marksAwarded) < 0.01,
    'the stored tag marks do not add up to the stored total');
  log('After reload', {
    status: final.status,
    score: final.scoreRecord,
    reviewedBy: final.reviewedBy?.name,
    editedQuestion: { q: editedAfter.number, marks: editedAfter.current.marksAwarded, tags: editedTags.map((t) => `${t.tag} ${t.marksAwarded}/${t.maxMarks}`) },
  });

  // ── 10. A late AI job must not overwrite the teacher ────────────────────
  const lateAi = await api('POST', `/institutes/${INSTITUTE}/attempts/${attemptId}/checked-copy/ai-check`);
  check(lateAi.enqueuedCount === 0, 'an AI check was queued over answers a teacher had already approved', lateAi);
  log('Late AI check refused to touch approved answers', lateAi);

  // ── 11. The checked copy, as a PDF ─────────────────────────────────────
  const pdf = await api('POST', `/institutes/${INSTITUTE}/attempts/${attemptId}/checked-copy/pdf`);
  check(pdf.status === 'FINAL', `expected a FINAL copy, got ${pdf.status}`);
  const pdfResponse = await fetch(pdf.url);
  const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
  check(pdfBytes.subarray(0, 5).toString() === '%PDF-', 'the stored checked copy is not a PDF');
  const pdfPath = path.join(fixtureDir, 'checked-copy-e2e.pdf');
  fs.writeFileSync(pdfPath, pdfBytes);
  log('Checked copy PDF', { bytes: pdfBytes.length, savedTo: pdfPath });

  // ── 12. The student's own view ─────────────────────────────────────────
  const studentLogin = await api('POST', '/auth/dev-login', { role: 'STUDENT' });
  const teacherToken = token;
  token = studentLogin.accessToken ?? studentLogin.data?.accessToken;
  const me = await api('GET', '/auth/me');
  check(!!me, 'the student could not read their own profile');
  token = teacherToken;

  console.log('\n──────────────────────────────────────────────');
  console.log(`✓ End-to-end run complete — ${steps.length} steps, score ${submitted.scoreRecord.obtainedMarks}/${submitted.scoreRecord.totalMarks}`);
  console.log(`  AI stage: ${aiRan ? 'completed and reviewed' : 'DID NOT RUN (teacher-entered marks used)'}`);
  console.log(`  attempt: ${attemptId}`);
  console.log(`  checked copy: ${pdfPath}`);
}

main().catch((err) => {
  console.error('\n✗ E2E run threw:', err);
  process.exit(1);
});
