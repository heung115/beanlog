import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("transport_guard",Path(__file__).with_name("management-transport-guard.py"))
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)

class TransportGuardTests(unittest.TestCase):
    def test_only_root_tailscaled_and_dedicated_caddy_are_trusted(self):
        def output(args):
            user="" if args[2]=="tailscaled.service" else "caddy"
            return f"User={user}\nMainPID=0\nLoadState=loaded\n"
        with patch.object(guard.pwd,"getpwnam",return_value=SimpleNamespace(pw_uid=996)),patch.object(guard,"run",side_effect=output):
            self.assertEqual(guard.checked_service_uids(),996)
        with patch.object(guard.pwd,"getpwnam",return_value=SimpleNamespace(pw_uid=0)):
            with self.assertRaises(RuntimeError):guard.checked_service_uids()
        with patch.object(guard.pwd,"getpwnam",return_value=SimpleNamespace(pw_uid=996)),patch.object(guard,"run",return_value="User=nobody\nMainPID=0\nLoadState=loaded\n"):
            with self.assertRaises(RuntimeError):guard.checked_service_uids()

    def test_running_process_uid_must_match_unit_contract(self):
        with patch.object(guard.pwd,"getpwnam",return_value=SimpleNamespace(pw_uid=996)),patch.object(guard,"run",return_value="User=\nMainPID=123\nLoadState=loaded\n"),patch.object(guard.Path,"read_text",return_value="Uid:\t0\t65534\t0\t0\n"):
            with self.assertRaises(RuntimeError):guard.checked_service_uids()

    def test_self_serve_addresses_are_literal_and_correct_family(self):
        with patch.object(guard,"run",side_effect=["100.64.0.99\n","fd7a:115c:a1e0::123\n"]):
            self.assertEqual(guard.tailscale_addresses(),("100.64.0.99","fd7a:115c:a1e0::123"))
        for bad in ("127.0.0.1","0.0.0.0","::1","not-an-address","100.64.0.99\n100.64.0.100"):
            with patch.object(guard,"run",return_value=bad):
                with self.assertRaises((RuntimeError,ValueError)):guard.tailscale_addresses()

    def test_caddy_template_has_no_shared_loopback_listener(self):
        source=Path(__file__).with_name("beanmap-private.Caddyfile").read_text()
        self.assertNotIn("bind 127.0.0.1",source)
        for name in ("status","studio","admin"):
            self.assertIn(f"bind unix//run/caddy/private/{name}.sock|0600",source)
        self.assertIn("@owner header Tailscale-User-Login",source)

if __name__=="__main__":unittest.main()
