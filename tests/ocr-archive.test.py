"""Portable extraction regression tests; no model or compiler download required."""
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
import sys

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location("opencv_build", Path(__file__).parents[1] / "scripts/ocr/build-opencv.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ArchiveExtractionTests(unittest.TestCase):
    def archive(self, directory, entries):
        archive = directory / "test.tar"
        with tarfile.open(archive, "w") as output:
            for name, kind, content in entries:
                entry = tarfile.TarInfo(name)
                entry.type = kind
                if kind == tarfile.REGTYPE:
                    entry.size = len(content)
                    entry.mode = 0o4755
                    output.addfile(entry, io.BytesIO(content))
                elif kind == tarfile.SYMTYPE:
                    entry.linkname = content
                    output.addfile(entry)
                else:
                    output.addfile(entry)
        return archive

    def test_regular_files_and_internal_sdk_links(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = self.archive(root, [("install/bin/tool", tarfile.REGTYPE, b"tool"), ("install/bin/alias", tarfile.SYMTYPE, "tool")])
            module.extract(archive, root / "out")
            self.assertEqual((root / "out/install/bin/alias").read_bytes(), b"tool")
            self.assertEqual((root / "out/install/bin/tool").stat().st_mode & 0o7777, 0o755)
            module.extract(archive, root / "out")
            self.assertEqual((root / "out/install/bin/alias").read_bytes(), b"tool")

    def test_escaping_paths_links_and_devices_are_rejected(self):
        for entries in [
            [("../escaped", tarfile.REGTYPE, b"bad")],
            [("/absolute", tarfile.REGTYPE, b"bad")],
            [("a\\b", tarfile.REGTYPE, b"bad")],
            [("link", tarfile.SYMTYPE, "../escaped")],
            [("link", tarfile.SYMTYPE, "/tmp/escaped")],
            [("device", tarfile.CHRTYPE, "")],
            [("link", tarfile.LNKTYPE, "")],
            [("link", tarfile.SYMTYPE, "internal"), ("link/file", tarfile.REGTYPE, b"bad")],
        ]:
            with self.subTest(entries=entries), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                archive = self.archive(root, entries)
                with self.assertRaises(ValueError):
                    module.extract(archive, root / "out")
                self.assertFalse((root / "escaped").exists())


if __name__ == "__main__":
    unittest.main()
