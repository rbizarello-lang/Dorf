import math, random
PR,FL,PL,VI,TE,RI,VZ='#8dbb5a','#3f7a45','#d9b44a','#c9b8a0','#c8553d','#4f9fc8','#ece7d6'
INK='#3b3b32'
COL={'p':PR,'f':FL,'c':PL,'v':VI,'r':RI}
def svg(name,w,h,body,title):
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" font-family="sans-serif" font-size="12">\n<title>{title}</title>\n<rect width="{w}" height="{h}" fill="{VZ}"/>\n'+body+'</svg>\n'
    open(name,'w').write(s)
def pts(P): return ' '.join(f'{x:.1f},{y:.1f}' for x,y in P)
def poly(P,fill,extra='stroke="#fff" stroke-width="1.5"'): return f'<polygon points="{pts(P)}" fill="{fill}" {extra}/>\n'
def txt(x,y,t,anchor='middle',c=INK,sz=12,w=''): return f'<text x="{x:.0f}" y="{y:.0f}" text-anchor="{anchor}" fill="{c}" font-size="{sz}" {w}>{t}</text>\n'
def ghost(P): return poly(P,PL,'fill-opacity="0.55" stroke="#8a6d1a" stroke-width="2" stroke-dasharray="5 3"')

# 1 Fatias
L=50;hh=L*math.sqrt(3)/2;ox,oy=40,40
def V(a,b): return (ox+a*L+b*L/2, oy+b*hh)
def T1(a,b): return [V(a,b),V(a+1,b),V(a,b+1)]
def T2(a,b): return [V(a+1,b),V(a+1,b+1),V(a,b+1)]
river={('1',1,0),('2',1,0),('1',1,1),('2',1,1),('1',2,1),('2',2,1),('1',2,2),('2',2,2),('1',2,3),('2',2,3)}
ghosts={('1',3,1),('2',3,1),('1',3,2)}
b=''
for bb in range(4):
  for a in range(4):
    for k in '12':
      key=(k,a,bb); P=T1(a,bb) if k=='1' else T2(a,bb)
      if key in ghosts: continue
      if key in river: c=RI
      elif a==0: c=FL if (bb+int(k))%3 else PR
      elif a==1: c=PR if bb<2 else PL
      elif a==2: c=PL if bb<1 else VI
      else: c=VI if (bb+int(k))%2 else PL
      b+=poly(P,c)
for key in ghosts: b+=ghost(T1(*key[1:]) if key[0]=='1' else T2(*key[1:]))
b+=txt(20,285,'rio em zigue-zague de triângulos = meandro',anchor='start')+txt(300,215,'peça de 3 fatias',c='#8a6d1a',anchor='start')+txt(300,120,'+3 por lado igual',anchor='start')
b+=txt(20,22,'Fatias: tabuleiro de triângulos, peças de 1 a 4 fatias',sz=13,w='font-weight="bold"',anchor='start')
svg('F1-1.svg',470,300,b,'Fatias')

# 2 Cacos (Voronoi relaxado)
random.seed(11)
W,H=520,300
P0=[(random.uniform(20,W-20),random.uniform(20,H-20)) for _ in range(15)]
def clip(poly_,a,b_,c):  # keep a*x+b*y<=c
    out=[]
    for i in range(len(poly_)):
        p,q=poly_[i],poly_[(i+1)%len(poly_)]
        fp=a*p[0]+b_*p[1]-c; fq=a*q[0]+b_*q[1]-c
        if fp<=0: out.append(p)
        if fp*fq<0:
            t=fp/(fp-fq); out.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
    return out
def cells(P):
    res=[]
    for i,p in enumerate(P):
        c=[(0,0),(W,0),(W,H),(0,H)]
        for j,q in enumerate(P):
            if i==j: continue
            a=q[0]-p[0];b_=q[1]-p[1];cc=(q[0]**2+q[1]**2-p[0]**2-p[1]**2)/2
            c=clip(c,a,b_,cc)
        res.append(c)
    return res
def cen(c):
    A=cx=cy=0
    for i in range(len(c)):
        x0,y0=c[i];x1,y1=c[(i+1)%len(c)];f=x0*y1-x1*y0;A+=f;cx+=(x0+x1)*f;cy+=(y0+y1)*f
    return (cx/(3*A),cy/(3*A))
for _ in range(3): P0=[cen(c) for c in cells(P0)]
C=cells(P0)
b=''
cs=['p','f','c','v','p','f','p','c','f','p','v','p','f','c','p']
ghost_i=7
for i,c in enumerate(C):
    if i==ghost_i: b+=ghost(c)
    else: b+=poly(c,COL[cs[i]])
    n=len(c)
    inner=all(5<x<W-5 and 5<y<H-5 for x,y in c)
    if inner: b+=txt(*P0[i],f'{n} lados',sz=11)
b+=txt(P0[ghost_i][0],P0[ghost_i][1]+16,'peça elástica',c='#8a6d1a',sz=11)
svg('F1-2.svg',W,H,b,'Cacos')

# 3 Contorno livre
def blob(cx,cy,R,ph,n=28):
    P=[]
    for k in range(n):
        t=2*math.pi*k/n; r=R*(1+0.16*math.sin(3*t+ph)+0.09*math.sin(5*t+2*ph))
        P.append((cx+r*math.cos(t),cy+r*math.sin(t)))
    return P
def path(P,fill,extra): return f'<path d="M{P[0][0]:.1f},{P[0][1]:.1f} '+' '.join(f'L{x:.1f},{y:.1f}' for x,y in P[1:])+f' Z" fill="{fill}" {extra}/>\n'
b=''
for (cx,cy,R,ph,c) in [(120,120,70,0.3,FL),(250,100,58,1.4,PR),(210,215,62,2.2,PL),(110,235,40,3,VI),(345,190,50,0.9,RI)]:
    b+=path(blob(cx,cy,R,ph),c,'stroke="#fff" stroke-width="1.5"')
b+=path(blob(400,90,48,2.5),VI,'fill-opacity="0.6" stroke="#8a6d1a" stroke-width="2" stroke-dasharray="5 3"')
b+='<path d="M440,150 q-20,20 -45,25" fill="none" stroke="#c8553d" stroke-width="2"/>\n'
b+='<path d="M468,60 q10,25 -10,50" fill="none" stroke="#c8553d" stroke-width="2"/>\n'
b+=txt(120,120,'mata')+txt(250,100,'prado')+txt(210,215,'campo')+txt(345,190,'rio')+txt(400,90,'vila',c='#8a6d1a')
b+=txt(510,275,'arrasta e gira livre; solta perto e o contorno gruda',anchor='end')+txt(150,30,'Contorno livre: sem casas, sem grade',sz=13,w='font-weight="bold"')
svg('F1-3.svg',520,300,b,'Contorno livre')

# 4 Penrose
S=70;cx,cy=190,150
def A(k): a=math.radians(72*k-90); return (math.cos(a),math.sin(a))
def sc(p): return (cx+S*p[0],cy+S*p[1])
b=''
cols=[PR,FL,PL,VI,PR]
for k in range(5):
    a0,a1=A(k),A(k+1); B=(a0[0]+a1[0],a0[1]+a1[1])
    b+=poly([sc((0,0)),sc(a0),sc(B),sc(a1)],cols[k])
for k in range(5):
    a=A(k); Bp=(a[0]+A(k-1)[0],a[1]+A(k-1)[1]); Bn=(a[0]+A(k+1)[0],a[1]+A(k+1)[1])
    T=(Bp[0]+Bn[0]-a[0],Bp[1]+Bn[1]-a[1])
    b+=poly([sc(a),sc(Bp),sc(T),sc(Bn)],[RI,PR,FL,PL,VI][k])
b+=txt(400,90,'losango gordo (72°)',anchor='start')+txt(400,110,'losango fino (36°)',anchor='start')
b+=txt(400,150,'todos os lados iguais:',anchor='start')+txt(400,168,'qualquer lado aceita',anchor='start')+txt(400,186,'qualquer losango.',anchor='start')+txt(400,214,'o ângulo livre decide',anchor='start')
b+=txt(100,25,'Losangos de Penrose: 5 gordos + 5 finos',sz=13,w='font-weight="bold"',anchor='start')
svg('F1-4.svg',600,300,b,'Penrose')

# 5 Costura de ilhas
Rh=26
def hx(q,r): return (Rh*1.5*q, Rh*math.sqrt(3)*(r+q/2))
def hexp(x,y,R=Rh): return [(x+R*math.cos(math.radians(60*i)),y+R*math.sin(math.radians(60*i))) for i in range(6)]
b=''
def island(ox,oy,cells_,cols_,ex=''):
    s=''
    for (q,r),c in zip(cells_,cols_):
        x,y=hx(q,r); s+=poly(hexp(ox+x,oy+y),c,ex or 'stroke="#fff" stroke-width="1.5"')
    return s
cellsA=[(0,0),(1,0),(0,1),(1,-1),(-1,1)]
b+=island(90,110,cellsA,[FL,FL,PR,RI,PR])
b+=island(330,70,[(0,0),(0,1),(1,0),(-1,1)],[RI,PR,PL,VI])
b+=island(330,230,[(0,0),(1,0),(0,-1)],[VI,PL,PL])
for x,y in [(210,170)]: pass
b+=poly(hexp(*(lambda p:(p[0]+330-hx(0,0)[0]-0,p[1]))(hx(0,0))),VZ,'fill-opacity="0"')
# sombra da ilha B movida
mv=[(0,0),(0,1),(1,0),(-1,1)]
for (q,r),c in zip(mv,[RI,PR,PL,VI]):
    x,y=hx(q,r); b+=poly(hexp(215+x,150+y),c,'fill-opacity="0.35" stroke="#8a6d1a" stroke-width="2" stroke-dasharray="5 3"')
b+='<path d="M300,80 C270,90 250,120 240,140" fill="none" stroke="#c8553d" stroke-width="2.5"/>\n'
b+=txt(150,40,'Costura de ilhas',sz=13,w='font-weight="bold"')+txt(140,205,'ilha A',c=INK)+txt(330,25,'ilha B anda e gira',c='#c8553d')+txt(330,300,'ilha C (ainda solta)')+txt(250,255,'3 bordas casam = +3×10 +nó',sz=11,c=INK)
svg('F1-5.svg',470,320,b,'Costura de ilhas')

# 6 Fusão
def sup(ox,oy,merged):
    s=''
    cl=[FL,FL,FL,FL,FL,FL,FL]
    cells_=[(0,0),(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)]
    for (q,r),c in zip(cells_,cl):
        x,y=hx(q,r); s+=poly(hexp(ox+x,oy+y),c,'stroke="none"' if merged else 'stroke="#fff" stroke-width="2"')
    return s
b=sup(110,150,False)
# fusão: contorno suave
b+=sup(360,150,True)
R2=Rh*2.45
P=[]
for k in range(36):
    t=2*math.pi*k/36; r=R2*(1+0.07*math.sin(6*t+0.5)); P.append((360+r*math.cos(t),150+r*math.sin(t)))
b+=path(P,FL,'stroke="#2c5a33" stroke-width="3"')
for i,(dx,dy) in enumerate([(-30,-20),(25,-30),(40,15),(-10,30),(-40,25),(5,-5)]):
    b+=f'<circle cx="{360+dx}" cy="{150+dy}" r="9" fill="#2c5a33"/>\n'
b+=txt(110,55,'7 peças')+txt(360,55,'1 região (superpeça)')+txt(235,155,'→',sz=26)+txt(360,255,'costuras somem; borda nova de 18 lados',sz=11)+txt(110,255,'miolo cercado + mesmo terreno',sz=11)
svg('F1-6.svg',470,280,b,'Fusão em regiões')

# 7 Octógonos e praças
s=36;d=s*(1+math.sqrt(2));b=''
def octo(x,y): return [(x+s*0.5/math.sin(math.pi/8)*math.cos(math.radians(22.5+45*i)),y+s*0.5/math.sin(math.pi/8)*math.sin(math.radians(22.5+45*i))) for i in range(8)]
oc={ (0,0):FL,(1,0):FL,(2,0):PR,(0,1):PL,(1,1):PR,(2,1):VI,(0,2):PR,(1,2):PL,(2,2):VI}
for (i,j),c in oc.items(): b+=poly(octo(50+d*i+d/2,50+d*j+d/2),c)
for i in range(2):
  for j in range(2):
    x,y=50+d*(i+1)+d/2-d/2+d/2-d/2+0,0
    cx_,cy_=50+d*(i+1)+d/2-d/2+ d/2*0+0, 0
sq=[]
for i in range(2):
  for j in range(2):
    x=50+d*(i+1); y=50+d*(j+1)
    r=s/math.sqrt(2); col=TE if (i,j)==(1,0) else VI
    if (i,j)==(0,1): b+=ghost([(x,y-r),(x+r,y),(x,y+r),(x-r,y)])
    else: b+=poly([(x,y-r),(x+r,y),(x,y+r),(x-r,y)],col)
b+=txt(450,100,'octógono: 8 bordas',anchor='start')+txt(450,120,'(4 grandes + 4 diagonais)',anchor='start',sz=11)+txt(450,160,'praça: 4 bordas, 45°',anchor='start')+txt(450,180,'fecha o vazio entre 4',anchor='start',sz=11)+txt(450,198,'octógonos',anchor='start',sz=11)+txt(45,20,'Octógonos e praças',anchor='start',sz=13,w='font-weight="bold"')
svg('F1-7.svg',640,350,b,'Octógonos e praças')
