# Data automation schedules

The scheduling source for events/rankings and fighter updates is cron-job.org.
GitHub Actions still executes the scripts via workflow_dispatch on main.
All times below use Europe/Madrid (including daylight saving changes).

| Job | Schedule | cron-job.org ID | Workflow |
| --- | --- | --- | --- |
| Rumors and official confirmations | Every hour, minute 0 | 8616997 | rumor-sync.yml |
| Events, results and official rankings | 02:17 and 14:17 | 8620496 | ufc-events.yml |
| Fighter records and statistics | 11:47 daily | 8620521 | fighter-records.yml |

Requests use POST to the repository workflow dispatch endpoint with body
`{"ref":"main"}`. Authentication is stored only in cron-job.org, never here.
The existing GitHub token must be renewed before its expiry (9 November 2026).

Events and fighters no longer have a second GitHub cron schedule, preventing
duplicate scheduled API calls. Manual and configured push triggers remain.
Rumors retain their GitHub backup checks; their hourly guard avoids repeat searches.
Official rumor confirmations are also checked inside the hourly rumor workflow.

GitHub must still accept and execute each dispatch: an HTTP 204 confirms acceptance,
not successful completion. Check Actions logs as well as cron-job.org history.

Fighter updates still require a completed card, complete results and at least
24 hours since event start. Unchanged official records are retried later.
Only registered fighters are updated. The ten main-card fighters for 10 October
2026 are covered by tests/test-october-10-card.mjs; prelim coverage is not implied.
