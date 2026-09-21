"""Build an allowlisted static Pages artifact, without runtime data."""
import hashlib, json, os, shutil
from pathlib import Path
from urllib.parse import urlparse
root = Path(__file__).resolve().parents[1]
ai_pause = os.environ.get('KNOWHOW_AI_PAUSED', 'true').strip().lower() or 'true'
if ai_pause not in ('true', 'false'):
    raise SystemExit('KNOWHOW_AI_PAUSED must be true or false')
base = os.environ.get('KNOWHOW_API_BASE', '').strip().rstrip('/')
if base:
    u = urlparse(base)
    if u.scheme != 'https' or not u.hostname or u.username or u.password or u.path not in ('', '/knowhow') or u.query or u.fragment:
        raise SystemExit('KNOWHOW_API_BASE must be a public HTTPS origin with optional /knowhow path and without credentials')
out = root / 'dist'
if out.exists(): shutil.rmtree(out)
out.mkdir()
for name in ('index.html','style.css','shell.css','app.js','demo-example.js','source-records.js','organization-kb.js','demo.js','general-knowledge.js','data-knowledge-bridge.js','data-explorer.js','data-platform.js','platform-shell.js'): shutil.copyfile(root/'src'/name,out/name)
(out/'config.js').write_text('window.KNOWHOW_CONFIG = '+json.dumps({'apiBase':base,'aiRequestsPaused':ai_pause=='true'})+';\n')
# New HTML refers to the exact build assets, avoiding stale browser script caches.
index = (out/'index.html').read_text()
for asset in ('style.css', 'shell.css', 'config.js', 'app.js', 'demo-example.js', 'source-records.js', 'organization-kb.js', 'demo.js', 'general-knowledge.js', 'data-knowledge-bridge.js','data-explorer.js','data-platform.js', 'platform-shell.js'):
    digest = hashlib.sha256((out/asset).read_bytes()).hexdigest()[:12]
    index = index.replace('./'+asset+'"', './'+asset+'?v='+digest+'"')
(out/'index.html').write_text(index)
(out/'.nojekyll').touch()
print('Built dist: '+', '.join(sorted(p.name for p in out.iterdir())))
