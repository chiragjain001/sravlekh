import React from 'react';
import { BookOpen } from 'lucide-react';

const QUESTION_TYPE_LABELS: Record<string, { label: string; order: number }> = {
  MCQ: { label: 'Multiple Choice Questions', order: 1 },
  MULTI_CORRECT: { label: 'Multiple Correct Answer Type', order: 2 },
  MULTIPLE_SELECT: { label: 'Multiple Select Questions', order: 2 },
  TRUE_FALSE: { label: 'True / False Questions', order: 3 },
  FILL_IN_THE_BLANK: { label: 'Fill in the Blanks', order: 4 },
  ASSERTION_REASON: { label: 'Assertion & Reason Type', order: 5 },
  STATEMENT_BASED: { label: 'Statement Based Questions', order: 6 },
  SHORT_ANSWER: { label: 'Short Answer Questions', order: 7 },
  LONG_ANSWER: { label: 'Long Answer Questions', order: 8 },
  NUMERICAL: { label: 'Numerical Value Type Questions', order: 9 },
  INTEGER: { label: 'Integer Type Questions', order: 10 },
  CALCULATION_BASED: { label: 'Calculation Based Questions', order: 11 },
  EQUATION_BASED: { label: 'Equation Based Questions', order: 12 },
  DERIVATION: { label: 'Derivation Questions', order: 13 },
  PROOF: { label: 'Proof Questions', order: 14 },
  SUBJECTIVE: { label: 'Subjective Questions', order: 15 },
  COMPREHENSION: { label: 'Comprehension Based Questions', order: 16 },
  PASSAGE_BASED: { label: 'Passage Based Questions', order: 16 },
  MATRIX_MATCH: { label: 'Matrix Match Type', order: 17 },
  MATCH_THE_FOLLOWING: { label: 'Match The Following Type', order: 17 },
  SEQUENCE_ORDERING: { label: 'Sequence Ordering Questions', order: 18 },
  ONE_WORD: { label: 'One Word Answer Questions', order: 19 },
};

function sectionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function PrintableQuestionPaper({
  exam,
  paper,
  batchLabel,
}: {
  exam: any;
  paper: any;
  batchLabel: string;
}) {
  const instituteName = paper?.institute?.name || exam?.institute?.name || 'Institute';
  const subjectName = paper?.blueprint?.subject?.name || exam?.blueprint?.subject?.name || 'General';
  const rawItems: any[] = paper?.items ?? paper?.paperItems ?? exam?.items ?? [];
  const totalMarks =
    paper?.blueprint?.totalMarks ??
    rawItems.reduce((s: number, i: any) => s + (i.marks || 0), 0);
  const duration = exam?.durationMinutes ?? paper?.blueprint?.duration;
  const instructions: string | undefined = paper?.blueprint?.instructions;

  // Attempt to parse "Class 10 - Section C" into "10" and "C"
  const parts = (batchLabel || '').split(' - ');
  const classVal = parts[0] ? parts[0].replace('Class', '').trim() : 'N/A';
  const sectionVal = parts[1] ? parts[1].replace('Section', '').trim() : 'All';

  // Check for blueprint structured sections (Theory, Hybrid, or Custom Section Builder)
  const blueprintSections: any[] = paper?.blueprint?.sections ?? exam?.blueprint?.sections ?? [];

  let sections: Array<{
    title: string;
    instructions?: string;
    items: any[];
    uniformMarks?: number | null;
    totalSectionMarks?: number;
  }> = [];

  if (Array.isArray(blueprintSections) && blueprintSections.length > 0 && rawItems.length > 0) {
    // 1. Group by sectionId if items have sectionId matching blueprint
    const hasSectionIds = rawItems.some(
      (i: any) => i.sectionId && blueprintSections.some((s: any) => s.id === i.sectionId)
    );

    if (hasSectionIds) {
      sections = blueprintSections
        .map((sec: any) => {
          const secItems = rawItems.filter((i: any) => i.sectionId === sec.id);
          const marksPerQ = sec.marksPerQuestion ?? secItems[0]?.marks;
          const uniform = secItems.every((i: any) => i.marks === marksPerQ) ? marksPerQ : null;
          const totalSec = secItems.reduce((acc: number, i: any) => acc + (i.marks || 0), 0);
          return {
            title: sec.name
              ? `${sec.name}${sec.questionType ? ` – ${sec.questionType}` : ''}`
              : `Section – ${sec.questionType || 'Questions'}`,
            instructions: sec.instructions,
            items: secItems,
            uniformMarks: uniform,
            totalSectionMarks: totalSec,
          };
        })
        .filter((s) => s.items.length > 0);

      const assignedIds = new Set(sections.flatMap((s) => s.items.map((i) => i.id)));
      const unassigned = rawItems.filter((i) => !assignedIds.has(i.id));
      if (unassigned.length > 0) {
        sections.push({
          title: `SECTION ${sectionLetter(sections.length)} – Additional Questions`,
          items: unassigned,
          totalSectionMarks: unassigned.reduce((acc: number, i: any) => acc + (i.marks || 0), 0),
        });
      }
    } else {
      // 2. Sequential slicing based on blueprint questionCount (as in Step 7 Preview)
      let offset = 0;
      blueprintSections.forEach((sec: any, sIdx: number) => {
        const count = sec.questionCount || 0;
        if (count > 0 && offset < rawItems.length) {
          const secItems = rawItems.slice(offset, offset + count);
          const marksPerQ = sec.marksPerQuestion ?? secItems[0]?.marks;
          const uniform = secItems.every((i: any) => i.marks === marksPerQ) ? marksPerQ : null;
          const totalSec = secItems.reduce((acc: number, i: any) => acc + (i.marks || 0), 0);
          sections.push({
            title: sec.name
              ? `${sec.name}${sec.questionType ? ` – ${sec.questionType}` : ''}`
              : `SECTION ${sectionLetter(sIdx)} – ${sec.questionType || 'Questions'}`,
            instructions: sec.instructions,
            items: secItems,
            uniformMarks: uniform,
            totalSectionMarks: totalSec,
          });
          offset += count;
        }
      });

      if (offset < rawItems.length) {
        const remaining = rawItems.slice(offset);
        sections.push({
          title: `SECTION ${sectionLetter(sections.length)} – Additional Questions`,
          items: remaining,
          totalSectionMarks: remaining.reduce((acc: number, i: any) => acc + (i.marks || 0), 0),
        });
      }
    }
  }

  // Fallback: If no blueprint sections or no section matches, group by Question Type
  if (sections.length === 0 && rawItems.length > 0) {
    const grouped = new Map<string, any[]>();
    for (const item of rawItems) {
      const type = item.question?.type || 'GENERAL';
      if (!grouped.has(type)) grouped.set(type, []);
      grouped.get(type)!.push(item);
    }

    const sortedTypes = Array.from(grouped.keys()).sort((a, b) => {
      const orderA = QUESTION_TYPE_LABELS[a]?.order ?? 99;
      const orderB = QUESTION_TYPE_LABELS[b]?.order ?? 99;
      return orderA - orderB;
    });

    sections = sortedTypes.map((type, idx) => {
      const secItems = grouped.get(type)!;
      const marksPerQ = secItems[0]?.marks;
      const uniform = secItems.every((i: any) => i.marks === marksPerQ) ? marksPerQ : null;
      const totalSec = secItems.reduce((acc: number, i: any) => acc + (i.marks || 0), 0);
      const label = QUESTION_TYPE_LABELS[type]?.label || type.replace(/_/g, ' ');
      return {
        title: `SECTION ${sectionLetter(idx)} – ${label}`,
        items: secItems,
        uniformMarks: uniform,
        totalSectionMarks: totalSec,
      };
    });
  }

  let counter = 0;

  return (
    <div
      id="printable-question-paper"
      className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-8 shadow-xs print:shadow-none print:border-none print:rounded-none print:p-0 text-black w-full max-w-full overflow-x-hidden"
    >
      <style>{`
        @media print {
          @page {
            margin: 12mm 15mm;
            size: A4 portrait;
          }
          body {
            visibility: hidden !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-question-paper,
          #printable-question-paper * {
            visibility: visible !important;
          }
          #printable-question-paper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            font-family: "Times New Roman", Times, Georgia, serif !important;
            color: black !important;
            background: white !important;
          }
          .print-border {
            border-color: black !important;
          }
          .print-question-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-section-header {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }
        }
        .printable-content img {
          max-width: 100% !important;
          height: auto !important;
        }
        .printable-content table {
          max-width: 100% !important;
          display: block;
          overflow-x: auto;
        }
        .printable-content pre, .printable-content code {
          max-width: 100% !important;
          white-space: pre-wrap !important;
          word-break: break-word !important;
        }
      `}</style>

      <div className="font-serif max-w-4xl mx-auto space-y-2.5 w-full min-w-0">
        {/* Editor Hint (Hidden on Print) */}
        <div className="print:hidden mb-3.5 p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[12px] sm:text-[12.5px] text-blue-900 flex items-center gap-2.5 shadow-2xs">
          <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="leading-snug">
            <strong>Print Preview:</strong> You can click directly on the text below (like Title,
            Class, Section, or Instructions) to edit it before printing. These edits are only for
            the printout and won&apos;t affect the digital database.
          </p>
        </div>

        {/* ── Desktop & Print Main Header Box (Academic 3-Box Layout) ── */}
        <div className="hidden sm:flex print:flex border-[1.5px] border-black p-3.5 justify-between items-center print-border bg-white">
          <div className="w-20 sm:w-24 flex justify-center items-center shrink-0">
            <div className="w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] rounded-full border-[1.5px] border-black flex flex-col items-center justify-center p-1 print-border">
              <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-black" strokeWidth={1.5} />
              <span className="text-[6px] font-bold tracking-widest mt-0.5 text-center leading-tight uppercase">
                Learn • Grow • Excel
              </span>
            </div>
          </div>

          <div className="flex-1 text-center px-3 sm:px-4 min-w-0">
            <h2
              className="text-[20px] sm:text-[24px] font-black uppercase tracking-wide text-black leading-tight outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded px-2 break-words"
              contentEditable
              suppressContentEditableWarning
            >
              {instituteName}
            </h2>
            <h3
              className="text-[14px] sm:text-[17px] font-bold text-black uppercase mt-1 outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded px-2 break-words"
              contentEditable
              suppressContentEditableWarning
            >
              {exam?.title ?? paper?.title}
            </h3>
          </div>

          <div
            className="w-36 sm:w-40 border-[1.5px] border-black p-2 text-[11px] sm:text-[12px] font-bold text-left leading-relaxed print-border outline-none focus:bg-slate-100 caret-black cursor-text transition-colors shrink-0"
            contentEditable
            suppressContentEditableWarning
          >
            <div>Class : {classVal}</div>
            <div>Subject : {subjectName}</div>
            <div>Section : {sectionVal}</div>
          </div>
        </div>

        {/* ── Mobile Main Header Box (Responsive 2-Tier Layout: Zero Overflow) ── */}
        <div className="flex sm:hidden print:hidden border-[1.5px] border-black p-2.5 flex-col gap-2.5 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-full border-[1.5px] border-black flex flex-col items-center justify-center p-0.5 shrink-0">
              <BookOpen className="w-5 h-5 text-black" strokeWidth={1.5} />
            </div>

            <div className="flex-1 text-center min-w-0">
              <h2
                className="text-[15px] font-black uppercase tracking-wide text-black leading-tight outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded px-1 break-words"
                contentEditable
                suppressContentEditableWarning
              >
                {instituteName}
              </h2>
              <h3
                className="text-[12.5px] font-bold text-black uppercase mt-0.5 outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded px-1 break-words"
                contentEditable
                suppressContentEditableWarning
              >
                {exam?.title ?? paper?.title}
              </h3>
            </div>
          </div>

          <div className="border-t border-black/40 pt-1.5 grid grid-cols-3 gap-1 text-[11px] font-bold text-center">
            <div className="border-r border-black/20 pr-1">
              <span className="text-slate-500 font-medium block text-[9.5px]">CLASS</span>
              <span
                className="outline-none focus:bg-slate-100 caret-black cursor-text"
                contentEditable
                suppressContentEditableWarning
              >
                {classVal}
              </span>
            </div>
            <div className="border-r border-black/20 px-1 overflow-hidden">
              <span className="text-slate-500 font-medium block text-[9.5px]">SUBJECT</span>
              <span
                className="outline-none focus:bg-slate-100 caret-black cursor-text truncate block"
                contentEditable
                suppressContentEditableWarning
              >
                {subjectName}
              </span>
            </div>
            <div className="pl-1">
              <span className="text-slate-500 font-medium block text-[9.5px]">SECTION</span>
              <span
                className="outline-none focus:bg-slate-100 caret-black cursor-text"
                contentEditable
                suppressContentEditableWarning
              >
                {sectionVal}
              </span>
            </div>
          </div>
        </div>

        {/* Time and Marks Row */}
        <div className="border-[1.5px] border-black px-2.5 sm:px-3.5 py-1.5 flex flex-wrap justify-between items-center gap-1 text-[11.5px] sm:text-[13px] font-bold print-border bg-white">
          <span
            className="outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded px-1"
            contentEditable
            suppressContentEditableWarning
          >
            Time : {duration ? `${duration} Minutes` : 'N/A'}
          </span>
          <span
            className="outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded px-1"
            contentEditable
            suppressContentEditableWarning
          >
            Maximum Marks : {totalMarks}
          </span>
        </div>

        {/* General Instructions Box */}
        {instructions && (
          <div className="border-[1.5px] border-black p-2.5 sm:p-3.5 print-border bg-white">
            <div
              className="font-bold text-[11.5px] sm:text-[13px] mb-1 outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded"
              contentEditable
              suppressContentEditableWarning
            >
              General Instructions:
            </div>
            <div
              className="text-[11px] sm:text-[12px] whitespace-pre-wrap leading-relaxed pl-3.5 sm:pl-4 outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded"
              contentEditable
              suppressContentEditableWarning
            >
              <ol className="list-decimal space-y-0.5">
                {instructions
                  .split('\n')
                  .filter((l) => l.trim())
                  .map((line, i) => {
                    const cleanLine = line.replace(/^[0-9.-]+\s*/, '');
                    return <li key={i}>{cleanLine}</li>;
                  })}
              </ol>
            </div>
          </div>
        )}

        {/* Empty state safeguard */}
        {sections.length === 0 && (
          <div className="p-8 text-center text-slate-400 font-sans border-[1.5px] border-dashed border-slate-300 rounded-xl my-4">
            <p className="font-semibold text-[13px]">No questions currently found in this paper.</p>
          </div>
        )}

        {/* Sections Container */}
        <div className="space-y-3.5 sm:space-y-4 mt-3">
          {sections.map((section, sIdx) => {
            return (
              <div
                key={sIdx}
                className="border-[1.5px] border-black print-border bg-white rounded-none w-full min-w-0"
              >
                {/* Section Header */}
                <div className="print-section-header border-b-[1.5px] border-black bg-gray-100/90 print:bg-gray-100 px-2.5 sm:px-3 py-1.5 sm:py-2 flex flex-wrap justify-between items-center gap-1.5 sm:gap-2 print-border">
                  <div className="flex-1 min-w-0">
                    <h4
                      className="text-[12px] sm:text-[13px] font-bold uppercase tracking-wide outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded px-1 break-words"
                      contentEditable
                      suppressContentEditableWarning
                    >
                      {section.title}
                    </h4>
                    {section.instructions && (
                      <p
                        className="text-[10.5px] sm:text-[11px] text-slate-600 font-medium italic mt-0.5 pl-1 outline-none focus:bg-slate-100 caret-black cursor-text break-words"
                        contentEditable
                        suppressContentEditableWarning
                      >
                        {section.instructions}
                      </p>
                    )}
                  </div>
                  {section.totalSectionMarks != null && (
                    <span
                      className="font-bold text-[11px] sm:text-[12px] outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded px-1 shrink-0 whitespace-nowrap"
                      contentEditable
                      suppressContentEditableWarning
                    >
                      {section.uniformMarks != null ? (
                        <>
                          ({section.uniformMarks} × {section.items.length} ={' '}
                          {section.totalSectionMarks} Marks)
                        </>
                      ) : (
                        <>({section.totalSectionMarks} Marks)</>
                      )}
                    </span>
                  )}
                </div>

                {/* Questions List */}
                <div className="p-2.5 sm:p-3.5 space-y-3.5 sm:space-y-4 divide-y divide-gray-200/60 print:divide-black/20">
                  {section.items.map((item: any, iIdx: number) => {
                    counter += 1;
                    const qContent = item.question?.content || item.content || '';
                    const qOptions = item.question?.options || item.options;
                    const qDifficulty = item.question?.difficulty || item.difficulty;
                    const qTopicName = item.question?.topic?.name || item.topicName;

                    return (
                      <div
                        key={item.id || `${sIdx}-${iIdx}`}
                        className={`print-question-item flex items-start justify-between gap-2.5 sm:gap-4 text-[12px] sm:text-[13px] leading-relaxed ${
                          iIdx > 0 ? 'pt-3 sm:pt-3.5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2 sm:gap-2.5 flex-1 min-w-0">
                          <span className="font-bold flex-shrink-0 w-4 sm:w-5">{counter}.</span>
                          <div className="flex-1 min-w-0 printable-content">
                            {/* Question Content (supports HTML / LaTeX markdown) */}
                            <div
                              className="text-black outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded px-0.5 sm:px-1 break-words font-medium leading-relaxed"
                              contentEditable
                              suppressContentEditableWarning
                              dangerouslySetInnerHTML={{ __html: qContent }}
                            />

                            {/* MCQ Options Rendering */}
                            {Array.isArray(qOptions) && qOptions.length > 0 && (
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-1.5 sm:gap-y-2 pl-1 sm:pl-2 text-[11.5px] sm:text-[12.5px]">
                                {qOptions.map((opt: any, oIdx: number) => (
                                  <div key={oIdx} className="flex items-start gap-1.5 sm:gap-2 min-w-0">
                                    <span className="font-bold shrink-0">
                                      ({opt.label || String.fromCharCode(65 + oIdx)})
                                    </span>
                                    <span
                                      className="outline-none focus:bg-slate-100 caret-black cursor-text transition-colors rounded px-0.5 sm:px-1 break-words min-w-0 flex-1"
                                      contentEditable
                                      suppressContentEditableWarning
                                      dangerouslySetInnerHTML={{
                                        __html: opt.text || opt.content || '',
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Tags for Screen Preview (Hidden on Print) */}
                            <div className="print:hidden flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 pt-0.5">
                              {qDifficulty && (
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize ${
                                    qDifficulty === 'HARD'
                                      ? 'bg-rose-100 text-rose-700'
                                      : qDifficulty === 'MEDIUM'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {qDifficulty}
                                </span>
                              )}
                              {qTopicName && (
                                <span className="text-[10px] sm:text-[10.5px] font-medium text-slate-400 truncate max-w-[240px]">
                                  {qTopicName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Marks Badge */}
                        <span className="font-bold shrink-0 text-slate-900 text-[11px] sm:text-[12.5px] ml-1 sm:ml-2">
                          [{item.marks}]
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
