# OnboardOS — Hackathon Judging Q&A & Evaluation Defense

This guide prepares you for questions judges, technical evaluators, and engineering leaders will ask during demos and presentations, mapped directly to typical hackathon judging criteria.

---

## Category 1: Architecture & Technical Depth

### Q1: "Is this just a wrapper around OpenAI / LangChain? Why didn't you use LangChain / CrewAI?"
**Answer:**
> "No, we intentionally did **not** use blackbox agent frameworks like LangChain or CrewAI. In enterprise engineering operations, relying on an LLM to decide control flow leads to unpredictable loops, non-deterministic state changes, and high latency.
>
> Instead, we built a **Deterministic Finite State Machine Orchestrator** in Python/FastAPI. The orchestrator strictly controls state transitions (`queued` → `running` → `waiting_approval` → `done` / `needs_attention`). AI is used strictly as a specialized task worker inside bounded agents (e.g., extracting skills from resumes or synthesizing grounded instructions via RAG). This ensures 100% deterministic, auditable execution with predictable latency and zero hallucinated control flow."

---

### Q2: "How do your agents communicate, and how is state managed?"
**Answer:**
> "State is centralized in relational models backed by SQLAlchemy and SQLite/PostgreSQL, validated at every transition with Pydantic schemas. 
> 
> The workflow runs sequentially through 4 core agents:
> 1. **Identity Agent**: Interacts with directory APIs to resolve naming collisions.
> 2. **Skill Manager Agent**: Extracts technical capabilities and calls the GitHub API for external verification.
> 3. **Project Manager Agent**: Applies our mathematical 4-factor scoring formula to rank teams.
> 4. **Guide Manager Agent**: Runs hybrid BM25 search over internal engineering docs to generate a personalized 30-day plan.
>
> If any agent encounters an issue, it gracefully degrades to a `needs_attention` state without crashing the pipeline, allowing a human manager to review and retry."

---

### Q3: "How does your RAG system work in the Guide Manager? How do you prevent hallucinations?"
**Answer:**
> "We implement a 3-layer anti-hallucination defense:
> 1. **Clean Ingestion & Hybrid Retrieval**: We ingest internal engineering markdown docs, strip markdown noise/disclaimers, split by header sections, and rank chunks using BM25 with Reciprocal Rank Fusion (RRF).
> 2. **Strict Grounding Rules**: The LLM prompt explicitly commands: *'Every instructional statement must be cited {doc, section}. If the information does not exist in the docs, output "Not documented — ask your lead"'*. It never hallucinates internal URLs or tools.
> 3. **Post-Generation Citation Verifier**: An automated verifier inspects every generated item. It verifies that the cited document and header section genuinely exist in the knowledge index and validates semantic overlap. The UI shows the real verification metric (e.g., `18/18 Verified`) and lets users click citations to inspect the raw source text inline."

---

## Category 2: Security, Privacy & Compliance

### Q4: "Resumes contain sensitive PII. How do you handle candidate privacy before sending data to LLMs?"
**Answer:**
> "We practice **Zero-Raw-PII LLM Ingestion**:
> - Before resume text touches the database or any external LLM API, our local regex privacy engine strips **phone numbers, personal emails, physical home addresses, and dates of birth**, replacing them with tokens like `[PHONE REDACTED]`.
> - Crucially, our audit logs follow a strict privacy policy: **we never log the redacted PII values**—we record only the *counts* and *types* of PII removed (e.g., `4 items removed: phone, email`).
> - This guarantees compliance with GDPR and CCPA right at the boundary."

---

### Q5: "How do you ensure auditability? What if someone tampers with the audit logs?"
**Answer:**
> "Every agent action, tool invocation (like GitHub API calls), and manager decision is recorded in an immutable, **SHA-256 Cryptographic Hash-Chained Ledger**:
> 
> $$\text{Entry Hash} = \text{SHA256}(\text{Previous Hash} \mid \text{Employee ID} \mid \text{Timestamp} \mid \text{Agent} \mid \text{Action} \mid \text{Actor} \mid \text{Payload})$$
>
> If any row in the database is modified, inserted, or deleted out of sequence, the hash chain breaks immediately. Our frontend includes a live **Audit Verification** endpoint that scans the entire chain and displays whether it is `INTACT` or `COMPROMISED`."

---

## Category 3: Algorithmic Fairness & Human-in-the-Loop

### Q6: "How does the system decide which team a new engineer should join? Isn't that biased?"
**Answer:**
> "The team placement is **100% deterministic**—the LLM is forbidden from deciding or changing team rankings. We use a transparent, auditable formula:
> 
> $$\text{Score} = 0.40 \times \text{Skill Match} + 0.25 \times \text{Gap Coverage} + 0.20 \times \text{Capacity} - 0.15 \times \text{Learning Gap}$$
>
> - **Skill Match (40%)**: Required vs. candidate skills.
> - **Gap Coverage (25%)**: How many critical missing skills on the team this candidate fills.
> - **Capacity (20%)**: Available bandwidth on the team.
> - **Learning Gap (-15%)**: Penalty for excessive ramp-up friction.
>
> The LLM's only job is to provide natural language explanations of the risks and learning opportunities for the top candidates."

---

### Q7: "What happens if the AI recommendation is wrong or sub-optimal?"
**Answer:**
> "We enforce **Human-in-the-Loop (HITL) approval gates**:
> - Corporate email/username assignment pauses at `waiting_approval`—managers can accept or manually edit the email handle before provisioning.
> - Team placement pauses at `waiting_approval`—managers can approve the top-scored team or trigger an **Override** with a written justification.
> - Overrides are logged with the manager's identity and timestamp in the cryptographic audit trail for executive transparency."

---

## Category 4: Real-World Business Value & Impact

### Q8: "What is the ROI / business impact of OnboardOS compared to standard HR onboarding?"
**Answer:**
> "Standard developer onboarding takes **3 to 4 weeks** of lost productivity:
> 1. Waiting days for IT to resolve directory credentials and email collisions.
> 2. Guessing team placement without objective skill matching.
> 3. Senior engineers spending hours answering repetitive 'how do I set up my dev environment' questions.
>
> **OnboardOS reduces ramp-up time from weeks to Day 1**:
> - Provisions clean, collision-free identities and SSO in minutes.
> - Objectively aligns candidate skills to team needs using GitHub verification.
> - Delivers a personalized, citation-backed 30-day technical guide grounded strictly in actual company documentation."

---

## Category 5: Edge Cases & Reliability

### Q9: "What happens if the GitHub username doesn't exist or has rate limits?"
**Answer:**
> "The system degrades gracefully:
> - If a GitHub username is invalid or 404s, the Skill Manager flags the profile as `resume-only`, setting skills to `claimed` (70% confidence) rather than crashing.
> - If the GitHub API hits rate limits, the agent logs the incident in the audit ledger and proceeds using cached ontology mappings.
> - If the LLM provider times out or fails, our structured LLM client has built-in retry logic and automatic deterministic fallback factories so the workflow never stalls."

---

### Q10: "How do you evaluate and benchmark the quality of your agents?"
**Answer:**
> "We built a dedicated **Evaluation Pipeline** (`eval/eval_pipeline.py`) integrated directly into the platform:
> - Tests identity resolution collision rates across edge-case names.
> - Evaluates skill extraction precision and recall against synthetic ground-truth profiles.
> - Verifies RAG citation fidelity (ensuring 0% hallucinated sources).
> - Benchmarks audit ledger hash verification across hundreds of entries.
> 
> The UI includes an **Evaluation Benchmarks** tab that displays live accuracy scores, latency metrics, and test results."

---

## Quick Demo Pitch (60-Second Elevator Pitch)

> *"Every engineering team struggles with onboarding: it takes 3 to 4 weeks before a new developer makes their first pull request. Engineers wait days for account provisioning, managers place them on teams without clear skill-gap data, and docs are scattered everywhere.*
>
> *We built **OnboardOS**—an autonomous, multi-agent engineering onboarding orchestrator. It features an **Identity Agent** that prevents directory collisions, a **Skill Manager** that verifies real GitHub code, a **Project Manager** that deterministically scores team fit with a transparent formula, and a **Guide Manager** that synthesizes a citation-grounded 30-day technical roadmap from company documentation.*
>
> *Best of all, it has **zero raw PII exposure**, requires **manager sign-off** on key decisions, and records every step in a **SHA-256 cryptographic audit ledger**. OnboardOS turns a 3-week onboarding bottleneck into a confident, Day-1 productive experience."*
