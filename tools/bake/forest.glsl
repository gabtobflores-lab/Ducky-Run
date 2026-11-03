// The ice halo's frozen forest: snow-laden spruces across a snowfield, backlit by the low sun, casting long blue shadows toward us.
const float Y0=.76, ASP=393./852., HY=.86;
float hsh(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float ground(vec2 p){return .6*vn(p*.03)+.3*vn(p*.09)+28.*smoothstep(260.,520.,p.y)*vn(p*.006+2.);} /* gentle snowy hills far beyond the forest */
float cone(vec3 p,float r,float h){vec2 q=vec2(length(p.xz),p.y);float k=h/sqrt(h*h+r*r);return max((q.x-r*(1.-q.y/h))*k,max(-q.y,q.y-h));}
float tree(vec3 p,float h,float sd){float d=1e5;float lean=(sd-.5)*.06;p.x-=p.y*lean;int nt=4+int(sd*2.99);for(int k=0;k<6;k++){if(k>=nt)break;float fk=float(k),u=fk/float(nt);float y0=h*(.08+u*.84),r=h*(.27-u*.21),hh=h*(.24-u*.1);
    vec3 q=p-vec3(0.,y0,0.);float rr=length(q.xz);q.y+=.55*hh*pow(clamp(rr/r,0.,1.),2.); /* branch tips droop under the snow */
    float an=atan(q.z,q.x);float br=(sin(an*(7.+fk)+sd*20.+fk*1.7)*.5+.5)*(vn(vec2(an*3.+sd*9.,fk))*.8+.2)*(1.-clamp(q.y/hh,0.,1.));
    d=min(d,cone(q,r*(.82+.3*br+.05*sin(an*27.+q.y*5.)),hh)*.75);}
  d=min(d,max(length(p.xz)-h*.03,max(-p.y,p.y-h*.25)));return d;} /* a spruce: its own number of tiers, each branch layer uneven and drooping, a slight lean */
const float CS=7.;
float forest(vec3 p,out float id){float d=1e5;id=0.;vec2 c0=floor(p.xz/CS);for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 c=c0+vec2(float(i),float(j));float hs=hsh(c);if(hs<.4||c.y<8.||c.y>22.+6.*hsh(vec2(c.x,1.)))continue;vec2 o=(vec2(hsh(c+3.1),hsh(c+7.7))-.5)*CS*.7;vec2 cp=(c+.5)*CS+o;float h=9.+10.*hsh(c+1.3);float g=ground(cp);float dd=tree(p-vec3(cp.x,g-.3,cp.y),h,hsh(c+5.5));if(dd<d){d=dd;id=hs;}}return d;}
float map(vec3 p,out float id,out float isT){float g=p.y-ground(p.xz);float f=forest(p,id);isT=step(f,g);return min(g,f);}
float shadow(vec3 ro,vec3 L){float s=1.,t=.2,id,it;for(int i=0;i<48;i++){float d=map(ro+L*t,id,it);s=min(s,10.*d/t);if(s<.01)break;t+=clamp(d,.15,3.);if(t>60.)break;}return clamp(s,0.,1.);}
vec4 render(vec2 uvS){vec3 ro=vec3(0.,13.,0.);vec3 rd=normalize(vec3((uvS.x-.5)*ASP*1.05,-(uvS.y-HY)*1.05,1.));vec3 L=normalize(vec3(.55,.42,.6));
  float t=.5,id=0.,it=0.;bool hit=false;for(int i=0;i<420;i++){float d=map(ro+rd*t,id,it);if(d<.0015*t){hit=true;break;}t+=d*.55;if(t>700.)break;}
  if(!hit)return vec4(0.);
  vec3 p=ro+rd*t;float e=.002*t+.005,d0=map(p,id,it),i2,t2;vec3 n=normalize(vec3(map(p+vec3(e,0,0),i2,t2)-d0,map(p+vec3(0,e,0),i2,t2)-d0,map(p+vec3(0,0,e),i2,t2)-d0));
  float sh=shadow(p+n*.05,L),dif=clamp(dot(n,L),0.,1.);vec3 col;
  if(it>.5){vec3 nn=normalize(n+(vec3(vn(p.xy*9.),vn(p.yz*9.+3.),vn(p.zx*9.+7.))-.5)*.55);n=nn; /* needles: fine texture in the light */
    float sn=smoothstep(.3,.62,n.y+(vn(p.xz*1.4+p.y*2.1)-.5)*.5)*smoothstep(.1,.5,vn(p.xz*.6+p.y*.9)+.25); /* snow lying on the tops of the branches */
    vec3 bark=mix(vec3(.04,.1,.1),vec3(.07,.15,.14),id);vec3 snow=vec3(.9,.95,1.);vec3 alb=mix(bark,snow,sn);
    col=alb*(vec3(1.,.95,.88)*dif*sh*1.6+vec3(.42,.55,.86)*(.36+.4*n.y))+vec3(1.,.97,.9)*pow(1.-clamp(dot(n,-rd),0.,1.),3.)*.5*sn*sh;} /* the snowy edges glow, lit from behind */
  else{vec3 alb=vec3(.94,.96,1.);col=alb*(vec3(1.,.97,.92)*dif*sh*1.15+vec3(.42,.56,.88)*.55);col+=vec3(1.)*pow(clamp(dot(reflect(rd,n),L),0.,1.),60.)*.4*sh;} /* the snowfield: warm where lit, blue in shadow */
  vec3 hz=vec3(.8,.87,.97);col=mix(col,hz,1.-exp(-t*.0028));col=col/(1.+col*.2);return vec4(clamp(col,0.,1.),1.);}
void main(){vec4 acc=vec4(0.);int n=int(SS);for(int j=0;j<4;j++)for(int i=0;i<4;i++){if(i>=n||j>=n)continue;vec2 o=(vec2(float(i),float(j))+.5)/SS;vec2 fc=gl_FragCoord.xy-.5+o;
  vec2 uvS=vec2(fc.x/res.x,Y0+(1.-fc.y/res.y)*(1.-Y0));vec4 c=render(uvS);acc+=vec4(c.rgb*c.a,c.a);}
  acc/=SS*SS;gl_FragColor=acc.a>0.?vec4(acc.rgb/acc.a,acc.a):vec4(0.);}
