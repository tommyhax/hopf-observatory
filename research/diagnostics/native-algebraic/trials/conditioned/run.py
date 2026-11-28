#!/usr/bin/env python3
"""Build, capture, independently match and time direct native quartic solving."""
from pathlib import Path
import argparse
import hashlib
import json
import platform
import statistics
import subprocess
import sys
import tempfile
import time
import sympy as sp

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'research'))
from analyze import match,aggregate

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def cmd(args,**kwargs): return subprocess.check_output([str(a) for a in args],text=True,**kwargs)

def cases():
    result=[]
    for corpus,path in [('original','research/results/reference.json'),('stress','research/results/stress-reference.json')]:
        for c in json.loads((ROOT/path).read_text())['cases']:
            values=sum(c['P'],[])+[c['c']]+c['o']+c['d']
            assert all(float(sp.Float(x,24))==x for x in values), 'uploaded geometry changed'
            result.append(dict(corpus=corpus,id=c['id'],family=c['family'],kind=0,values=values,
                reference=[r['s'] for r in c['reference']['roots']]))
    x=sp.Symbol('x')
    for i,c in enumerate(json.loads((ROOT/'research/diagnostics/algorithm1010/fixtures.json').read_text())):
        values=c['c']+[c['lead']]
        p=sp.Poly(sum(sp.Rational(float(a))*x**k for k,a in enumerate(values)),x)
        rr=[] if p.is_zero or p.degree()==0 else p.intervals(eps=sp.Rational(1,10**65))
        reference=[str(sp.N((a+b)/2,65)) for (a,b),multiplicity in rr]
        result.append(dict(corpus='fixtures',id=i,name=c['name'],family='fixture',kind=1,values=values,
            reference=reference,intendedRoots=c['roots']))
    return result

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--bits',nargs='+',type=int,default=[53,113,256]);ap.add_argument('--benchmark',action='store_true');ap.add_argument('--verify-only',action='store_true');a=ap.parse_args()
    directory=HERE/'results';directory.mkdir(exist_ok=True)
    if a.verify_only:
        report=json.loads((directory/'analysis.json').read_text())
        for name,h in report['hashes'].items():assert digest(ROOT/name)==h,name
        for name,h in report['resultHashes'].items():assert digest(HERE/name)==h,name
        print('Source, input, prior-evidence and result hashes verified.');return
    previous=json.loads((HERE.parent/'double-precision/results/analysis.json').read_text())
    protected=dict(previous['hashes'])
    for name,h in protected.items():assert digest(ROOT/name)==h,name
    files=[HERE/'PROTOCOL.md',HERE/'solver.hpp',HERE/'main.cpp',Path(__file__),HERE/'LICENSE_1_0.txt',
        ROOT/'research/results/reference.json',ROOT/'research/results/stress-reference.json',
        ROOT/'research/diagnostics/algorithm1010/fixtures.json']
    protected.update({str(p.relative_to(ROOT)):digest(p) for p in files})
    tests=cases();rows=[{k:v for k,v in c.items() if k not in ('kind','values')} for c in tests]
    compiler=['clang++','-std=c++17','-O3','-ffp-contract=off','-I/opt/homebrew/include']
    result_paths=[];timings={}
    with tempfile.TemporaryDirectory(prefix='hopf-native-quartic-') as tmp:
        tmp=Path(tmp);exe=tmp/'native-quartic';data=tmp/'inputs.txt'
        data.write_text('\n'.join(' '.join(map(str,[c['kind'],i]+c['values'])) for i,c in enumerate(tests))+'\n')
        print('Compiling C++...',flush=True);cmd(compiler+[HERE/'main.cpp','-o',exe])
        metadata=json.loads(cmd([exe,'--metadata']));print(metadata,flush=True)
        for bits in a.bits:
            for method in ['algebraic','iterative']:
                key=f'{method}{bits}';start=time.monotonic()
                text=cmd([exe,data,bits,method,'capture']);path=directory/f'{key}.tsv';path.write_text(text);result_paths.append(path)
                lines=text.splitlines();assert len(lines)==len(tests)
                for index,line in enumerate(lines):
                    fields=line.split('\t');i,n=map(int,fields[:2]);assert i==index
                    roots=fields[2:2+n];assert len(fields)==2+n+7
                    rows[i][key]={'roots':roots,'match':match([float(x) for x in tests[i]['reference']],[float(x) for x in roots])}
                bad=sum(r[key]['match']['failed'] for r in rows)
                print(f'{key}: {bad}/{len(rows)} failed, {time.monotonic()-start:.2f}s capture',flush=True)
                if a.benchmark:
                    text=cmd([exe,data,bits,method,'benchmark']);path=directory/f'{key}-timing.tsv';path.write_text(text);result_paths.append(path)
                    ts=[]
                    for line in text.splitlines():
                        phase,block,repeats,count,seconds,checksum=line.split('\t')
                        ts.append(dict(phase=phase,block=int(block),repeats=int(repeats),count=int(count),seconds=float(seconds),checksum=float(checksum),nsPerQuery=float(seconds)*1e9/(int(repeats)*int(count))))
                    timings[key]={phase:dict(medianNs=statistics.median(t['nsPerQuery'] for t in ts if t['phase']==phase),samples=[t for t in ts if t['phase']==phase]) for phase in ['solve_only','construct_solve']}
    methods=[f'{m}{b}' for b in a.bits for m in ['algebraic','iterative']]
    summaries={}
    for corpus in ['original','stress','grazing','fixtures']:
        selected=([r for r in rows if r['corpus']=='stress' and r['family']=='tangent']
                  if corpus=='grazing' else [r for r in rows if r['corpus']==corpus])
        summaries[corpus]={}
        for key in methods:
            summary=aggregate(selected,key,'match');summary['failedIds']=[r['id'] for r in selected if r[key]['match']['failed']]
            summary['tolerances']={str(t):sum(match([float(x) for x in r['reference']],[float(x) for x in r[key]['roots']],t)['failed'] for r in selected) for t in [1e-4,1e-6,1e-8,1e-10,1e-12]}
            summaries[corpus][key]=summary
    for name,h in protected.items():assert digest(ROOT/name)==h,name
    report=dict(schemaVersion=1,date='2026-11-28',metadata=metadata,platform=platform.platform(),compilerFlags=compiler,
        hashes=protected,inheritedMismatches=previous['inheritedMismatches'],resultHashes={str(p.relative_to(HERE)):digest(p) for p in result_paths},summary=summaries,timings=timings,rows=rows)
    (directory/'analysis.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    print(json.dumps(summaries,indent=2),flush=True)

if __name__=='__main__':main()
