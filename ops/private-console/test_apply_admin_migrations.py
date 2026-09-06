import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import unittest
from unittest import mock


SPEC = importlib.util.spec_from_file_location(
    "apply_admin_migrations", Path(__file__).with_name("apply-admin-migrations.py")
)
migrations = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migrations)


class AdminMigrationTests(unittest.TestCase):
    def test_real_migrations_have_one_outer_transaction_with_precommit_checks(self):
        sql = migrations.build_sql()
        boundaries = [line.strip().lower() for line in sql.splitlines()
                      if migrations.TRANSACTION_LINE.fullmatch(line)]
        self.assertEqual(boundaries, ["begin;", "commit;"])
        self.assertLess(sql.index("create table beanmap_private.admin_users"),
                        sql.index("alter function public.beanmap_is_admin() set schema"))
        self.assertLess(sql.index("$admin_verify_membership$;"), sql.rindex("commit;"))
        self.assertIn("exception when insufficient_privilege then null;", sql)

    def test_only_outer_transaction_is_removed(self):
        sql = "-- migration\nbegin;\ncreate function sample() returns void as $$\nbegin\n  null;\nend;\n$$ language plpgsql;\ncommit;\n"
        body = migrations.migration_body(sql, wrapped=True)
        self.assertIn("$$\nbegin\n  null;\nend;", body)
        self.assertNotRegex(body, r"(?im)^\s*(begin|commit);\s*$")

    def test_changed_transaction_boundaries_fail_before_any_remote_execution(self):
        for sql in ("begin;\nselect 1;\n", "begin;\ncommit;\nselect 1;\ncommit;\n",
                    "select 1;\nbegin;\ncommit;\n", "begin;\nrollback;\n"):
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                migrations.migration_body(sql, wrapped=True)
        with self.assertRaises(ValueError):
            migrations.migration_body("begin;\nselect 1;\ncommit;\n", wrapped=False)

    def test_default_is_preview_and_never_connects_to_ssh(self):
        output = io.StringIO()
        with mock.patch.object(migrations.subprocess, "run") as run:
            with contextlib.redirect_stdout(output):
                self.assertEqual(migrations.main([]), 0)
            run.assert_not_called()
        self.assertTrue(output.getvalue().startswith("\\set ON_ERROR_STOP on\nbegin;"))

    def test_explicit_apply_passes_sql_on_stdin_and_propagates_failure(self):
        with mock.patch.object(migrations.subprocess, "run", return_value=
                               subprocess.CompletedProcess([], 3)) as run:
            self.assertEqual(migrations.main(["--apply"]), 3)
        args, kwargs = run.call_args
        self.assertEqual(args[0][:2], ["ssh", "oracle"])
        self.assertIn("-v ON_ERROR_STOP=1", args[0][2])
        self.assertEqual(kwargs["input"], migrations.build_sql())
        self.assertFalse(kwargs["check"])
        self.assertTrue(kwargs["text"])


if __name__ == "__main__":
    unittest.main()
