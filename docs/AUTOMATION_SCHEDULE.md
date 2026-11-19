# Data automation schedules

All local times use Europe/Madrid (including daylight saving changes).

| Job | Schedule | Trigger |
| --- | --- | --- |
| Events, results, rankings, fighter records and statistics | 08:00 and 14:00 | GitHub Actions, `ufc-events.yml` |
| Conditional post-event retry | 10:07, 11:07, 12:07 and 13:07 (allowed window 10:00–14:00) | GitHub Actions, `morning-retry.yml`, plus completed rumor runs |
| Rumors and official confirmations | Every hour, minute 0 | cron-job.org (8616997) and GitHub backup, `rumor-sync.yml` |
| Legacy fighter dispatch (job skipped without full_refresh) | 11:47 daily | cron-job.org (8620521), `fighter-records.yml` |

The events schedule runs on the default branch. It reads the public UFC calendar
and the official event pages, uses no paid API and does not need a dispatch token.
Legacy cron-job.org events schedules (8620496 and 8625854) can be switched off
if still enabled. Manual and configured push triggers remain. GitHub may delay
scheduled runs; check the actual run and the saved verification timestamps. The health
check warns if Actions has no scheduled run recorded since the latest Madrid
slot after a 90-minute grace period. It reports queued runs, failed attempts
and partial data separately; a push or manual run does not prove the schedule.

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
