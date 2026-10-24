# Frontend Platform Setup

> **Sample Data**: This document is synthetic sample documentation created for OnboardOS multi-agent orchestrator evaluation and demonstration.

## Prerequisites
Frontend engineers require:
1. Node.js version 20 LTS or later (installed via `nvm` or `fnm`)
2. `pnpm` version 9+ as the corporate package manager (`npm install -g pnpm`)
3. VS Code with recommended extensions: ESLint, Prettier, Tailwind CSS IntelliSense

## Installing Dependencies and Dev Server
Clone the frontend platform repository:
```bash
git clone https://github.com/company/frontend-platform.git
cd frontend-platform
pnpm install
pnpm dev
```
The application will launch at `http://localhost:5173` with fast hot-module reloading.

## Design System and Component Explorer
We maintain a shared UI library with Tailwind CSS and Radix UI primitives.
Launch the local Storybook preview with:
```bash
pnpm storybook
```
Storybook runs at `http://localhost:6006` showcasing buttons, modals, input forms, and badge components.

## Linting and Code Formatting
Ensure all changes conform to style standards:
```bash
pnpm lint --fix
pnpm prettier --write .
```
Pre-commit git hooks automatically check TypeScript compilation before commits are accepted.
