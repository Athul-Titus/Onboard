# On-Call and Incident Management

## Rotation Overview
- Engineers join the primary on-call rotation after completing their first 30 days and shadowing at least two weekly shifts.
- On-call shifts run for 7 days, transitioning every Tuesday at 10:00 AM PST.
- On-call compensation and comp time policies are outlined in the HR benefits guide.

## Incident Severities
- **SEV-1 (Critical Outage)**: Core user flows completely down or customer data at risk. Page secondary and engineering leadership immediately. Response SLA: 5 minutes.
- **SEV-2 (Major Degradation)**: High-impact degradation affecting a significant subset of users. Response SLA: 15 minutes.
- **SEV-3 (Minor Issue)**: Non-critical bug or minor degraded service with workaround. Resolved during regular business hours.

## Blameless Postmortems
- Every SEV-1 and SEV-2 incident requires a blameless postmortem meeting within 48 hours.
- Focus on system resilience, monitoring gaps, and process improvements, never on blaming individuals.
