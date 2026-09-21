"""Local-only company workflow UI fixture server. No model or product API calls."""
import argparse, copy, json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
text=(ROOT/'src/demo-example.js').read_text(); fixture=json.loads(text[text.index('=')+1:].strip().rstrip(';'))
state={'sessions':0,'documents':{},'events':[]}
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
    def reply(self,value,status=200):
        data=json.dumps(value,ensure_ascii=False).encode(); self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_GET(self):
        if self.path=='/__mock__/report': return self.reply(state)
        return super().do_GET()
    def do_POST(self):
        b=json.loads(self.rfile.read(int(self.headers['Content-Length']))); action=self.path.rsplit('/',1)[-1]; state['events'].append({'action':action,**b})
        if action=='session':
            state['sessions']+=1;return self.reply({'session_id':'mock-company-'+str(state['sessions']),'expires_in':28800})
        if action=='search':
            other={'station_key':'unmapped-station','name':'다른 공개 충전소','address':'서울 강남구 공개도로 10','operator':'공개 운영사','row_count':1}
            return self.reply({'stations':[fixture['station'],other],'total':2,'source':fixture['source']})
        if action=='chargers':
            if b['station_key']==fixture['station']['station_key']: return self.reply({'station':fixture['station'],'chargers':fixture['chargers'],'source':fixture['source']})
            return self.reply({'station':{'station_key':'unmapped-station','name':'다른 공개 충전소','address':'서울 강남구 공개도로 10','operator':'공개 운영사'},'chargers':[{'record_key':'unmapped-public-row','charger_id':'01','type':'DC콤보'}],'source':fixture['source']})
        if not b.get('session_id','').startswith('mock-company-'): return self.reply({'error':'세션 만료'},401)
        if action=='catalog': return self.reply({'documents':[d for d in state['documents'].values() if d['department']==b['department'] and d['session']==b['session_id']]})
        if action=='save':
            key='company-doc-'+str(len(state['documents'])+1);d={**b,'session':b['session_id'],'id':key,'version':1,'state':'draft','comments':[],'history':[]};d['history']=[{k:copy.deepcopy(v) for k,v in d.items() if k not in ('comments','history')}];state['documents'][key]=d;return self.reply(d)
        d=state['documents'].get(b.get('id',b.get('document_id')))
        if not d or d['session']!=b['session_id'] or d['department']!=b['department']: return self.reply({'error':'문서 없음'},404)
        if action=='document': return self.reply(d)
        if action=='compare-versions': return self.reply({'id':d['id'],'current_version':d['version'],'before':next(v for v in d['history'] if v['version']==b['from_version']),'after':next(v for v in d['history'] if v['version']==b['to_version'])})
        if action in ('comment','review','revise') and b['version']!=d['version']:return self.reply({'error':'최신 버전을 다시 확인하세요.'},409)
        if action=='comment':
            c={'id':'comment-'+str(len(d['comments'])+1),'document_id':d['id'],'version':d['version'],'body':b['body'],'author_role':b.get('author_role','member'),'state':'unverified','resolved_version':None};d['comments'].append(c);return self.reply({'id':d['id'],'version':d['version'],'comment':c,'comments':d['comments']})
        if action=='revise':
            d.update({k:b[k] for k in ('content','reason','source','identifiers') if k in b});d['version']+=1;d['state']='draft';d['pending']=b.get('resolve_comment_ids',[]);d['history'].append({k:copy.deepcopy(v) for k,v in d.items() if k not in ('comments','history')});return self.reply(d)
        if action=='review':
            d['state']='confirmed';d['history'][-1]['state']='confirmed'
            for c in d['comments']:
                if c['id'] in d.get('pending',[]):c['resolved_version']=d['version']
            return self.reply(d)
        if action=='chat':
            evidence=[] if d['state']!='confirmed' else [{'id':d['id'],'title':d['title'],'version':d['version'],'department':d['department'],'text':d['content']}]
            return self.reply({'ai_generated':bool(b.get('generate') and evidence),'answer':'로컬 모의 답변: 최신 확인 문서에 따라 발생 시각과 오류 화면을 전달하세요.' if b.get('generate') and evidence else None,'ai':{'status':'로컬 모의 응답'},'evidence':evidence})
        return self.reply({'error':'모의 경로 미지원'},404)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=18774);a=p.parse_args();print('Local mock only on',a.port,flush=True);ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
