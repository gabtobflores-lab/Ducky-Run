/* Mirror Drop aurora: original, drawn entirely in code. Three folded curtains of light at different depths,
   fine vertical rays from stretched simplex noise, colour blended in OKLab, soft glow and grain. */
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
float blob(vec2 p,vec2 c,vec2 r){vec2 d=(p-c)/r;return exp(-dot(d,d));}
/* one curtain of light at one depth: a folded sheet hanging from a wavy lower hem.
   returns x = light amount, y = height above the hem (for colour) */
vec2 sheet(vec2 q,float depth,float hem0,float seed){
  float x=q.x/depth;                                                       /* farther sheets look narrower and finer */
  float fold=.13*sin(x*4.1+t*.05+seed)+.05*sin(x*9.3-t*.08+seed*2.)+.08*(sfbm(vec2(x*2.+t*.015,seed))-.5);   /* deep folds: seen from below, the curtain becomes columns */
  float hem=hem0+fold;
  float d=q.y-hem;                                                         /* > 0 above the hem */
  vec2 s=vec2((x+fold*.6)*2.,q.y*.08);                                     /* wider rays: the light diffuses like mist */                                    /* stretched space: noise becomes vertical rays */
  float L1=sfbm(s+vec2(.012,.005)*t+seed);                                 /* broad structure */
  float L2=sfbm(s*vec2(2.6,1.)+vec2(-.038*t+.3*sin(t*.23+seed),0.)+seed*3.); /* fine shimmer that tears and regroups */
  float rays=pow(clamp(L1*(.55+.45*L2)*1.45,0.,1.),1.8);                   /* soft, gaseous rays rather than hard streaks */                   /* fine threads, with dark gaps between */
  float soft=smoothstep(.36,.7,sfbm(vec2(x*3.2+t*.02,seed*1.7)));     /* curtains break apart: real dark sky between them */        /* the sheet is brighter in some stretches than others */
  float up=exp(-max(d,0.)/(.3*depth)),down=exp(-pow(max(-d,0.)/.15,1.3));
  float body=up*down;
  return vec2(body*soft*(.22*soft+rays*1.5),d);}
void main(){vec2 p=UV();float asp=res.x/res.y;vec2 q=vec2(p.x*asp,1.-p.y);   /* q.y: 0 = bottom, 1 = top */
  /* 1. one detailed grayscale intensity map: three folded curtains of rays, summed */
  float I=0.;
  for(int i=0;i<3;i++){float fi=float(i);
    float depth=1.-fi*.22,hem0=.16+fi*.1+.04*sin(t*.03+fi*2.)+.05*sin(q.x*1.2+fi*3.+t*.02);
    I+=sheet(q,depth,hem0,fi*7.3+1.).x*(1.-fi*.25);}
  /* the lower third is a pool of light around the player: a bright, slowly breathing glow along the horizon */
  float pool=exp(-pow(q.y/.3,2.))*(.55+.25*sfbm(vec2(q.x*1.4+t*.02,t*.01)));
  I=I*.8+pool*.45;
  /* 3. vignette: light gathers in the centre-left column and falls off with an inverse-square curve towards the sides and the top */
  vec2 v=vec2((p.x-.42)/1.1,max(q.y-.4,0.)/1.15);
  float vig=1./(1.+1.3*dot(v,v));vig*=vig;
  I*=vig;
  /* 2. colour chosen by brightness, not position (OKLab): dark sky -> violet envelope -> system blue -> neon cyan only in the hottest cores */
  vec3 cSky=lab(vec3(2.,11.,30.)),cVio=lab(vec3(58.,0.,125.)),cBlu=lab(vec3(0.,85.,255.)),cCya=lab(vec3(0.,240.,210.));
  float n=1.-exp(-I*1.5);                                                     /* intensity, softly compressed to 0..1 */
  vec3 c=n<.25?mix(cSky,cVio,smoothstep(0.,.25,n)):n<.55?mix(cVio,cBlu,smoothstep(.25,.55,n)):mix(cBlu,cCya,smoothstep(.55,.9,n));
  float mist=sfbm(vec2(q.x*1.1-t*.015,q.y*.35+t*.008)+3.1);                       /* a broad, slowly drifting veil of teal light */
  mist=smoothstep(.35,.75,mist)*smoothstep(.95,.25,q.y)*exp(-pow((p.x-.38)/.65,2.))*vig;   /* strongest through the middle and left, fading up into the dark */
  c=mix(c,cCya,clamp(mist*.6*(.3+.7*n),0.,.6));                                   /* blended in OKLab, so it glows over the purple instead of muddying it */
  vec3 lin=fromOklab(c)*(1.+mist*.25);
  /* the backdrop: pitch-dark midnight indigo at the top, lifting a little towards the glowing horizon */
  vec3 sky=toLin(vec3(2.,11.,30.)/255.)*mix(1.,2.2,smoothstep(.7,0.,q.y))*mix(.5,1.,smoothstep(1.,.75,q.y));
  lin=max(lin,sky);
  vec3 col=toSrgb(lin);
  col+=starfield(vec2(q.x,p.y),.28)*(1.-smoothstep(.0,.3,n))*smoothstep(.25,.6,q.y);
  col+=(hs(gl_FragCoord.xy+fract(t*7.)*61.)-.5)*.01;                          /* fine grain against banding */
  gl_FragColor=vec4(col,1.);}
