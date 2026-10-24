# Code Review and Pull Request Guidelines

> **Sample Data**: This document is synthetic sample documentation created for OnboardOS multi-agent orchestrator evaluation and demonstration.

## Pull Request Hygiene
- Keep PRs small and focused (recommended under 300 lines of changes). Smaller PRs receive faster reviews and introduce fewer bugs.
- Always link the corresponding Jira/Linear issue ticket in the PR description.
- Include a clear summary explaining:
  1. What change was made.
  2. Why the change was necessary.
  3. How you tested the change (including screenshots for UI changes).

## Review Requirements
- Every PR requires at least **two approving reviews** from peer engineers on the owning team before merging.
- All automated CI checks (linters, type checks, unit tests, security scans) must pass completely green.
- If architectural patterns or shared schemas are being modified, request a review from a Staff Engineer or Tech Lead.

## Constructive Review Culture
- Code reviews are a tool for collective learning, not gatekeeping.
- Prefix comments with tags like `[nit]`, `[suggestion]`, or `[blocking]` to clarify priority.
- Praise elegant code and good documentation as readily as pointing out bugs.
