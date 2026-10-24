# OnboardOS 🚀
## Comprehensive System Architecture, Rationale, and Technical Specification

> **Autonomous Multi-Agent Employee Onboarding & Placement Orchestrator for Engineering Teams**  
> *Hackathon Track: AI for Developers*

---

## 📑 Table of Contents
1. [Executive Summary & The "Why"](#1-executive-summary--the-why)
2. [High-Level Architecture & Multi-Agent Pipeline](#2-high-level-architecture--multi-agent-pipeline)
3. [Deep-Dive: The 4 Autonomous Agents](#3-deep-dive-the-4-autonomous-agents)
   - [3.1 Identity Agent (Corporate Account Provisioning & Collision Detection)](#31-identity-agent)
   - [3.2 Skill Manager Agent (PII Redaction, Ontology & GitHub Evidence)](#32-skill-manager-agent)
   - [3.3 Project Manager Agent (Deterministic Mathematical Placement)](#33-project-manager-agent)
   - [3.4 Guide Manager Agent (Hybrid RAG & Grounded 30-Day Guide)](#34-guide-manager-agent)
4. [Guardrails, Privacy & Safety Architecture](#4-guardrails-privacy--safety-architecture)
   - [4.1 Local PII Sanitization](#41-local-pii-sanitization)
   - [4.2 Cryptographic Audit Logging (SHA-256 Hash Chaining)](#42-cryptographic-audit-logging)
   - [4.3 Human-in-the-Loop (HITL) Approval Gates](#43-human-in-the-loop-hitl-approval-gates)
   - [4.4 Anti-Hallucination Citation Grounding](#44-anti-hallucination-citation-grounding)
5. [Data Foundations & Seed Engineering Infrastructure](#5-data-foundations--seed-engineering-infrastructure)
6. [Evaluation Benchmark Suite & Results](#6-evaluation-benchmark-suite--results)
7. [Full Tech Stack & Codebase Structure](#7-full-tech-stack--codebase-structure)
8. [Step-by-Step Execution Guide](#8-step-by-step-execution-guide)

---

## 1. Executive Summary & The "Why"

### 1.1 The Industry Problem
When an engineering new hire joins an organization, the onboarding process is typically:
- **Fragmented**: Siloed across HR platforms, Jira, IT ticket queues, Slack channels, and stale Confluence wikis.
- **Error-Prone**: Corporate email and username collisions are manually handled or stall IT tickets.
- **Subjective & Opaque**: Team placement is frequently decided by ad-hoc managerial hunches rather than empirical skill overlap, team capacity, and existing technology gaps.
- **Security & Privacy Risks**: Resumes containing personal phone numbers, physical home addresses, and personal email addresses are often sent unfiltered into commercial cloud LLMs.
- **Unverified Claims**: Candidates frequently state proficiencies on resumes that lack demonstrable evidence in code or projects.
- **Hallucinatory Guides**: When AI is used to produce onboarding checklists, generic LLMs hallucinate internal toolchains, non-existent repo names, or outdated deployment procedures.

### 1.2 The OnboardOS Solution
**OnboardOS** automates the entire developer intake lifecycle from a single trigger:
$$\text{Candidate Resume} + \text{Target Role} + \text{Start Date} + \text{Optional GitHub Handle}$$

In response, an orchestrated team of 4 autonomous agents executes a deterministic, evidence-backed workflow producing a personalized, manager-approved onboarding dossier:
1. **Collision-free identity proposal** compliant with company naming policies.
2. **PII-sanitized skill map** normalized to an 80+ engineering skill ontology and backed by live GitHub repository analysis.
3. **Mathematically scored team placement** balancing skill match, gap coverage, team load, and learning ramp-up.
4. **100% doc-grounded 30-day onboarding guide** citing verified company markdown documentation with strict fallback to `"Not documented - ask your lead"` for unverified items.
5. **Two Human-in-the-Loop approval checkpoints** with immutable, tamper-evident SHA-256 cryptographic audit logs.

---

## 2. High-Level Architecture & Multi-Agent Pipeline

```
                                  +---------------------------------------+
                                  |            NEW HIRE INTAKE            |
                                  |  (Resume PDF/DOCX/TXT + GitHub Handle)|
                                  +-------------------+-------------------+
                                                      |
                          +---------------------------+---------------------------+
                          |                                                       |
                          v                                                       v
            +---------------------------+                           +---------------------------+
            |      IDENTITY AGENT       |                           |       SKILL MANAGER       |
            | - Ordered naming policy   |                           | - Local PII redaction     |
            | - Directory collision     |                           | - 80-skill ontology norm  |
            | - Fallback rule ladder    |                           | - Live GitHub code checks |
            +-------------+-------------+                           +-------------+-------------+
                          |                                                       |
                          v [Approval Gate 1]                                     v
            +---------------------------+                           +---------------------------+
            |    Corporate Account      |                           |      PROJECT MANAGER      |
            |    Provisioning Sign-off  |                           | - Deterministic Formula   |
            +---------------------------+                           | - Gap coverage analysis   |
                                                                    | - Strategic LLM rationale |
                                                                    +-------------+-------------+
                                                                                  |
                                                                                  v [Approval Gate 2]
                                                                    +---------------------------+
                                                                    |   Team & Project Placement|
                                                                    |    (Approve or Override)  |
                                                                    +-------------+-------------+
                                                                                  |
                                                                                  v
                                                                    +---------------------------+
                                                                    |       GUIDE MANAGER       |
                                                                    | - Hybrid RAG (BM25 + RRF) |
                                                                    | - 16 Company handbook docs|
                                                                    | - Verifier safety pass    |
                                                                    +---------------------------+
```

---

## 3. Deep-Dive: The 4 Autonomous Agents

### 3.1 Identity Agent
*Source: `backend/app/agents/identity_agent.py`*

#### Purpose
Eliminate manual IT provisioning tickets and naming collisions by dynamically evaluating ordered corporate directory policies against a mock directory database (`MockDirectoryUser`).

#### Algorithmic Execution
1. **Name Normalization**: Sanitizes input strings and extracts first name, last name, and initials.
2. **Sequential Policy Traversal**: Iterates through `naming_policy.json`:
   - **Rule 1 (`first_initial_last`)**: e.g., `jdoe@company.com`
   - **Rule 2 (`first_dot_last`)**: e.g., `john.doe@company.com`
   - **Rule 3 (`first_last_initial`)**: e.g., `johnd@company.com`
   - **Rule 4 (`last_first_initial`)**: e.g., `doej@company.com`
3. **Collision Detection**: For each candidate pair, queries `check_email_available()` and `check_username_available()`.
4. **Collision Logging**: If taken, an audit log of type `failure_recovery` is logged recording the collision reason and advancing to the next rule.
5. **Fallback Recovery**: If all 4 rules collide, generates a collision-free randomized suffix: `{first}.{last}{100..999}@company.com`.
6. **Approval Gate 1**: The proposal enters `waiting_approval` status. Only when an engineering manager approves (or edits) the handle is `create_account()` invoked.

---

### 3.2 Skill Manager Agent
*Source: `backend/app/agents/skill_manager.py`*

#### Purpose
Extract technical proficiencies from resumes, normalize them to standard industry terminology, cross-reference them with live GitHub code evidence, and compute team gap analysis.

#### Algorithmic Execution
1. **Pre-LLM PII Redaction**:
   - Executes regex sanitization stripping phone numbers, personal emails (Gmail, Yahoo, Proton, etc.), physical street addresses, and dates of birth.
   - Computes a `RedactionSummary` (counts and types removed) before any string enters the LLM prompt.
2. **Structured Skill Extraction**:
   - Passes redacted text to `LLMClient` with a strict Pydantic JSON schema (`RawExtractedSkills`) enforcing extraction of:
     - Canonical skill names
     - Years of professional experience
     - Key project titles
     - Professional certifications
3. **Ontology Normalization** (`backend/app/tools/ontology.py`):
   - Compares raw extracted skill tokens against an 80+ engineering skill ontology (`skills_ontology.json`).
   - Normalizes aliases (e.g., `postgres` $\rightarrow$ `PostgreSQL`, `k8s` $\rightarrow$ `Kubernetes`, `react.js` $\rightarrow$ `React`, `aws lambda` $\rightarrow$ `AWS`).
4. **Live GitHub Portfolio Evidence Verification** (`backend/app/tools/github_tool.py`):
   - If a GitHub handle is supplied, fetches candidate repositories via the GitHub REST API.
   - Evaluates repo languages, commit frequency, repo stars, and checks for automated test files (e.g., `test_*.py`, `*.spec.ts`, `jest`, `pytest`).
5. **Tri-State Evidence Badging**:
   - `Verified`: Supported by public repository code, test suites, or verified certifications.
   - `Claimed`: Mentioned in resume text without external code proof.
   - `Unclear`: Ambiguous acronyms or unverified claims.
6. **Team Gap Analysis**:
   - Cross-checks candidate skills against the `required_skills` of all 5 engineering teams, computing `matched_skills`, `missing_skills`, and percentage coverage.

---

### 3.3 Project Manager Agent
*Source: `backend/app/agents/project_manager.py`, `backend/app/tools/scoring.py`*

#### Purpose
Determine the optimal engineering team and project placement using an objective, deterministic mathematical scoring formula, complemented by an LLM-generated strategic rationale.

#### Deterministic Placement Formula
For every engineering team $T$, the placement score $S(T) \in [0.0, 1.0]$ is computed as:

$$S(T) = w_1 \cdot \text{SkillMatch} + w_2 \cdot \text{GapCoverage} + w_3 \cdot \text{Capacity} - w_4 \cdot \text{LearningGap}$$

Where:
- **$\text{SkillMatch} = \frac{|\text{Candidate Skills} \cap \text{Team Required Skills}|}{|\text{Team Required Skills}|}$** (Weight $w_1 = 0.40$)
- **$\text{GapCoverage} = \frac{|\text{Candidate Skills} \cap \text{Team Required Skills}|}{\max(1, |\text{Candidate Skills}|)}$** (Weight $w_2 = 0.25$)
- **$\text{Capacity} = \frac{\max(0, \text{Capacity} - \text{CurrentLoad})}{\text{Capacity}}$** (Weight $w_3 = 0.20$)
- **$\text{LearningGap} = \frac{|\text{Team Required Skills} \setminus \text{Candidate Skills}|}{|\text{Team Required Skills}|}$** (Weight $w_4 = 0.15$)

#### Strategic LLM Rationale
- The deterministic algorithm ranks the top 3 team candidates.
- The top candidate is enriched by `LLMClient` generating a concise strategic rationale explaining why the candidate excels in that domain and outlining an immediate high-impact starter project.
- **Approval Gate 2**: Placed in `waiting_approval`. Managers can click **Approve** or **Override** with any other team in the directory.

---

### 3.4 Guide Manager Agent
*Source: `backend/app/agents/guide_manager.py`, `backend/app/tools/retrieval.py`*

#### Purpose
Produce a personalized, practical 30-day onboarding guide divided into actionable milestones, citing verified company documentation.

#### Hybrid RAG Architecture
1. **Document Ingestion**:
   - Chunks 16 company handbook documents (`backend/app/data/docs/*.md`) by structural markdown headings.
   - Cleans formatting, stripping code block noise while preserving actionable configuration commands.
2. **Dense + Sparse Hybrid Search**:
   - **Sparse Retrieval**: BM25Okapi (`rank_bm25`) indexing term-level keywords (CLI commands, tool names, environment variables).
   - **Dense Retrieval**: TF-IDF / Dense embedding cosine similarity capturing semantic intent.
3. **Reciprocal Rank Fusion (RRF)**:
   Combines rank positions from sparse and dense lists:
   $$\text{RRF Score}(d) = \sum_{m \in \{\text{BM25}, \text{Dense}\}} \frac{1}{60 + \text{rank}_m(d)}$$
4. **Structured Guide Sections**:
   - **Day 1 Setup**: Local virtual environment, package manager, database connection, secret keys.
   - **Tools & Access**: 1Password vault, 2FA/MFA enrollment, VPN, Slack channels, Jira boards.
   - **People to Meet**: Engineering Manager, Tech Lead, Onboarding Buddy.
   - **Week 1–4 Goals**: First PR, code review expectations, deployment protocols, on-call shadow rotation.
   - **Ramp-Up Plan**: Tailored tutorials targeting the candidate's specific identified skill gaps.
5. **Anti-Hallucination & Verifier Pass**:
   - Every guide bullet point must cite a valid `document` filename and `section` header.
   - If documentation is missing, the system strictly outputs:  
     `"Not documented - ask your lead"`
   - A deterministic Verifier pass checks every cited section against the in-memory document corpus, calculating `verified_count` and `total_count`.

---

## 4. Guardrails, Privacy & Safety Architecture

```
+-------------------------------------------------------------------------------+
|                             SAFETY & PRIVACY SHIELD                            |
+-------------------------------------------------------------------------------+
|  1. Local PII Sanitization        -> No personal email/phone/address sent to  |
|                                      external LLMs.                           |
|  2. Cryptographic Audit Chain     -> Tamper-evident SHA-256 hash log.         |
|  3. Human Approval Gates          -> No auto-creation of emails or placements.|
|  4. Grounding Verifier            -> Hallucinated instructions disallowed.    |
|  5. No Hiring Judgments           -> Evaluates technical match only.          |
+-------------------------------------------------------------------------------+
```

### 4.1 Local PII Sanitization
*Source: `skill_manager.redact_pii_with_summary()`*
- Executed locally in Python memory before any LLM prompt formatting.
- Phone numbers replaced with `[PHONE REDACTED]`.
- Personal emails (e.g., `@gmail.com`) replaced with `[EMAIL REDACTED]`.
- Street addresses replaced with `[ADDRESS REDACTED]`.
- Dates of birth replaced with `[DOB REDACTED]`.
- Audit logs only record the **count and categories** removed, never the underlying personal data.

### 4.2 Cryptographic Audit Logging
*Source: `backend/app/orchestrator.py`*
- Every agent invocation, tool execution, collision recovery, and manager approval produces an immutable `AuditLogModel` entry.
- Uses SHA-256 hash chaining:
  $$\text{Hash}_i = \text{SHA256}(\text{Hash}_{i-1} \parallel \text{EmployeeID} \parallel \text{Timestamp} \parallel \text{Agent} \parallel \text{Action} \parallel \dots)$$
- Guarantees complete chronological transparency and prevents silent tampering with onboarding records.

### 4.3 Human-in-the-Loop (HITL) Approval Gates
- **Gate 1 (Corporate Identity)**: The Identity Agent proposes the email/username. The system will not provision directory accounts until human manager approval.
- **Gate 2 (Team & Project Placement)**: The Project Manager scores the teams and presents the top recommendation. The manager can approve or override the placement with an alternative team.

### 4.4 Anti-Hallucination Citation Grounding
- Guide instructions without explicit source citations are strictly assigned `"Not documented - ask your lead"`.
- Each citation includes document name, section, and the exact supporting excerpt for instant verification in the UI.

---

## 5. Data Foundations & Seed Engineering Infrastructure

### 5.1 Engineering Teams (`teams.json`)
1. **Backend Platform**: Required skills: Python, FastAPI, PostgreSQL, Redis, Docker, REST APIs, Microservices Architecture.
2. **Frontend Platform**: Required skills: TypeScript, React, TailwindCSS, Next.js, WebSockets, State Management.
3. **Data & ML Platform**: Required skills: Python, PyTorch, Kafka, Spark, SQL, ChromaDB, Vector Embeddings.
4. **DevOps & Infrastructure**: Required skills: Kubernetes, Terraform, AWS, Docker, CI/CD, Linux, Prometheus.
5. **Mobile Platform**: Required skills: React Native, TypeScript, iOS / Swift, Android / Kotlin, Mobile Architecture.

### 5.2 Projects (`projects.json`)
Includes active initiatives such as *Real-time Event Streaming Engine*, *Design System V2*, *RAG Semantic Search Platform*, *Multi-Region Kubernetes Migration*, and *Mobile Offline Sync*.

### 5.3 Skills Ontology (`skills_ontology.json`)
Over 80 canonical engineering competencies mapped across 6 categories (Languages, Frameworks, Databases, Cloud/DevOps, AI/Data, Architecture) with comprehensive alias resolution.

### 5.4 Internal Documentation Corpus (`backend/app/data/docs/`)
16 specialized markdown documents covering:
- `01_company_overview_and_engineering_values.md`
- `02_dev_env_setup_backend.md`
- `03_dev_env_setup_frontend.md`
- `04_dev_env_setup_data_ml.md`
- `05_dev_env_setup_devops.md`
- `06_dev_env_setup_mobile.md`
- `07_security_and_credentials_policy.md`
- `08_code_review_and_pr_guidelines.md`
- `09_git_branching_and_release_flow.md`
- `10_on_call_and_incident_management.md`
- `11_deployment_and_ci_cd_runbook.md`
- `12_team_backend_overview.md`
- `13_team_frontend_overview.md`
- `14_team_data_ml_overview.md`
- `15_team_devops_overview.md`
- `16_people_and_key_leads_directory.md`

---

## 6. Evaluation Benchmark Suite & Results

*Source: `backend/eval/eval_pipeline.py`*

The platform includes an automated evaluation harness verifying extraction precision, deterministic placement accuracy, and RAG retrieval fidelity across benchmark datasets:

```bash
python backend/eval/eval_pipeline.py
```

### Benchmark Results
| Metric | Benchmark Dataset | Result |
| :--- | :--- | :--- |
| **Skill Extraction Precision** | 8 Labelled Test Resumes | **91.1%** |
| **Skill Extraction Recall** | 8 Labelled Test Resumes | **100.0%** |
| **Skill Extraction F1 Score** | 8 Labelled Test Resumes | **95.3%** |
| **Top-1 Team Placement Match** | 10 Candidate Profiles | **100.0%** |
| **Top-2 Team Placement Match** | 10 Candidate Profiles | **100.0%** |
| **RAG Grounding Citation Accuracy** | 15 Company Benchmark Queries | **93.3%** |

---

## 7. Full Tech Stack & Codebase Structure

### 7.1 Technology Stack
- **Backend**: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, SQLite
- **LLM Layer**: Agnostic client supporting OpenAI (GPT-4o), Google Gemini, Anthropic Claude, and deterministic offline Mock mode
- **Retrieval Engine**: BM25Okapi (`rank_bm25`) + TF-IDF dense cosine similarity + Reciprocal Rank Fusion
- **File Parsing**: `pypdf` (PDF), `python-docx` (DOCX), UTF-8 text decoding
- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide React icons
- **State Machine**: Orchestrator with event-driven background tasks and WebSocket broadcasts

### 7.2 Directory Layout
```
vibethon_26/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── identity_agent.py      # Corporate email & collision resolution
│   │   │   ├── skill_manager.py       # PII redaction, ontology, GitHub checks
│   │   │   ├── project_manager.py     # Deterministic mathematical placement
│   │   │   └── guide_manager.py       # Hybrid RAG & 30-day guide generation
│   │   ├── data/
│   │   │   ├── docs/                  # 16 Markdown company handbook documents
│   │   │   └── seed/                  # Naming policy, ontology, teams, projects
│   │   ├── prompts/
│   │   │   └── agent_prompts.py       # Structured agent system prompts
│   │   ├── tools/
│   │   │   ├── directory.py           # Mock corporate directory & collision DB
│   │   │   ├── github_tool.py         # Live GitHub API client & repo inspector
│   │   │   ├── ontology.py            # 80-skill ontology matcher & normalizer
│   │   │   ├── retrieval.py           # BM25 + dense RRF hybrid search engine
│   │   │   └── scoring.py             # Deterministic placement scoring formula
│   │   ├── config.py                  # Pydantic settings & environment vars
│   │   ├── db.py                      # SQLAlchemy session & SQLite engine
│   │   ├── llm_client.py              # Multi-provider LLM interface with fallback
│   │   ├── main.py                    # FastAPI routes, file upload, WebSockets
│   │   ├── models.py                  # SQLAlchemy ORM models
│   │   ├── orchestrator.py            # State machine & hash-chained audit logging
│   │   └── schemas.py                 # Pydantic validation schemas
│   ├── eval/
│   │   └── eval_pipeline.py           # 3-part benchmark evaluation suite
│   └── requirements.txt               # Backend dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Single-page reactive onboarding dashboard
│   │   ├── main.jsx                   # React 19 bootstrap
│   │   └── index.css                  # Modern Tailwind CSS styling
│   ├── package.json                   # Vite & React dependencies
│   └── vite.config.js                 # Dev server configuration
├── onboardos.db                       # Local SQLite database
└── README.md                          # Quickstart & setup instructions
```

---

## 8. Step-by-Step Execution Guide

### 8.1 Backend Launch
```powershell
# Activate virtual environment
.\.venv\Scripts\activate

# Install dependencies (if needed)
pip install -r backend/requirements.txt

# Start FastAPI server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```
API Documentation: `http://localhost:8000/docs`

### 8.2 Frontend Launch
```powershell
cd frontend
npm install
npm run dev
```
Web Interface: `http://localhost:5173`

### 8.3 Running Benchmark Tests
```powershell
python backend/eval/eval_pipeline.py
```
Outputs automated test metrics for Skill Extraction, Team Assignment, and RAG Grounding Citation Accuracy.
