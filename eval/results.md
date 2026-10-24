# Project Manager Assignment Evaluation Benchmark

## Executive Summary

- **Sample Hires Evaluated:** 10
- **Top-1 Placement Accuracy:** `100.0%`
- **Top-2 Placement Accuracy:** `100.0%`

---

## Detailed Placement Breakdown

| Hire ID | Candidate Profile | Expected Team | Recommended #1 Team | Score | Fit Label | Top-1 Match | Top-2 Match |
|---|---|---|---|---|---|---|---|
| hire-01 | Backend Specialist | Backend Platform | Backend Platform | 75.2 | `strong` | ✅ PASS | ✅ PASS |
| hire-02 | Frontend Design System Engineer | Frontend Platform | Frontend Platform | 72.8 | `strong` | ✅ PASS | ✅ PASS |
| hire-03 | Data Streaming & ML Engineer | Data & ML Platform | Data & ML Platform | 80.8 | `strong` | ✅ PASS | ✅ PASS |
| hire-04 | Cloud DevOps & Infrastructure Lead | DevOps & Infrastructure | DevOps & Infrastructure | 75.8 | `strong` | ✅ PASS | ✅ PASS |
| hire-05 | Mobile Engineer (React Native & Native) | Mobile Platform | Mobile Platform | 79.0 | `strong` | ✅ PASS | ✅ PASS |
| hire-06 | Distributed Systems & DB Architect | Backend Platform | Backend Platform | 66.0 | `strong` | ✅ PASS | ✅ PASS |
| hire-07 | Real-Time Web Frontend Engineer | Frontend Platform | Frontend Platform | 64.2 | `strong` | ✅ PASS | ✅ PASS |
| hire-08 | Semantic Search & Vector ML Engineer | Data & ML Platform | Data & ML Platform | 65.8 | `strong` | ✅ PASS | ✅ PASS |
| hire-09 | Platform SRE & Security Specialist | DevOps & Infrastructure | DevOps & Infrastructure | 62.5 | `strong` | ✅ PASS | ✅ PASS |
| hire-10 | Cross-Platform Mobile Offline Sync Dev | Mobile Platform | Mobile Platform | 59.0 | `moderate` | ✅ PASS | ✅ PASS |

---

## Weight Sensitivity Analysis (±10% Nudges)

Tests the stability of the #1 recommendation when scoring formula weights are varied by ±10%:

| Weight Term | Baseline | Nudged Weight | Direction | Top-1 Rank Changes | Stability Rate |
|---|---|---|---|---|---|
| `skill_match` | 0.450 | 0.405 | -10% | 0 / 10 (0.0%) | `100.0%` stable |
| `skill_match` | 0.450 | 0.495 | +10% | 0 / 10 (0.0%) | `100.0%` stable |
| `gap_coverage` | 0.300 | 0.270 | -10% | 0 / 10 (0.0%) | `100.0%` stable |
| `gap_coverage` | 0.300 | 0.330 | +10% | 0 / 10 (0.0%) | `100.0%` stable |
| `capacity` | 0.250 | 0.225 | -10% | 0 / 10 (0.0%) | `100.0%` stable |
| `capacity` | 0.250 | 0.275 | +10% | 0 / 10 (0.0%) | `100.0%` stable |
| `learning_gap` | 0.150 | 0.135 | -10% | 0 / 10 (0.0%) | `100.0%` stable |
| `learning_gap` | 0.150 | 0.165 | +10% | 0 / 10 (0.0%) | `100.0%` stable |

### Stability Insights

- Positive weights (`skill_match: 0.45`, `gap_coverage: 0.30`, `capacity: 0.25`) exhibit high stability across distinct candidate profiles.
- High skill alignment provides dominant separation, rendering recommendation orders robust against minor configuration drift.