"""Exact independent checks of all boundary queries on the outlier paths."""
from pathlib import Path
import sys,json,time
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'research'))
from reference import roots,polynomial
scenes=json.loads((ROOT/'native/scenes/benchmark.json').read_text())['scenes']
points=json.loads((HERE/'results/outlier-final.json').read_text())
start=time.monotonic();paths=[]
for point in points:
    u=scenes[point['scene']]['uniforms'];P=[u['uP'][i:i+4] for i in range(0,16,4)]
    name=f"pixel-{point['scene']}-{point['width']}-{point['x']}-{point['y']}-queries.ndjson"
    queries=[]
    for i,line in enumerate((HERE/'results'/name).read_text().splitlines()):
        q=json.loads(line);reference=roots(P,q['level'],q['o'],q['d'])
        cutoff=.5*u['uRayBias']*max(1,sum(x*x for x in q['o'])**.5)
        candidates=[float(x['s']) for x in reference['roots'] if float(x['s'])>cutoff]
        expected=min(candidates,default=-1)
        error=abs(q['hit']-expected)/max(1,abs(expected))
        queries.append(dict(**q,index=i,reference=reference,expected=expected,error=error,
                            failed=(q['hit']<0)!=(expected<0) or error>1e-6))
    paths.append(dict(scene=point['scene'],width=point['width'],x=point['x'],y=point['y'],queries=queries))
misses=json.loads((HERE/'results/invalid-replay.json').read_text())
P=[misses['P'][i:i+4] for i in range(0,16,4)]
for row in misses['rows']:assert polynomial(P,row['level'],row['o'],row['d']).count_roots()==0
report=dict(seconds=time.monotonic()-start,paths=paths,queries=sum(len(p['queries']) for p in paths),
    failedQueries=sum(q['failed'] for p in paths for q in p['queries']),exactMissesVerified=len(misses['rows']))
(HERE/'results/exact-outliers-final.json').write_text(json.dumps(report,indent=2)+'\n')
print(report['queries'],'exact boundary queries;',report['failedQueries'],'failures;',report['exactMissesVerified'],'exact misses verified')
if report['failedQueries']:raise SystemExit(1)
