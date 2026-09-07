import contextlib
import importlib.util
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("private_console_provision", Path(__file__).with_name("provision.py"))
provision = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(provision)


class ProvisionTests(unittest.TestCase):
    def test_studio_ip_is_a_single_literal_private_bridge_address(self):
        self.assertEqual(provision.studio_management_ip('OTHER=preserved\nBEANMAP_STUDIO_IP=172.19.0.5\n'), '172.19.0.5')
        for text in ['', 'BEANMAP_STUDIO_IP=8.8.8.8', 'BEANMAP_STUDIO_IP=127.0.0.1',
                     'BEANMAP_STUDIO_IP=169.254.169.254', 'BEANMAP_STUDIO_IP=hostname',
                     'BEANMAP_STUDIO_IP=172.19.0.5:3000',
                     'BEANMAP_STUDIO_IP=172.19.0.5\nBEANMAP_STUDIO_IP=172.19.0.6']:
            with self.subTest(text=text), self.assertRaises(provision.ProvisionError):
                provision.studio_management_ip(text)

    def status(self):
        return {
            "BackendState": "Running",
            "Self": {"UserID": 123, "DNSName": "oracle-free.tail6e4bc0.ts.net."},
            "User": {"123": {"LoginName": "owner@example.invalid"}},
        }

    def test_owner_comes_from_self_user_not_first_peer(self):
        status = self.status()
        status["User"]["999"] = {"LoginName": "another@example.invalid"}
        self.assertEqual(provision.tailscale_owner(status), ("owner@example.invalid", provision.EXPECTED_DNS))

    def test_tagged_or_wrong_dns_fails_closed(self):
        for key, value in [("Tags", ["tag:server"]), ("DNSName", "other.example.ts.net.")]:
            with self.subTest(key=key):
                status = self.status()
                status["Self"][key] = value
                with self.assertRaises(provision.ProvisionError):
                    provision.tailscale_owner(status)

    def test_caddy_injection_in_identity_is_rejected(self):
        for value in ["owner@example.invalid\nrespond 200", "*", '"anything"', "{env.SECRET}"]:
            with self.subTest(value=value):
                status = self.status()
                status["User"]["123"]["LoginName"] = value
                with self.assertRaises(provision.ProvisionError):
                    provision.tailscale_owner(status)

    def test_raw_environment_keeps_literal_credentials(self):
        value = 'literal$HOME#tag=\'"\\end'
        self.assertEqual(provision.raw_env({"PASSWORD": value}), f"PASSWORD={value}\n")

    def test_multiline_values_cannot_add_environment_keys(self):
        for value in ["a\nb", "a\rb", "a\x00b", "a\tb"]:
            with self.assertRaises(provision.ProvisionError):
                provision.raw_env({"PASSWORD": value})

    def test_systemd_values_are_quoted_without_shell_interpretation(self):
        self.assertEqual(provision.systemd_env({"VALUE": 'a"b\\c$d'}), 'VALUE="a\\"b\\\\c$d"\n')

    def test_existing_secret_is_preserved_and_bad_secret_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "secret"
            path.write_text("a" * 64 + "\n")
            self.assertEqual(provision.persisted_token(path), "a" * 64)
            path.write_text("too-short\n")
            with self.assertRaises(provision.ProvisionError):
                provision.persisted_token(path)

    def test_atomic_write_preserves_mode_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(os, "chown"), patch.object(os, "fchown"):
            path = Path(directory) / "private.env"
            self.assertTrue(provision.atomic_write(path, "secret\n"))
            inode = path.stat().st_ino
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertFalse(provision.atomic_write(path, "secret\n"))
            self.assertEqual(path.stat().st_ino, inode)
            self.assertEqual(list(Path(directory).iterdir()), [path])

    def test_symlink_cannot_redirect_secret_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "original"
            target.write_text("preserve")
            link = Path(directory) / "private.env"
            link.symlink_to(target)
            with self.assertRaises(provision.ProvisionError):
                provision.atomic_write(link, "replace")
            self.assertEqual(target.read_text(), "preserve")

    def test_inspection_errors_do_not_print_secret_stderr(self):
        secret = "must-never-appear"
        result = type("Result", (), {"returncode": 1, "stderr": secret.encode(), "stdout": secret.encode()})()
        captured = io.StringIO()
        with patch.object(provision.subprocess, "run", return_value=result), contextlib.redirect_stdout(captured), contextlib.redirect_stderr(captured):
            with self.assertRaises(provision.ProvisionError) as error:
                provision.command_json(["docker", "inspect", "safe-name"])
        self.assertNotIn(secret, str(error.exception))
        self.assertNotIn(secret, captured.getvalue())


if __name__ == "__main__":
    unittest.main()
