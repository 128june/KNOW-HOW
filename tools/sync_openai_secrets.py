"""Deliver numbered OpenAI keys to one private backend using encrypted Secrets.

No key material is written to files, command arguments, outputs, or logs. GitHub
CLI reads the JSON bundle from stdin and encrypts it with the destination
repository public key before sending it to GitHub. This script never calls
OpenAI. Run only from the manual, trusted-main Actions workflow.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys


SOURCE_REPOSITORY = "128june/KNOW-HOW"
BACKEND_REPOSITORY = "128june/ctrl-j"
BACKEND_SECRET = "KNOWHOW_OPENAI_KEYS_JSON"
SYNC_TOKEN = "KNOWHOW_BACKEND_SYNC_TOKEN"
KEY_NAME = re.compile(r"OPENAI_API_KEY_([1-9][0-9]{0,5})\Z")
MAX_KEYS = 20
WORKFLOW_KEY_NAMES = tuple(f"OPENAI_API_KEY_{number}" for number in range(1, MAX_KEYS + 1))
# Stay below GitHub's 48 KB per-secret maximum, including encrypted overhead.
MAX_BUNDLE_BYTES = 40_000


class SyncError(Exception):
    """A safe, fixed diagnostic that never embeds upstream response content."""


def select_keys(source: dict, operation: str = "sync") -> dict[str, str]:
    if operation not in {"sync", "disable"}:
        raise SyncError("Unsupported sync operation.")
    if operation == "disable":
        return {}
    selected = []
    for name, value in source.items():
        if not isinstance(name, str) or not name.startswith("OPENAI_API_KEY_"):
            continue
        match = KEY_NAME.fullmatch(name)
        if not match:
            raise SyncError("OpenAI key names must end in a positive number without leading zeros (maximum six digits).")
        if value == "":
            continue
        if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{8,512}", value):
            raise SyncError("An OpenAI key must contain 8–512 letters, digits, underscores, or hyphens, without padding.")
        selected.append((int(match.group(1)), name, value))
    if not selected:
        raise SyncError("No numbered OpenAI keys found; existing backend keys were preserved. Use disable to intentionally clear them.")
    if len(selected) > MAX_KEYS:
        raise SyncError("At most 20 OpenAI keys can be delivered at once.")
    return {name: value for _, name, value in sorted(selected)}


def encode_bundle(keys: dict[str, str]) -> str:
    bundle = json.dumps(keys, separators=(",", ":"), ensure_ascii=True)
    if len(bundle.encode("utf-8")) > MAX_BUNDLE_BYTES:
        raise SyncError("OpenAI key bundle exceeds the 40000-byte delivery limit.")
    return bundle


def gh_command(arguments: list[str], token: str, stdin: str | None = None) -> None:
    # Do not inherit the Actions key environment, GH_DEBUG, proxy settings,
    # alternate GitHub hosts, or shell hooks into the CLI process.
    child_env = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": os.environ.get("HOME", ""),
        "GH_TOKEN": token,
        "GH_HOST": "github.com",
        "GH_PROMPT_DISABLED": "1",
        "NO_COLOR": "1",
    }
    try:
        result = subprocess.run(
            ["gh", *arguments], input=stdin, text=True, capture_output=True,
            env=child_env, timeout=60, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise SyncError("GitHub command was unavailable or timed out; no upstream output was logged.") from None
    if result.returncode != 0:
        # Upstream stdout/stderr may contain a body or transformed secret.
        raise SyncError("GitHub request failed; check the dedicated token permissions/expiry and backend Actions status.")


def sync(source: dict, operation: str = "sync") -> int:
    token = source.get(SYNC_TOKEN)
    if not isinstance(token, str) or not token or any(ch.isspace() for ch in token):
        raise SyncError("KNOWHOW_BACKEND_SYNC_TOKEN is missing or invalid; no backend settings were changed.")
    keys = select_keys(source, operation)
    bundle = encode_bundle(keys)
    gh_command(["secret", "set", BACKEND_SECRET, "--repo", BACKEND_REPOSITORY], token, bundle)
    try:
        gh_command(["workflow", "run", "deploy.yml", "--repo", BACKEND_REPOSITORY, "--ref", "main"], token)
    except SyncError:
        raise SyncError("Backend secret was updated, but deployment dispatch did not complete. Run ctrl-j deploy.yml on main and verify its result.") from None
    return len(keys)


def main() -> int:
    try:
        if (os.environ.get("GITHUB_REPOSITORY") != SOURCE_REPOSITORY
                or os.environ.get("GITHUB_REF") != "refs/heads/main"
                or os.environ.get("GITHUB_EVENT_NAME") != "workflow_dispatch"):
            raise SyncError("Secret delivery is restricted to the source repository manual workflow on main.")
        # Never enumerate the repository's secrets or the process environment.
        # Empty values are missing GitHub secret slots, not keys to deliver.
        source = {name: os.environ.pop(name, "") for name in (SYNC_TOKEN, *WORKFLOW_KEY_NAMES)}
        source = {name: value for name, value in source.items() if value}
        count = sync(source, os.environ.get("SYNC_OPERATION", "sync"))
        print(f"Encrypted backend key bundle updated ({count} keys). Backend deployment requested; verify ctrl-j Actions completion.")
        return 0
    except SyncError as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
