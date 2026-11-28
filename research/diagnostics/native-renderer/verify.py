"""Recompute checks from captures; reject stale sources or changed evidence."""
from pathlib import Path
import hashlib,json,gzip,statistics,sys
import numpy as np
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'research'))
from analyze import match
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
capture=read(HERE/'results/captures.json');benchmark=read(HERE/'results/benchmark.json')
for report in [capture,benchmark]:
    for name,h in report['hashes'].items():assert sha(ROOT/name)==h,name
assert capture['hashes']==benchmark['hashes']
assert read(HERE/'results/transport-native.json')['passed']
prior=read(HERE.parent/'native-algebraic/results/analysis.json')
for name,h in prior['hashes'].items():assert sha(ROOT/name)==h,name

references={name:read(ROOT/f'research/results/{name}.json')['cases'] for name in ['reference','stress-reference']}
rootRows=read(HERE/'results/roots.json')['rows']
assert len(rootRows)==3267
for corpus,cases in references.items():
    actual=[r for r in rootRows if r['corpus']==corpus];assert len(actual)==len(cases)
    for case,row in zip(cases,actual):
        assert case['id']==row['id'];expected=[float(x['s']) for x in case['reference']['roots']]
        assert not match(expected,row['actual'],1e-8)['failed'],(corpus,row['id'])

validation=read(HERE/'results/validation.json');assert len(capture['measurements'])==16
for cap,row in zip(capture['measurements'],validation['images']):
    assert cap['scene']==row['scene'] and cap['mode']==row['mode'] and cap['width']==row['width']
    assert sha(Path(cap['nativePath']))==cap['nativeSHA256']
    assert sha(ROOT/cap['gpuPath'])==cap['gpuSHA256']
    a=np.frombuffer(gzip.decompress(Path(cap['nativePath']).read_bytes()),np.uint8).reshape(-1,4)
    b=np.frombuffer(gzip.decompress((ROOT/cap['gpuPath']).read_bytes()),np.uint8).reshape(-1,4)
    difference=np.abs(a[:,:3].astype(int)-b[:,:3].astype(int)).max(axis=1)
    assert int(difference.max())==row['maxDifference']
    assert int(np.count_nonzero(difference>3))==row['over3']
    assert int(np.count_nonzero(difference>16))==row['over16']
    assert row['over3']<=12  # Every substantial outlier is in the saved list.
    assert cap['native']['invalidRoots']==cap['native']['invalidPixels']==0

assert len(benchmark['measurements'])==24
for summary in benchmark['summary']:
    scene=summary['scene']
    cap=next(r for r in capture['measurements'] if r['scene']==scene and r['width']==1280)
    for backend in ['native','gpu']:
        rows=[r for r in benchmark['measurements'] if r['scene']==scene and r['backend']==backend]
        assert len(rows)==3 and {r['block'] for r in rows}=={0,1,2}
        assert all(r['frames']==3 and r['warmup']==1 and r['width']==1280 and r['height']==720 for r in rows)
        for r in rows:
            assert r['uniforms']==cap['uniforms']
            assert len(r['result']['milliseconds'])==len(r['result']['completionMilliseconds'])==3
            assert all(x>0 for x in r['result']['milliseconds'])
            if backend=='native':
                assert r['result']['invalidRoots']==r['result']['invalidPixels']==0
                assert r['result']['checksum']==cap['native']['checksum']
                assert r['result']['presentationBackend']=='metal'
                for key in ['escalated113','escalated256']:assert r['result'][key]==4*cap['native'][key]
            else:assert r['result']['glError']==0 and not r['result']['disjoint']
        median=statistics.median(x for r in rows for x in r['result']['completionMilliseconds'])
        assert median==summary['nativeCompletedMs' if backend=='native' else 'gpuCompletedMs']
    single=benchmark['singleThread'][scene]['result'];assert single['checksum']==cap['native']['checksum']
    assert single['invalidRoots']==single['invalidPixels']==0

outliers=read(HERE/'results/outlier-final.json')
assert all(r['adaptiveRGBA']==r['referenceRGBA'] for r in outliers)
exact=read(HERE/'results/exact-outliers-final.json')
assert exact['failedQueries']==0 and exact['queries']==sum(len(p['queries']) for p in exact['paths'])
assert exact['exactMissesVerified']==128

trial=HERE/'trials/binary64';old=read(trial/'captures.json');mapping=read(trial/'image-index.json')
for name,h in old['hashes'].items():
    stored=trial/'sources'/name
    if stored.exists():assert sha(stored)==h,name
    else:assert hashlib.sha256(gzip.decompress(Path(str(stored)+'.gz').read_bytes())).hexdigest()==h,name
for cap in old['measurements']:
    for key,hkey in [('nativePath','nativeSHA256'),('gpuPath','gpuSHA256')]:assert sha(ROOT/mapping[cap[key]])==cap[hkey]

result=dict(passed=True,rootQueries=3267,frameComparisons=16,timedFramesPerBackend=36,
    exactOutlierQueries=exact['queries'],priorHashesPreserved=len(prior['hashes']),sourceAndCaptureHashes=benchmark['hashes'])
(HERE/'results/verification.json').write_text(json.dumps(result,indent=2)+'\n')
print('Verified: roots, transport, 16 image comparisons, 72 timed frames, exact outliers, archived trial and prior evidence.')
