precision highp float;
uniform vec2 res;uniform float ph;   // ph: position in the loop, 0..1 (the video loops seamlessly)
/* Offline aurora renderer: real 3D curtains of light seen from the ground, ray-marched with many samples.
   Everything that moves is driven by a point travelling round a circle, so the last frame flows into the first. */
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<4;k++){v+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v/.9375;}
vec2 loopv(float r){float a=ph*6.2831853;return r*vec2(cos(a),sin(a));}          /* periodic time */
/* one curtain: where it hangs (z as a function of x), its lower edge, brightness along it */
float sheetZ(float x,float z0,float s){return z0+2.2*sin(x*.45+s+loopv(1.).x*.5)+1.1*sin(x*1.1-s*2.+loopv(1.).y*.6)+1.2*(fbm(vec2(x*.25,s)+loopv(.6))-.5);}   /* deep folds: where the curtain turns towards you it glows brighter */
float baseY(float x,float y0,float s){return y0+.35*sin(x*.5+s*3.)+.3*(fbm(vec2(x*.4,s+5.)+loopv(.5))-.5)+.45*(fbm(vec2(x*2.3,s+9.)+loopv(.3))-.5);}   /* ragged lower edge */
/* individual rays along a curtain: one per cell, each with its own position, width and brightness, dark gaps between */
float rayComb(float u,float h,float seed){float r=0.,c=floor(u),f=fract(u);
  for(int j=-1;j<=1;j++){float cj=c+float(j);
    float off=.2+.6*hs(vec2(cj,seed)),wid=.12+.16*hs(vec2(cj,seed+3.1)),br=.25+.75*hs(vec2(cj,seed+7.7));
    br*=.55+.45*vn(vec2(cj*.37+seed,h*.18)+loopv(.3));                    /* each ray brightens and fades along its length, slowly */
    float d=f-float(j)-off;r+=br*exp(-d*d/(wid*wid));}
  return r;}
vec3 emit(float h){ /* colour by height above the lower edge */
  vec3 hem=vec3(.1,1.,.95),cy=vec3(.0,.92,1.),bl=vec3(.05,.35,1.),vi=vec3(.03,.42,.36);   /* cyan-white edge, electric cyan, system blue, dark teal at the top */
  return h<.25?mix(hem,cy,h/.25):h<1.1?mix(cy,bl,.25+(h-.25)/.85*.6):mix(mix(cy,bl,.6),vi,clamp((h-1.1)/1.6,0.,1.));   /* cyan, a touch of blue, then teal-green higher up */}
void main(){vec2 uv=(gl_FragCoord.xy-.5*res)/res.y;
  /* camera on the ground, looking up and ahead */
  float pitch=.66;                                                       /* looking up into the sky: rays rush together overhead */vec3 ro=vec3(0.,0.,0.);
  vec3 rd=normalize(vec3(uv.x*1.15,uv.y*1.15,1.));
  rd=vec3(rd.x,rd.y*cos(pitch)+rd.z*sin(pitch),-rd.y*sin(pitch)+rd.z*cos(pitch));
  vec3 col=vec3(0.);
  float dt=.032;
  for(int i=0;i<520;i++){float tt=2.+(float(i)+hs(gl_FragCoord.xy+float(i)*.37))*dt*(1.+float(i)*.006);   /* jittered samples: no banding */vec3 P=ro+rd*tt;
    if(P.y<0.)continue;
    for(int k=0;k<5;k++){float fk=float(k),s=fk*3.7+1.;
      float z0=2.7+fk*1.9+.5*sin(fk*2.3),y0=.8+fk*.38+.2*sin(fk*4.1+1.);   /* five curtains from near to far */                                   /* three curtains at clearly different depths */
      float h0=P.y-y0;
      float X=P.x+.16*sin(h0*.6+s+loopv(1.).x*.8)+.05*sin(h0*1.5-s*1.7+loopv(1.).y)+.16*h0;   /* a gentle twist as it rises */   /* the curtain twists and leans as it rises */
      float dz=P.z-sheetZ(X,z0,s)-X*(.9-fk*.42);                     /* curtains run away from you at different angles: ribbons that recede into the distance */
      float w=.075-.009*fk;                                                  /* half the width */                                                    /* thinner sheets: crisp light, not fog */                                                    /* near curtain softest */                                                    /* the near curtain is thick and soft, like light slightly out of focus */
      float sheet=exp(-pow(abs(dz)/w,2.6))+.09*exp(-dz*dz/(20.*w*w));   /* a steeper edge: light drops off cleanly into dark sky */   /* the light scatters into a wide soft glow around the curtain */
      if(sheet<.002)continue;
      float h=P.y-baseY(X,y0,s);
      float prof=(smoothstep(-.6,.15,h)+.35*exp(-max(-h,0.)*1.6)*step(h,0.))*exp(-max(h,0.)/((1.7+.4*fk)*(.45+1.3*smoothstep(.25,.8,fbm(vec2(X*.32+s*2.,4.)+loopv(.35))))))*(.55+.45*smoothstep(.0,.6,h));   /* the edge fades in softly: no hard bright line */
      /* rays: fine vertical structure along the curtain, slowly drifting */
      float u=X*4.2+dz*.2;
      float comb=rayComb(u*(1.-.15*(1.-fk*.5)),h,s)*.85+rayComb(u*2.3+.5,h,s+11.)*.2*fk;   /* the near curtain is softer (slightly out of focus), the far ones crisp */      /* bold rays plus finer ones between */
      float bright=.1+.9*smoothstep(.3,.72,fbm(vec2(X*.22+s,2.)+loopv(.4)));
      float cx=-.3+(.22*loopv(1.).x+.15*loopv(1.).y)*(1.-fk*.15)+(fk-1.5)*.32*sin(fk*1.9+.5)-.25;                                  /* all layers gather towards the centre-left */                           /* the light gathers in one area that drifts slowly */
      float lobe=(fk<.5?4.2:1.)*exp(-pow((X-cx-dz*.1)/(.62+fk*.3),2.))+.45*exp(-pow((X-cx-2.6+.6*loopv(1.).y)/(.8+fk*.5),2.));   /* one main luminous mass and a smaller second one */
      bright*=lobe;
      float rays=mix(.55,.2+.8*comb,.9*smoothstep(.1,.9,lobe));
      rays*=.9+.1*vn(vec2(u*9.+s*3.,h*.25)+loopv(.2));                /* fine streak texture, very subtle */          /* crisp rays burn inside the bright mass, soft glow at its edges */      /* some stretches glow, others fade */
      vec3 ec=mix(emit(max(h,0.)),vec3(.1,.38,1.),fk*.06);
      col+=ec*sheet*prof*rays*bright*(1./(1.+fk*.9))*dt*6.;}}
  /* night sky behind */
  float y=gl_FragCoord.y/res.y;
  vec3 sky=mix(vec3(.06,.035,.2),vec3(.003,.006,.022),smoothstep(0.,.45,y));                   /* violet glow low down, near-black navy overhead */
  sky+=vec3(.09,.03,.24)*exp(-pow((gl_FragCoord.x/res.x-.7)/.35,2.))*smoothstep(.45,0.,y);   /* violet glow low down */
  col*=3.6;col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);   /* filmic curve: saturated glow, cores burn towards white */
  col=sky*(1.-col*.8)+col;                                                    /* light glows over the sky, it doesn't just sit on top */
  vec2 g=gl_FragCoord.xy/res.y*160.;float st=hs(floor(g));
  col+=vec3(.8,.85,1.)*step(.993,st)*exp(-dot(fract(g)-.5,fract(g)-.5)*40.)*.6*(1.-smoothstep(.0,.25,dot(col,vec3(.3,.5,.2))));
  gl_FragColor=vec4(pow(col,vec3(1./1.05)),1.);}
