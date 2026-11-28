import json,gzip,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
here=Path(__file__).resolve().parent;root=here.parents[2];r=json.loads((here/'results/renders.json').read_text())
for p,h in r['hashes'].items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,p
rows=[];panels=[]
for a in r['renders']:
 if a['variant']!='production':continue
 b=next(v for v in r['renders'] if v['variant']=='direct' and all(v[k]==a[k] for k in ['index','mode','width','height']))
 def read(v):
  p=root/v['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==v['sha256'];return np.frombuffer(gzip.decompress(p.read_bytes()),np.uint8).reshape(v['height'],v['width'],4)[::-1].copy()
 aa,bb=read(a),read(b);delta=np.abs(aa[:,:,:3].astype(int)-bb[:,:,:3].astype(int));mx=delta.max(axis=2)
 yy,xx=np.where(mx>3)
 row={k:a[k] for k in ['scene','index','mode','width','height']}
 row.update(maxChannelDifference=int(delta.max()),meanChannelDifference=float(delta.mean()),pixelsOver1=int((mx>1).sum()),pixelsOver3=len(xx),
  outliers=[{'x':int(x),'y':int(y),'difference':int(mx[y,x]),'production':aa[y,x].tolist(),'direct':bb[y,x].tolist()} for x,y in zip(xx,yy)])
 rows.append(row);print(row['scene'],a['width'],a['mode'],'max',row['maxChannelDifference'],'pixels>3',len(xx))
 if a['width']==480 and a['mode']==0:
  panels.append([Image.fromarray(aa),Image.fromarray(bb),Image.fromarray(np.uint8(np.minimum(255,delta*16)))])
canvas=Image.new('RGB',(1440,4*300),(19,23,30));draw=ImageDraw.Draw(canvas)
for i,panels_row in enumerate(panels):
 for j,im in enumerate(panels_row):canvas.paste(im,(480*j,300*i+26));draw.text((480*j+10,300*i+6),['Current renderer','Guarded direct GPU','Absolute difference x16'][j],fill='white')
canvas.save(here/'results/comparison.png')
(here/'results/image-analysis.json').write_text(json.dumps({'images':rows},indent=2)+'\n')
