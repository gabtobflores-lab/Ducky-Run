precision highp float;
uniform vec2 res;uniform float ph;   // ph: position in the loop, 0..1 (the video loops seamlessly)
/* Offline aurora renderer: real 3D curtains of light seen from the ground, ray-marched with many samples.
   Everything that moves is driven by a point travelling round a circle, so the last frame flows into the first. */
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<4;k++){v+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v/.9375;}
vec2 loopv(float r){float a=ph*6.2831853;return r*vec2(cos(a),sin(a));}          /* periodic time */
/* one curtain: where it hangs (z as a function of x), its lower edge, brightness along it */
float sheetZ(float x,float z0,float s){return z0+1.6*sin(x*.35+s+loopv(1.).x*.5)+.9*sin(x*.8-s*2.+loopv(1.).y*.6)+1.2*(fbm(vec2(x*.25,s)+loopv(.6))-.5);}
float baseY(float x,float y0,float s){return y0+.35*sin(x*.5+s*3.)+.3*(fbm(vec2(x*.4,s+5.)+loopv(.5))-.5)+.45*(fbm(vec2(x*2.3,s+9.)+loopv(.3))-.5);}   /* ragged lower edge */
vec3 emit(float h){ /* colour by height above the lower edge */
  vec3 hem=vec3(.55,1.,1.),cy=vec3(.0,.9,1.),bl=vec3(.08,.4,1.),vi=vec3(.0,.38,.42);   /* cyan-white edge, electric cyan, system blue, dark teal at the top */
  return h<.25?mix(hem,cy,h/.25):h<1.6?mix(cy,bl,(h-.25)/1.35):mix(bl,vi,clamp((h-1.6)/2.2,0.,1.));}
void main(){vec2 uv=(gl_FragCoord.xy-.5*res)/res.y;
  /* camera on the ground, looking up and ahead */
  float pitch=.62;vec3 ro=vec3(0.,0.,0.);
  vec3 rd=normalize(vec3(uv.x*1.15,uv.y*1.15,1.));
  rd=vec3(rd.x,rd.y*cos(pitch)+rd.z*sin(pitch),-rd.y*sin(pitch)+rd.z*cos(pitch));
  vec3 col=vec3(0.);
  float dt=.075;
  for(int i=0;i<220;i++){float tt=2.+float(i)*dt*(1.+float(i)*.012);vec3 P=ro+rd*tt;
    if(P.y<0.)continue;
    for(int k=0;k<3;k++){float fk=float(k),s=fk*3.7+1.;
      float z0=3.2+fk*2.2,y0=.7+fk*.45;
      float dz=P.z-sheetZ(P.x,z0,s);
      float w=.16+.05*fk;
      float sheet=exp(-dz*dz/(w*w));
      if(sheet<.002)continue;
      float h=P.y-baseY(P.x,y0,s);
      float prof=smoothstep(-.5,.15,h)*exp(-max(h,0.)/(2.2+.5*fk))*(.55+.45*smoothstep(.0,.6,h));   /* the edge fades in softly: no hard bright line */
      /* rays: fine vertical structure along the curtain, slowly drifting */
      float u=P.x*3.+dz*.4;
      float rays=pow(fbm(vec2(u+s*7.,h*.12)+loopv(.35)),2.2)*1.8+.15;
      rays*=.6+.4*vn(vec2(u*4.+s,h*.3)+loopv(.25));
      rays*=.75+.25*vn(vec2(u*13.+s*2.,h*.5)+loopv(.2));                 /* hair-fine filaments */
      rays*=.85+.3*smoothstep(.55,.95,vn(vec2(u*1.3-h*.2,s)+loopv(.45)));  /* travelling pulses of brighter light */
      float bright=.15+.85*smoothstep(.3,.72,fbm(vec2(P.x*.22+s,2.)+loopv(.4)));      /* some stretches glow, others fade */
      col+=emit(max(h,0.))*sheet*prof*rays*bright*(1.-fk*.18)*dt*7.;}}
  /* night sky behind */
  float y=gl_FragCoord.y/res.y;
  vec3 sky=mix(vec3(.14,.08,.42),vec3(.006,.012,.04),smoothstep(0.,.55,y));                   /* violet glow low down, near-black navy overhead */
  sky+=vec3(.05,.02,.16)*exp(-pow((gl_FragCoord.x/res.x-.75)/.4,2.))*smoothstep(.5,0.,y);
  col*=1.7;col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);   /* filmic curve: saturated glow, cores burn towards white */
  col=sky*(1.-col*.6)+col;                                                    /* light glows over the sky, it doesn't just sit on top */
  vec2 g=gl_FragCoord.xy/res.y*160.;float st=hs(floor(g));
  col+=vec3(.8,.85,1.)*step(.993,st)*exp(-dot(fract(g)-.5,fract(g)-.5)*40.)*.6*(1.-smoothstep(.0,.25,dot(col,vec3(.3,.5,.2))));
  gl_FragColor=vec4(pow(col,vec3(1./1.05)),1.);}
