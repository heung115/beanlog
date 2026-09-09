#!/bin/sh
set -eu
cd "$(dirname "$0")"
[ "$(docker image inspect beanmap-postgres-meta:v0.96.6-security-p3 --format '{{.Id}}')" = 'sha256:855f489860828f8cdb6f4110a467d2670ba5a2cec1ef7d2c5b7f7fcd93601b0b' ]
[ "$(docker image inspect beanmap-studio:2026.08.03-security-p3 --format '{{.Id}}')" = 'sha256:fbd09e43b4928bb4b3368808d2baa26ef7183dc4345b04c5ffe1e5a779927c42' ]
docker build --network=host --target dependencies -f Dockerfile.meta -t beanmap-meta-runtime-deps:security-p4 .
docker build --network=none -f Dockerfile.meta -t beanmap-postgres-meta:v0.96.6-security-p4 .
docker build --network=host --target dependencies -f Dockerfile.studio -t beanmap-studio-runtime-deps:security-p4 .
docker build --network=none -f Dockerfile.studio -t beanmap-studio:2026.08.03-security-p4 .
docker image inspect beanmap-postgres-meta:v0.96.6-security-p4 beanmap-studio:2026.08.03-security-p4 --format '{{.Id}} {{json .RepoTags}}'
