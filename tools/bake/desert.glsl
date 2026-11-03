// The eclipse's desert, after the iPhone Duo wallpaper: sweeping dunes with sharp crests in front of layered peaks.
// variant 0: dunes by day, 1: dunes in totality, 2: peaks by day, 3: peaks in totality. The image covers the screen from y0 to the bottom.
const float Y0=.7, ASP=393./852., HY=.775;
float hsh(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p,int o){float v=0.,a=.5;for(int k=0;k<7;k++){if(k>=o)break;v+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float dune(vec2 p,int o){float w=fbm(p*.018,3)*7.;float u=-(p.x*.62+p.y*.38)*.045+w*.32+sin(p.y*.022+p.x*.01)*1.1;float f=fract(u);
  float pr=f<.7?pow(f/.7,1.35):1.-pow((f-.7)/.3,.75);float amp=6.+4.*vn(p*.01);return pr*amp+fbm(p*.04,o)*1.4-1.2;}
float ripple(vec2 p){float w=fbm(p*.6,2)*2.;return .025*sin(p.x*3.1+p.y*1.4+w*3.)*(.6+.4*vn(p*.2));}
float peaks(vec2 p){float r=0.,a=.6,f=1.;vec2 q=p*.0045;for(int k=0;k<4;k++){r+=a*(1.-abs(vn(q*f)*2.-1.));f*=2.1;a*=.4;}return r*r*r*70.*smoothstep(150.,320.,p.y)-3.;}
float H(vec2 p,int o){return variant<1.5?dune(p,o):max(peaks(p),-3.);}
vec3 nrm(vec2 p,float t){float e=.02+t*.0015;float h=H(p,6)+(variant<1.5?ripple(p):0.);return normalize(vec3(h-H(p+vec2(e,0),6)-(variant<1.5?ripple(p+vec2(e,0)):0.),e,h-H(p+vec2(0,e),6)-(variant<1.5?ripple(p+vec2(0,e)):0.)));}
float shadow(vec3 ro,vec3 L){float s=1.,t=.3;for(int i=0;i<40;i++){vec3 p=ro+L*t;float d=p.y-H(p.xz,3);s=min(s,8.*d/t);if(s<.01)break;t+=clamp(d*.6,.2,4.);}return clamp(s,0.,1.);}
vec4 render(vec2 uvS){bool night=mod(variant,2.)>.5;vec3 ro=vec3(0.,15.,0.);vec3 rd=normalize(vec3((uvS.x-.5)*ASP*1.05,-(uvS.y-HY)*1.05,1.));
  float tmax=variant<1.5?420.:1400.,t=1.;bool hit=false;for(int i=0;i<420;i++){vec3 p=ro+rd*t;float h=H(p.xz,3);float d=p.y-h;if(d<.002*t){hit=true;break;}t+=max(d*.3,.006*t);if(t>tmax)break;}
  if(hit){float a=t-max(.006*t,.05),b=t;for(int k=0;k<8;k++){float m=(a+b)*.5;vec3 q=ro+rd*m;if(q.y-H(q.xz,3)<0.)b=m;else a=m;}t=b;} /* refine the hit: clean crests */
  if(!hit)return vec4(0.);
  vec3 p=ro+rd*t;vec3 n=nrm(p.xz,t);
  vec3 L=night?normalize(vec3(.2,.08,1.)):normalize(vec3(.62,.45,-.5));
  float dif=clamp(dot(n,L),0.,1.);float sh=night?1.:shadow(p+n*.05,L);
  vec3 alb=variant<1.5?vec3(.98,.72,.52):vec3(.78,.74,.88);
  vec3 col;
  if(!night){col=alb*(dif*sh*vec3(1.,.84,.64)*1.85+vec3(.5,.54,1.)*(.45+.55*n.y)*.62+vec3(.9,.6,.5)*.12*(1.-n.y));
    col+=vec3(1.,.85,.7)*pow(1.-max(dot(n,-rd),0.),5.)*.12*sh;
    vec3 hz=mix(vec3(.88,.8,.9),vec3(.82,.84,.95),smoothstep(0.,.1,rd.y));col=mix(col,hz,1.-exp(-t*(variant<1.5?.0062:.0028)));}
  else{col=alb*(vec3(1.,.5,.3)*dif*.42+vec3(.1,.1,.28)*(.4+.6*n.y)*.55+vec3(.3,.12,.18)*.08);
    col+=vec3(1.,.52,.34)*pow(1.-max(dot(n,-rd),0.),3.)*.34*smoothstep(-.2,.6,dot(n,L));col+=vec3(.9,.45,.35)*.06*smoothstep(.3,1.,dot(n,L));
    vec3 hz=vec3(.3,.15,.26);col=mix(col,hz,1.-exp(-t*(variant<1.5?.0062:.0028)));}
  float a=variant<1.5?1.-smoothstep(tmax*.7,tmax,t):1.;
  col=col/(1.+col*.28);{float l=dot(col,vec3(.3,.59,.11));col=mix(vec3(l),col,1.15);}col=clamp(col,0.,1.);return vec4(col,a);}
void main(){vec4 acc=vec4(0.);int n=int(SS);for(int j=0;j<4;j++)for(int i=0;i<4;i++){if(i>=n||j>=n)continue;vec2 o=(vec2(float(i),float(j))+.5)/SS;vec2 fc=gl_FragCoord.xy-.5+o;
  vec2 uvS=vec2(fc.x/res.x,Y0+(1.-fc.y/res.y)*(1.-Y0));vec4 c=render(uvS);acc+=vec4(c.rgb*c.a,c.a);}
  acc/=SS*SS;gl_FragColor=acc.a>0.?vec4(acc.rgb/acc.a,acc.a):vec4(0.);}
