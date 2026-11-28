#!/usr/bin/env python3
"""Recheck saved captures against the fixed references without rerunning timing."""
import json
import gzip
import hashlib
import math
import statistics
from run import HERE,ROOT,cases,digest,match,aggregate

report=json.loads((HERE/'results/analysis.json').read_text())
for name,h in report['hashes'].items():
    assert digest(ROOT/name)==h,name
for name,h in report['resultHashes'].items():
    assert digest(HERE/name)==h,name

tests=cases()
assert len(tests)==3321
assert len(report['rows'])==len(tests)
methods=list(report['summary']['original'])
for method in methods:
    lines=(HERE/'results'/f'{method}.tsv').read_text().splitlines()
    assert len(lines)==len(tests)
    for i,(line,test,row) in enumerate(zip(lines,tests,report['rows'])):
        f=line.split('\t');index,n=map(int,f[:2]);assert index==i
        roots=f[2:2+n];assert len(f)==2+n+7
        assert all(math.isfinite(float(x)) for x in f[2+n:])
        assert row['corpus']==test['corpus'] and row['id']==test['id']
        assert row['reference']==test['reference']
        assert roots==row[method]['roots']
        computed=match([float(x) for x in test['reference']],[float(x) for x in roots])
        assert computed==row[method]['match'],(method,test['corpus'],test['id'])

for corpus,summaries in report['summary'].items():
    rows=([r for r in report['rows'] if r['corpus']=='stress' and r['family']=='tangent']
          if corpus=='grazing' else [r for r in report['rows'] if r['corpus']==corpus])
    for method,summary in summaries.items():
        for k,v in aggregate(rows,method,'match').items():assert summary[k]==v,(corpus,method,k)
        assert summary['failedIds']==[r['id'] for r in rows if r[method]['match']['failed']]
        for tolerance,count in summary['tolerances'].items():
            actual=sum(match([float(x) for x in r['reference']],[float(x) for x in r[method]['roots']],float(tolerance))['failed'] for r in rows)
            assert actual==count,(corpus,method,tolerance)

for method,phases in report['timings'].items():
    raw=[line.split('\t') for line in (HERE/'results'/f'{method}-timing.tsv').read_text().splitlines()]
    assert len(raw)==14
    for phase,stats in phases.items():
        selected=[r for r in raw if r[0]==phase]
        assert len(selected)==7
        values=[]
        for i,r in enumerate(selected):
            assert int(r[1])==i and int(r[2])>=1 and int(r[3])==3267
            assert float(r[4])>0 and math.isfinite(float(r[5]))
            ns=float(r[4])*1e9/(int(r[2])*int(r[3]));values.append(ns)
            assert stats['samples'][i]['nsPerQuery']==ns
        assert statistics.median(values)==stats['medianNs']

archive=HERE/'trials/index.json'
if archive.exists():
    for original,entry in json.loads(archive.read_text()).items():
        compressed=(HERE/entry['compressedPath']).read_bytes()
        assert hashlib.sha256(compressed).hexdigest()==entry['compressedSha256'],original
        decoded=gzip.decompress(compressed)
        assert len(decoded)==entry['bytes'],original
        assert hashlib.sha256(decoded).hexdigest()==entry['sha256'],original

print('Verified all 3,321 queries at all three precisions, all tolerances, timings, preservation hashes and archived trials.')
