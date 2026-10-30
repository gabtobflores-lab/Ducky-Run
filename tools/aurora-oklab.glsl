/* ---------------------------------------------------------------------------------------------
   Mirror Drop aurora, written from scratch to four rules:
   1. colour is blended in OKLab (perceptually uniform), never in RGB
   2. noise is sampled in a stretched space (x * 3.5, y * 0.08) so it forms thin vertical rays, not blobs
   3. two multi-octave simplex layers with unrelated velocities are multiplied, so the light tears and regroups
   4. a steep power curve keeps true black between rays; animated dither removes banding on OLED
   --------------------------------------------------------------------------------------------- */

/* ---- 2D simplex noise (Gustavson's skewed-triangle lattice), returns about -1..1 ---- */
vec3 sxPerm(vec3 x){return mod(((x*34.)+1.)*x,289.);}
float simplex(vec2 v){
  const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx);
  vec2 i1=x0.x>x0.y?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);
  vec3 p=sxPerm(sxPerm(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
  vec3 x=2.*fract(p*C.www)-1.,h=abs(x)-.5,a0=x-floor(x+.5);
  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);}
/* multi-fractal: four octaves, each finer and fainter; result 0..1 */
float sfbm(vec2 p){float v=0.,a=.5;for(int k=0;k<4;k++){v+=a*simplex(p);p=p*2.07+vec2(5.3,1.9);a*=.5;}return .5+.5*v/.9375;}

/* ---- colour: sRGB <-> linear <-> OKLab ---- */
vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
vec3 toSrgb(vec3 c){c=max(c,0.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
vec3 toOklab(vec3 c){vec3 l=vec3(dot(c,vec3(.4122214708,.5363325363,.0514459929)),dot(c,vec3(.2119034982,.6806995451,.1073969566)),dot(c,vec3(.0883024619,.2817188376,.6299787005)));
  l=pow(max(l,0.),vec3(1./3.));
  return vec3(dot(l,vec3(.2104542553,.7936177850,-.0040720468)),dot(l,vec3(1.9779984951,-2.4285922050,.4505937099)),dot(l,vec3(.0259040371,.7827717662,-.8086757660)));}
vec3 fromOklab(vec3 c){vec3 l=vec3(c.x+.3963377774*c.y+.2158037573*c.z,c.x-.1055613458*c.y-.0638541728*c.z,c.x-.0894841775*c.y-1.2914855480*c.z);l=l*l*l;
  return vec3(dot(l,vec3(4.0767416621,-3.3077115913,.2309699292)),dot(l,vec3(-1.2684380046,2.6097574011,-.3413193965)),dot(l,vec3(-.0041960863,-.7034186147,1.7076147010)));}
/* the four anchors, converted once per pixel (cheap) */
vec3 ramp(float n){
  vec3 sky=toOklab(toLin(vec3(2.,11.,30.)/255.)),    /* #020B1E deep sky backdrop  */
       halo=toOklab(toLin(vec3(58.,0.,125.)/255.)),  /* #3A007D ambient halo       */
       core=toOklab(toLin(vec3(0.,85.,255.)/255.)),  /* #0055FF core glow          */
       peak=toOklab(toLin(vec3(0.,240.,210.)/255.)); /* #00F0D2 vibrant ray peak   */
  vec3 c=n<.3?mix(sky,halo,n/.3):n<.62?mix(halo,core,(n-.3)/.32):mix(core,peak,(n-.62)/.38);
  return fromOklab(c);}

void main(){vec2 p=UV();float asp=res.x/res.y;
  vec2 q=vec2(p.x*asp,1.-p.y);                                    /* aspect-correct, y up */
  /* rule 2: the curtain bends gently, then the space is squashed so noise becomes vertical threads */
  float bend=.05*sin(q.y*2.2+t*.05+q.x*.8)+.025*sin(q.y*5.1-t*.08);   /* a gentle fold, never a ribbon */
  vec2 s=vec2((q.x+bend)*3.5,q.y*.08);
  /* rule 3: two independent layers, unrelated speeds, multiplied */
  float L1=sfbm(s+vec2(.012,.005)*t);                             /* broad structural drift */
  float wave=sin(t*.23+q.y*3.)*.5+.5;                              /* non-linear shimmer modifier */
  float L2=sfbm(s*vec2(3.1,1.)+vec2(-.038*t+.35*wave*wave,0.)+17.); /* fine horizontal shimmer and tearing */
  L1=.4+.6*L1;                                                       /* the broad layer shapes the light but never switches the whole sky off */
  L2=.3+.7*L2;
  float n=L1*L2*1.25;
  float group=.4+.6*smoothstep(.3,.62,sfbm(vec2((q.x+bend)*.9+t*.007,4.2+t*.003)));     /* strands gather into a few curtains with dark sky between */
  float body=sfbm(vec2((q.x+bend)*1.6,q.y*.05)+vec2(.012,.005)*t+9.);             /* a wide, soft sheet of light behind the strands */
  n=n*(.3+.9*group)+(.06+body*body*.4)*group;                                               /* multiplicative: rays appear only where both agree */
  /* the light hangs as a curtain: brightest across the middle of the screen, fading up into the sky and down to the horizon */
  float hem=.3+.06*sin(q.x*1.7+t*.04)+.04*sin(q.x*3.9-t*.06);
  float env=mix(.35,1.,smoothstep(hem-.22,hem+.04,q.y))*exp(-max(q.y-hem-.04,0.)*1.9)*smoothstep(-.05,.25,q.y);  /* rays fall off slowly upward, a softer glow continues below the hem */
  n=clamp(n*env,0.,1.);
  /* rule 4: steep falloff keeps black pockets between rays */
  float glow=pow(n,1.8)*.38;                                        /* the soft body the rays sit in */
  n=pow(n,3.5)*1.6;
  n=max(n,glow);
  n=1.-exp(-n*1.1);                                                /* highlights roll off smoothly instead of flattening into one colour */
  vec3 lin=ramp(clamp(n,0.,1.));   /* anything beyond the peak blooms a little */
  vec3 col=toSrgb(lin);
  col+=starfield(vec2(q.x,p.y),.25)*(1.-smoothstep(.0,.25,n));
  col+=(hs(gl_FragCoord.xy+fract(t*7.)*61.)-.5)*.01;               /* rule 4: ~1% animated grain against banding */
  gl_FragColor=vec4(col,1.);}
