import json,sys,hashlib
from pathlib import Path
here=Path(__file__).resolve().parent;root=here.parents[2]
sys.path.insert(0,str(root/'research'))
from analyze import match
r=json.loads((here/'results/roots.json').read_text());out={};failures=[]
for p,h in r['hashes'].items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,p
for corpus,rows in r['results'].items():
 refs={c['id']:c for c in json.loads((root/'research/results'/('stress-reference.json' if corpus=='stress' else 'reference.json')).read_text())['cases']}
 out[corpus]={}
 for name in rows[0]:
  if name=='id':continue
  out[corpus][name]={}
  for tol in [1e-4,1e-6,1e-7]:
   ms=[match([float(v['s']) for v in refs[row['id']]['reference']['roots']],row[name],tol) for row in rows]
   bad=[row['id'] for row,m in zip(rows,ms) if m['failed']]
   out[corpus][name][str(tol)]={'failed':len(bad),'ids':bad,'maxError':max((e for m in ms for e in m['errors']),default=0)}
   if tol==1e-4:
    print(corpus,name,'failed',len(bad),'/',len(rows),'ids',bad[:20])
    for row,m in zip(rows,ms):
     if m['failed']:failures.append({'corpus':corpus,'variant':name,'id':row['id'],'actual':row[name],
      'expected':[v['s'] for v in refs[row['id']]['reference']['roots']]})
 for name in [n for n in rows[0] if n not in ['id','production']]:
  ds=[row[name] for row in r['diagnostics'][corpus]]
  print(corpus,name,'wide',sum(x[0] for x in ds),'uncertain',sum(x[1] for x in ds))
(here/'results/root-analysis.json').write_text(json.dumps({'summary':out,'failures':failures},indent=2)+'\n')
