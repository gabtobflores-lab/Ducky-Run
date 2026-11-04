// Golden hour's sea of clouds as real volumetric cloud: light scatters through 3D density, the clouds shadow themselves,
// the sun shines through their thin edges (silver lining), with peaks rising through. variant 0 golden, 1 sunset, 2 blue hour.
const float Y0=.7, ASP=393./852., HY=.79;
float h3(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float hsh(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
const float TOP=-6., BOT=-46.;
float dens(vec3 p,int o){float y=(p.y-BOT)/(TOP-BOT);if(y<0.||y>1.)return 0.;vec3 q=p*vec3(.016,.026,.016);float cov=n3(q*.35+vec3(3.1,0.,1.7));
  float f=0.,a=.55;for(int k=0;k<5;k++){if(k>=o)break;f+=a*n3(q);q=q*2.05+vec3(1.3,7.1,3.7);a*=.48;}
  float shape=smoothstep(0.,.18,y)*(1.-smoothstep(.45+.4*cov,1.,y)); /* flat bases, billowing tops of uneven height */
  return clamp((f-.52+.32*cov)*6.,0.,1.)*shape;}
float peak(vec2 p){float r=0.,a=.6,f=1.;vec2 q=p*.0042+vec2(.3,1.7);for(int k=0;k<5;k++){r+=a*(1.-abs(vn(q*f)*2.-1.));f*=2.1;a*=.42;}float m=smoothstep(.45,.75,vn(p*.0021+vec2(4.,1.)));return (r*r*r*95.-24.)*m*smoothstep(260.,420.,p.y)-60.;}
vec4 render(vec2 uvS){vec3 ro=vec3(0.,10.,0.);vec3 rd=normalize(vec3((uvS.x-.5)*ASP*1.05,-(uvS.y-HY)*1.05,1.));
  float el=variant<.5?.13:variant<1.5?.025:-.06;vec3 L=normalize(vec3((.62-.5)*ASP*1.05,el,1.));
  vec3 sunC=variant<.5?vec3(1.,.82,.58)*2.2:variant<1.5?vec3(1.,.52,.3)*2.4:vec3(0.);vec3 amb=variant<.5?vec3(.55,.58,.78):variant<1.5?vec3(.5,.36,.55):vec3(.16,.15,.32);vec3 hzc=variant<.5?vec3(1.,.86,.64):variant<1.5?vec3(1.,.6,.44):vec3(.72,.4,.46);
  float tP=-1.;{float t=5.;for(int i=0;i<220;i++){vec3 p=ro+rd*t;float d=p.y-peak(p.xz);if(d<.002*t){tP=t;break;}t+=max(d*.3,.006*t);if(t>2200.)break;}
    if(tP>0.){float a=tP-.006*tP,b=tP;for(int k=0;k<10;k++){float m=(a+b)*.5;vec3 q=ro+rd*m;if(q.y-peak(q.xz)<0.)b=m;else a=m;}tP=b;}}
  float t0=rd.y<0.?(TOP-ro.y)/rd.y:1e9,t1=rd.y<0.?(BOT-ro.y)/rd.y:1e9;if(t0>2200.&&tP<0.)return vec4(0.);
  float tend=min(t1,2200.);if(tP>0.)tend=min(tend,tP);
  vec3 col=vec3(0.);float T=1.;float mu=dot(rd,L);float g=.55;float hg=(1.-g*g)/pow(1.+g*g-2.*g*mu,1.5)*.25+.12;
  if(t0<tend){float t=t0,dt;for(int i=0;i<140;i++){if(t>tend||T<.02)break;dt=.8+t*.008;vec3 p=ro+rd*(t+dt*hsh(gl_FragCoord.xy+float(i)));float d=dens(p,5);
      if(d>.004){float ls=0.;for(int j=0;j<5;j++){ls+=dens(p+L*(2.+float(j)*float(j)*2.2),3);}float lt=exp(-ls*1.6);float powder=1.-exp(-d*6.);
        float hy=clamp((p.y-BOT)/(TOP-BOT),0.,1.);vec3 S=sunC*lt*min(hg,1.6)*powder*1.15+amb*(.2+.6*hy)*(.5+.5*lt)+sunC*.08*hy;
        float ext=d*.35*dt;col+=T*S*(1.-exp(-ext));T*=exp(-ext);}
      t+=dt;}}
  if(tP>0.&&T>.02){vec3 p=ro+rd*tP;float e=.4+tP*.004;float h0=peak(p.xz);vec3 n=normalize(vec3(h0-peak(p.xz+vec2(e,0.)),e,h0-peak(p.xz+vec2(0.,e))));
    vec3 pc=vec3(.36,.33,.42)*amb*.9+sunC*clamp(dot(n,L),0.,1.)*.36*vec3(.9,.8,.75)+sunC*pow(1.-clamp(dot(n,-rd),0.,1.),4.)*.3*step(0.,dot(n,L));col+=T*pc;T=0.;}
  float tf=min(min(tend,t0>1e8?tend:tend),2200.);float fog=1.-exp(-(t0<1e8?t0:tf)*.0012);
  vec3 c=col/max(1.-T,1e-3);c=mix(c,hzc*(variant>1.5?.8:1.),fog*.85);c+=sunC*.18*pow(clamp(mu,0.,1.),14.)*fog;
  float a=1.-T;if(a<.01)return vec4(0.);
  c=c/(1.+c*.32);{float l=dot(c,vec3(.3,.59,.11));c=mix(vec3(l),c,1.08);}return vec4(clamp(c,0.,1.),clamp(a*1.05,0.,1.));}
void main(){vec4 acc=vec4(0.);int n=int(SS);for(int j=0;j<4;j++)for(int i=0;i<4;i++){if(i>=n||j>=n)continue;vec2 o=(vec2(float(i),float(j))+.5)/SS;vec2 fc=gl_FragCoord.xy-.5+o;
  vec2 uvS=vec2(fc.x/res.x,Y0+(1.-fc.y/res.y)*(1.-Y0));vec4 c=render(uvS);acc+=vec4(c.rgb*c.a,c.a);}
  acc/=SS*SS;gl_FragColor=acc.a>0.?vec4(acc.rgb/acc.a,acc.a):vec4(0.);}
