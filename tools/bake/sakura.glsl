// Spring: a snow-capped mountain, a far shore of cherry trees in full bloom, and a still lake reflecting it all.
const float Y0=.56, ASP=393./852., HY=.875;
float hsh(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float h3(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float vn3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
const float SHORE=150.;
float mountain(vec2 p){vec2 c=vec2(-70.,820.);float r=length(p-c)/430.;float base=pow(max(0.,1.-r),1.5)*230.;float rg=0.,a=.5,f=1.;vec2 q=p*.012;for(int k=0;k<5;k++){rg+=a*(1.-abs(vn(q*f)*2.-1.));f*=2.1;a*=.45;}return base*(.86+.24*rg)-4.+3.*vn(p*.02);}
float land(vec2 p){return p.y<SHORE?-1.:max(mountain(p),1.2+2.*vn(p*.03));}
float trees(vec3 p,out float sh){sh=0.;if(p.z<SHORE-6.||p.z>SHORE+70.)return 1e5;float d=1e5;const float CS=9.;vec2 c0=floor(p.xz/CS);for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 c=c0+vec2(float(i),float(j));vec2 cp=(c+.5)*CS;if(cp.y<SHORE+2.||cp.y>SHORE+62.||hsh(c)<.25)continue;
    cp+=(vec2(hsh(c+1.),hsh(c+2.))-.5)*CS*.6;float s=3.2+4.*hsh(c+3.);vec3 o=vec3(cp.x,1.+s*1.1,cp.y);
    for(int k=0;k<5;k++){float fk=float(k);float an=fk*1.257+hsh(c)*6.;vec3 off=vec3(sin(an)*s*.6,(hsh(c+fk)-.3)*s*.6,cos(an)*s*.45);float dd=length(p-o-off)-s*(.55+.15*hsh(c+fk*2.));if(dd<d){d=dd;sh=hsh(c);}}}
  return d+(vn3(p*.7)-.5)*.8+(vn3(p*1.9)-.5)*.22;} /* billowing canopies, soft and clumped */
vec3 skyC(vec3 rd){float y=max(rd.y,0.);vec3 c=mix(vec3(1.,.88,.9),vec3(.62,.76,.96),smoothstep(0.,.35,y));c+=vec3(1.,.9,.8)*pow(max(dot(rd,normalize(vec3(.45,.5,1.))),0.),6.)*.3;return c;}
float hit(vec3 ro,vec3 rd,out vec3 n,out float kind,out float sh,float tmax){float t=.5;kind=-1.;for(int i=0;i<300;i++){vec3 p=ro+rd*t;float s2;float dt=trees(p,s2);float dl=p.y-land(p.xz);
    if(dt<.01*max(1.,t*.012)){kind=2.;sh=s2;break;}if(dl<.002*t){kind=1.;break;}t+=min(dt*.45,max(dl*.4,.01*t));if(t>tmax)return -1.;}
  vec3 p=ro+rd*t;float e=.05+t*.002;
  if(kind>1.5){e=.35+t*.002; /* soft, rounded clumps of blossom */float a,b,c2,d0=trees(p,a);n=normalize(vec3(trees(p+vec3(e,0,0),b)-d0,trees(p+vec3(0,e,0),b)-d0,trees(p+vec3(0,0,e),b)-d0));}
  else{float h=land(p.xz);n=normalize(vec3(h-land(p.xz+vec2(e,0.)),e,h-land(p.xz+vec2(0.,e))));}
  return t;}
vec3 shade(vec3 ro,vec3 rd,float t,vec3 n,float kind,float sh){vec3 p=ro+rd*t;vec3 L=normalize(vec3(.5,.62,-.6));float dif=clamp(dot(n,L),0.,1.);vec3 col;
  if(kind>1.5){float v=vn3(p*.6);vec3 a=mix(vec3(.98,.72,.82),vec3(.93,.56,.7),smoothstep(.3,.75,v));a=mix(a,vec3(1.,.92,.95),smoothstep(.65,.9,vn3(p*1.7))*.7);a=mix(a,vec3(.96,.8,.86),sh*.4);
    float wr=pow(clamp(dot(n,L)*.5+.5,0.,1.),1.4);col=a*(vec3(1.,.96,.92)*wr*1.05+vec3(.62,.6,.85)*.32*(.6+.4*n.y))*(.8+.2*smoothstep(-.5,.6,n.y));col+=vec3(1.,.85,.9)*pow(1.-clamp(dot(n,-rd),0.,1.),3.)*.25;} /* blossom: pink in the shade, almost white where the sun catches it */
  else{float h=p.y;float snow=smoothstep(110.,122.,h+14.*vn(p.xz*.05));vec3 rock=mix(vec3(.46,.48,.68),vec3(.58,.58,.76),vn(p.xz*.05));vec3 grass=mix(vec3(.66,.72,.6),vec3(.96,.8,.86),.55); /* the shore carpeted with fallen petals */vec3 a=h>8.?rock:grass;a=mix(a,vec3(.97,.97,1.),snow);
    col=a*(vec3(1.,.95,.88)*dif*1.2+vec3(.55,.62,.9)*(.4+.4*n.y));}
  float fog=1.-exp(-t*(kind>1.5?.0022:.00085));col=mix(col,mix(vec3(.88,.86,.95),vec3(.98,.88,.9),.5),fog);return col;}
vec4 render(vec2 uvS){vec3 ro=vec3(0.,6.,0.);vec3 rd=normalize(vec3((uvS.x-.5)*ASP*1.05,-(uvS.y-HY)*1.05,1.));
  vec3 n;float kind,sh;bool refl=false;vec3 att=vec3(1.);
  if(rd.y<0.){float tw=-ro.y/rd.y;vec3 pw=ro+rd*tw;if(pw.z<SHORE){refl=true;ro=pw;vec2 w=vec2(vn(pw.xz*vec2(.3,1.2))-.5,vn(pw.xz*vec2(.2,1.)+5.)-.5)*.014;vec3 nn=normalize(vec3(w.x,1.,w.y));rd=reflect(rd,nn);att=vec3(.78,.84,.94);}} /* the lake mirrors the scene */
  float t=hit(ro,rd,n,kind,sh,1600.);vec3 col;float alpha=1.;
  if(t<0.){if(!refl)return vec4(0.);col=skyC(rd);}else col=shade(ro,rd,t,n,kind,sh);
  if(refl){col*=att;col=mix(col,vec3(.9,.88,.96),.12);}
  col=col/(1.+col*.15);return vec4(clamp(col,0.,1.),alpha);}
void main(){vec4 acc=vec4(0.);int n=int(SS);for(int j=0;j<4;j++)for(int i=0;i<4;i++){if(i>=n||j>=n)continue;vec2 o=(vec2(float(i),float(j))+.5)/SS;vec2 fc=gl_FragCoord.xy-.5+o;
  vec2 uvS=vec2(fc.x/res.x,Y0+(1.-fc.y/res.y)*(1.-Y0));vec4 c=render(uvS);acc+=vec4(c.rgb*c.a,c.a);}
  acc/=SS*SS;gl_FragColor=acc.a>0.?vec4(acc.rgb/acc.a,acc.a):vec4(0.);}
