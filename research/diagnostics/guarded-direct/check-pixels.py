"""Independently isolate every boundary of the captured actual incoming rays."""
from pathlib import Path
import json,sys,hashlib,time
here=Path(__file__).resolve().parent;root=here.parents[2];sys.path.insert(0,str(root/'research'))
from reference import roots
r=json.loads((here/'results/pixel-probes.json').read_text());records=[];start=time.monotonic()
for p,h in r['hashes'].items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,p
for point in r['records']:
 u=point['uniforms'];P=[u['uP'][i:i+4] for i in range(0,16,4)];levels=[]
 for i in range(u['uCount']):
  if not u['uEnabled'][i]:continue
  levels.extend([(i,u['uLows'][i]),(i,u['uHighs'][i])] if u['uShells'][i] else [(i,u['uLevels'][i])])
 queries=[]
 for event in point['events']:
  cutoff=.5*u['uRayBias']*max(1,sum(x*x for x in event['o'])**.5);refs=[];candidates=[]
  for object_id,level in levels:
   ref=roots(P,level,event['o'],event['d']);refs.append({'id':object_id,'level':level,'reference':ref})
   candidates.extend((float(v['s']),object_id,level) for v in ref['roots'] if float(v['s'])>cutoff)
  expected=min(candidates,default=(-1,-1,0));error=abs(event['s']-expected[0])/max(1,abs(expected[0]))
  failed=(event['s']<0)!=(expected[0]<0) or error>1e-4
  if failed:print('FAIL',point['index'],point['width'],point['x'],point['y'],event['step'],event['s'],expected,error,flush=True)
  queries.append({**event,'cutoff':cutoff,'expected':expected,'error':error,'failed':failed,'references':refs})
 row={k:point[k] for k in ['index','width','height','x','y','difference','color','instrumentedColor']};row['queries']=queries;records.append(row)
 print('Checked',point['index'],point['width'],point['x'],point['y'],len(queries),'queries',flush=True)
result={'seconds':time.monotonic()-start,'queries':sum(len(p['queries']) for p in records),
 'failed':sum(q['failed'] for p in records for q in p['queries']),'records':records}
(here/'results/pixel-analysis.json').write_text(json.dumps(result,indent=2)+'\n')
print('Exact pixel checks:',result['queries'],'queries;',result['failed'],'failures')
if result['failed']:raise SystemExit(1)
