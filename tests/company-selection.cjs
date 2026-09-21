const fs=require('node:fs'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/company-live.cjs','utf8').split('(async()=>{')[0].replace('request,render};','request,render,selectStation,moreChargers,restore,charger,target};');
const {setup,response}=new Function('require',harness+'\nreturn {setup,response};')(require);
(async()=>{
 const {api,c,nodes,storage}=setup('#scenario-1');api.activate();const station=api.state.station;
 const rows=Array.from({length:51},(_,n)=>({record_key:'row-'+n,charger_id:n===50?'02':n===0?'01':'later-'+n}));
 const calls=[];let includeMatch=true,duplicate=false,changedSource=false;
 c.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});assert(url.endsWith('/workflow/chargers'));
  const choices=includeMatch?rows:rows.slice(0,50);
  return response({station:{...station,row_count:choices.length},chargers:duplicate?choices.slice(0,1):choices.slice(body.offset,body.offset+body.limit),total:choices.length,source:{preserved:changedSource?'changed-source':'source'}});
 };
 api.state.chargerId='02';api.state.q='GS타워';api.state.stations=[station];
 await api.selectStation(0);assert.equal(api.state.recordKey,'','never substitutes 01 when searched 02 is not loaded');
 assert.match(api.target(),/<option value="" selected>/);assert.match(api.target(),/more-chargers/);assert.match(api.state.notice,/아직 불러온 목록/);
 const count=calls.length;await assert.rejects(()=>api.openSelected(),/먼저 선택/);assert.equal(calls.length,count,'no KB session or query before target selection');
 api.state.recordKey='old';api.state.chargerId='01';api.restore();assert.equal(api.state.recordKey,'');assert.equal(api.state.chargerId,'02','restore pending exact ID rather than initial 01');
 await api.moreChargers();assert.equal(api.charger().charger_id,'02');assert.deepEqual(calls.map(c=>c.body.offset),[0,50]);assert.equal(api.state.chargers.length,51);assert(!api.target().includes('more-chargers'));
 assert.equal(api.state.document,null);assert.equal(api.state.department,'app');
 // A directly chosen alternative must survive subsequent list expansion.
 await api.selectStation(0);api.state.recordKey='row-0';await api.moreChargers();assert.equal(api.charger().charger_id,'01');
 // No matching current source: keep selection empty and explain it.
 includeMatch=false;await api.selectStation(0);assert.equal(api.state.recordKey,'');assert.match(api.state.notice,/찾지 못했습니다/);assert(!api.target().includes('more-chargers'));
 // A normal no-ID station search still starts at its first real row.
 api.state.chargerId='';await api.selectStation(0);assert.equal(api.charger().charger_id,'01');
 // Refuse a repeated page instead of accumulating duplicate source rows.
 includeMatch=true;api.state.chargerId='02';await api.selectStation(0);duplicate=true;
 await assert.rejects(()=>api.moreChargers(),/목록이 변경/);assert.equal(api.state.chargers.length,50);assert.equal(api.state.recordKey,'');
 duplicate=false;changedSource=true;await assert.rejects(()=>api.moreChargers(),/목록이 변경/);assert.equal(api.state.chargers.length,50);assert.equal(api.state.source.preserved,'source');
 assert(calls.every(c=>!c.body.generate));
 console.log('PASS: exact charger ID, explicit later-page selection, no wrong-row fallback, pending reload, chosen target preserved, no KB/model requests before selection');
})().catch(error=>{console.error(error);process.exitCode=1});
