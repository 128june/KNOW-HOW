"""Secret-delivery tests use invented markers only, and never invoke GitHub."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("sync_openai_secrets", ROOT / "tools/sync_openai_secrets.py")
syncer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(syncer)


class SecretDeliveryTests(unittest.TestCase):
    def test_numeric_order_and_exact_allowlist(self):
        source = {"OPENAI_API_KEY_10": "test-key-c", "OPENAI_API_KEY_2": "test-key-b",
                  "OPENAI_API_KEY_1": "test-key-a", "OTHER_SECRET": "excluded",
                  "OPENAI_API_KEY": "excluded", "KNOWHOW_BACKEND_SYNC_TOKEN": "test-token"}
        self.assertEqual(list(syncer.select_keys(source)), ["OPENAI_API_KEY_1", "OPENAI_API_KEY_2", "OPENAI_API_KEY_10"])
        self.assertNotIn("excluded", syncer.encode_bundle(syncer.select_keys(source)))

    def test_invalid_numbered_names_rejected(self):
        for name in ("OPENAI_API_KEY_0", "OPENAI_API_KEY_01", "OPENAI_API_KEY_2_OTHER", "OPENAI_API_KEY_1000000"):
            with self.subTest(name=name), self.assertRaises(syncer.SyncError):
                syncer.select_keys({name: "test-value"})

    def test_no_keys_preserves_existing_but_disable_is_explicit(self):
        with self.assertRaises(syncer.SyncError):
            syncer.select_keys({})
        self.assertEqual(syncer.select_keys({}, "disable"), {})

    def test_key_limits_and_invalid_values(self):
        with self.assertRaises(syncer.SyncError):
            syncer.select_keys({f"OPENAI_API_KEY_{i}": "test-value" for i in range(1, 22)})
        for value in ("", None, 123, "short", " test-key", "test-key ", "test/key", "test\nvalue", "test value", "한글", "a" * 513):
            with self.subTest(value_type=type(value).__name__), self.assertRaises(syncer.SyncError):
                syncer.select_keys({"OPENAI_API_KEY_1": value})
        with self.assertRaises(syncer.SyncError):
            syncer.encode_bundle({f"OPENAI_API_KEY_{i}": "a" * 4096 for i in range(1, 21)})

    def test_secret_in_stdin_only_and_child_env_allowlisted(self):
        result = subprocess.CompletedProcess([], 0, stdout="", stderr="")
        with patch.object(syncer.subprocess, "run", return_value=result) as run, patch.dict(os.environ, {"GH_DEBUG": "api", "UNRELATED_SECRET": "test-sensitive-context", "HTTPS_PROXY": "test-proxy"}):
            count = syncer.sync({"OPENAI_API_KEY_10": "test-key-b", "OPENAI_API_KEY_2": "test-key-a", "KNOWHOW_BACKEND_SYNC_TOKEN": "test-token"})
        self.assertEqual(count, 2)
        self.assertEqual(run.call_count, 2)
        first = run.call_args_list[0]
        self.assertEqual(first.args[0], ["gh", "secret", "set", "KNOWHOW_OPENAI_KEYS_JSON", "--repo", "128june/ctrl-j"])
        self.assertEqual(json.loads(first.kwargs["input"]), {"OPENAI_API_KEY_2": "test-key-a", "OPENAI_API_KEY_10": "test-key-b"})
        self.assertNotIn("test-key-a", " ".join(first.args[0]))
        self.assertEqual(first.kwargs["env"]["GH_TOKEN"], "test-token")
        for name in ("GH_DEBUG", "UNRELATED_SECRET", "HTTPS_PROXY"):
            self.assertNotIn(name, first.kwargs["env"])
        self.assertEqual(run.call_args_list[1].args[0], ["gh", "workflow", "run", "deploy.yml", "--repo", "128june/ctrl-j", "--ref", "main"])

    def test_disable_sends_empty_bundle_and_redeploys(self):
        with patch.object(syncer, "gh_command") as command:
            self.assertEqual(syncer.sync({"KNOWHOW_BACKEND_SYNC_TOKEN": "test-token"}, "disable"), 0)
        self.assertEqual(command.call_args_list[0].args[2], "{}")
        self.assertEqual(command.call_count, 2)

    def test_missing_credentials_makes_no_network_request(self):
        with patch.object(syncer, "gh_command") as command, self.assertRaises(syncer.SyncError):
            syncer.sync({"OPENAI_API_KEY_1": "test-key"})
        command.assert_not_called()

    def test_failed_update_never_dispatches_or_logs_upstream_output(self):
        result = subprocess.CompletedProcess([], 1, stdout="test-leaked-key", stderr="test-leaked-token")
        with patch.object(syncer.subprocess, "run", return_value=result) as run, self.assertRaises(syncer.SyncError) as caught:
            syncer.sync({"OPENAI_API_KEY_1": "test-key", "KNOWHOW_BACKEND_SYNC_TOKEN": "test-token"})
        self.assertEqual(run.call_count, 1)
        self.assertNotIn("test-leaked", str(caught.exception))

    def test_dispatch_failure_reports_partial_update_without_response(self):
        with patch.object(syncer, "gh_command", side_effect=[None, syncer.SyncError("test-upstream-secret")]), self.assertRaises(syncer.SyncError) as caught:
            syncer.sync({"OPENAI_API_KEY_1": "test-key", "KNOWHOW_BACKEND_SYNC_TOKEN": "test-token"})
        self.assertIn("secret was updated", str(caught.exception))
        self.assertNotIn("test-upstream-secret", str(caught.exception))

    def test_manual_main_only_guard(self):
        for repo, ref, event in (("fork/KNOW-HOW", "refs/heads/main", "workflow_dispatch"),
                                 ("128june/KNOW-HOW", "refs/heads/feature", "workflow_dispatch"),
                                 ("128june/KNOW-HOW", "refs/heads/main", "pull_request")):
            with patch.dict(os.environ, {"GITHUB_REPOSITORY": repo, "GITHUB_REF": ref, "GITHUB_EVENT_NAME": event}), patch.object(syncer, "sync") as sync, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(syncer.main(), 1)
                sync.assert_not_called()

    def test_invalid_key_is_not_logged(self):
        with patch.dict(os.environ, {"GITHUB_REPOSITORY": "128june/KNOW-HOW", "GITHUB_REF": "refs/heads/main", "GITHUB_EVENT_NAME": "workflow_dispatch", "KNOWHOW_BACKEND_SYNC_TOKEN": "test-token", "OPENAI_API_KEY_1": "test-private\ninvalid"}), contextlib.redirect_stderr(io.StringIO()) as stderr:
            self.assertEqual(syncer.main(), 1)
        self.assertNotIn("test-private", stderr.getvalue())

    def test_workflow_never_exports_unrelated_secret_context(self):
        workflow = (ROOT / ".github/workflows/sync-openai-secrets.yml").read_text()
        self.assertNotIn("toJSON(secrets)", workflow)
        self.assertNotIn("toJson(secrets)", workflow)
        references = re.findall(r"\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}", workflow)
        self.assertEqual(set(references), {"KNOWHOW_BACKEND_SYNC_TOKEN", *syncer.WORKFLOW_KEY_NAMES})

    def test_main_collects_only_explicit_slots(self):
        env = {"GITHUB_REPOSITORY": "128june/KNOW-HOW", "GITHUB_REF": "refs/heads/main",
               "GITHUB_EVENT_NAME": "workflow_dispatch", "KNOWHOW_BACKEND_SYNC_TOKEN": "test-token",
               "OPENAI_API_KEY_1": "test-key-a", "OPENAI_API_KEY_20": "test-key-b",
               "OPENAI_API_KEY_21": "test-excluded", "OTHER_SECRET": "test-excluded"}
        with patch.dict(os.environ, env, clear=True), patch.object(syncer, "sync", return_value=2) as sync, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(syncer.main(), 0)
        self.assertEqual(sync.call_args.args[0], {"KNOWHOW_BACKEND_SYNC_TOKEN": "test-token", "OPENAI_API_KEY_1": "test-key-a", "OPENAI_API_KEY_20": "test-key-b"})

    def test_public_build_excludes_runtime_secret_environment(self):
        # Exercise the real builder in an isolated copy so another UI build is
        # unaffected. These markers are invented and cannot authorize anything.
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "tools").mkdir()
            shutil.copyfile(ROOT / "tools/build.py", root / "tools/build.py")
            shutil.copytree(ROOT / "src", root / "src")
            env = dict(os.environ, KNOWHOW_API_BASE="https://api.ctrl-j.xyz/knowhow",
                       OPENAI_API_KEY_1="test-public-build-key-marker",
                       KNOWHOW_OPENAI_KEYS_JSON='{"OPENAI_API_KEY_1":"test-public-build-key-marker"}',
                       KNOWHOW_BACKEND_SYNC_TOKEN="test-public-build-token-marker")
            subprocess.run([sys.executable, "-B", str(root / "tools/build.py")],
                           env=env, check=True, capture_output=True)
            names = {path.name for path in (root / "dist").iterdir()}
            self.assertEqual(names, {"index.html", "style.css", "app.js", "demo.js", "config.js", ".nojekyll"})
            for path in (root / "dist").iterdir():
                self.assertNotIn(b"test-public-build-key-marker", path.read_bytes())
                self.assertNotIn(b"test-public-build-token-marker", path.read_bytes())


if __name__ == "__main__":
    unittest.main()
