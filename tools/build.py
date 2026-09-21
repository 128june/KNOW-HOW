"""Build an allowlisted static Pages artifact, without runtime data."""
import json, os, shutil
from pathlib import Path
from urllib.parse import urlparse
root = Path(__file__).resolve().parents[1]
base = os.environ.get('KNOWHOW_API_BASE', '').strip().rstrip('/')
if base:
    u = urlparse(base)
    if u.scheme != 'https' or not u.hostname or u.username or u.password or u.path not in ('', '/knowhow') or u.query or u.fragment:
        raise SystemExit('KNOWHOW_API_BASE must be a public HTTPS origin with optional /knowhow path and without credentials')
out = root / 'dist'
if out.exists(): shutil.rmtree(out)
out.mkdir()
for name in ('index.html','style.css','app.js'): shutil.copyfile(root/'src'/name,out/name)
(out/'config.js').write_text('window.KNOWHOW_CONFIG = '+json.dumps({'apiBase':base})+';\n')
(out/'.nojekyll').touch()
print('Built dist: '+', '.join(sorted(p.name for p in out.iterdir())))
