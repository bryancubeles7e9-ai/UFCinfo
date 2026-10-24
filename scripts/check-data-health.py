"""Read-only alerts. Never calls a sports/search provider or changes published data."""
import importlib.util
import json
import os
from datetime import datetime, timezone
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
        if not ages or min(ages) > 30 or min(ages) < -1:
            alerts.append(f'{kind}: sin sincronización reciente verificable (margen: 30 horas).')
        source_age = hours(stamp, now)
        attempt_age = hours(job.get('attemptedAt'), now)
        superseded = source_age is not None and attempt_age is not None and source_age < attempt_age
        if job.get('consecutiveFailures', 0) >= 2 and not superseded:
            alerts.append(f'{kind}: dos o más consultas consecutivas fallidas.')
        pending_age = hours(job.get('pendingSince'), now)
        if monitor.pending_count(kind, feed) and pending_age is not None and pending_age > 48:
            if kind == 'records' and source_statistics_pending(feed, now):
                ids = ', '.join(sorted(feed['pendingProfileIds']))
                warnings.append(f'records: UFC sigue sin publicar estadísticas completas para {ids}. '
                                'Récord consultado recientemente; estadísticas previas conservadas y reintento pendiente.')
            else:
                alerts.append(f'{kind}: hay datos pendientes de forma continua desde hace más de 48 horas.')
    return alerts


def repeated_failures(runs):
    # Ignore cancelled/skipped runs and preserve newest-first API ordering.
    completed = [r for r in runs if r.get('head_branch') == 'main' and
                 r.get('status') == 'completed' and r.get('conclusion') in
                 ('success', 'failure', 'timed_out', 'action_required')]
    return len(completed) >= 2 and all(r['conclusion'] != 'success' for r in completed[:2])


def main():
    alerts = []
    warnings = []
    try:
        read = lambda name: json.loads((ROOT / 'assets/data' / name).read_text())
        alerts = assess(read('sync-health.json'),
                        {kind: read(filename) for kind, (_, filename) in monitor.JOBS.items()},
                        read('ufc-rumor-groups.json'), datetime.now(timezone.utc), warnings)
    except (OSError, ValueError, TypeError, KeyError):
        alerts.append('No se puede verificar el estado: faltan datos o el formato es inválido.')
    if os.environ.get('GITHUB_TOKEN'):
        for workflow in ('rumor-sync.yml', 'ufc-events.yml', 'fighter-records.yml'):
            url = f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}/actions/workflows/{workflow}/runs?branch=main&per_page=20"
            try:
                request = Request(url, headers={'Authorization': 'Bearer ' + os.environ['GITHUB_TOKEN'], 'Accept': 'application/vnd.github+json'})
                with urlopen(request, timeout=20) as response:
                    runs = json.load(response)['workflow_runs']
                if repeated_failures(runs):
                    alerts.append(f'{workflow}: las dos últimas ejecuciones terminadas han fallado.')
            except (OSError, ValueError, KeyError):
                alerts.append(f'{workflow}: no se ha podido consultar el historial de Actions.')
    report = '## Estado de las automatizaciones\n\n' + ('\n'.join('- ' + a for a in alerts) if alerts else 'Sin incidencias que superen los umbrales de alerta.')
    if warnings:
        report += '\n\n### Datos pendientes en la fuente\n\n' + '\n'.join('- ' + w for w in warnings)
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
