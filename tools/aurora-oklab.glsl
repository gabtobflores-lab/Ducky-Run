/* Mirror Drop aurora: an original gaseous light field, drawn entirely in code (WebGL / GLSL ES 1.0).
   1. sheared, non-uniformly scaled coordinates  -> slanted, ribbon-like pillars
   2. two-dimensional domain warping              -> the light bends, folds and tears instead of sliding
   3. one grayscale intensity mask, coloured by luminance thresholds in OKLab
   4. fine animated dither against banding
   Uniforms come from the game: res (pixels), t (seconds). UV(), hs() and starfield() are shared helpers. */
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

vec3 lab(vec3 srgb255){return toOklab(toLin(srgb255/255.));}

void main(){
  vec2 P=UV();float asp=res.x/res.y;
  vec2 base=vec2(P.x*asp,1.-P.y);                                  /* aspect-correct, y up: one continuous, asymmetric domain */

  /* ---- 1. shear and frequency remap ---- */
  vec2 uv=base;
  uv.x+=uv.y*.55;                                                  /* diagonal structural tilt (about 20 degrees on a phone) */
  uv.x*=2.2;                                                       /* horizontal compression */
  uv.y*=.08;                                                       /* vertical stretch: features become tall ribbons */

  /* ---- 2. domain warping: a slow macro flow field bends the sheared grid ---- */
  vec2 warp=vec2(simplex(base*1.+vec2(t*.03,t*.015)),
                 simplex(base*.8-vec2(t*.01,t*.04)));
  vec2 warp2=vec2(simplex(base*2.1+warp*.6+vec2(-t*.02,t*.025)),     /* a second pass, warped by the first: folds inside folds */
                  simplex(base*1.7-warp*.5+vec2(t*.035,-t*.01)));
  uv.x+=warp.x*.35+warp2.x*.12;
  uv.y+=(warp.y*.12+warp2.y*.04)*.1;                               /* the vertical warp is scaled with the 0.08 stretch, so the ribbons stay tall */

  /* ---- 3a. one detailed grayscale intensity mask ---- */
  float broad=sfbm(uv+vec2(t*.012,t*.005));                         /* the curtains */
  float fine=sfbm(uv*vec2(3.,1.)+vec2(-t*.038,0.)+7.3);             /* threads and shimmer inside them */
  float I=broad*(.6+.4*fine);
  /* shape the field over the screen: brightest through the centre-left, fading towards the top, a glow around the player low down */
  float colW=exp(-pow((P.x-.38)/.42,2.));
  float vert=smoothstep(1.02,.35,base.y)*(.75+.25*smoothstep(0.,.25,base.y));
  I*=mix(.7,1.3,colW)*vert;
  I=clamp((I-.2)/.5,0.,1.);                                       /* normalise to 0..1 */

  /* ---- 3b. colour by luminance, in OKLab ---- */
  vec3 cSky=lab(vec3(2.,11.,30.)),    /* #020B1E midnight indigo */
       cVio=lab(vec3(58.,0.,125.)),   /* #3A007D royal purple    */
       cBlu=lab(vec3(0.,85.,255.)),   /* #0055FF system blue     */
       cCya=lab(vec3(0.,240.,210.));  /* #00F0D2 electric cyan   */
  float v=I<.3?pow(I/.3,2.2)*.3:I;                                  /* valleys fall away hard: dark canyons through the light */
  vec3 c=v<.3 ?mix(cSky,cVio,smoothstep(.0,.3,v)*.55):
         v<.55?mix(mix(cSky,cVio,.55),cVio,smoothstep(.3,.55,v)):
         v<.75?mix(cVio,cBlu,smoothstep(.55,.75,v)):
               mix(cBlu,cCya,smoothstep(.75,.95,v));
  vec3 lin=fromOklab(c);
  lin=max(lin,toLin(vec3(2.,11.,30.)/255.));                         /* never darker than the night sky */
  vec3 col=toSrgb(lin);

  /* stars only where the sky is dark */
  col+=starfield(vec2(base.x,P.y),.28)*(1.-smoothstep(.1,.45,v))*smoothstep(.3,.7,base.y);

  /* ---- 4. anti-banding dither, about 1% ---- */
  col+=(hs(gl_FragCoord.xy+fract(t*7.)*61.)-.5)*.01;
  gl_FragColor=vec4(col,1.);}
