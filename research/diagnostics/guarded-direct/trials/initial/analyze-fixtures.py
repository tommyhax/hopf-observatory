import json,sys,hashlib
from pathlib import Path
import sympy as s
here=Path(__file__).resolve().parent;root=here.parents[2];sys.path.insert(0,str(root/'research'))
from analyze import match
r=json.loads((here/'results/fixtures.json').read_text());x=s.Symbol('x');rows=[]
for p,h in r['hashes'].items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,p
for row in r['results']:
 p=s.Poly(sum(s.Rational(float(v))*x**i for i,v in enumerate(row['coefficients'])),x)
 rr=[] if p.is_zero or p.degree()==0 else p.intervals(eps=s.Rational(1,10**40))
 expected=[str(s.N((a+b)/2,45)) for (a,b),n in rr]
 m=match(list(map(float,expected)),row['actual'],1e-4)
 rows.append({**row,'expected':expected,'match':m})
 if m['failed']:print(row['variant'],row['name'],'expected',list(map(float,expected)),'actual',row['actual'])
for n in ['direct','paired-direct']:print(n,'failures',sum(v['match']['failed'] for v in rows if v['variant']==n))
(here/'results/fixture-analysis.json').write_text(json.dumps({'results':rows},indent=2)+'\n')
