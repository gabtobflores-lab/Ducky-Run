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
  vec2 s=vec2((x+fold*.6)*3.5,q.y*.08);                                    /* stretched space: noise becomes vertical rays */
  float L1=sfbm(s+vec2(.012,.005)*t+seed);                                 /* broad structure */
  float L2=sfbm(s*vec2(2.6,1.)+vec2(-.038*t+.3*sin(t*.23+seed),0.)+seed*3.); /* fine shimmer that tears and regroups */
  float rays=pow(clamp(L1*(.35+.65*L2)*1.55,0.,1.),2.2);                   /* fine threads, with dark gaps between */
  float soft=smoothstep(.36,.7,sfbm(vec2(x*3.2+t*.02,seed*1.7)));     /* curtains break apart: real dark sky between them */        /* the sheet is brighter in some stretches than others */
  float up=exp(-max(d,0.)/(.26*depth)),down=exp(-pow(max(-d,0.)/.15,1.3));
  float body=up*down;
  return vec2(body*soft*(.22*soft+rays*1.5),d);}
void main(){vec2 p=UV();float asp=res.x/res.y;vec2 q=vec2(p.x*asp,1.-p.y);
  /* night sky: near-black overhead, deep indigo low down, a faint violet glow along the horizon */
  vec3 sky=mix(vec3(.004,.008,.022),vec3(.02,.03,.09),smoothstep(1.,.25,q.y));
  sky+=vec3(.07,.04,.2)*blob(vec2(p.x,q.y),vec2(.65,-.05),vec2(.7,.3));
  /* colour by height above the hem, mixed in OKLab: violet-blue below, cyan at the hem, teal-green above, fading out */
  vec3 cLow=lab(vec3(60.,70.,230.)),cHem=lab(vec3(120.,255.,250.)),cMid=lab(vec3(0.,215.,225.)),cTop=lab(vec3(20.,170.,130.));
  vec3 lin=toLin(sky);float lum=0.;
  for(int i=0;i<3;i++){float fi=float(i);
    float depth=1.-fi*.22,hem0=.3+fi*.14+.04*sin(t*.03+fi*2.)+.05*sin(q.x*1.2+fi*3.+t*.02);   /* each curtain hangs at its own height and slant */
    vec2 r=sheet(q,depth,hem0,fi*7.3+1.);
    float k=r.y;
    vec3 c=k<0.?mix(cHem,cLow,smoothstep(0.,-.12,k)):k<.12?mix(cHem,cMid,k/.12):mix(cMid,cTop,smoothstep(.1,.36,k));
    float a=r.x*(1.-fi*.25);                                               /* nearer sheets are brighter */
    lin+=fromOklab(c)*a*1.45;lum+=a;}
  lin=lin/(1.+lin*.35);                                                    /* gentle highlight roll-off: bright, never clipped */
  vec3 col=toSrgb(lin);
  col+=starfield(vec2(q.x,p.y),.28)*(1.-smoothstep(.0,.35,lum));
  col+=(hs(gl_FragCoord.xy+fract(t*7.)*61.)-.5)*.01;                        /* fine grain against banding */
  gl_FragColor=vec4(col,1.);}
