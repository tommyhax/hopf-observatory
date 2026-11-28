"""Recheck captured accuracy, shader identity, frame timings and preservation."""
from pathlib import Path
import json,hashlib,statistics,math,sys,gzip
import numpy as np
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'research'))
from analyze import match
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(name):return json.loads((HERE/'results'/name).read_text())
def hashes(r):
 for field in ['hashes','sourceHashes']:
  for p,h in r.get(field,{}).items():assert digest(ROOT/p)==h,p
roots=load('roots.json');fixtures=load('fixtures.json');benchmark=load('benchmark.json');renders=load('renders.json');pixels=load('pixel-probes.json')
for r in [roots,fixtures,benchmark,renders,pixels]:hashes(r)
for corpus,size in [('original',867),('stress',2400)]:
 ref=json.loads((ROOT/'research/results'/('reference.json' if corpus=='original' else 'stress-reference.json')).read_text())['cases']
 rows=roots['results'][corpus];assert len(rows)==size and {c['id'] for c in rows}=={c['id'] for c in ref}
 expected={c['id']:[float(x['s']) for x in c['reference']['roots']] for c in ref}
 for row in rows:
  assert not match(expected[row['id']],row['direct'],1e-4)['failed'],(corpus,row)
  assert not match(expected[row['id']],row['paired-direct'],1e-7)['failed'],(corpus,row)
 for name in ['direct','paired-direct']:
  assert all(row[name][1]==0 for row in roots['diagnostics'][corpus]),'Unresolved corpus guard'
for name in ['direct','paired-direct']:
 selected=[r for r in load('fixture-analysis.json')['results'] if r['variant']==name]
 assert len(selected)==54 and len({r['id'] for r in selected})==54
 assert not any(match(list(map(float,r['expected'])),r['actual'],1e-4)['failed'] for r in selected)
 assert fixtures['rendererHashes'][name]==roots['rendererHashes'][name]
for name in ['production','direct']:
 source=roots['rendererSources'][name]
 h=hashlib.sha256(source.encode()).hexdigest()
 assert h==roots['rendererHashes'][name]==benchmark['shaderHashes'][name]==renders['shaderHashes'][name]
 transport=load('transport-'+name+'.json');hashes(transport)
 assert transport['passed'] and all(r['passed']==r['total'] for r in transport['results'].values())
 assert transport['shaderHashes']['fragment']==h
 assert transport['hardware']==benchmark['hardware']==roots['hardware']==renders['hardware']==fixtures['hardware']
assert pixels['shaderHash']==benchmark['shaderHashes']['direct']
assert len(benchmark['measurements'])==24
scene_names=[x['scene'] for x in benchmark['summaries']]
accepted=json.loads((ROOT/'research/diagnostics/algorithm1010/final/results/webgl-benchmark.json').read_text())
scenes=[v for v in accepted['measurements'] if v['variant']=='production' and v['round']==0]
for i,summary in enumerate(benchmark['summaries']):
 assert summary['scene']==scenes[i]['scene']
 for name in ['production','direct']:
  blocks=[b for b in benchmark['measurements'] if b['scene']==summary['scene'] and b['variant']==name]
  assert [b['round'] for b in blocks]==[0,1,2]
  for b in blocks:
   assert b['uniforms']==scenes[i]['uniforms'] and b['width']==1280 and b['height']==720
   assert not b['disjoint'] and b['frames']==10 and b['warmup']==5
   assert b['order']==(['direct','production'] if (i+b['round'])%2 else ['production','direct'])
   for key in ['gpuMilliseconds','completionMilliseconds']:assert len(b[key])==10 and all(math.isfinite(x) and x>0 for x in b[key])
  assert statistics.median([x for b in blocks for x in b['gpuMilliseconds']])==summary[name]['gpuMedian']
  assert statistics.median([x for b in blocks for x in b['completionMilliseconds']])==summary[name]['completionMedian']
images=load('image-analysis.json')['images'];assert len(images)==16 and len(renders['renders'])==32
for row in images:
 pairs=[]
 for name in ['production','direct']:
  v=next(v for v in renders['renders'] if v['variant']==name and all(v[k]==row[k] for k in ['index','mode','width','height']))
  p=ROOT/v['path'];assert digest(p)==v['sha256']
  pairs.append(np.frombuffer(gzip.decompress(p.read_bytes()),np.uint8).reshape(row['height'],row['width'],4)[::-1])
 d=np.abs(pairs[0][:,:,:3].astype(int)-pairs[1][:,:,:3].astype(int));assert d.max()==row['maxChannelDifference']
 assert int((d.max(2)>3).sum())==row['pixelsOver3']
expected_points={(r['index'],r['width'],p['x'],p['y']) for r in images if r['mode']==0 for p in r['outliers']}
assert expected_points=={(p['index'],p['width'],p['x'],p['y']) for p in pixels['records']}
for p in pixels['records']:
 assert p['color']==p['instrumentedColor']
 assert [round(max(0,min(1,c))*255) for c in p['color']]==p['direct']
 assert all(q['color']==p['color'] for q in p['events'])
exact=load('pixel-analysis.json');assert exact['failed']==0 and exact['queries']==313
assert exact['queries']==sum(len(p['events']) for p in pixels['records'])
for p in exact['records']:
 for q in p['queries']:
  assert not q['failed'] and q['error']<=1e-4
  candidates=[float(v['s']) for ref in q['references'] for v in ref['reference']['roots'] if float(v['s'])>q['cutoff']]
  assert q['expected'][0]==min(candidates,default=-1)
preview=load('preview.json');hashes(preview);assert len(preview['results'])==2 and all(r['pass'] for r in preview['results'])
prior=json.loads((ROOT/'research/diagnostics/native-algebraic/results/analysis.json').read_text())
for p,h in prior['hashes'].items():assert digest(ROOT/p)==h,p
trial=HERE/'trials/initial';manifest=json.loads((trial/'manifest.json').read_text())
for p,h in manifest.items():assert digest(trial/p)==h,p
old=json.loads((trial/'results/roots.json').read_text())
for p,h in old['hashes'].items():
 local=trial/Path(p).relative_to(HERE.relative_to(ROOT)) if p.startswith(str(HERE.relative_to(ROOT))+'/') else ROOT/p
 assert digest(local)==h,p
for file in HERE.glob('*'):
 if file.suffix in ['.mjs','.py','.md','.glsl','.in']:
  assert all(line==line.rstrip() for line in file.read_text().splitlines()),file
result={'passed':True,'rays':3267,'fixtures':54,'imageComparisons':16,'exactPixelQueries':313,'timedFrames':240,
 'priorProtectedSources':len(prior['hashes']),'archivedTrialFiles':len(manifest)}
(HERE/'results/verification.json').write_text(json.dumps(result,indent=2)+'\n')
print('Verified:',result)
