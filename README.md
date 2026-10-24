# OnboardOS 🚀

**Autonomous Multi-Agent Employee Onboarding & Placement Orchestrator for Engineering Teams**  
*Hackathon Track: AI for Developers*

---

## 💡 Overview

When an engineering new hire joins, onboarding is often fragmented across HR tools, stale wiki pages, and manual manager setup. **OnboardOS** transforms a single trigger—*"new hire added"*—into a transparent, multi-agent pipeline producing a complete, personalized, and manager-approved onboarding package:
1. **Corporate Identity Provisioning**: Ordered naming policy evaluation against a directory service with automated collision detection and resolution.
2. **Evidence-Backed Skill Map**: PII-redacted resume extraction normalized against an engineering ontology (~80 skills), verified with live GitHub repository and testing activity.
3. **Deterministic Team & Project Placement**: Mathematical scoring based on skill match, gap coverage, capacity, and learning ramp-up, enriched with LLM strategic rationale.
4. **Grounded 30-Day Engineering Guide**: Hybrid RAG (BM25 + Dense embeddings with Reciprocal Rank Fusion) citing verified internal company docs; unbacked instructions strictly default to `"Not documented - ask your lead"`.
5. **Human-in-the-Loop Approval Gates**: Consequential actions (account creation and team assignment) require manager review or override with an immutable audit trail.

---

## 🛠️ Architecture & Multi-Agent Flow

```
+---------------------------------------------------------------------------------+
|                                 NEW HIRE INTAKE                                 |
|                     (Resume Text / PDF + Optional GitHub)                       |
+---------------------------------------+-----------------------------------------+
                                        |
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
     +-----------------------+                    +-------------------------+
     |     IDENTITY AGENT    |                    |      SKILL MANAGER      |
     | - Naming policy rules |                    | - Strict PII redaction  |
     | - Collision detection |                    | - GitHub evidence check |
     | - Mock directory sync |                    | - Ontology normalizer   |
     +-----------+-----------+                    +------------+------------+
                 |                                             |
                 v [Approval Gate 1]                           v
     +-----------------------+                    +-------------------------+
     | Provision Corporate   |                    |    PROJECT MANAGER      |
     | Account (Email/Slack) |                    | - Deterministic scoring |
     +-----------------------+                    | - Top 3 team ranking    |
                                                  | - Strategic rationale   |
                                                  +------------+------------+
                                                               |
                                                               v [Approval Gate 2]
                                                  +-------------------------+
                                                  | Final Team Placement    |
                                                  | (Approve or Override)   |
                                                  +------------+------------+
                                                               |
                                                               v
                                                  +-------------------------+
                                                  |      GUIDE MANAGER      |
                                                  | - Hybrid RAG (BM25+RRF) |
                                                  | - Grounded citations    |
                                                  | - Verifier safety pass  |
                                                  +-------------------------+
```

---

## 📦 Tech Stack

- **Backend**: Python 3.12, FastAPI, Pydantic v2, SQLite via SQLAlchemy
- **Orchestration**: State machine with timeout guards, retries, and immutable audit logging
- **LLM Layer**: Provider-agnostic `LLMClient` with schema validation and retry feedback loops (OpenAI, Gemini, Anthropic, and deterministic Mock mode)
- **Hybrid Search**: `rank_bm25` (BM25Okapi) + dense embeddings with Reciprocal Rank Fusion
- **Frontend**: React, Vite, Tailwind CSS, Lucide icons, Dark Mode UI
- **Seed Data**: 5 engineering teams, 8 projects, 80-skill ontology, 16 markdown company docs

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.11 or 3.12
- Node.js 18+ and npm

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/Athul-Titus/Onboard.git
cd Onboard

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```
Backend API will be running at `http://localhost:8000` (Docs: `http://localhost:8000/docs`).

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Evaluation Benchmarks

Run the automated evaluation suite:
```bash
python backend/eval/eval_pipeline.py
```

### Benchmark Results
| Metric | Benchmark Dataset | Result |
| :--- | :--- | :--- |
| **Skill Extraction Precision** | 8 Labelled Test Resumes | **91.1%** |
| **Skill Extraction Recall** | 8 Labelled Test Resumes | **100.0%** |
| **Skill Extraction F1** | 8 Labelled Test Resumes | **95.3%** |
| **Top-1 Team Placement Match** | 10 Candidate Profiles | **100.0%** |
| **Top-2 Team Placement Match** | 10 Candidate Profiles | **100.0%** |
| **RAG Grounding Citation Accuracy** | 15 Company Benchmark Queries | **93.3%** |

---

## 🛡️ Guardrails & Safety Architecture

1. **Strict Citation Grounding**: Every instruction in the 30-day guide must cite an internal company document and section. Items lacking documentation explicitly default to `"Not documented - ask your lead"`.
2. **PII Redaction**: All phone numbers, street addresses, personal emails, and dates of birth are sanitized via regex before any text reaches an LLM.
3. **No Unverified Claims**: Skills without concrete evidence (GitHub repos or certifications) are strictly badged as `Claimed`.
4. **No Hiring Judgments**: Scoring only evaluates technical competencies against team capacity and project requirements.
5. **Manager Approvals**: Account creation and team placement cannot execute automatically without human sign-off.
