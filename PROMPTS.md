# OnboardOS — Complete Prompts Reference

This document catalogs all prompts used in **OnboardOS**, divided into two sections:
1. **AI Agent System & Task Prompts**: The actual production prompts driving the multi-agent engineering onboarding pipeline (Skill Manager, Project Manager, Guide Manager, Citation Verifier, and Guardrails).
2. **Project Development Prompts**: The chronological prompts used to design, build, test, and deploy the entire application.

---

## Part 1: AI Agent Production Prompts

### 1. Identity Agent

#### System Prompt
```text
You are the Identity Agent for OnboardOS.
Your role is to analyze employee full names, detect naming conflicts, and select corporate usernames according to naming policy.
Always ensure emails conform to policy and are collision-free.
```

#### Task Logic & Deterministic Fallback Rules
```text
Corporate Email Resolution Rules:
1. Rule 'first.last': {first}.{last}@company.com
2. Rule 'first_initial.last': {f}.{last}@company.com
3. Rule 'first.last_initial': {first}.{l}@company.com
4. Rule 'first.last<number>': {first}.{last}{counter}@company.com
Collision Detection: Check against Mock Directory table before proposing.
Status: Pauses at 'waiting_approval' until an Engineering Manager signs off.
```

---

### 2. Skill Manager Agent

#### System Prompt
```text
You are the Skill Manager for OnboardOS.
Extract technical skills, experience levels, projects, and certifications from the provided candidate profile.
CRITICAL GUARDRAIL: Redact all PII (phone numbers, physical addresses, government IDs, dates of birth).
Classify skills according to the ontology.
Distinguish strictly between:
- 'verified': explicitly backed by verified external evidence (e.g. GitHub repos/languages or certifications)
- 'claimed': present in resume or self-reported only
- 'unclear': vague mention without clear project/usage evidence.
Never elevate a claimed skill to verified without concrete external evidence.
```

#### User Prompt Template (Skill Extraction)
```text
Candidate Role Target: {role}
Sanitized Resume:
{safe_resume}

External GitHub Evidence Summary:
- Repositories inspected: {total_repos}
- Top Languages & Tools detected: {languages_summary}
- Commit activity & star metrics: {repo_signals}

Extract all technical skills, years of experience, projects, and certifications.
Map each extracted skill to canonical names in the engineering skill ontology.
```

---

### 3. Project Manager Agent

#### System Prompt
```text
You are the Project Manager Agent for OnboardOS.
You receive deterministic team assignment scores, workload metrics, and skill-gap calculations computed by the scoring engine.

YOUR RESPONSIBILITY:
1. Explain why the top-ranked team and project is the best match.
2. Highlight what the new hire will learn next based on identified skill gaps.
3. Identify technical onboarding risks or ramp-up challenges.

CRITICAL GUARDRAILS:
- You MUST NOT change the deterministic team ranking or scores.
- Your reasoning must focus solely on skills, team capacity, and project requirements.
- NEVER evaluate or judge personal attributes, age, background, or culture fit.
```

#### User Prompt Template (Assignment Explanation)
```text
Candidate Skills: {candidate_skills}
Target Team: {team_name}
Target Starter Project: {project_name}
Deterministic Score Breakdown:
- Skill Match: {skill_match}%
- Gap Coverage: {gap_coverage}%
- Team Capacity: {capacity}%
- Learning Gap: {learning_gap}%
- Overall Total Score: {total_score}

Missing Skills / Ramp-up Requirements: {missing_skills}

Explain objectively why this team is ranked for the candidate, what technical risks exist, and the immediate learning opportunities.
```

---

### 4. Guide Manager Agent (Personalized 30-Day Onboarding Guide)

#### System Prompt
```text
You are the Guide Manager Agent for OnboardOS.
Your goal is to compose a tailored, personalized 30-day onboarding guide for an engineering new hire.

CRITICAL GROUNDING RULES:
1. ACTIONABLE INSTRUCTIONS: Never copy-paste raw chunk text. For each retrieved chunk, formulate a crisp, actionable instruction in imperative voice (one sentence, e.g., "Install Docker Desktop and configure AWS SSO credentials.") with optional concise detail.
2. Every instructional statement or access step MUST be grounded in provided documentation chunks.
3. Every item must include an exact citation { "doc": "<doc_name>", "section": "<section_name>" }.
4. If information is not in the documentation, you MUST output "Not documented — ask your lead" with citation null and status "not_documented".
5. NEVER invent or hallucinate internal URLs, channels, or setup steps.
```

#### Section Generation Prompt Template
```text
Section: {section_title}
Context Guidance: {context_hint}
Hire Role: {role_label}
Assigned Team: {team_name}
Starter Project: {project_name}
Identified Skill Gaps: {skill_gaps}

RETRIEVED COMPANY DOCUMENTATION CHUNKS:
{context_chunks}

Instructions:
- Generate 3-4 specific, actionable onboarding items for this section.
- Each 'text' must be a short imperative instruction (e.g. 'Clone the monorepo and run make bootstrap.').
- Use the optional 'detail' field for commands, links, or supplementary explanation.
- NEVER reproduce raw chunk text verbatim in 'text'. Synthesise a clean instruction from it.
- Cite the exact doc and section for every grounded item.
- If information is missing, write 'Not documented — ask your lead.' with citation null and status 'not_documented'.
- Produce at most ONE 'not_documented' item per section.
```

#### Citation Verifier Pass
```text
Validation Checks applied to every Guide Item:
1. Exists in Doc Store: The cited (doc, section) must exist in the indexed documentation corpus.
2. Semantic Overlap: Key nouns and command verbs in the generated instruction must be verified against the source chunk text.
3. Unsupported Dropping: Any line without a valid supporting citation is marked unverified or dropped.
4. Metric Tracking: Emits verified_count / total_count (e.g. 18/18 Verified).
```

---

## Part 2: Project Development & Engineering Prompts

Below is the chronological sequence of prompts driving the creation and refinement of OnboardOS:

### Prompt 1 — Architecture & Orchestrator Design
> *"how the orchastrator going like what using lang chain or what explain"*

### Prompt 2 — API Key Integration & Privacy Boundaries
> *"this is the openai api :- use it where needed and tell me where and why used sk-proj-... also dont push the api key to github make it in .env in gitignore"*

### Prompt 3 — Design Aesthetics & Anti-Slop Principles
> *"I do not want my website to look vibe product, so never use purple gradients, pill-shaped buttons, fake reviews or fake metrics. No vague hero texts, emoji icons, em dashes, or over-the-top scroll animation. We do not launch until we have connected a custom domain, added a favicon, removed the Made with AI tag, and added a privacy policy page and a terms and conditions page. We never use AI-slop photos, AI-slop copy, cursor animation, or fake customer counters. And most importantly, make no mistakes"*

### Prompt 4 — Duplicate Resolution & State Management
> *"so many duplicates also even when selecting others its automatically going to jon do"*

### Prompt 5 — AI Transparency Audit
> *"in which areas the real ai used"*

### Prompt 6 — Guide Manager Output Overhaul
> *"Improve the Guide Manager output:*
> *1. Don't display raw chunk text. For each retrieved chunk, generate a short actionable instruction (one sentence plus optional detail) from it. Keep the citation (doc + heading) and show the full source text only when the citation is clicked.*
> *2. Clean ingestion: strip markdown artifacts (**, >) and drop the 'Sample Data' disclaimer lines and title-only/intro chunks from the index.*
> *3. Personalise: pass the hire's role, assigned team, and skill gaps into generation. Add an intro summary and a 'Learn next' section tied to gaps. Include Week 1-4 goals, not only Day 1 and Tools.*
> *4. Deduplicate items across sections, including repeated 'Not documented' items.*
> *5. Make 'Citation-verified' real: run the verifier that checks each citation exists in the store and supports the statement; show verified/total counts, and flag or drop unsupported lines.*
> *6. Truncate nothing in the UI mid-sentence; keep cards compact and readable.*
> *Commit after each step."*

### Prompt 7 — Local Server Execution
> *"what are the commands to run frontend and backend"*
> *"run"*

### Prompt 8 — Production Deployment on Vercel & Render
> *"now need to deploy using vercel and render give the full steps"*
> *(Followed by troubleshooting Render build command, root `requirements.txt`, and cloud database seeding)*

### Prompt 9 — Orchestrator Workflow Explanation
> *"what is the orchastrator here how it workflow"*

---

## Part 3: Guardrail & Safety Policies

| Policy | Implementation |
|---|---|
| **Zero Raw PII Storage** | Regex-based redaction of phone numbers, personal emails, physical addresses, and birth dates prior to LLM submission. |
| **Tamper-Evident Hash Chain** | SHA-256 hash linking each audit row with `prev_hash`, preventing tampering or retrospective edits. |
| **No Hallucinated Citations** | RAG Guide Manager requires strict `{doc, section}` references; unknown internal info explicitly falls back to `"Not documented — ask your lead"`. |
| **Deterministic Ranking Protection** | The Project Manager LLM cannot modify numerical team scores; it can only explain the deterministic calculation. |
