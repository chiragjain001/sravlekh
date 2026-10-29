# AIOS / SARVLEKH — 90-Day Go-To-Market, Customer Validation & Growth Execution Plan

**Document Version:** 1.0.0  
**Execution Horizon:** Next 90 Days (Days 1 to 90)  
**Target Market:** Tier-1 and Tier-2 Indian Coaching Institutes & High-Frequency Testing Schools  
**Primary Sales Motion:** Founder-Led Direct Sales & Paid On-Site Pilots

---

## 1. Executive Go-To-Market Thesis

### Why Traditional EdTech Sales Tactics Fail:
Most EdTech startups fail in the Indian institutional market because they attempt to sell full administrative ERPs to school trust boards. These sales cycles take **6 to 18 months**, involve committee politics, face entrenched legacy relationships (Entab, Vidyalaya), and demand massive customizations (transport GPS, custom fee receipt printouts).

### The AIOS Entry Strategy (The Trojan Horse):
AIOS will **not** enter the market as an ERP replacement. AIOS enters through a single, urgent, burning operational pain point:

$$\textbf{The Paper Examination \& Grading Nightmare}$$

In every competitive coaching institute (JEE, NEET, Foundation, Commerce) and high school (CBSE/ICSE Grades 9–12):
1. Teachers spend **15 to 25 hours per week** manually grading paper copies with red pens.
2. Result turnaround takes **10 to 14 days**, frustrating students and parents.
3. Exam papers are leaked or shared across batches because generating anti-cheating paper variants is too tedious.
4. The marksheet reports only a raw score (e.g., $64/100$), leaving parents with zero insight into *why* marks were lost.

AIOS solves this entire loop in **48 hours** with physical paper booklets, high-speed scanning, Otsu OMR roll recognition, AI-assisted first-pass scoring, and 1-click diagnostic mastery report cards.

---

## 2. Ideal Customer Profile (ICP) & Persona Qualification

### 2.1 The #1 Beachhead ICP: Tier-1 & Tier-2 Coaching Institutes
- **Profile:** Independent or 2–5 branch coaching institutes preparing students for competitive exams (JEE Main/Advanced, NEET, CUET, Foundation Olympiads, CA Foundation).
- **Size:** 150 to 1,200 enrolled students.
- **Exam Cadence:** Conducts tests **weekly or bi-weekly** (20 to 30 exams per year).
- **Current Workflow:** Print papers at local print shops $\rightarrow$ students write on blank ruled sheets or loose papers $\rightarrow$ faculty spend weekends grading $\rightarrow$ data entered into Excel.
- **Budget:** Spend ₹30,000 to ₹1,50,000 annually on printing paper alone; willing to spend ₹250–₹350/student/year to market "AI-powered diagnostic testing" to prospective parents.
- **Decision Maker:** **The Founder / Institute Director** (single decision-maker, zero board politics, can approve a ₹1 Lakh contract in 48 hours).

### 2.2 Qualifying Criteria (The "YES" Checklist)
Before spending time on a demonstration, the prospect must meet at least 4 of these 5 criteria:
- [ ] Conducts physical paper examinations at least once every 2 weeks.
- [ ] Has at least 150 enrolled students.
- [ ] Faculty currently spend >10 hours/week grading physical answer sheets.
- [ ] Has an existing ADF document scanner or multi-function printer (or willing to procure a ₹25,000 Brother/Canon scanner).
- [ ] The person in the meeting has direct check-signing financial authority.

---

## 3. The 15-Minute High-Impact Demo Script

Never show settings, role editors, or user lists during a sales demo. Demonstrate the complete physical-to-digital examination loop live in 15 minutes.

### Phase 1: The Paper Generation Magic (3 Minutes)
1. Open **Blueprint Paper Builder**.
2. Select *"Class 11 Physics — Laws of Motion & Friction (50 Marks)"*.
3. Click **Generate Anti-Cheating Sets**.
4. Show the system automatically drawing balanced questions via Fisher–Yates shuffle, avoiding duplicate question families, and generating **Set A and Set B**.
5. *The Hook:* *"Sir, how long does it take your physics faculty to create two balanced, non-leaking test paper sets? With Sarvlekh, it took 45 seconds."*

### Phase 2: The Physical Examination Logistics (3 Minutes)
1. Show the generated **Printable Answer Booklet PDF**.
2. Point out the **HMAC-SHA256 Signed QR Code** on the cover page.
3. Point out the **OMR Roll-Number Bubble Grid**.
4. *The Hook:* *"Your students still write with physical pens on paper. You don't need iPads, you don't need tablets. But each booklet is now cryptographically serialized to prevent paper swapping."*

### Phase 3: The 30-Second Ingestion & Auto-Segmentation (3 Minutes)
1. Upload a sample 20-page combined PDF from an office scanner.
2. Trigger **Automatic Page Segmentation**.
3. Show OpenCV slicing the bundle into 3 separate student booklets, reading the OMR roll numbers with 0.98 confidence, and linking each booklet to the enrolled student profile without manual data entry.
4. *The Hook:* *"No manual sorting. Drop 100 answer sheets into the scanner, upload one file, and the software assigns every sheet to the right student."*

### Phase 4: The Digital Evaluation Desk (4 Minutes)
1. Open **EvaluationWorkspace** on split screen.
2. Left: High-resolution student handwritten answer.
3. Right: Rubric criteria and the AI first-pass suggestion with justification note.
4. Teacher accepts suggested marks or clicks a button to adjust. Click diagnostic tags: `FORMULA_ERROR` and `CALCULATION_ERROR`.
5. *The Hook:* *"Your faculty cuts grading time by 60%. The AI never grades behind your back—the teacher is always in control, but never starts from a blank sheet."*

### Phase 5: The Parent "WOW" Factor — Diagnostic Mastery Report (2 Minutes)
1. Click **Lock Results** and open the generated **Academic Diagnostic PDF**.
2. Show the parent report: Not just $32/50$, but a radar chart showing $92\%$ mastery in Friction, $40\%$ mastery in Circular Dynamics, and the exact list of careless vs conceptual mistakes.
3. *The Close:* *"When parents come for the PTM, which coaching institute will they choose? The one that gives them a raw number, or the one that gives them this diagnostic proof?"*

---

## 4. The 14-Day Paid Pilot Program

Never offer free, open-ended pilots. A free pilot has no executive commitment, faculty ignore it, and it dies of inertia.

### Pilot Terms & Structure:
- **Duration:** Exactly 14 Days (or 1 full examination cycle).
- **Scope:** 1 single subject, 1 batch, up to 100 students, exactly 2 consecutive tests.
- **Pilot Commitment Fee:** **₹5,000 (Non-refundable, but 100% credited against the annual contract upon signing).**
- **Hardware Requirement:** Institute must provide a standard ADF scanner (Brother ADS-1200 or Canon imageFORMULA). If unavailable, founder provides a portable demo scanner for the test day.

### Guaranteed Pilot Deliverables (Our SLA):
1. Complete batch roster uploaded within 4 hours.
2. Printable serialized test booklets delivered 24 hours prior to test day.
3. Scanning and automated segmentation executed within 30 minutes of paper submission.
4. Teacher evaluation completed on the Digital Desk within 24 hours.
5. High-resolution diagnostic report cards generated and delivered to director.

---

## 5. Trust, Compliance & Objections Playbook

| Objection / Concern | The Honest, High-Trust Response |
| :--- | :--- |
| **"Will AI grade our students wrong and make parents angry?"** | *"Under our AI Governance Policy, the AI is legally blocked from finalizing scores. The AI acts only as a teaching assistant suggesting rubric marks. A human faculty member must inspect and approve every single mark awarded before results can lock."* |
| **"What if our internet goes down during evaluation?"** | *"The Digital Evaluation Desk is engineered with local storage caching. Teachers can continue grading even if the broadband drops; marks sync automatically the moment connection is restored."* |
| **"Is student data secure? What about the new DPDP Law?"** | *"We are fully compliant with India's Digital Personal Data Protection Act 2023. You (the institute) remain the Data Fiduciary; we act strictly as your Data Processor. We do not track, profile, or advertise to students. Your data can be exported in full at any time."* |
| **"Can we export our student records if we leave?"** | *"Yes. We believe in zero vendor lock-in. You can download all student profiles, exam histories, and evaluated PDFs as clean CSVs and ZIP archives directly from your dashboard."* |

---

## 6. The 90-Day Execution Timeline & Milestones

```
DAY 1 - 30: HARDENING & FIRST 3 PILOTS
├── Week 1: Deploy Razorpay payment integration & Staging smoke test
├── Week 2: Build founder outreach list (50 Tier-1/2 coaching centers in NCR/Jaipur/Kota)
├── Week 3: Conduct 15 live demos; sign first 2 paid pilots (₹5,000 pilot fee)
└── Week 4: Execute Pilot #1 live; collect teacher feedback; generate first diagnostic reports

DAY 31 - 60: PILOT CONVERSION & INITIAL REVENUE
├── Week 5: Convert Pilot #1 and #2 into annual contracts (₹90,000 ACV each)
├── Week 6: Package Pilot #1 results into an anonymized Case Study: "How [Institute] Cut Grading Time by 65%"
├── Week 7: Launch referral campaign to neighboring institutes using the Case Study
└── Week 8: Sign 3 new pilots; cross ₹2,50,000 in booked annual contract value

DAY 61 - 90: SCALE TO 10 PAYING INSTITUTES (BREAK-EVEN)
├── Week 9: Standardize scanner onboarding guide and teacher video walkthroughs
├── Week 10: Convert 3 active pilots; sign 2 direct enterprise coaching centers
├── Week 11: Implement customer billing dashboard & self-serve plan upgrades
└── Week 12: Reach 10 active paying institutes (4,000+ enrolled students, ~₹10,00,000 ARR)
```

---

## 7. Immediate Resource Allocation (Founder vs Hired)

To preserve cash runway and reach break-even quickly:

| Activity | Execution Owner | Weekly Hours | Monthly Budget |
| :--- | :--- | :---: | :---: |
| **Product Demos & Direct Sales** | Founder | 20 Hours | — |
| **On-Site Pilot Setup & Scanning Support** | Founder | 15 Hours | ₹5,000 (Travel) |
| **Core Engineering & Razorpay Integration** | Existing Dev / Founder | 15 Hours | — |
| **Part-Time Customer Success / Data Prep** | 1 Student Intern / Junior Exec | 20 Hours | ₹12,000 |
| **Targeted Outreach / LinkedIn Sales Nav** | Founder / Automated Tools | 5 Hours | ₹8,000 |
| **TOTAL MONTHLY GTM BUDGET** | — | — | **₹25,000 / month** |

