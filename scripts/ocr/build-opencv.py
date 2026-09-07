"""Build only pinned OpenCV JS bindings; downloads are verified by the caller."""
from pathlib import Path, PurePosixPath
import json
import os
import shutil
import subprocess
import sys
import tarfile
import time


def extract(archive: Path, destination: Path):
    destination.mkdir(parents=True, exist_ok=True)
    destination = destination.resolve()
    # Debian's Python 3.11 has no tarfile data filter. Copy only regular files,
    # directories and internal relative symlinks, without archive ownership.
    with tarfile.open(archive, "r|*") as source:
        for member in source:
            name = PurePosixPath(member.name)
            if name.is_absolute() or ".." in name.parts or "\\" in member.name:
                raise ValueError("Unsafe archive member path")
            target = destination.joinpath(*name.parts)
            if not target.resolve().is_relative_to(destination):
                raise ValueError("Archive member escapes extraction directory")
            if any(parent.is_symlink() for parent in target.parents if parent != destination):
                raise ValueError("Archive member has a symlink parent")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            if member.issym():
                link = PurePosixPath(member.linkname)
                if link.is_absolute() or "\\" in member.linkname or not (target.parent / member.linkname).resolve().is_relative_to(destination):
                    raise ValueError("Unsafe archive symlink")
                if target.is_symlink():
                    target.unlink()
                target.symlink_to(member.linkname)
            elif member.isfile():
                if target.is_symlink():
                    raise ValueError("Archive file replaces a symlink")
                with source.extractfile(member) as incoming, target.open("wb") as outgoing:
                    shutil.copyfileobj(incoming, outgoing)
                target.chmod(0o755 if member.mode & 0o111 else 0o644)
            else:
                raise ValueError("Unsupported archive member type")


def main():
    source_archive, sdk_archive, output = map(Path, sys.argv[1:4])
    root = Path(__file__).resolve().parent
    lock = json.loads((root / "sources.lock.json").read_text())
    output.mkdir(parents=True, exist_ok=True)
    extract(source_archive, output)
    extract(sdk_archive, output)
    source = output / "opencv-4.10.0"
    sdk = output / "install"
    build = output / "build"
    config = output / "emscripten_config.py"
    node = os.environ.get("BEANMAP_OCR_NODE", "node")
    config.write_text("\n".join([
        "LLVM_ROOT = " + repr(str(sdk / "bin")),
        "BINARYEN_ROOT = " + repr(str(sdk)),
        "EMSCRIPTEN_ROOT = " + repr(str(sdk / "emscripten")),
        "NODE_JS = [" + repr(node) + "]",
        "CACHE = " + repr(str(sdk / "emscripten/cache")),
    ]) + "\n")
    env = os.environ.copy()
    env.update({"EM_CONFIG": str(config), "EMSCRIPTEN": str(sdk / "emscripten"),
                "EMSCRIPTEN_ROOT": str(sdk / "emscripten"), "SOURCE_DATE_EPOCH": "0"})
    env["PATH"] = str(sdk / "emscripten") + os.pathsep + env["PATH"]
    version = subprocess.check_output([str(sdk / "emscripten/emcc"), "--version"], env=env, text=True)
    if "3.1.64" not in version or "a1fe3902bf73a3802eae0357d273d0e37ea79898" not in version:
        raise RuntimeError("Unexpected Emscripten compiler")
    flags = lock["opencvBuild"]["flags"]
    command = [str(sdk / "emscripten/emcmake"), sys.executable,
               str(source / "platforms/js/build_js.py"), str(build), "--build_wasm",
               "--disable_single_file", "--config_only", "--config=" + str(root / "paddle-whitelist.py"),
               "--build_flags=" + flags.rstrip() + " "]
    command += ["--cmake_option=-D" + item for item in lock["opencvBuild"]["cmakeOptions"]]
    jobs = int(os.environ.get("BEANMAP_OCR_BUILD_JOBS", "2"))
    if jobs < 1 or jobs > 8:
        raise ValueError("BEANMAP_OCR_BUILD_JOBS must be between 1 and 8")
    started = time.monotonic()
    with (output / "build.log").open("w") as log:
        subprocess.run(command, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
        subprocess.run(["cmake", "--build", str(build), "--target", "opencv_js", "--parallel", str(jobs)],
                       env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    (output / "provenance.json").write_text(json.dumps({
        "compiler": version.splitlines()[0], "sourceSha256": lock["opencvSource"]["sha256"],
        "flags": flags, "cmakeOptions": lock["opencvBuild"]["cmakeOptions"],
        "whitelistSha256": lock["opencvBuild"]["whitelistSha256"],
        "elapsedSeconds": time.monotonic() - started,
    }, indent=2) + "\n")


if __name__ == "__main__":
    main()
