"""Build an allowlisted static Pages artifact, without runtime data."""
import hashlib, json, os, shutil
from pathlib import Path
from urllib.parse import urlparse
root = Path(__file__).resolve().parents[1]
ai_pause = os.environ.get('KNOWHOW_AI_PAUSED', 'true').strip().lower() or 'true'
if ai_pause not in ('true', 'false'):
    raise SystemExit('KNOWHOW_AI_PAUSED must be true or false')
base = os.environ.get('KNOWHOW_API_BASE', '').strip().rstrip('/')
general_base = os.environ.get('KNOWHOW_GENERAL_API_BASE', '').strip().rstrip('/')
if general_base:
    g = urlparse(general_base)
    if g.scheme != 'https' or not g.hostname or g.username or g.password or g.path not in ('', '/knowhow') or g.query or g.fragment:
        raise SystemExit('KNOWHOW_GENERAL_API_BASE must be a public HTTPS origin with optional /knowhow path')
if base:
    u = urlparse(base)
    if u.scheme != 'https' or not u.hostname or u.username or u.password or u.path not in ('', '/knowhow') or u.query or u.fragment:
        raise SystemExit('KNOWHOW_API_BASE must be a public HTTPS origin with optional /knowhow path and without credentials')
out = root / 'dist'
if out.exists(): shutil.rmtree(out)
out.mkdir()
for name in ('index.html','style.css','shell.css','app.js','demo-example.js','source-records.js','organization-kb.js','demo.js','general-knowledge.js','general-workflow-fixture.js','general-workflow-core.js','general-workflow-store.js','general-workflow-ui.js','general-workflow.css','data-knowledge-bridge.js','data-explorer.js','data-review-ui.js','data-handoff-ui.js','data-platform.css','data-lineage-ui.js','data-platform.js','support-workspace.js','support-workspace.css','kb-catalog.js','kb-lineage.js','kb-lineage.css','home-knowledge.js','home-knowledge.css','clarity-design.css','platform-shell.js'): shutil.copyfile(root/'src'/name,out/name)
config = {'apiBase':base,'aiRequestsPaused':ai_pause=='true'}
if general_base: config['generalApiBase'] = general_base
(out/'config.js').write_text('window.KNOWHOW_CONFIG = '+json.dumps(config)+';\n')
# New HTML refers to the exact build assets, avoiding stale browser script caches.
index = (out/'index.html').read_text()
for asset in ('style.css', 'shell.css', 'config.js', 'app.js', 'demo-example.js', 'source-records.js', 'organization-kb.js', 'demo.js', 'general-knowledge.js','general-workflow-fixture.js','general-workflow-core.js','general-workflow-store.js','general-workflow-ui.js','general-workflow.css', 'data-knowledge-bridge.js','data-explorer.js','data-review-ui.js','data-handoff-ui.js','data-platform.css','data-lineage-ui.js','data-platform.js','support-workspace.js','support-workspace.css','kb-catalog.js','kb-lineage.js','kb-lineage.css','home-knowledge.js','home-knowledge.css','clarity-design.css', 'platform-shell.js'):
    digest = hashlib.sha256((out/asset).read_bytes()).hexdigest()[:12]
    index = index.replace('./'+asset+'"', './'+asset+'?v='+digest+'"')
(out/'index.html').write_text(index)
(out/'.nojekyll').touch()
print('Built dist: '+', '.join(sorted(p.name for p in out.iterdir())))
