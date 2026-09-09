#!/usr/bin/env python3
"""Build an isolated Linux fixture; no host network, production writes, or real accounts."""
import json
import os
from pathlib import Path
import subprocess
import uuid

ROOT=Path(__file__).resolve().parent

def docker(*args, capture=True):
    result=subprocess.run(["docker",*args],check=False,capture_output=capture,text=True,timeout=300)
    if result.returncode:
        if capture:print(result.stderr[-6000:])
        raise RuntimeError("Disposable private-transport fixture failed")
    return result.stdout

def main():
    suffix=uuid.uuid4().hex[:10];network="beanmap-private-transport-"+suffix;backend=network+"-backend";front=network+"-front"
    image="beanmap-private-transport-test:"+suffix
    try:
        docker("build","-q","-f",str(ROOT/"Dockerfile.transport-test"),"-t",image,str(ROOT))
        docker("network","create","--internal","--ipv6","--subnet",f"fded:{suffix[:4]}:{suffix[4:8]}::/64",network)
        docker("run","-d","--name",backend,"--network",network,image,"backend")
        info=json.loads(docker("inspect",backend))[0]["NetworkSettings"]["Networks"][network]
        print(docker("run","--rm","--name",front,"--network",network,"--cap-add","NET_ADMIN",
          "-e","BEANMAP_DISPOSABLE_TRANSPORT_TEST=1","-e","FIXTURE_BACKEND4="+info["IPAddress"],"-e","FIXTURE_BACKEND6="+info["GlobalIPv6Address"],image).strip())
    finally:
        for name in (front,backend):subprocess.run(["docker","rm","-f",name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)
        subprocess.run(["docker","network","rm",network],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)
        subprocess.run(["docker","image","rm",image],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)

if __name__=="__main__":main()
