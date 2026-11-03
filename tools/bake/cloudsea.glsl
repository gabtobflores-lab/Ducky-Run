// Golden hour's sea of clouds and the peaks rising through it, backlit by the low sun.
// variant 0: golden light, 1: sunset, 2: blue hour. The image covers the screen from Y0 to the bottom.
const float Y0=.7, ASP=393./852., HY=.79;
float hsh(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p,int o){float v=0.,a=.5;for(int k=0;k<7;k++){if(k>=o)break;v+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float cloud(vec2 p,int o){vec2 w=vec2(fbm(p*.006,3),fbm(p*.006+5.2,3))*60.;vec2 q=(p+w)*.014;float bl=0.,a=.55;for(int k=0;k<4;k++){bl+=a*abs(vn(q)*2.-1.);q=q*2.07+vec2(3.1,1.3);a*=.48;}float big=fbm(p*.004+3.,3);return -16.+pow(clamp(bl,0.,1.2),1.5)*11.+big*9.;} /* billowing, cauliflower tops */ /* billowing tops */
float peak(vec2 p){float r=0.,a=.6,f=1.;vec2 q=p*.0042+vec2(.3,1.7);for(int k=0;k<5;k++){r+=a*(1.-abs(vn(q*f)*2.-1.));f*=2.1;a*=.42;}float m=smoothstep(.45,.75,vn(p*.0021+vec2(4.,1.)));return (r*r*r*95.-24.)*m*smoothstep(260.,420.,p.y)-30.;}
float H(vec2 p,int o,out float isPk){float c=cloud(p,o),k=peak(p);isPk=step(c,k);return max(c,k);}
vec4 render(vec2 uvS){vec3 ro=vec3(0.,6.,0.);vec3 rd=normalize(vec3((uvS.x-.5)*ASP*1.05,-(uvS.y-HY)*1.05,1.));
  float el=variant<.5?.13:variant<1.5?.025:-.06;vec3 L=normalize(vec3((.62-.5)*ASP*1.05,el,1.));
  vec3 sunC=variant<.5?vec3(1.,.8,.52)*1.15:variant<1.5?vec3(1.,.5,.3)*1.2:vec3(0.);vec3 amb=variant<.5?vec3(.5,.52,.7):variant<1.5?vec3(.46,.33,.5):vec3(.15,.14,.3);vec3 hzc=variant<.5?vec3(1.,.86,.62):variant<1.5?vec3(1.,.6,.42):vec3(.78,.42,.46);
  float t=2.,pk=0.;bool hit=false;for(int i=0;i<360;i++){vec3 p=ro+rd*t;float h=H(p.xz,4,pk);float d=p.y-h;if(d<.003*t){hit=true;break;}t+=max(d*.4,.008*t);if(t>1800.)break;}
  if(!hit)return vec4(0.);
  {float a=t-max(.008*t,.05),b=t;for(int k=0;k<8;k++){float m=(a+b)*.5;vec3 q=ro+rd*m;if(q.y-H(q.xz,4,pk)<0.)b=m;else a=m;}t=b;}
  vec3 p=ro+rd*t;float e=pk>.5?.05+t*.002:.9+t*.006; /* clouds are lit softly: their shading follows the large billows, not every crease */float h0=H(p.xz,6,pk);float dum;vec3 n=normalize(vec3(h0-H(p.xz+vec2(e,0.),6,dum),e,h0-H(p.xz+vec2(0.,e),6,dum)));
  vec3 col;
  if(pk<.5){float ht=clamp((p.y+12.)/16.,0.,1.); /* cloud: soft wrapped light, brighter on high tops, glowing at the rims where the sun shines through */
    float wrap=pow(clamp(dot(n,L)*.5+.5,0.,1.),1.6);float back=pow(clamp(dot(rd,L),0.,1.),6.)*pow(1.-clamp(dot(n,-rd),0.,1.),2.);
    col=amb*(.55+.45*n.y)*(.6+.5*ht)+sunC*wrap*(.35+.65*ht)*.95+sunC*back*1.+sunC*pow(clamp(dot(rd,L),0.,1.),40.)*.5*ht;
    col=mix(col*vec3(.86,.82,.98),col,ht);}
  else{float dif=clamp(dot(n,L),0.,1.);col=vec3(.42,.38,.48)*amb*.9+sunC*dif*.45*vec3(.9,.8,.75)+sunC*pow(1.-clamp(dot(n,-rd),0.,1.),4.)*.4*step(0.,dot(n,L));} /* rock: in shade, lit gold on the sunward slopes, rimmed with light */
  float fog=1.-exp(-t*.0011);col=mix(col,hzc*(variant>1.5?.8:1.),fog);col+=sunC*.25*pow(clamp(dot(rd,L),0.,1.),12.)*fog; /* haze toward the horizon, brightest toward the sun */
  col=col/(1.+col*.3);{float l=dot(col,vec3(.3,.59,.11));col=mix(vec3(l),col,1.1);}return vec4(clamp(col,0.,1.),1.);}
void main(){vec4 acc=vec4(0.);int n=int(SS);for(int j=0;j<4;j++)for(int i=0;i<4;i++){if(i>=n||j>=n)continue;vec2 o=(vec2(float(i),float(j))+.5)/SS;vec2 fc=gl_FragCoord.xy-.5+o;
  vec2 uvS=vec2(fc.x/res.x,Y0+(1.-fc.y/res.y)*(1.-Y0));vec4 c=render(uvS);acc+=vec4(c.rgb*c.a,c.a);}
  acc/=SS*SS;gl_FragColor=acc.a>0.?vec4(acc.rgb/acc.a,acc.a):vec4(0.);}
