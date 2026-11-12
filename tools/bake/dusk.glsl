// Dusk for the fireflies: rolling hills and scattered trees in silhouette, rimmed by the last warm light, fading into violet haze.
const float Y0=.76, ASP=393./852., HY=.855;
float hsh(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float h3(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float vn3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
const float SHORE=-1e4;
float mountain(vec2 p){vec2 c=vec2(-70.,820.);float r=length(p-c)/430.;float base=pow(max(0.,1.-r),1.5)*230.;float rg=0.,a=.5,f=1.;vec2 q=p*.012;for(int k=0;k<5;k++){rg+=a*(1.-abs(vn(q*f)*2.-1.));f*=2.1;a*=.45;}return base*(.86+.24*rg)-4.+3.*vn(p*.02);}
float land(vec2 p){return 4.*vn(p*.012)+2.*vn(p*.035)+34.*smoothstep(260.,620.,p.y)*vn(p*.0035+1.)-2.;}
float trees(vec3 p,out float sh){sh=0.;if(p.z<135.||p.z>455.)return 1e5;float d=1e5;const float CS=9.;vec2 c0=floor(p.xz/CS);for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 c=c0+vec2(float(i),float(j));vec2 cp=(c+.5)*CS;if(cp.y<150.||cp.y>440.||hsh(c)<.7)continue;
    cp+=(vec2(hsh(c+1.),hsh(c+2.))-.5)*CS*.6;float s=3.2+4.*hsh(c+3.);vec3 o=vec3(cp.x,land(cp)+1.+s*1.1,cp.y);
    for(int k=0;k<5;k++){float fk=float(k);float an=fk*1.257+hsh(c)*6.;vec3 off=vec3(sin(an)*s*.6,(hsh(c+fk)-.3)*s*.6,cos(an)*s*.45);float dd=length(p-o-off)-s*(.55+.15*hsh(c+fk*2.));if(dd<d){d=dd;sh=hsh(c);}}}
  return d+(vn3(p*.7)-.5)*.8+(vn3(p*1.9)-.5)*.22;} /* billowing canopies, soft and clumped */
vec3 skyC0(vec3 rd){float y=max(rd.y,0.);vec3 c=mix(vec3(1.,.88,.9),vec3(.62,.76,.96),smoothstep(0.,.35,y));c+=vec3(1.,.9,.8)*pow(max(dot(rd,normalize(vec3(.45,.5,1.))),0.),6.)*.3;return c;}
float hit(vec3 ro,vec3 rd,out vec3 n,out float kind,out float sh,float tmax){float t=.5;kind=-1.;for(int i=0;i<300;i++){vec3 p=ro+rd*t;float s2;float dt=trees(p,s2);float dl=p.y-land(p.xz);
    if(dt<.01*max(1.,t*.012)){kind=2.;sh=s2;break;}if(dl<.002*t){kind=1.;break;}t+=min(dt*.45,max(dl*.4,.01*t));if(t>tmax)return -1.;}
  vec3 p=ro+rd*t;float e=.05+t*.002;
  if(kind>1.5){e=.35+t*.002; /* soft, rounded clumps of blossom */float a,b,c2,d0=trees(p,a);n=normalize(vec3(trees(p+vec3(e,0,0),b)-d0,trees(p+vec3(0,e,0),b)-d0,trees(p+vec3(0,0,e),b)-d0));}
  else{float h=land(p.xz);n=normalize(vec3(h-land(p.xz+vec2(e,0.)),e,h-land(p.xz+vec2(0.,e))));}
  return t;}
vec3 shade(vec3 ro,vec3 rd,float t,vec3 n,float kind,float sh){vec3 p=ro+rd*t;vec3 L=normalize(vec3(-.35,.1,1.));float rim=pow(1.-clamp(dot(n,-rd),0.,1.),3.)*smoothstep(-.3,.6,dot(n,L));vec3 col;
  if(kind>1.5)col=vec3(.07,.06,.11)+vec3(1.,.58,.48)*rim*.5+vec3(.2,.15,.3)*.25*(.5+.5*n.y); /* trees in silhouette, their edges catching the sunset */
  else col=vec3(.12,.09,.17)*(.6+.4*n.y)+vec3(1.,.55,.45)*rim*.35+vec3(.9,.5,.45)*clamp(dot(n,L),0.,1.)*.12;
  float fog=1.-exp(-t*.0042);col=mix(col,mix(vec3(.38,.24,.42),vec3(.86,.5,.52),smoothstep(150.,700.,t)),fog);return col;}
vec4 render(vec2 uvS){vec3 ro=vec3(0.,9.,0.);vec3 rd=normalize(vec3((uvS.x-.5)*ASP*1.05,-(uvS.y-HY)*1.05,1.));
  vec3 n;float kind,sh;bool refl=false;vec3 att=vec3(1.);
  if(false){float tw=-ro.y/rd.y;vec3 pw=ro+rd*tw;if(pw.z<SHORE){refl=true;ro=pw;vec2 w=vec2(vn(pw.xz*vec2(.3,1.2))-.5,vn(pw.xz*vec2(.2,1.)+5.)-.5)*.014;vec3 nn=normalize(vec3(w.x,1.,w.y));rd=reflect(rd,nn);att=vec3(.78,.84,.94);}} /* the lake mirrors the scene */
  float t=hit(ro,rd,n,kind,sh,1600.);vec3 col;float alpha=1.;
  if(t<0.){if(!refl)return vec4(0.);col=skyC0(rd);}else col=shade(ro,rd,t,n,kind,sh);
  if(refl){col*=att;col=mix(col,vec3(.9,.88,.96),.12);}
  col=col/(1.+col*.15);return vec4(clamp(col,0.,1.),alpha);}
void main(){vec4 acc=vec4(0.);int n=int(SS);for(int j=0;j<4;j++)for(int i=0;i<4;i++){if(i>=n||j>=n)continue;vec2 o=(vec2(float(i),float(j))+.5)/SS;vec2 fc=gl_FragCoord.xy-.5+o;
  vec2 uvS=vec2(fc.x/res.x,Y0+(1.-fc.y/res.y)*(1.-Y0));vec4 c=render(uvS);acc+=vec4(c.rgb*c.a,c.a);}
  acc/=SS*SS;gl_FragColor=acc.a>0.?vec4(acc.rgb/acc.a,acc.a):vec4(0.);}
