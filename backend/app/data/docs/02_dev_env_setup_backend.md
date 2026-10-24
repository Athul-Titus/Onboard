# Backend Development Environment Setup

> **Sample Data**: This document is synthetic sample documentation created for OnboardOS multi-agent orchestrator evaluation and demonstration.

## Prerequisites
Before configuring your backend workspace, ensure you have installed:
1. Python 3.11 or Python 3.12 (managed via `pyenv` or official Windows Python installer)
2. Docker Desktop with Compose v2 enabled
3. Git and GitHub CLI (`gh auth login`)
4. PostgreSQL client CLI (`psql`)

## Repository Checkout and Virtual Environment
Clone the central backend service:
```bash
git clone https://github.com/company/backend-core.git
cd backend-core
python -m venv .venv
source .venv/bin/activate  # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Local Services with Docker Compose
Start PostgreSQL, Redis, and local mock queues with:
```bash
docker compose -f docker-compose.local.yml up -d
```
Verify databases are healthy:
- PostgreSQL listens on `localhost:5432` with user `postgres` and password `postgres_dev`.
- Redis listens on `localhost:6379`.

## Running Backend Tests
Execute unit and integration tests with coverage:
```bash
pytest --cov=app tests/
```
All pull requests require passing tests with minimum 80% line coverage before merging.
