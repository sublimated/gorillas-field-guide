import re, os, glob, io
from svgelements import Path as SEPath
from PIL import Image, ImageDraw
import fitz

SHAPE_RE = re.compile(r'<(path|polygon|rect|circle|ellipse)\b([^>]*?)/>', re.S)
def attr(a, name):
    m = re.search(rf'\b{name}="([^"]*)"', a)
    return m.group(1) if m else None

def el_bbox(tag, a):
    try:
        if tag == 'rect':
            x=float(attr(a,'x') or 0); y=float(attr(a,'y') or 0)
            w=float(attr(a,'width') or 0); h=float(attr(a,'height') or 0)
            return (x,y,x+w,y+h)
        if tag in ('polygon','polyline'):
            nums=[float(n) for n in re.findall(r'-?\d*\.?\d+', attr(a,'points') or '')]
            xs=nums[0::2]; ys=nums[1::2]
            return (min(xs),min(ys),max(xs),max(ys))
        if tag=='circle':
            cx=float(attr(a,'cx') or 0); cy=float(attr(a,'cy') or 0); r=float(attr(a,'r') or 0)
            return (cx-r,cy-r,cx+r,cy+r)
        if tag=='ellipse':
            cx=float(attr(a,'cx') or 0); cy=float(attr(a,'cy') or 0); rx=float(attr(a,'rx') or 0); ry=float(attr(a,'ry') or 0)
            return (cx-rx,cy-ry,cx+rx,cy+ry)
        if tag=='path':
            return SEPath(attr(a,'d')).bbox()
    except Exception:
        return None

T = 7.0   # maxdim threshold: below = label letter-piece, above = glyph stroke
MARGIN = 10.0

def normalize(path):
    s=open(path,encoding='utf8').read()
    shapes=[]
    for m in SHAPE_RE.finditer(s):
        tag, a = m.group(1), m.group(2)
        bb=el_bbox(tag,a)
        if bb: shapes.append((m.group(0), tag, bb))
    if not shapes: return None, "no shapes"
    larges=[sh for sh in shapes if max(sh[2][2]-sh[2][0], sh[2][3]-sh[2][1])>=T]
    if not larges: return None, "no large (glyph) shape — flag"
    glyph_top=min(sh[2][1] for sh in larges)
    glyph=[sh for sh in shapes if not (max(sh[2][2]-sh[2][0], sh[2][3]-sh[2][1])<T and sh[2][1]<glyph_top)]
    if not glyph: return None, "everything classified as label — flag"
    gx0=min(sh[2][0] for sh in glyph); gy0=min(sh[2][1] for sh in glyph)
    gx1=max(sh[2][2] for sh in glyph); gy1=max(sh[2][3] for sh in glyph)
    w=gx1-gx0; h=gy1-gy0; cx=(gx0+gx1)/2; cy=(gy0+gy1)/2
    s_scale=(100-2*MARGIN)/max(w,h)
    body="\n  ".join(sh[0] for sh in glyph)
    out=(f'<?xml version="1.0" encoding="UTF-8"?>\n'
         f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n'
         f'  <g transform="translate(50 50) scale({s_scale:.5f}) translate({-cx:.4f} {-cy:.4f})">\n'
         f'  {body}\n  </g>\n</svg>\n')
    return out, f"kept {len(glyph)}/{len(shapes)} shapes"

os.makedirs("_normalized", exist_ok=True)
sample=["02","04","05","24","27","30","33","50","60","90","96","100"]
results=[]
for vid in sample:
    src=f"Sorcerer Script Start-{vid}.svg"
    out,msg=normalize(src)
    if out:
        open(f"_normalized/{vid}.svg","w",encoding='utf8').write(out)
    results.append((vid,msg))
    print(f"{vid}: {msg}")

def render(fn, cell):
    d=fitz.open(fn); p=d[0]; r=p.rect
    zoom=(cell-16)/max(r.width,r.height)
    pix=p.get_pixmap(matrix=fitz.Matrix(zoom,zoom),alpha=False)
    img=Image.open(io.BytesIO(pix.tobytes("png"))); d.close(); return img

cell=210
sheet=Image.new("RGB",(len(sample)*0+ 6*cell, 2*(cell+24)*((len(sample)+5)//6)),"white")
cols=6; rows=(len(sample)+cols-1)//cols
sheet=Image.new("RGB",(cols*cell, rows*2*(cell+22)),"white")
draw=ImageDraw.Draw(sheet)
for i,vid in enumerate(sample):
    col=i%cols; row=i//cols
    bx=col*cell; by=row*2*(cell+22)
    try:
        b=render(f"Sorcerer Script Start-{vid}.svg",cell)
        sheet.paste(b,(bx+(cell-b.width)//2, by+22+(cell-16-b.height)//2))
    except Exception as e: draw.text((bx+4,by+30),f"err",fill="red")
    draw.text((bx+4,by+4),f"{vid} BEFORE",fill="black")
    draw.rectangle([bx,by+22,bx+cell-1,by+22+cell-1],outline="#ccc")
    ay=by+cell+22
    try:
        a=render(f"_normalized/{vid}.svg",cell)
        sheet.paste(a,(bx+(cell-a.width)//2, ay+22+(cell-16-a.height)//2))
    except Exception as e: draw.text((bx+4,ay+30),f"(flagged)",fill="red")
    draw.text((bx+4,ay+4),f"{vid} AFTER",fill="#006400")
    draw.rectangle([bx,ay+22,bx+cell-1,ay+22+cell-1],outline="#8c8")
sheet.save("_proof_sheet.png")
print("\nsaved _proof_sheet.png", sheet.size)
