#!/usr/bin/env python3
"""Package a completed same-major Nix build into the current Supabase image.

Run on the Oracle host as root. This only creates an image; it never starts or
replaces a production service. The builder must contain /tmp/pg1711-result.
"""
import argparse
import json
import pathlib
import subprocess


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--builder", default="beanmap-pg1711-builder")
    parser.add_argument("--directory", required=True)
    parser.add_argument("--base", default="beanlog-postgres:17.6.1.136-p1")
    parser.add_argument("--image", default="beanlog-postgres:17.11-supabase136-p1")
    args = parser.parse_args()
    directory = pathlib.Path(args.directory).resolve()
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory.chmod(0o700)

    def docker_exec(*command):
        return run("docker", "exec", args.builder, *command)

    old_out = "/nix/store/axzw4y8zm4i1q6kay5rgkqavn2p1lzll-postgresql-17.6"
    old_lib = "/nix/store/h3h9bd42vx194fv2y6hr30vj0r385nx4-postgresql-17.6-lib"
    plugin_union = "/nix/store/hf6lpfr2lnna0wrl5rg4pgy5drxdc1ff-postgresql-and-plugins-17.6"
    new_out = docker_exec("readlink", "-f", "/tmp/pg1711-result")
    new_lib = docker_exec(new_out + "/bin/pg_config", "--pkglibdir").removesuffix("/lib")
    version = docker_exec(new_out + "/bin/postgres", "--version")
    if version != "postgres (PostgreSQL) 17.11":
        raise SystemExit("Refusing unexpected candidate version: " + version)

    # Bring in only newly required runtime paths. Development toolchains and
    # build/source files stay outside the production image.
    closure = docker_exec("nix-store", "--query", "--requisites", new_out, new_lib).splitlines()
    for path in closure:
        if not path.startswith("/nix/store/") or "\n" in path:
            raise SystemExit("Invalid Nix closure path")
    additions = run("docker", "run", "--rm", "--network", "none", "--entrypoint", "sh",
                    args.base, "-c", 'for p do if ! test -e "$p"; then printf "%s\\n" "$p"; fi; done',
                    "check-closure", *closure).splitlines()
    for path in additions:
        destination = directory / pathlib.Path(path).name
        subprocess.run(["docker", "cp", args.builder + ":" + path, str(destination)], check=True)

    base_id = run("docker", "image", "inspect", args.base, "--format", "{{.Id}}")
    dockerfile = ["FROM " + base_id, "USER root"]
    dockerfile.extend("COPY " + pathlib.Path(path).name + " " + path for path in additions)
    # Existing Supabase extensions retain their exact ABI/build dependencies and
    # paths. Redirect the original core paths so even extension RPATH references
    # use patched libpq/contrib code. Replace Supabase's three copied core binaries;
    # preserve its postgres wrapper and NIX_PGLIBDIR extension-union setting.
    dockerfile += [
        "RUN rm -rf " + old_out + " " + old_lib + " && \\",
        "    ln -s " + new_out + " " + old_out + " && \\",
        "    ln -s " + new_lib + " " + old_lib + " && \\",
        "    chmod u+w " + plugin_union + "/bin " + plugin_union + "/bin/.postgres-wrapped " + plugin_union + "/bin/pg_ctl " + plugin_union + "/bin/pg_config && \\",
        "    cp " + new_out + "/bin/postgres " + plugin_union + "/bin/.postgres-wrapped && \\",
        "    cp " + new_out + "/bin/pg_ctl " + plugin_union + "/bin/pg_ctl && \\",
        "    cp " + new_out + "/bin/pg_config " + plugin_union + "/bin/pg_config && \\",
        "    postgres --version && pg_dump --version && psql --version",
        'LABEL org.beanmap.postgresql.version="17.11"',
        'LABEL org.beanmap.postgresql.source="https://ftp.postgresql.org/pub/source/v17.11/postgresql-17.11.tar.bz2"',
        'LABEL org.beanmap.postgresql.sha256="dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979"',
        'LABEL org.beanmap.supabase.base="17.6.1.136-p1"',
    ]
    (directory / "Dockerfile").write_text("\n".join(dockerfile) + "\n")
    (directory / "manifest.json").write_text(json.dumps({
        "version": version, "base_image": base_id, "image": args.image,
        "postgres_out": new_out, "postgres_lib": new_lib, "added_paths": additions,
    }, indent=2) + "\n")
    subprocess.run(["docker", "build", "--network", "none", "-t", args.image, str(directory)], check=True)
    print(run("docker", "image", "inspect", args.image, "--format", "{{.Id}}"))


if __name__ == "__main__":
    main()
