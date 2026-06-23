import re, math, io, os, fitz
from PIL import Image

GLYPHDIR = r"G:\GOD App\app\public\glyphs\sorcerer"
def inner(fn):
    s=open(os.path.join(GLYPHDIR,fn),encoding='utf8').read()
    m=re.search(r'<svg[^>]*>([\s\S]*?)</svg>',s)
    body=m.group(1) if m else ''
    return re.sub(r'<!--[\s\S]*?-->','',body)

# Fireball, clockwise from top: Level, School, Damage, Area, Range, Duration
RING=[("Sorcerer_Level_3.svg"),("Sorcerer_School_Evocation.svg"),("Sorcerer_Damage_Fire.svg"),
      ("Sorcerer_Area_Sphere-20.svg"),("Sorcerer_Range_150-feet.svg"),("Sorcerer_Duration_Instantaneous.svg")]
CENTER="Sorcerer_Center.svg"

SIZE=420; PAD=28; CX=CY=SIZE/2; rOuter=SIZE/2-PAD; rInner=rOuter*0.62
band=rOuter-rInner; rMid=(rInner+rOuter)/2
INK="#35105e"; GUIDE="rgba(120,86,140,0.45)"

def pt(a,r): return (CX+r*math.cos(a), CY+r*math.sin(a))

def compose(glyph_r, glyph_gs, rot_off, center_gs, show_band=True):
    el=[]
    el.append(f'<rect x="0" y="0" width="{SIZE}" height="{SIZE}" fill="#efe2c4"/>')
    # ring band circles
    if show_band:
        for r in (rOuter, rInner):
            el.append(f'<circle cx="{CX}" cy="{CY}" r="{r:.2f}" fill="none" stroke="rgba(140,100,60,0.45)" stroke-width="1.4"/>')
    start=-math.pi/2; span=2*math.pi/6
    # dividers
    for i in range(6):
        a=start+i*span; x0,y0=pt(a,rInner); x1,y1=pt(a,rOuter)
        el.append(f'<line x1="{x0:.2f}" y1="{y0:.2f}" x2="{x1:.2f}" y2="{y1:.2f}" stroke="rgba(140,100,60,0.4)" stroke-width="1.1"/>')
    # double-start at top
    for off in (-0.05,0.05):
        x0,y0=pt(start+off,rInner-6); x1,y1=pt(start+off,rOuter+6)
        el.append(f'<line x1="{x0:.2f}" y1="{y0:.2f}" x2="{x1:.2f}" y2="{y1:.2f}" stroke="{INK}" stroke-width="1.5"/>')
    # glyphs
    for i,fn in enumerate(RING):
        a=start+i*span+span/2
        cx,cy=pt(a,glyph_r)
        deg=a*180/math.pi+rot_off
        el.append(f'<g fill="{INK}" transform="translate({cx:.2f} {cy:.2f}) rotate({deg:.2f}) translate({-glyph_gs/2:.2f} {-glyph_gs/2:.2f}) scale({glyph_gs/100:.4f})">{inner(fn)}</g>')
    # center mandala
    g=center_gs
    el.append(f'<g fill="{INK}" transform="translate({CX-g/2:.2f} {CY-g/2:.2f}) scale({g/100:.4f})">{inner(CENTER)}</g>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">{"".join(el)}</svg>'

def render(svg):
    d=fitz.open(stream=svg.encode(),filetype="svg");pix=d[0].get_pixmap(matrix=fitz.Matrix(1.4,1.4));d.close()
    return Image.open(io.BytesIO(pix.tobytes("png")))

svg=compose(glyph_r=rMid, glyph_gs=band*1.0, rot_off=90, center_gs=2*rInner*0.9)
img=render(svg)
# side-by-side with the book original
orig=Image.open(r"G:\GOD App\Source PDFs\_img\class_samples\crop_sorcerer.png").convert("RGB")
h=max(img.height,orig.height); 
o2=orig.resize((int(orig.width*h/orig.height),h)); i2=img.resize((int(img.width*h/img.height),h))
combo=Image.new("RGB",(o2.width+i2.width+20,h),"white");combo.paste(o2,(0,0));combo.paste(i2,(o2.width+20,0))
combo.save("_seal_compare.png");print("saved _seal_compare.png",combo.size)

def compose2(glyph_r, glyph_gs, rot_off, center_gs):
    el=[f'<rect x="0" y="0" width="{SIZE}" height="{SIZE}" fill="#efe2c4"/>']
    start=-math.pi/2; span=2*math.pi/6
    for i,fn in enumerate(RING):
        a=start+i*span+span/2; cx,cy=pt(a,glyph_r); deg=a*180/math.pi+rot_off
        el.append(f'<g fill="{INK}" transform="translate({cx:.2f} {cy:.2f}) rotate({deg:.2f}) translate({-glyph_gs/2:.2f} {-glyph_gs/2:.2f}) scale({glyph_gs/100:.4f})">{inner(fn)}</g>')
    g=center_gs
    el.append(f'<g fill="{INK}" transform="translate({CX-g/2:.2f} {CY-g/2:.2f}) scale({g/100:.4f})">{inner(CENTER)}</g>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">{"".join(el)}</svg>'

variants=[
  ("A radial",   compose2(rMid,      band*1.20, 90, rOuter*0.82)),
  ("B upright",  compose2(rMid,      band*1.20,  0, rOuter*0.82)),
  ("C bigger",   compose2(rMid+6,    band*1.30, 90, rOuter*0.78)),
]
orig=Image.open(r"G:\GOD App\Source PDFs\_img\class_samples\crop_sorcerer.png").convert("RGB")
tiles=[("original",orig)]+[(n,render(s)) for n,s in variants]
H=300
from PIL import ImageDraw
scaled=[(n,im.resize((int(im.width*H/im.height),H))) for n,im in tiles]
W=sum(im.width for _,im in scaled)+20*len(scaled)
combo=Image.new("RGB",(W,H+22),"white");dr=ImageDraw.Draw(combo)
x=0
for n,im in scaled:
    combo.paste(im,(x,22));dr.text((x+4,4),n,fill="black");x+=im.width+20
combo.save("_seal_variants.png");print("saved _seal_variants.png",combo.size)

def composeF(gr_f, gs_f, rot_off, cs_f):
    gr=rOuter*gr_f; gs=rOuter*gs_f; cs=rOuter*cs_f
    el=[f'<rect x="0" y="0" width="{SIZE}" height="{SIZE}" fill="#efe2c4"/>']
    start=-math.pi/2; span=2*math.pi/6
    for i,fn in enumerate(RING):
        a=start+i*span+span/2; cx,cy=pt(a,gr); deg=a*180/math.pi+rot_off
        el.append(f'<g fill="{INK}" transform="translate({cx:.2f} {cy:.2f}) rotate({deg:.2f}) translate({-gs/2:.2f} {-gs/2:.2f}) scale({gs/100:.4f})">{inner(fn)}</g>')
    el.append(f'<g fill="{INK}" transform="translate({CX-cs/2:.2f} {CY-cs/2:.2f}) scale({cs/100:.4f})">{inner(CENTER)}</g>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">{"".join(el)}</svg>'

variants=[
  ("D r68 s60 rot90", composeF(0.68,0.60, 90,0.82)),
  ("E r66 s66 rot90", composeF(0.66,0.66, 90,0.80)),
  ("F r68 s60 rot-90",composeF(0.68,0.60,-90,0.82)),
]
orig=Image.open(r"G:\GOD App\Source PDFs\_img\class_samples\crop_sorcerer.png").convert("RGB")
from PIL import ImageDraw
tiles=[("original",orig)]+[(n,render(s)) for n,s in variants]
H=320; scaled=[(n,im.resize((int(im.width*H/im.height),H))) for n,im in tiles]
W=sum(im.width for _,im in scaled)+20*len(scaled)
combo=Image.new("RGB",(W,H+22),"white");dr=ImageDraw.Draw(combo);x=0
for n,im in scaled:
    combo.paste(im,(x,22));dr.text((x+4,4),n,fill="black");x+=im.width+20
combo.save("_seal_variants2.png");print("saved _seal_variants2.png",combo.size)
