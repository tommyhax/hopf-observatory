from pathlib import Path
import sys,json,gzip,hashlib
import numpy as np
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'research'))
from analyze import match
def read(p):return json.loads(p.read_text())
captures=read(HERE/'results/captures.json')
for path,h in captures['hashes'].items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==h,path
rootCases=read(HERE/'results/roots.json')['rows'];failed=[];errors=[]
for r in rootCases:
    check=match([float(x) for x in r['expected']],r['actual'],1e-8)
    errors+=check['errors']
    if check['failed']:failed.append({'corpus':r['corpus'],'id':r['id'],**check})
rows=[];panels=[]
for r in captures['measurements']:
    path=Path(r['nativePath']);a=np.frombuffer(gzip.decompress(path.read_bytes()),np.uint8).reshape(r['height'],r['width'],4)
    b=np.frombuffer(gzip.decompress((ROOT/r['gpuPath']).read_bytes()),np.uint8).reshape(a.shape)
    assert hashlib.sha256(path.read_bytes()).hexdigest()==r['nativeSHA256']
    assert hashlib.sha256((ROOT/r['gpuPath']).read_bytes()).hexdigest()==r['gpuSHA256']
    diff=np.abs(a[:,:,:3].astype(int)-b[:,:,:3].astype(int));maximum=diff.max(axis=2)
    indices=np.argsort(maximum.ravel())[-12:][::-1]
    outliers=[dict(x=int(i%r['width']),y=int(i//r['width']),native=a.reshape(-1,4)[i].tolist(),gpu=b.reshape(-1,4)[i].tolist(),maxDifference=int(maximum.ravel()[i])) for i in indices]
    row=dict(scene=r['scene'],name=r['name'],mode=r['mode'],width=r['width'],height=r['height'],pixels=maximum.size,changed=int(np.count_nonzero(maximum)),
        over3=int(np.count_nonzero(maximum>3)),over16=int(np.count_nonzero(maximum>16)),maxDifference=int(maximum.max()),
        meanAbsoluteChannelDifference=float(diff.mean()),outliers=outliers)
    rows.append(row)
    if r['mode']==0 and r['width']==480:
        panel=Image.new('RGB',(r['width']*3,r['height']+25),'#10212b');draw=ImageDraw.Draw(panel)
        for j,(data,label) in enumerate([(b,'Current GPU'),(a,'Native C++'),(np.minimum(diff*8,255).astype(np.uint8),'Difference ×8')]):
            panel.paste(Image.fromarray(data[::-1,:,:3]),(j*r['width'],25));draw.text((j*r['width']+8,6),r['name']+' · '+label,fill='white')
        panels.append(panel)
out=Image.new('RGB',(panels[0].width,sum(p.height for p in panels)));y=0
for panel in panels:out.paste(panel,(0,y));y+=panel.height
out.save(HERE/'results/comparison.png')
report=dict(rootCorpusPassed=not failed,rootCases=len(rootCases),rootFailures=failed,maxRootError=max(errors),
    invalidRoots=sum(r['native']['invalidRoots'] for r in captures['measurements']),
    invalidPixels=sum(r['native']['invalidPixels'] for r in captures['measurements']),images=rows)
(HERE/'results/validation.json').write_text(json.dumps(report,indent=2)+'\n')
for r in rows:print(r['name'],r['width'],r['mode'],'>3:',r['over3'],'>16:',r['over16'],'max:',r['maxDifference'])
print('Root corpus:',len(rootCases),'failures:',len(failed),'invalid roots:',report['invalidRoots'])
