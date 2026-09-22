"""Build real static artifacts in isolation; no server or model calls."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class BuildConfigurationTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        shutil.copytree(ROOT / 'src', self.root / 'src')
        (self.root / 'tools').mkdir()
        shutil.copyfile(ROOT / 'tools/build.py', self.root / 'tools/build.py')

    def build(self, pause=None, general=None):
        env = {key: os.environ[key] for key in ('PATH', 'SYSTEMROOT') if key in os.environ}
        env['KNOWHOW_API_BASE'] = 'https://api.example.test/knowhow'
        if general is not None:
            env['KNOWHOW_GENERAL_API_BASE'] = general
        if pause is not None:
            env['KNOWHOW_AI_PAUSED'] = pause
        return subprocess.run([sys.executable, '-I', '-S', '-B', str(self.root / 'tools/build.py')],
                              env=env, capture_output=True, text=True, check=False)

    def config(self):
        text = (self.root / 'dist/config.js').read_text()
        return json.loads(text.split(' = ', 1)[1].removesuffix(';\n'))

    def test_default_and_empty_settings_keep_generation_paused(self):
        for value in (None, '', 'true'):
            with self.subTest(value=value):
                self.assertEqual(self.build(value).returncode, 0)
                self.assertEqual(self.config(), {'apiBase': 'https://api.example.test/knowhow', 'aiRequestsPaused': True})

    def test_general_api_is_explicit_and_invalid_setting_preserves_artifact(self):
        self.assertEqual(self.build(general='https://api.example.test/knowhow').returncode, 0)
        self.assertEqual(self.config()['generalApiBase'], 'https://api.example.test/knowhow')
        before = (self.root / 'dist/config.js').read_bytes()
        self.assertNotEqual(self.build(general='http://unsafe.example.test').returncode, 0)
        self.assertEqual((self.root / 'dist/config.js').read_bytes(), before)

    def test_explicit_resume_changes_the_browser_config_asset(self):
        self.assertEqual(self.build('true').returncode, 0)
        paused_html = (self.root / 'dist/index.html').read_text()
        self.assertEqual(self.build('false').returncode, 0)
        self.assertFalse(self.config()['aiRequestsPaused'])
        resumed_html = (self.root / 'dist/index.html').read_text()
        def reference(html):
            return html.split('./config.js?v=', 1)[1].split('"', 1)[0]
        self.assertNotEqual(reference(paused_html), reference(resumed_html))

    def test_invalid_setting_fails_before_replacing_existing_artifacts(self):
        self.assertEqual(self.build('true').returncode, 0)
        before = (self.root / 'dist/config.js').read_bytes()
        result = self.build('flase')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('KNOWHOW_AI_PAUSED must be true or false', result.stderr)
        self.assertEqual((self.root / 'dist/config.js').read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
