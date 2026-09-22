"""Isolated local UI preview; never changes production config or another server."""
import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=18962)
parser.add_argument('--api', default='http://127.0.0.1:18963/knowhow')
args = parser.parse_args()
source = Path(__file__).resolve().parents[1] / 'src'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(source), **kw)

    def do_GET(self):
        if self.path.split('?')[0] == '/config.js':
            body = ('window.KNOWHOW_CONFIG = ' + json.dumps({
                'apiBase': args.api, 'generalApiBase': args.api,
                'aiRequestsPaused': True,
            }) + ';').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

if __name__ == '__main__':
    print(f'General workflow UI: http://127.0.0.1:{args.port}/#general-1', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
