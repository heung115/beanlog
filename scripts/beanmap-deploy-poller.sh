#!/usr/bin/env bash

set -euo pipefail

readonly repository_url="https://github.com/heung115/beanlog.git"
readonly workflow_runs_url="https://api.github.com/repos/heung115/beanlog/actions/workflows/ci-cd.yml/runs?branch=main&event=push&status=success&per_page=1"
readonly state_dir="/var/lib/beanmap-deploy"
readonly repository_dir="$state_dir/repository.git"
readonly deployed_sha_file="$state_dir/deployed-sha"
readonly deploy_command="/usr/local/sbin/beanmap-deploy"

umask 077
/usr/bin/install -d -m 0700 "$state_dir"

exec 9>"$state_dir/deploy.lock"
if ! /usr/bin/flock -n 9; then
  exit 0
fi

response_file="$(/usr/bin/mktemp "$state_dir/workflow-runs.XXXXXX.json")"
state_file=""
cleanup() {
  /usr/bin/rm -f "$response_file"
  if [[ -n "$state_file" ]]; then
    /usr/bin/rm -f "$state_file"
  fi
}
trap cleanup EXIT

/usr/bin/curl \
  --fail \
  --silent \
  --show-error \
  --location \
  --proto '=https' \
  --tlsv1.2 \
  --connect-timeout 10 \
  --max-time 30 \
  --retry 2 \
  --retry-all-errors \
  --header 'Accept: application/vnd.github+json' \
  --header 'X-GitHub-Api-Version: 2022-11-28' \
  --header 'User-Agent: beanmap-deploy-poller' \
  --output "$response_file" \
  "$workflow_runs_url"

verified_sha="$(
  /usr/bin/jq -r '
    .workflow_runs[0]
    | select(
        .head_branch == "main"
        and .event == "push"
        and .status == "completed"
        and .conclusion == "success"
      )
    | .head_sha
  ' "$response_file"
)"

if [[ ! "$verified_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "no verified main commit is available" >&2
  exit 1
fi

deployed_sha=""
if [[ -f "$deployed_sha_file" ]]; then
  IFS= read -r deployed_sha < "$deployed_sha_file"
fi

if [[ "$verified_sha" == "$deployed_sha" ]]; then
  exit 0
fi

if [[ ! -d "$repository_dir" ]]; then
  /usr/bin/git init --bare "$repository_dir" >/dev/null
fi

if /usr/bin/git --git-dir="$repository_dir" remote get-url origin >/dev/null 2>&1; then
  /usr/bin/git --git-dir="$repository_dir" remote set-url origin "$repository_url"
else
  /usr/bin/git --git-dir="$repository_dir" remote add origin "$repository_url"
fi

/usr/bin/git --git-dir="$repository_dir" fetch \
  --force \
  --prune \
  origin \
  '+refs/heads/main:refs/heads/main'

/usr/bin/git --git-dir="$repository_dir" cat-file -e "$verified_sha^{commit}"
if ! /usr/bin/git --git-dir="$repository_dir" merge-base --is-ancestor "$verified_sha" refs/heads/main; then
  echo "verified commit is not part of main" >&2
  exit 1
fi

/usr/bin/git --git-dir="$repository_dir" archive --format=tar.gz "$verified_sha" \
  | "$deploy_command" deploy

state_file="$(/usr/bin/mktemp "$state_dir/deployed-sha.XXXXXX")"
/usr/bin/printf '%s\n' "$verified_sha" > "$state_file"
/usr/bin/chmod 0600 "$state_file"
/usr/bin/mv -f "$state_file" "$deployed_sha_file"
state_file=""

echo "deployed verified commit ${verified_sha:0:12}"
