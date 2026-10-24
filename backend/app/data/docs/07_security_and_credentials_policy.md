# Security and Credentials Policy

> **Sample Data**: This document is synthetic sample documentation created for OnboardOS multi-agent orchestrator evaluation and demonstration.

## Password Manager & 2-Factor Authentication
- Every engineer must use corporate 1Password for secret and credential management.
- Multi-factor authentication (2FA) via hardware security key (YubiKey) or authenticator app is mandatory across all accounts (Google Workspace, GitHub, AWS, Slack). SMS 2FA is strictly forbidden.

## Secrets in Code
- **Never commit credentials**: Never check in API keys, database passwords, private keys, or `.env` files into git repositories.
- `git-secrets` and pre-commit hooks are enforced across all repositories to block commits containing high-entropy strings or private tokens.
- Use HashiCorp Vault or AWS Secrets Manager for injecting secrets dynamically in staging and production environments.

## PII Redaction and Data Privacy
- Personal Identifiable Information (PII) such as personal phone numbers, physical addresses, dates of birth, and government IDs must never be sent to external LLMs or logged in plain text.
- Any ingestion pipeline must run regex and token scrubbing prior to storage or inference.
