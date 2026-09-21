"""Loopback-only, disposable real API/Worker for data-lineage-live-browser.cjs.

Run with a Python environment containing the API test dependencies:
  python tests/data-lineage-local-api.py --api-repo ../ctrl-j-data-lineage
No production files/settings are loaded or changed. Provider functions fail closed.
"""
import argparse
import importlib
import os
from pathlib import Path
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--api-repo', type=Path, required=True)
    parser.add_argument('--port', type=int, default=18773)
    parser.add_argument('--origin', default='http://127.0.0.1:18923')
    args = parser.parse_args()
    if not args.origin.startswith('http://127.0.0.1:'):
        parser.error('Only a loopback browser origin is allowed')
    with tempfile.TemporaryDirectory(prefix='knowhow-lineage-live-') as directory:
        os.environ.update({
            'APP_RUNTIME': 'test', 'LLM_PROVIDER': 'mock',
            'DATA_PLATFORM_DATA_DIR': str(Path(directory) / 'platform'),
            'KNOWHOW_DATA_DIR': str(Path(directory) / 'knowledge'),
            'DATA_PLATFORM_ENABLE_PUBLIC_DEMO': 'true',
            'KNOWHOW_ENABLE_PUBLIC_DEMO_AI': 'false',
            'KNOWHOW_VISITOR_EMBEDDINGS_ENABLED': 'false',
            'KNOWHOW_EMBEDDINGS_ENABLED': 'false',
        })
        sys.path.insert(0, str(args.api_repo.resolve() / 'services/api'))
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        import uvicorn
        routing = importlib.import_module('app.modules.data_platform.router')
        from app.modules.knowhow import ai_provider, inquiry_provider, vector_store

        calls = dict(generation=0, inquiry=0, embeddings=0, vector_client=0)

        def guard(name):
            def forbidden(*_args, **_kwargs):
                calls[name] += 1
                raise AssertionError('Provider calls forbidden in lineage verification: ' + name)
            return forbidden

        ai_provider.generate = guard('generation')
        inquiry_provider.generate = guard('inquiry')
        vector_store.request_embeddings = guard('embeddings')
        vector_store.VectorStore._client = guard('vector_client')
        app = FastAPI()
        app.add_middleware(CORSMiddleware, allow_origins=[args.origin],
                           allow_methods=['GET', 'POST', 'OPTIONS'],
                           allow_headers=['Authorization', 'Content-Type'])
        app.include_router(routing.router, prefix='/data-platform')

        @app.get('/test/provider-calls')
        def provider_calls():
            return calls

        uvicorn.run(app, host='127.0.0.1', port=args.port, access_log=False)


if __name__ == '__main__':
    main()
