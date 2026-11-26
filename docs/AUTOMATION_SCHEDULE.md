# Data automation schedules

All local times use Europe/Madrid (including daylight saving changes).

| Job | Schedule | Trigger |
| --- | --- | --- |
| Events, results, rankings, fighter records and statistics | 08:00 and 14:00 | cron-job.org (8620496, 8625854) and GitHub schedule backup, `ufc-events.yml` |
| Conditional post-event retry | 10:10 and 12:10 (allowed window 10:00–14:00) | cron-job.org (8942435), GitHub schedule backup at 10:07–13:07 and completed rumor runs, `morning-retry.yml` |
| Data health check | 09:45 and 15:45, plus every 3 hours at minute 43 | cron-job.org (8942437) and GitHub schedule backup, `data-health.yml` |
| Encrypted backup of accounts and Pick'em | Sundays 04:23 | cron-job.org (8949663) and GitHub schedule backup, `backup.yml` |
| Weekly review of errors, data and backups | Mondays 08:32 | Claude Code scheduled task, reports to the owner |
| Site uptime check | Every 15 minutes | cron-job.org (8942439) requests `/api/health/full` (database readable and writable, at least 50 MB free on the data disk) and emails on failure |
| Rumors and official confirmations | Every hour, minute 0 (paused while TwitterAPI.io is inactive) | cron-job.org (8616997, disabled) and GitHub backup, `rumor-sync.yml` |

cron-job.org is the primary trigger for the events workflow: GitHub's native
schedule often fires hours late or not at all on this repository (in November
2026 the 08:00 slot never ran). Its jobs 8620496 and 8625854 call the
`workflow_dispatch` endpoint with a fine-grained GitHub token limited to this
repository and the Actions read/write permission. When that token expires, the
jobs fail with HTTP 401: create a new one with the same scope and replace the
`Authorization: Bearer …` header in every dispatch job. The native schedule stays as a
backup; the workflow's concurrency group prevents overlapping runs.

Every cron-job.org job emails its owner on failure, so an expired token (HTTP
401) or a site outage is noticed the same day. The dispatch jobs share the same
token; renew it in jobs 8620496, 8625854, 8942435, 8942437 and 8949663.

The legacy fighter dispatch (8620521) was disabled on 25 November 2026: the
workflow skipped it without `full_refresh`, and records are already refreshed in
the events workflow. Manual and configured push triggers remain. The health
check warns if Actions has no scheduled or dispatched run recorded since the
latest Madrid slot after a 90-minute grace period. It reports queued runs,
failed attempts and partial data separately; a push run does not prove the schedule.
The main sync publishes every source together in one commit, including the
recorded status of any failed source. A source failure does not block the other
sync stages; it is reported as a workflow failure after publishing the valid data.

Rumors retain their hourly guard against repeat paid searches. If retaining the
external rumors trigger, its GitHub credential must be kept valid.

Fighter updates run after the cards in the same workflow. They require a completed
card and a result for each selected bout, without a 24-hour wait. Cards from the
last 14 days are checked again even when processed; unchanged records no longer
block statistics. Full manual refresh uses full_refresh=true in fighter-records.yml.
Only registered fighters are updated. The ten main-card fighters for 10 October
2026 are covered by tests/test-october-10-card.mjs; preliminary participants are updated only when they already have a registered profile. Cards now include all available sections.

Rumor searches overlap the configured last 24 hours even after a successful hourly search, to recover delayed search indexing. The same-hour guard and maximum three paid pages remain. Keywords include possible/potential/rumored/booked/matchup. Logs and the separate accounting ledger retain collection counts and query time bounds, with no post texts or credentials. HTTP-200 provider error payloads do not advance the public search time. An empty response is distinguished from candidates rejected by the publication filter.

The public “Estado de los datos” panel checks the saved feeds every five minutes.
It labels rumor snapshots older than 90 minutes and daily snapshots older than
20 hours as delayed, and reports pending fighter/photo failures separately.
These are freshness checks, not a claim that a workflow succeeded or the upstream
source changed. A feed request failure is displayed as unable to check; previous
consultation dates remain visible. Rumor runs publish received-post and added-group
counts without exposing post bodies, API keys or accounting data.
