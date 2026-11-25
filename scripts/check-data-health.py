"""Read-only alerts. Never calls a sports/search provider or changes published data."""
import importlib.util
import json
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('monitor', ROOT / 'scripts/run-data-sync.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


def hours(value, now):
    try:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if stamp.tzinfo is None:
            return None
        return (now - stamp).total_seconds() / 3600
    except (ValueError, TypeError, AttributeError):
        return None


def source_statistics_pending(feed, now):
    """Only downgrade missing source statistics after a recent verified record fetch."""
    sync = feed.get('lastSync', {})
    age = hours(sync.get('checkedAt'), now)
    pending = set(feed.get('pendingProfileIds', []))
    record_only = set(sync.get('recordOnlyIds', []))
    return (age is not None and 0 <= age <= 30 and bool(pending)
            and pending <= record_only
            and set(sync.get('failedIds', [])) <= record_only
            and not feed.get('profileReview')
            and not any(feed.get('unmatchedEventFighters', {}).values()))


def assess(state, feeds, rumors, now, warnings=None):
    alerts = []
    warnings = warnings if warnings is not None else []
    age = hours(rumors.get('lastSearchedAt'), now)
    if age is None or age > 3 or age < -1:
        alerts.append('Rumores: última búsqueda ausente, inválida o de hace más de 3 horas.')
    for kind in monitor.JOBS:
        job = state.get('jobs', {}).get(kind, {})
        feed = feeds[kind]
        stamp = (feed.get('lastSync', {}).get('checkedAt') if kind == 'records' else
                 feed.get('resultsVerification', {}).get('checkedAt') if kind == 'results' else
                 feed.get('synchronizedAt'))
        # A successful morning retry can be newer than the wrapper's last attempt.
        ages = [v for v in (hours(stamp, now), hours(job.get('lastSuccessAt'), now)) if v is not None]
        source_age = hours(stamp, now)
        attempt_age = hours(job.get('attemptedAt'), now)
        superseded = (source_age is not None and attempt_age is not None
                      and -1 <= source_age < attempt_age)
        failures = job.get('consecutiveFailures', 0)
        fresh = any(-1 <= value <= 30 for value in ages)
        status = job.get('status')
        if not fresh:
            if attempt_age is None or not -1 <= attempt_age <= 30:
                alerts.append(f'{kind}: no consta un intento reciente ni datos vigentes (margen: 30 horas).')
            elif status == 'failed' or failures:
                alerts.append(f'{kind}: el último intento falló y no hay datos vigentes.')
            else:
                alerts.append(f'{kind}: hay un intento reciente, pero no consta una actualización verificable.')
        elif not superseded:
            if failures >= 2:
                alerts.append(f'{kind}: dos o más consultas consecutivas fallidas; se conserva la última copia.')
            elif status == 'failed' or failures == 1:
                warnings.append(f'{kind}: el último intento falló; se conserva la última copia vigente.')
        pending_age = hours(job.get('pendingSince'), now)
        count = monitor.pending_count(kind, feed)
        if not count or not fresh or ((status == 'failed' or failures) and not superseded):
            continue
        if kind == 'records' and source_statistics_pending(feed, now):
            ids = ', '.join(sorted(feed['pendingProfileIds']))
            warnings.append(f'records: UFC sigue sin publicar estadísticas completas para {ids}. '
                            'Récord consultado recientemente; estadísticas previas conservadas y reintento pendiente.')
        elif pending_age is not None and pending_age > 48:
            alerts.append(f'{kind}: hay datos pendientes de forma continua desde hace más de 48 horas.')
        else:
            pending = 'queda 1 comprobación pendiente' if count == 1 else f'quedan {count} comprobaciones pendientes'
            warnings.append(f'{kind}: actualización parcial; {pending}.')
    return alerts


def repeated_failures(runs):
    # Ignore cancelled/skipped runs and preserve newest-first API ordering.
    completed = [r for r in runs if r.get('head_branch') == 'main' and
                 r.get('status') == 'completed' and r.get('conclusion') in
                 ('success', 'failure', 'timed_out', 'action_required')]
    return len(completed) >= 2 and all(r['conclusion'] != 'success' for r in completed[:2])


def schedule_warning(runs, now):
    """Check whether Actions registered the latest due Madrid slot.

    cron-job.org dispatches the slots (workflow_dispatch) and GitHub's own schedule
    is a backup, so either event counts. A push run updates the site without proving
    that a scheduler worked. Run history tells us when GitHub registered a run, not
    which slot triggered it.
    """
    local = now.astimezone(ZoneInfo('Europe/Madrid'))
    slots = [day.replace(hour=hour, minute=0, second=0, microsecond=0)
             for day in (local - timedelta(days=1), local) for hour in (8, 14)]
    due = max(slot for slot in slots if slot + timedelta(minutes=90) <= local)
    due_age = (now - due.astimezone(timezone.utc)).total_seconds() / 3600
    active = [r for r in runs if r.get('head_branch') == 'main' and r.get('event') in ('schedule', 'workflow_dispatch')
              and (age := hours(r.get('created_at'), now)) is not None
              and 0 <= age <= due_age]
    label = due.strftime('%d/%m a las %H:%M') + ' (Madrid)'
    if not active:
        return f'Carteleras: no consta una ejecución programada desde el {label} tras el margen de 90 min.'
    latest = min(active, key=lambda r: hours(r['created_at'], now))
    if latest.get('status') != 'completed':
        return f'Carteleras: la ejecución programada desde el {label} está en cola o en curso.'
    if latest.get('conclusion') != 'success':
        return f"Carteleras: la última ejecución programada desde el {label} no terminó correctamente ({latest.get('conclusion') or 'sin resultado'})."
    return None


def main():
    alerts = []
    warnings = []
    now = datetime.now(timezone.utc)
    try:
        read = lambda name: json.loads((ROOT / 'assets/data' / name).read_text())
        alerts = assess(read('sync-health.json'),
                        {kind: read(filename) for kind, (_, filename) in monitor.JOBS.items()},
                        read('ufc-rumor-groups.json'), now, warnings)
    except (OSError, ValueError, TypeError, KeyError):
        alerts.append('No se puede verificar el estado: faltan datos o el formato es inválido.')
    if os.environ.get('GITHUB_TOKEN'):
        for workflow in ('rumor-sync.yml', 'ufc-events.yml', 'fighter-records.yml'):
            url = f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}/actions/workflows/{workflow}/runs?branch=main&per_page=20"
            try:
                request = Request(url, headers={'Authorization': 'Bearer ' + os.environ['GITHUB_TOKEN'], 'Accept': 'application/vnd.github+json'})
                with urlopen(request, timeout=20) as response:
                    runs = json.load(response)['workflow_runs']
                if workflow == 'ufc-events.yml' and (warning := schedule_warning(runs, now)):
                    warnings.append(warning)
                if repeated_failures(runs):
                    alerts.append(f'{workflow}: las dos últimas ejecuciones terminadas han fallado.')
            except (OSError, ValueError, KeyError):
                alerts.append(f'{workflow}: no se ha podido consultar el historial de Actions.')
    report = '## Estado de las automatizaciones\n\n' + ('\n'.join('- ' + a for a in alerts) if alerts else 'Sin incidencias que superen los umbrales de alerta.')
    if warnings:
        report += '\n\n### Avisos de horario y datos pendientes\n\n' + '\n'.join('- ' + w for w in warnings)
    print(report)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as out:
            out.write(report + '\n')
    for warning in warnings:
        print('::warning::' + warning)
    for alert in alerts:
        print('::error::' + alert)
    return bool(alerts)


if __name__ == '__main__':
    raise SystemExit(main())
