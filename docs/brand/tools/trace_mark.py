import potrace, numpy as np
from PIL import Image
im=Image.open('/home/user/SonderThreads/docs/brand/strynd-mark-blue.png').convert('RGBA')
a=np.array(im)[:,:,3]>128
ys,xs=np.where(a); x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
a=a[y0:y1+1,x0:x1+1]; h,w=a.shape
plist=potrace.Bitmap(~a).trace(turdsize=20,alphamax=1.0,opticurve=True,opttolerance=0.2)
parts=[]
for c in plist:
    s=c.start_point; d=[f"M{s.x:.1f},{s.y:.1f}"]
    for seg in c.segments:
        if seg.is_corner: d.append(f"L{seg.c.x:.1f},{seg.c.y:.1f}L{seg.end_point.x:.1f},{seg.end_point.y:.1f}")
        else: d.append(f"C{seg.c1.x:.1f},{seg.c1.y:.1f} {seg.c2.x:.1f},{seg.c2.y:.1f} {seg.end_point.x:.1f},{seg.end_point.y:.1f}")
    parts.append("".join(d)+"Z")
open('mark-path.txt','w').write(f"{w} {h}\n"+"".join(parts))
print(w,h,len(plist),sum(len(p) for p in parts))
