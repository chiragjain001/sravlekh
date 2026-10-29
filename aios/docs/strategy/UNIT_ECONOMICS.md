# AIOS / SARVLEKH — Unit Economics, Cost Structure & Financial Viability Model

**Document Version:** 1.0.0  
**Analysis Date:** October 26, 2026  
**Auditor:** SaaS Pricing, Unit Economics & FinOps Specialist  
**Exchange Rate Reference:** $1.00\text{ USD} \approx ₹84.00\text{ INR}$

---

## 1. Executive Financial Summary

A software product can be technically elegant while remaining commercially unviable. The fundamental economic question for AIOS is:

$$\textbf{Can we deliver continuous diagnostic assessment and digital answer-sheet evaluation at } ₹200 \text{ to } ₹350 \text{ per student/year while keeping direct COGS below } ₹50 \text{ to } ₹100 \text{ per student/year?}$$

### The Direct Verdict:
1. **The ₹200/student/year pricing model is VIABLE, but ONLY under strict AI provider optimization.**
2. If AIOS uses **OpenAI GPT-4o** for every handwritten answer evaluation, inference costs alone reach **₹120 to ₹250 per student/year**, obliterating gross margins and causing net operating losses.
3. If AIOS leverages **Gemini 1.5 Flash / Gemini 2.0 Flash** (supported via our `providers/gemini_adapter.py` abstraction) or local computer-vision OCR pre-filtering, inference COGS drops to **₹8 to ₹25 per student/year**, unlocking **72% to 82% gross margins**.
4. Flat infrastructure costs (Postgres, Redis, Docker compute) require a minimum threshold of **5,000 enrolled students across 10–15 institutes** to achieve platform break-even.

---

## 2. Infrastructure & Operating Cost Drivers

### 2.1 Fixed Infrastructure (Shared Multi-Tenant Baseline)

The baseline multi-tenant cluster comfortably serves up to **25,000 enrolled students** across 50 institutes before requiring horizontal database sharding.

| Component | Architecture / Provider | Specs / Sizing | Monthly Cost (USD) | Monthly Cost (INR) | Annual Cost (INR) |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Primary Relational DB** | Managed PostgreSQL (Supabase / AWS RDS) | 4 vCPU, 16 GB RAM, 250 GB NVMe Storage, Connection Pooler | $110.00 | ₹9,240 | ₹1,10,880 |
| **In-Memory Cache & Queues**| Managed Redis (Upstash / ElastiCache) | 2 GB Memory, High-Availability persistence (AOF) | $35.00 | ₹2,940 | ₹35,280 |
| **API Application Compute** | Node.js NestJS (`aios-api` 2 replicas) | 2 vCPU, 4 GB RAM per container (AWS ECS / Hetzner Cloud) | $45.00 | ₹3,780 | ₹45,360 |
| **Python Engine Compute** | FastAPI Python (`aios-python` 2 replicas) | 4 vCPU, 8 GB RAM (OpenCV, PyPDFium2, FPDF2) | $80.00 | ₹6,720 | ₹80,640 |
| **Web Frontend Compute** | Next.js SSR / Static Edge (Vercel / Cloudflare) | Edge network + Node serverless runtimes | $20.00 | ₹1,680 | ₹20,160 |
| **Observability & Error Tracking**| Sentry Team Plan + Grafana Cloud | Error tracking, queue dead-letter alerts, metrics | $30.00 | ₹2,520 | ₹30,240 |
| **Domain, DNS & Security** | Cloudflare Pro (WAF, SSL, DDoS protection) | Global CDN, edge security rules | $25.00 | ₹2,100 | ₹25,200 |
| **Automated Off-site Backups** | S3 / GCS Cold Storage + Daily Restore Drill | Cross-region daily snapshots & WAL archiving | $15.00 | ₹1,260 | ₹15,120 |
| **TOTAL FIXED INFRASTRUCTURE**| — | — | **$360.00 / mo** | **₹30,240 / mo** | **₹3,62,880 / yr** |

---

### 2.2 Variable Cost Drivers (Per-Student & Per-Exam Usage)

#### A. Document Storage (Scanned Page Images & PDFs)
- **Assumptions:** 1 standard exam booklet = 6 scanned A4 pages.
- Highly compressed grayscale/JPEG at 200 DPI = ~250 KB per page $\approx 1.5 \text{ MB}$ per booklet.
- Average student takes **12 exams per year** (coaching: 18; school: 8). Annual storage = $18 \text{ MB}$ per student/year.
- **Provider:** Cloudflare R2 / AWS S3 Standard with lifecycle archival.
- **Cost:** Cloudflare R2 charges $\$0.015 \text{ per GB/month}$ with **zero egress fees**.
- $18 \text{ MB} \times \$0.015 / 1,000 \text{ MB} \approx \$0.00027 \text{ per student/month} \approx \mathbf{₹0.27 \text{ per student/year}}$.
- *Storage cost is practically negligible.*

#### B. AI Inference & OCR Token Economics
This is the single most dangerous variable cost. Let us model the exact mathematics of evaluating a 6-question subjective test paper.

##### Model Option 1: OpenAI GPT-4o (State of the Art, High Cost)
- **Input:** Question image crop + OCR prompt + Solution rubric $\approx 1,500 \text{ tokens}$ ($1,000 \text{ image} + 500 \text{ text}$).
- **Output:** Structured JSON evaluation + justification note $\approx 400 \text{ tokens}$.
- **Pricing:** $\$2.50 / 1\text{M input tokens}$; $\$10.00 / 1\text{M output tokens}$.
- Cost per question: $(1.5 \times \$0.0025) + (0.4 \times \$0.010) = \$0.00375 + \$0.0040 = \mathbf{\$0.00775 \ (\approx ₹0.65)}$.
- Cost per 6-question exam: $6 \times ₹0.65 = \mathbf{₹3.90 \text{ per exam attempt}}$.
- Over 12 exams/year: $12 \times ₹3.90 = \mathbf{₹46.80 \text{ per student/year}}$.
- Over 20 exams/year (intensive coaching): $20 \times ₹3.90 = \mathbf{₹78.00 \text{ per student/year}}$.
- *Notice:* If a student writes 10 questions per exam across 20 tests, cost rises to **₹130/year**, consuming 65% of a ₹200 subscription.

##### Model Option 2: Google Gemini 1.5 Flash / 2.0 Flash (Recommended Production Default)
- **Pricing:** $\$0.075 / 1\text{M input tokens}$; $\$0.30 / 1\text{M output tokens}$.
- Cost per question: $(1.5 \times \$0.000075) + (0.4 \times \$0.00030) = \$0.0001125 + \$0.00012 = \mathbf{\$0.0002325 \ (\approx ₹0.0195)}$.
- Cost per 6-question exam: $6 \times ₹0.0195 = \mathbf{₹0.117 \text{ per exam attempt}}$.
- Over 12 exams/year: $12 \times ₹0.117 = \mathbf{₹1.40 \text{ per student/year}}$.
- Over 20 exams/year: $20 \times ₹0.117 = \mathbf{₹2.34 \text{ per student/year}}$.
- **FinOps Takeaway:** Switching the default evaluation model in `AIModelRegistry` from GPT-4o to Gemini Flash reduces AI evaluation costs by **97%**, dropping annual AI COGS from ₹47–₹78 down to **₹1.40–₹2.34 per student/year**.

#### C. Communication & Notification Delivery
- **In-App Notifications:** 100% free (WebSocket / database write).
- **Transactional WhatsApp API (Meta Cloud API / Gupshup):** ₹0.45 to ₹0.60 per service conversation.
- **DLT Transactional SMS (India):** ₹0.12 to ₹0.16 per 160-character SMS.
- **Policy Recommendation:** Include **In-App + Email** in base license. Pass WhatsApp/SMS through as a **prepaid messaging credit pack** purchased by the institute, ensuring zero margin dilution.

#### D. Payment Gateway Fees
- Razorpay / Cashfree: **2.0% + GST** on digital fee transactions.
- Assumed collected at annual subscription payment.

---

## 3. Financial Scenarios Across Five Institution Sizes

We model five realistic institution sizes across three distinct AI usage profiles:
- **Low AI Usage:** 6 exams/year, objective OMR auto-graded locally, only terminal exams use AI subjective evaluation.
- **Base AI Usage:** 12 exams/year (monthly tests), balanced objective + subjective evaluation using Gemini Flash.
- **High AI Usage:** 24 exams/year (bi-weekly coaching tests), full descriptive handwritten AI first-pass scoring.

### Pricing Assumptions:
- **Annual Price per Student:** **₹300 / student / year** (Base Commercial Target).
- *(Note: We explicitly test the ₹200/student baseline in §4).*

---

### Scenario A: 100 Students (Micro Coaching / Boutique Batch)
*Annual Contract Value (ACV): ₹30,000 ($357 USD)*

| Metric | Low Usage (6 Exams/yr) | Base Usage (12 Exams/yr) | High Usage (24 Exams/yr) |
| :--- | :---: | :---: | :---: |
| **Gross Annual Revenue** | **₹30,000** | **₹30,000** | **₹30,000** |
| Payment Gateway (2%) | ₹600 | ₹600 | ₹600 |
| Allocated Shared Cloud Compute | ₹3,600 | ₹3,600 | ₹3,600 |
| Storage & Bandwidth (R2) | ₹20 | ₹35 | ₹65 |
| AI Inference & OCR (Gemini Flash) | ₹120 | ₹240 | ₹480 |
| Report PDF Generation Compute | ₹150 | ₹300 | ₹600 |
| Initial Onboarding & Setup (Amortized) | ₹2,500 | ₹2,500 | ₹2,500 |
| Technical Support & Training (Labor) | ₹3,000 | ₹4,500 | ₹6,000 |
| **Total Direct COGS** | **₹9,990** | **₹11,775** | **₹13,845** |
| **Gross Profit** | **₹20,010** | **₹18,225** | **₹16,155** |
| **Gross Margin %** | **66.7%** | **60.8%** | **53.9%** |
| **COGS per Student / Year** | **₹99.90** | **₹117.75** | **₹138.45** |

*Takeaway:* Small 100-student institutes suffer from fixed support and onboarding overhead. At ₹30,000 ACV, margins are acceptable (~60%), but high hand-holding cuts profitability. **Recommendation: Minimum contract floor of ₹35,000/year regardless of student count below 150.**

---

### Scenario B: 300 Students (Typical Standalone Coaching Institute)
*Annual Contract Value (ACV): ₹90,000 ($1,071 USD)*

| Metric | Low Usage (6 Exams/yr) | Base Usage (12 Exams/yr) | High Usage (24 Exams/yr) |
| :--- | :---: | :---: | :---: |
| **Gross Annual Revenue** | **₹90,000** | **₹90,000** | **₹90,000** |
| Payment Gateway (2%) | ₹1,800 | ₹1,800 | ₹1,800 |
| Allocated Shared Cloud Compute | ₹5,400 | ₹5,400 | ₹5,400 |
| Storage & Bandwidth (R2) | ₹60 | ₹110 | ₹200 |
| AI Inference & OCR (Gemini Flash) | ₹360 | ₹720 | ₹1,440 |
| Report PDF Generation Compute | ₹450 | ₹900 | ₹1,800 |
| Initial Onboarding & Setup (Amortized) | ₹3,500 | ₹3,500 | ₹3,500 |
| Technical Support & Training (Labor) | ₹5,000 | ₹7,000 | ₹9,500 |
| **Total Direct COGS** | **₹16,570** | **₹19,430** | **₹23,640** |
| **Gross Profit** | **₹73,430** | **₹70,570** | **₹66,360** |
| **Gross Margin %** | **81.6%** | **78.4%** | **73.7%** |
| **COGS per Student / Year** | **₹55.23** | **₹64.77** | **₹78.80** |

*Takeaway:* **The sweet spot.** At 300 students, unit economics become highly attractive with gross margins near 80% and direct operating cost of ~₹65/student/year.

---

### Scenario C: 500 Students (Mid-Sized Coaching / K-10 Private School)
*Annual Contract Value (ACV): ₹1,50,000 ($1,785 USD)*

| Metric | Low Usage (6 Exams/yr) | Base Usage (12 Exams/yr) | High Usage (24 Exams/yr) |
| :--- | :---: | :---: | :---: |
| **Gross Annual Revenue** | **₹1,50,000** | **₹1,50,000** | **₹1,50,000** |
| Payment Gateway (2%) | ₹3,000 | ₹3,000 | ₹3,000 |
| Allocated Shared Cloud Compute | ₹7,200 | ₹7,200 | ₹7,200 |
| Storage & Bandwidth (R2) | ₹100 | ₹180 | ₹350 |
| AI Inference & OCR (Gemini Flash) | ₹600 | ₹1,200 | ₹2,400 |
| Report PDF Generation Compute | ₹750 | ₹1,500 | ₹3,000 |
| Initial Onboarding & Setup (Amortized) | ₹4,500 | ₹4,500 | ₹4,500 |
| Technical Support & Training (Labor) | ₹7,000 | ₹10,000 | ₹14,000 |
| **Total Direct COGS** | **₹23,150** | **₹27,580** | **₹34,450** |
| **Gross Profit** | **₹1,26,850** | **₹1,22,420** | **₹1,15,550** |
| **Gross Margin %** | **84.6%** | **81.6%** | **77.0%** |
| **COGS per Student / Year** | **₹46.30** | **₹55.16** | **₹68.90** |

---

### Scenario D: 1,000 Students (Established School / Regional Test-Prep Center)
*Annual Contract Value (ACV): ₹2,80,000 ($3,333 USD — Volume Discounted at ₹280/student)*

| Metric | Low Usage (6 Exams/yr) | Base Usage (12 Exams/yr) | High Usage (24 Exams/yr) |
| :--- | :---: | :---: | :---: |
| **Gross Annual Revenue** | **₹2,80,000** | **₹2,80,000** | **₹2,80,000** |
| Payment Gateway (2%) | ₹5,600 | ₹5,600 | ₹5,600 |
| Allocated Shared Cloud Compute | ₹12,000 | ₹12,000 | ₹12,000 |
| Storage & Bandwidth (R2) | ₹200 | ₹360 | ₹700 |
| AI Inference & OCR (Gemini Flash) | ₹1,200 | ₹2,400 | ₹4,800 |
| Report PDF Generation Compute | ₹1,500 | ₹3,000 | ₹6,000 |
| Dedicated Onboarding & Scanner Training | ₹8,000 | ₹8,000 | ₹8,000 |
| Technical Support SLA & Account Review | ₹12,000 | ₹16,000 | ₹22,000 |
| **Total Direct COGS** | **₹40,500** | **₹47,360** | **₹59,100** |
| **Gross Profit** | **₹2,39,500** | **₹2,32,640** | **₹2,20,900** |
| **Gross Margin %** | **85.5%** | **83.1%** | **78.9%** |
| **COGS per Student / Year** | **₹40.50** | **₹47.36** | **₹59.10** |

---

### Scenario E: 2,500 Students (Large School Campus / Multi-Branch Group)
*Annual Contract Value (ACV): ₹6,25,000 ($7,440 USD — Enterprise Tier at ₹250/student)*

| Metric | Low Usage (6 Exams/yr) | Base Usage (12 Exams/yr) | High Usage (24 Exams/yr) |
| :--- | :---: | :---: | :---: |
| **Gross Annual Revenue** | **₹6,25,000** | **₹6,25,000** | **₹6,25,000** |
| Payment Gateway (2%) | ₹12,500 | ₹12,500 | ₹12,500 |
| Allocated Shared Cloud Compute | ₹24,000 | ₹24,000 | ₹24,000 |
| Storage & Bandwidth (R2) | ₹500 | ₹900 | ₹1,750 |
| AI Inference & OCR (Gemini Flash) | ₹3,000 | ₹6,000 | ₹12,000 |
| Report PDF Generation Compute | ₹3,750 | ₹7,500 | ₹15,000 |
| On-Premises Scanner & Staff Training | ₹15,000 | ₹15,000 | ₹15,000 |
| Dedicated Priority Support SLA | ₹25,000 | ₹32,000 | ₹42,000 |
| **Total Direct COGS** | **₹83,750** | **₹97,900** | **₹1,22,250** |
| **Gross Profit** | **₹5,41,250** | **₹5,27,100** | **₹5,02,750** |
| **Gross Margin %** | **86.6%** | **84.3%** | **80.4%** |
| **COGS per Student / Year** | **₹33.50** | **₹39.16** | **₹48.90** |

---

## 4. Explicit Stress-Testing of the ₹200/Student/Year Hypothesis

Our business plan hypothesized a target pricing of **₹200 per student/year** and target operating cost of **₹50 to ₹100 per student/year**. Does this survive real-world stress testing?

### Stress Test Matrix (At ₹200 Annual Subscription Price)

| Student Cohort | Annual Revenue | Direct COGS (Gemini Flash) | Gross Margin % | Direct COGS (GPT-4o Vision) | Gross Margin % (GPT-4o) | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **100 Students** | ₹20,000 | ₹11,775 | **41.1%** | ₹16,455 | **17.7%** | **UNSUSTAINABLE** at 100 students (Support eats margin). |
| **300 Students** | ₹60,000 | ₹19,430 | **67.6%** | ₹33,470 | **44.2%** | **VIABLE** with Flash; tight with GPT-4o. |
| **500 Students** | ₹1,00,000 | ₹27,580 | **72.4%** | ₹51,000 | **49.0%** | **STRONG** with Flash; target ₹55 COGS achieved. |
| **1,000 Students**| ₹2,00,000 | ₹47,360 | **76.3%** | ₹94,200 | **52.9%** | **HEALTHY**; ₹47 COGS achieved. |
| **2,500 Students**| ₹5,00,000 | ₹97,900 | **80.4%** | ₹2,14,900 | **57.0%** | **HIGH SCALE**; ₹39 COGS achieved. |

### Critical Finding:
- **At 100 students:** ₹200/student yields only ₹20,000/year. Human onboarding and phone support alone cost ₹5,500, leaving just ₹8,000 net. AIOS cannot offer standalone ₹200 pricing to sub-200 student institutes.
- **Minimum Contract Floor:** To protect unit economics, AIOS must enforce a **Minimum Annual Contract Value (ACV) of ₹35,000** (covering up to 150 students). Any student beyond 150 is billed at ₹200–₹250/student/year.

---

## 5. Customer Acquisition Cost (CAC) & Payback Analysis

In B2B EdTech in India, field sales travel and long decision cycles can destroy unit economics if not strictly controlled.

| Sales Motion | Target Segment | Estimated CAC (INR) | Average ACV (INR) | CAC Payback Period | Gross Margin Contribution |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Founder-Led Direct Sales** | 300–500 student coaching centers | ₹8,000 – ₹12,000 | ₹90,000 – ₹1,50,000 | **1.2 to 1.6 Months** | Highly profitable in Year 1 |
| **Inside Sales / Remote Demo** | Multi-branch coaching centers | ₹15,000 – ₹22,000 | ₹1,50,000 – ₹2,80,000 | **1.8 to 2.4 Months** | Scalable across Tier-2/3 cities |
| **Institutional Field Sales** | Formal K-12 private schools | ₹45,000 – ₹70,000 | ₹2,80,000 – ₹6,25,000 | **3.5 to 5.2 Months** | Viable, but high sales friction |

---

## 6. Break-Even Analysis & Capital Runway Requirements

### 6.1 Fixed Platform Overhead
- **Fixed Infrastructure:** ₹3,62,880 / year (₹30,240 / month).
- **Core Engineering & Maintenance (1 Full-Time Dev / Support):** ₹7,20,000 / year (₹60,000 / month).
- **Administrative, Legal & Compliance (DPDP audit, domain, SaaS tools):** ₹1,20,000 / year (₹10,000 / month).
- **TOTAL ANNUAL FIXED OVERHEAD:** **₹12,02,880 / year (approx. ₹1,00,000 / month)**.

### 6.2 Break-Even Calculation
$$\text{Average Blended ACV} = ₹1,20,000 \quad (\approx 400 \text{ students @ } ₹300/\text{student})$$
$$\text{Average Direct COGS per Institute} = ₹25,000$$
$$\text{Contribution Margin per Institute} = ₹95,000 \quad (79.1\%)$$

$$\textbf{Break-Even Number of Institutes} = \frac{\text{Fixed Overhead}}{\text{Contribution Margin}} = \frac{₹12,02,880}{₹95,000} \approx \mathbf{12.7 \text{ Institutes}}$$

$$\textbf{Break-Even Enrolled Student Base} = 13 \times 400 \text{ students} \approx \mathbf{5,200 \text{ Students}}$$

### Strategic Conclusion:
AIOS reaches **operational cash-flow break-even at just 13 paying coaching institutes / schools (~5,200 total students)**. This is an extraordinarily low, highly achievable bar for a B2B SaaS startup.

