import re, os, glob
from svgelements import Path as SEPath

SHAPE_RE = re.compile(r'<(path|polygon|rect|circle|ellipse)\b([^>]*?)/>', re.S)
def attr(a,name):
    m=re.search(rf'\b{name}="([^"]*)"',a); return m.group(1) if m else None
def el_bbox(tag,a):
    try:
        if tag=='rect':
            x=float(attr(a,'x') or 0);y=float(attr(a,'y') or 0);w=float(attr(a,'width') or 0);h=float(attr(a,'height') or 0);return(x,y,x+w,y+h)
        if tag in('polygon','polyline'):
            n=[float(v) for v in re.findall(r'-?\d*\.?\d+',attr(a,'points') or '')];return(min(n[0::2]),min(n[1::2]),max(n[0::2]),max(n[1::2]))
        if tag=='circle':
            cx=float(attr(a,'cx') or 0);cy=float(attr(a,'cy') or 0);r=float(attr(a,'r') or 0);return(cx-r,cy-r,cx+r,cy+r)
        if tag=='ellipse':
            cx=float(attr(a,'cx') or 0);cy=float(attr(a,'cy') or 0);rx=float(attr(a,'rx') or 0);ry=float(attr(a,'ry') or 0);return(cx-rx,cy-ry,cx+rx,cy+ry)
        if tag=='path': return SEPath(attr(a,'d')).bbox()
    except Exception: return None
T=7.0; MARGIN=10.0
def normalize(path):
    s=open(path,encoding='utf8').read()
    shapes=[(m.group(0),m.group(1),el_bbox(m.group(1),m.group(2))) for m in SHAPE_RE.finditer(s)]
    shapes=[sh for sh in shapes if sh[2]]
    if not shapes: return None,"NO SHAPES"
    md=lambda b:max(b[2]-b[0],b[3]-b[1])
    larges=[sh for sh in shapes if md(sh[2])>=T]
    if not larges: return None,"FLAG: no glyph-sized shape"
    gt=min(sh[2][1] for sh in larges)
    glyph=[sh for sh in shapes if not(md(sh[2])<T and sh[2][1]<gt)]
    label_n=len(shapes)-len(glyph)
    if not glyph: return None,"FLAG: all label"
    gx0=min(s[2][0] for s in glyph);gy0=min(s[2][1] for s in glyph);gx1=max(s[2][2] for s in glyph);gy1=max(s[2][3] for s in glyph)
    w=gx1-gx0;h=gy1-gy0;cx=(gx0+gx1)/2;cy=(gy0+gy1)/2;sc=(100-2*MARGIN)/max(w,h)
    body="\n  ".join(s[0] for s in glyph)
    out=(f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n'
         f'  <g transform="translate(50 50) scale({sc:.5f}) translate({-cx:.4f} {-cy:.4f})">\n  {body}\n  </g>\n</svg>\n')
    return out,f"ok (label {label_n}, glyph {len(glyph)})"
os.makedirs("_normalized",exist_ok=True)
flags=[]
ids=[re.match(r'Sorcerer Script Start-(\d+)\.svg$',os.path.basename(f)) for f in glob.glob("Sorcerer Script Start-*.svg")]
ids=sorted([int(m.group(1)) for m in ids if m])
for i in ids:
    src=f"Sorcerer Script Start-{i}.svg"
    out,msg=normalize(src)
    if out: open(f"_normalized/{i}.svg","w",encoding='utf8').write(out)
    else: flags.append((i,msg))
print(f"processed {len(ids)} numbered files -> _normalized/")
print(f"flagged (need manual look): {len(flags)}")
for i,m in flags: print(f"  {i}: {m}")
