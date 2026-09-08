#!/usr/bin/env python3
"""Emit local, credential-free alerts for sustained Auth limiting; send no messages."""
import json
from pathlib import Path
import subprocess
import sys

STATE = Path('/var/lib/beanmap-auth-budgets/monitor.json')


def evaluate(logs, previous):
    lines = [line for line in logs.splitlines() if 'beanmap_auth_budget ' in line]
    unavailable = any(' unavailable ' in line for line in lines)
    global_limit = any('scope=public-total' in line or 'scope=admin-total' in line for line in lines)
    consecutive = previous.get('consecutive', 0) + 1 if len(lines) >= 6 else 0
    alert = unavailable or global_limit or consecutive >= 2
    return {'consecutive': consecutive, 'alert': alert, 'events': len(lines),
            'shared_capacity': global_limit, 'counter_unavailable': unavailable}


def main():
    result = subprocess.run(['docker', 'logs', '--since', '60s', 'supabase-kong'], capture_output=True, text=True)
    if result.returncode:
        print('Auth budget monitor could not read gateway logs; inspect supabase-kong.', file=sys.stderr)
        return 1
    previous = json.loads(STATE.read_text()) if STATE.exists() else {}
    state = evaluate(result.stdout + result.stderr, previous)
    temporary = STATE.with_suffix('.tmp')
    temporary.write_text(json.dumps(state) + '\n')
    temporary.chmod(0o600)
    temporary.replace(STATE)
    if state['alert']:
        print('Auth budget alert: sustained denials or shared capacity unavailable. '
              'Inspect the gateway budget scopes and Auth health; preserve per-client limits. '
              f'events={state["events"]} shared_capacity={state["shared_capacity"]} '
              f'counter_unavailable={state["counter_unavailable"]}', file=sys.stderr)
        return 1
    if previous.get('alert'):
        print('Auth budget alert recovered; current minute is below the alert threshold.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
