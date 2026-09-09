#!/usr/bin/env python3
"""Enforce an operator-approved UID boundary on the private Docker management bridge.

`check` is read-only. `apply` changes only our two private OUTPUT hooks/chains.
Neither command alters Tailscale, Caddy, Docker, public listeners, or other rules.
"""
from __future__ import annotations
import argparse
import ipaddress
import os
from pathlib import Path
import pwd
import subprocess
import sys

CHAIN = "BEANMAP-MGMT-OUT"
SERVE_CHAIN = "BEANMAP-SERVE-OUT"
BRIDGE = "bm-management"


def run(args: list[str], *, data: str | None = None) -> str:
    result = subprocess.run(args, input=data, text=True, capture_output=True, timeout=10, check=False)
    if result.returncode:
        raise RuntimeError("Private management boundary command failed")
    return result.stdout


def checked_service_uids() -> int:
    caddy_uid = pwd.getpwnam("caddy").pw_uid
    if caddy_uid == 0:
        raise RuntimeError("Caddy must remain an unprivileged dedicated service")
    for unit, expected_user, expected_uid in (("tailscaled.service", ("", "root"), 0), ("caddy.service", ("caddy",), caddy_uid)):
        properties = dict(line.split("=", 1) for line in run(["systemctl", "show", unit, "--property=User,MainPID,LoadState"]).splitlines())
        if properties.get("LoadState") != "loaded" or properties.get("User") not in expected_user:
            raise RuntimeError("Private transport service identity changed")
        pid = properties.get("MainPID", "0")
        if pid != "0":
            lines = Path(f"/proc/{int(pid)}/status").read_text().splitlines()
            uids = next(line.split()[1:] for line in lines if line.startswith("Uid:"))
            if [int(uid) for uid in uids] != [expected_uid] * 4:
                raise RuntimeError("Running private transport identity changed")
    return caddy_uid


def rules(caddy_uid: int, ipv6: bool = False) -> list[str]:
    # IPv6 neighbor discovery is kernel-generated and has no userspace socket
    # owner. Let it resolve peers without opening any TCP/UDP application path.
    discovery=[f"-A {CHAIN} -p ipv6-icmp -m icmp6 --icmpv6-type {kind} -j RETURN" for kind in (135,136)] if ipv6 else []
    return discovery+[f"-A {CHAIN} -m owner --uid-owner 0 -j RETURN",
            f"-A {CHAIN} -m owner --uid-owner {caddy_uid} -j RETURN",
            f"-A {CHAIN} -j REJECT"]


def tailscale_addresses() -> tuple[str, str]:
    addresses=[]
    for version in (4,6):
        address=ipaddress.ip_address(run(["tailscale","ip",f"-{version}"]).strip())
        if address.version!=version or address.is_loopback or address.is_unspecified:
            raise RuntimeError("Invalid local Tailscale address")
        addresses.append(str(address))
    return tuple(addresses)


def hooks(address: str) -> list[str]:
    network=ipaddress.ip_network(address).with_prefixlen
    return [f"-A OUTPUT -o {BRIDGE} -j {CHAIN}",
            f"-A OUTPUT -d {network} -p tcp -m multiport --dports 443,8443,9443 -j {SERVE_CHAIN}"]


def apply(caddy_uid: int, local_addresses: tuple[str,str]) -> None:
    for binary,address in zip(("iptables", "ip6tables"),local_addresses):
        # Atomic table commit prevents a window with an empty allow/deny chain.
        payload = "\n".join(["*filter", f":{CHAIN} - [0:0]",f":{SERVE_CHAIN} - [0:0]", f"-F {CHAIN}", *rules(caddy_uid,binary=="ip6tables"),
            f"-F {SERVE_CHAIN}",f"-A {SERVE_CHAIN} -m owner --uid-owner 0 -j RETURN",f"-A {SERVE_CHAIN} -j REJECT", "COMMIT", ""])
        run([binary + "-restore", "--wait", "5", "--noflush"], data=payload)
        existing = run([binary, "--wait", "5", "-S", "OUTPUT"]).splitlines()
        # Put the guard ahead of broad ACCEPT/ESTABLISHED rules. Remove only
        # duplicate exact hooks, without ever removing the newly inserted one.
        expected=hooks(address)
        for hook in reversed(expected):run([binary,"--wait","5","-I","OUTPUT","1",*hook.split()[2:]])
        positions = [index for index, line in enumerate([line for line in existing if line.startswith("-A OUTPUT ")], len(expected)+1)
                     if line.endswith(f" -j {CHAIN}") or line.endswith(f" -j {SERVE_CHAIN}")]
        for position in reversed(positions):
            run([binary, "--wait", "5", "-D", "OUTPUT", str(position)])
    check(caddy_uid,local_addresses)


def check(caddy_uid: int, local_addresses: tuple[str,str]) -> None:
    for binary,address in zip(("iptables", "ip6tables"),local_addresses):
        actual = [line for line in run([binary, "--wait", "5", "-S", CHAIN]).splitlines() if line.startswith("-A ")]
        # iptables expands REJECT with a protocol-specific default reject type.
        normalized = [line.split(" --reject-with ", 1)[0] for line in actual]
        if normalized != rules(caddy_uid,binary=="ip6tables"):
            raise RuntimeError("Private management chain does not match its UID boundary")
        serve=[line.split(" --reject-with ",1)[0] for line in run([binary,"--wait","5","-S",SERVE_CHAIN]).splitlines() if line.startswith("-A ")]
        if serve!=[f"-A {SERVE_CHAIN} -m owner --uid-owner 0 -j RETURN",f"-A {SERVE_CHAIN} -j REJECT"]:
            raise RuntimeError("Local Serve boundary must admit root only")
        actual_hooks = [line for line in run([binary, "--wait", "5", "-S", "OUTPUT"]).splitlines() if line.startswith("-A OUTPUT ")]
        expected = hooks(address)
        if actual_hooks[:len(expected)]!=expected or any(actual_hooks.count(hook)!=1 for hook in expected):
            raise RuntimeError("Private management guard must be the first unique OUTPUT hook")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("apply", "check"))
    args = parser.parse_args()
    try:
        if os.geteuid() != 0:
            raise RuntimeError("Root is required for the host management boundary")
        caddy_uid = checked_service_uids()
        (apply if args.action == "apply" else check)(caddy_uid,tailscale_addresses())
        print("Private management UID boundary verified (IPv4 and IPv6).")
        return 0
    except (OSError, KeyError, ValueError, StopIteration, RuntimeError, subprocess.TimeoutExpired):
        print("Private management boundary failed closed; inspect service identities and owned rules.", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
