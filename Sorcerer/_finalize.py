import re, os, shutil, glob
from svgelements import Path as SEPath

SHAPE_RE=re.compile(r'<(path|polygon|rect|circle|ellipse)\b([^>]*?)/>',re.S)
def attr(a,n):
    m=re.search(rf'\b{n}="([^"]*)"',a);return m.group(1) if m else None
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
        if tag=='path':return SEPath(attr(a,'d')).bbox()
    except Exception:return None
T=7.0;MARGIN=10.0
def normalize(path):
    s=open(path,encoding='utf8').read()
    shapes=[(m.group(0),m.group(1),el_bbox(m.group(1),m.group(2))) for m in SHAPE_RE.finditer(s)]
    shapes=[x for x in shapes if x[2]]
    md=lambda b:max(b[2]-b[0],b[3]-b[1])
    larges=[x for x in shapes if md(x[2])>=T]
    gt=min(x[2][1] for x in larges)
    glyph=[x for x in shapes if not(md(x[2])<T and x[2][1]<gt)]
    gx0=min(x[2][0] for x in glyph);gy0=min(x[2][1] for x in glyph);gx1=max(x[2][2] for x in glyph);gy1=max(x[2][3] for x in glyph)
    w=gx1-gx0;h=gy1-gy0;cx=(gx0+gx1)/2;cy=(gy0+gy1)/2;sc=(100-2*MARGIN)/max(w,h)
    body="\n  ".join(x[0] for x in glyph)
    return(f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n'
           f'  <g transform="translate(50 50) scale({sc:.5f}) translate({-cx:.4f} {-cy:.4f})">\n  {body}\n  </g>\n</svg>\n')

def slug(v):
    return re.sub(r'\s+','-',re.sub(r'[()\'\"]','',re.sub(r'[\/]','-',v)).strip())

RANGE={2:'Unlimited',3:'Touch',4:'Special',5:'Sight',6:'Self',7:'90 feet',8:'60 feet',9:'5 feet',10:'500 miles',11:'500 feet',12:'30 feet',13:'300 feet',14:'1 mile',15:'150 feet',16:'120 feet',17:'10 feet',18:'100 feet'}
SCHOOL={19:'Divination',20:'Conjuration',21:'Abjuration',22:'Illusion',23:'Evocation',24:'Enchantment',25:'Necromancy',26:'Transmutation'}
DURATION={27:'1 minute',28:'1 hour',29:'10 minutes',30:'10 days',31:'24 hours',32:'1 round',33:'8 hours',34:'7 days',35:'30 days',36:'Until dispelled',37:'Special',38:'Instantaneous',39:'Up to 5 minutes',40:'Up to 1 hour',41:'Up to 10 minutes',42:'Up to 2 hours',43:'Up to 24 hours',44:'Up to 1 round',45:'Up to 8 hours'}
DAMAGE={46:'Cold',47:'Bludgeoning',48:'Acid',49:'Lightning',50:'Force',51:'Fire',52:'Piercing',53:'None',54:'Necrotic',55:'Radiant',56:'Psychic',57:'Poison',58:'Thunder',59:'Slashing'}
LEVEL={60+i:str(i) for i in range(10)}
AREA={70:'Cone (15)',71:'Cone (30)',72:'Cone (40)',73:'Cone (60)',74:'Cube (100)',75:'Cube (10)',76:'Cube (150)',77:'Cube (15)',78:'Cube (200)',79:'Cube (20)',80:'Cube (2500)',81:'Cube (30)',82:'Cube (40000)',83:'Cube (40)',84:'Cube (5280)',85:'Cube (5)',86:'Cylinder (10)',87:'Cylinder (20)',88:'Cylinder (40)',89:'Cylinder (50)',90:'Cylinder (5)',91:'Cylinder (60)',92:'Line (100)',93:'Line (50)',94:'Line (60)',95:'Line (90)',96:'None',97:'Sphere (100)',98:'Sphere (10)',99:'Sphere (15)',100:'Sphere (20)',101:'Sphere (30)',102:'Sphere (360)'}
GROUPS={'Range':RANGE,'School':SCHOOL,'Duration':DURATION,'Damage':DAMAGE,'Level':LEVEL,'Area':AREA}

DST=[r"G:\GOD App\app\public\glyphs\sorcerer", r"G:\GOD App\Sorcerer"]
for d in DST: os.makedirs(d,exist_ok=True)

written=[]
for grp,m in GROUPS.items():
    for vid,val in m.items():
        src=f"Sorcerer Script Start-{vid:02d}.svg"
        out=normalize(src)
        name=f"Sorcerer_{grp}_{slug(val)}.svg"
        for d in DST: open(os.path.join(d,name),"w",encoding='utf8').write(out)
        written.append(name)

# finished extras (already 100x100, copy as-is) + legend + center
extras={
  "Sorcerer Script Start- Sphere 40ft.svg":"Sorcerer_Area_Sphere-40.svg",
  "Sorcerer Script Start-Sphere 5ft.svg":"Sorcerer_Area_Sphere-5.svg",
  "Sorcerer Script Start-Sphere 60ft.svg":"Sorcerer_Area_Sphere-60.svg",
  "Sorcerer Script Start-Center Symbol.svg":"Sorcerer_Center.svg",
  "Sorcerer Script Start-01.svg":"Sorcerer_legend.svg",
}
for src,name in extras.items():
    if os.path.exists(src):
        for d in DST: shutil.copyfile(src, os.path.join(d,name))
        written.append(name)
    else:
        print("MISSING extra:", src)

print(f"wrote {len(written)} files to each of 2 locations")
print("sample:", sorted(written)[:6], "...")
# sanity: counts per group
from collections import Counter
c=Counter(n.split('_')[1] for n in written)
print("by group:", dict(c))
