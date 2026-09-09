#!/usr/bin/env python3
"""Hourly local catch-up: capture only when GCS completion is >=23 hours old."""
import argparse
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

spec = importlib.util.spec_from_file_location('gcs', Path(__file__).with_name('gcs.py'))
gcs = importlib.util.module_from_spec(spec); spec.loader.exec_module(gcs)


def record(root, state):
    payload = {**state, 'checked_at': gcs.backup.now().isoformat()}
    temporary = root / 'last-status.json.new'
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        json.dump(payload, output); output.write('\n'); output.flush(); os.fsync(output.fileno())
    temporary.chmod(0o600); temporary.replace(root / 'last-status.json')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config-directory', required=True, type=Path)
    parser.add_argument('--approved-gcp-backup', action='store_true')
    args = parser.parse_args(); os.umask(0o077)
    if not args.approved_gcp_backup: raise ValueError('Use only the authorized GCP backup destination')
    root = gcs.backup.private_directory(args.config_directory)
    try:
        with (root / 'daily.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            settings = gcs.config(root / 'gcs.json')
            state = gcs.remote_status(settings)
            record(root, state)
            if state.get('within_rpo') and state.get('age_hours', 24) < 23:
                print(json.dumps({'status': 'fresh-no-copy', 'age_hours': state['age_hours']})); return 0
            before = state
            output = subprocess.check_output([sys.executable, str(Path(__file__).with_name('backup.py')), 'pull', '--config', str(root / 'daily.json'), '--approved-production-transfer'], stderr=subprocess.DEVNULL)
            captured = json.loads(output)
            local = gcs.backup.configurations(root / 'daily.json')
            directory = Path(local['destination']) / captured['backup']
            result = gcs.upload(settings, directory, 'daily', approved=True)
            verified = gcs.remote_status(settings)
            if not verified.get('within_rpo'): raise RuntimeError('GCS backup completion did not become fresh')
            record(root, verified)
            print(json.dumps({'status': 'completed', 'caught_up_from': before['status'], 'bytes': result['bytes']})); return 0
    except Exception as error:
        # No raw SQL/credentials/producer stderr is included in monitoring state.
        failed = {'status': 'failed', 'reason': type(error).__name__, 'checked_at': gcs.backup.now().isoformat()}
        record(root, failed)
        print(json.dumps(failed), file=sys.stderr); return 1


if __name__ == '__main__': raise SystemExit(main())
