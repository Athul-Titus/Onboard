# Git Branching and Release Flow

> **Sample Data**: This document is synthetic sample documentation created for OnboardOS multi-agent orchestrator evaluation and demonstration.

## Branching Strategy
We adhere to **Trunk-Based Development**:
- `main` is our production-ready trunk.
- Feature branches branch directly off `main` with naming convention:
  `feat/<ticket-id>-short-description` or `fix/<ticket-id>-short-description`.
- Long-lived feature branches are strongly discouraged. Break large initiatives down into incremental pull requests shielded by feature flags.

## Feature Flags
We use LaunchDarkly for progressive rollouts:
- Wrap risky new behaviors in a feature flag before merging to `main`.
- Gradually increase rollout percentage (e.g. 5% -> 25% -> 100%) while observing error metrics and latency dashboards in Datadog.

## Deployment Pipeline
- Merging to `main` triggers automated build and deployment to the `staging` environment.
- Production releases occur twice daily (11:00 AM PST and 3:00 PM PST) via automated canary deployment after staging health checks pass.
