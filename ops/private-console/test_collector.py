import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("collector", Path(__file__).with_name("collector.py"))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
ENTRY = {"name": "beanlogapp-api-1", "label": "API"}


class LogSafetyTests(unittest.TestCase):
    def test_request_uses_allowlisted_fields_and_replaces_dynamic_segments(self):
        # Synthetic token is assembled so secret scanners do not mistake the
        # redaction fixture for an accidentally committed credential.
        fake_token = '.'.join(('eyJabc', 'secret', 'jwt'))
        raw = ('2026-09-06T03:02:01.123456789Z [GIN] 2026/09/06 - 03:02:01 | 500 | 1.25ms | 100.120.1.2 | GET '
               f'"/api/beans/123e4567-e89b-12d3-a456-426614174000?email=private@example.com&token={fake_token}"')
        result = collector.parse_logs(raw, ENTRY)
        encoded = json.dumps(result)
        for secret in ("private@example.com", "eyJabc", "100.120.1.2", "123e4567"):
            self.assertNotIn(secret, encoded)
        self.assertEqual(result["requests"][0]["route"], "/api/beans/:id")
        self.assertEqual(result["errors"], 1)

    def test_unknown_routes_and_raw_messages_never_escape(self):
        raw = '\n'.join([
            '2026-09-06T03:02:01Z [GIN] 2026/09/06 - 03:02:01 | 401 | 25µs | 10.0.0.2 | GET "/admin/secret@example.com?apikey=abc"',
            '2026-09-06T03:02:02Z {"level":"error","msg":"password=PRIVATE_SECRET","query":"SELECT email FROM auth.users"}',
            '2026-09-06T03:02:03Z ERROR <script>alert("PRIVATE_SECRET")</script>',
            '2026-09-06T03:02:04Z WARNING Authorization: Bearer PRIVATE_SECRET',
            'PRIVATE_SECRET no predictable format',
        ])
        result = collector.parse_logs(raw, ENTRY)
        encoded = json.dumps(result)
        for forbidden in ("PRIVATE_SECRET", "example.com", "script", "SELECT", "Authorization", "apikey"):
            self.assertNotIn(forbidden, encoded)
        self.assertEqual(result["requests"][0]["route"], "기타 경로")
        self.assertEqual(result["errors"], 2)
        self.assertEqual(result["warnings"], 2)
        self.assertEqual(result["omittedLines"], 4)

    def test_log_history_is_bounded(self):
        raw = '\n'.join('2026-09-06T03:02:01Z [GIN] 2026/09/06 - 03:02:01 | 200 | 1ms | 1.2.3.4 | GET "/api/beans"' for _ in range(120))
        result = collector.parse_logs(raw, ENTRY)
        self.assertEqual(len(result["requests"]), 20)

    def test_deeply_nested_untrusted_json_cannot_abort_collection(self):
        raw = '2026-09-06T03:02:01Z ' + '[' * 3000 + '"PRIVATE"' + ']' * 3000
        result = collector.parse_logs(raw, ENTRY)
        self.assertEqual(result["status"], "available")
        self.assertEqual(result["omittedLines"], 1)
        self.assertNotIn("PRIVATE", json.dumps(result))

    def test_stderr_is_collected_for_sanitizing_and_failure_is_unknown(self):
        seen = {}
        def runner(args, **kwargs):
            seen.update(kwargs)
            raise collector.CollectionError("command_failed")
        result = collector.container_logs(ENTRY, runner)
        self.assertTrue(seen["capture_stderr"])
        self.assertEqual(result["status"], "unavailable")
        self.assertIsNone(result["errors"])


class CommandBoundaryTests(unittest.TestCase):
    def test_timeout_kills_command_without_exposing_output(self):
        with self.assertRaisesRegex(collector.CollectionError, "^command_timeout$"):
            collector.command([sys.executable, "-c", "import time; print('PRIVATE', flush=True); time.sleep(3)"], timeout=0.1)

    def test_large_stdout_fails_closed(self):
        with self.assertRaisesRegex(collector.CollectionError, "^command_output_limit$"):
            collector.command([sys.executable, "-c", "print('PRIVATE' * 10000)"], max_bytes=1024)

    def test_failure_discards_stderr(self):
        with self.assertRaisesRegex(collector.CollectionError, "^command_failed$"):
            collector.command([sys.executable, "-c", "import sys; print('PRIVATE', file=sys.stderr); sys.exit(1)"], capture_stderr=True)

    def test_shell_metacharacters_are_literal_arguments(self):
        output = collector.command([sys.executable, "-c", "import sys; print(sys.argv[1])", "$(printf unsafe); | &"])
        self.assertEqual(output.strip(), "$(printf unsafe); | &")


class SnapshotTests(unittest.TestCase):
    def test_inspect_extracts_only_safe_fields(self):
        def runner(args, **kwargs):
            self.assertNotIn("{{json .State}}", args)
            return json.dumps({"status": "running", "health": "healthy", "restartCount": 2,
                               "startedAt": "2026-09-06T03:02:01Z", "secret": "PRIVATE"})
        data = collector.container_state(ENTRY, runner)
        self.assertEqual(data["restartCount"], 2)
        self.assertNotIn("PRIVATE", json.dumps(data))

    def test_invalid_inspect_and_db_data_show_unavailable(self):
        self.assertEqual(collector.container_state(ENTRY, lambda *_: "bad json")["status"], "unknown")
        for raw in ('null', '{"sizeBytes":0,"connections":[{"state":"SELECT PRIVATE","count":1}]}',
                    '{"sizeBytes":-1,"connections":[]}', '{"sizeBytes":false,"connections":[]}'):
            data = collector.database_stats(lambda *_, **__: raw)
            self.assertEqual(data["status"], "unavailable")
            self.assertIsNone(data["totalConnections"])

    def test_db_aggregate_whitelists_fields(self):
        raw = json.dumps({"sizeBytes": 1024, "connections": [{"state": "idle", "count": 3, "user": "PRIVATE"}, {"state": "active", "count": 1}]})
        def runner(args, **kwargs):
            self.assertIn("PGCONNECT_TIMEOUT=2", args)
            self.assertIn("PGOPTIONS=-c statement_timeout=2000 -c lock_timeout=1000 -c default_transaction_read_only=on", args)
            return raw
        data = collector.database_stats(runner)
        self.assertEqual(data["totalConnections"], 4)
        self.assertNotIn("PRIVATE", json.dumps(data))
        self.assertNotIn("query", collector.DB_SQL)

    def test_cpu_first_boot_or_reset_is_unknown_not_zero(self):
        current = {"total": 100, "idle": 50, "bootId": "boot"}
        self.assertIsNone(collector.cpu_percent(current, None))
        self.assertIsNone(collector.cpu_percent(current, {"total": 90, "idle": 45, "bootId": "old"}))
        self.assertIsNone(collector.cpu_percent(current, {"total": 110, "idle": 55, "bootId": "boot"}))
        self.assertEqual(collector.cpu_percent(current, {"total": 80, "idle": 45, "bootId": "boot"}), 75.0)

    def test_atomic_write_modes_and_failed_replace_preserve_old_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "data"
            collector.ensure_output_dir(root)
            self.assertEqual(stat.S_IMODE(root.stat().st_mode), 0o750)
            target = root / "status.json"
            collector.atomic_json(target, {"old": True}, 0o640)
            self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o640)
            with patch.object(collector.os, "replace", side_effect=OSError("simulated")):
                with self.assertRaises(OSError):
                    collector.atomic_json(target, {"new": True}, 0o640)
            self.assertEqual(json.loads(target.read_text()), {"old": True})
            self.assertEqual(list(root.iterdir()), [target])
            state = root / "cpu-state.json"
            collector.atomic_json(state, {}, 0o600)
            self.assertEqual(stat.S_IMODE(state.stat().st_mode), 0o600)

    def test_symlink_output_directory_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            link = Path(directory) / "link"
            link.symlink_to(Path(directory), target_is_directory=True)
            with self.assertRaises(ValueError):
                collector.ensure_output_dir(link)

    def test_backup_never_returns_names_and_ignores_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            backup = root / "password-private-person@example.com.sql"
            backup.write_bytes(b"12345")
            os.utime(backup, (1000, 1000))
            (root / "link").symlink_to(backup)
            data = collector.backup_stats(root, now=1100)
            self.assertEqual(data["ageSeconds"], 100)
            self.assertEqual(data["sizeBytes"], 5)
            self.assertNotIn("private-person", json.dumps(data))


if __name__ == "__main__":
    unittest.main()
