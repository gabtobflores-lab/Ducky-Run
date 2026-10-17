// Each event's sky, painted on the GPU exactly as the web version painted it (the same GLSL, run by SpriteKit),
// and Apple's aurora, played as video behind everything.

import SpriteKit
import Combine
import AVFoundation
import UIKit
import simd

enum SkyShaders {
    static let common = #"""
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<5;k++){v+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float fbm3(vec2 p){float v=0.,a=.5;for(int k=0;k<3;k++){v+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v/.875;}
vec2 UV(){return vec2(v_tex_coord.x,1.-v_tex_coord.y);}
float dith(){return (hs(v_tex_coord*u_res+fract(u_t*7.))-.5)/255.;}
vec3 meteorsGL(vec2 P,float asp,float k){vec3 c=vec3(0.);for(int i=0;i<6;i++){float fi=float(i),per=2.3+fi*1.15,u=(u_t+fi*1.37)/per,cyc=floor(u),ph=fract(u);
  if(ph<.28){float h=hs(vec2(cyc,fi)),h2=hs(vec2(fi,cyc+3.));vec2 st=vec2((.05+h*.75)*asp,.04+h2*.42);vec2 dir=normalize(vec2(.6+.25*h,.8));float q=ph/.28;
    float len=.07+.08*h2;vec2 head=st+dir*(q*.3);vec2 d=P-head;float al=dot(d,-dir),pp=abs(dot(d,vec2(-dir.y,dir.x)));
    float seg=step(0.,al)*(1.-smoothstep(0.,len,al));float w=exp(-((pp/.0019)*(pp/.0019)))+exp(-((pp/.007)*(pp/.007)))*.3;c+=vec3(.92,.95,1.)*w*seg*pow(max(1.-al/len,0.),1.5)*sin(q*3.1416)*(.5+.4*h);}}return c*k;}
vec3 starfield(vec2 P,float k){vec3 c=vec3(0.);vec2 g=P*130.;vec2 id=floor(g);float h=hs(id);if(h>.982){vec2 f=fract(g)-.5;c+=vec3(1.)*exp(-dot(f,f)*30.)*(h-.982)/.018*(.65+.35*sin(u_t*(1.3+h*3.)+h*50.));}
  g=P*260.;id=floor(g);h=hs(id+7.);if(h>.975){vec2 f=fract(g)-.5;c+=vec3(.85,.9,1.)*exp(-dot(f,f)*34.)*.45;}return c*k;}

"""#
    static let clouds = common + #"""
float rainL(vec2 uv,float asp,float dens,float spd,float sd){vec2 p=vec2((uv.x*asp+uv.y*.1)*dens,uv.y*dens*.09-u_t*spd);float id=floor(p.x),r=hs(vec2(id,sd));float y=fract(p.y+r*7.),len=.3+.4*r;
  float seg=smoothstep(0.,len*.25,y)*(1.-smoothstep(len*.7,len,y));float fx=fract(p.x)-.5-(r-.5)*.5;return seg*(1.-smoothstep(0.,.1,abs(fx)))*step(.4,hs(vec2(id,sd+3.)));}
vec4 layer(vec2 P,vec2 uv,float s,float sp,float sd){vec2 p=P*s+u_drift*u_t*sp+sd;vec2 w=vec2(fbm3(p*.55+vec2(u_t*.06,u_t*.02)),fbm3(p*.55+vec2(5.2,1.3)-vec2(u_t*.045,-u_t*.03)));vec2 m=vec2(u_t*.035,-u_t*.05)*sp; 
  float f=fbm(p+w*1.5+m),f2=fbm(p+w*1.5+m+vec2(.03,-.16));float c=clamp((uv.y-u_cov.y)/(u_cov.x-u_cov.y),0.,1.);c=c*c*(3.-2.*c)*u_cov.z+u_band.z*exp(-(((uv.y-u_band.x)/u_band.y)*((uv.y-u_band.x)/u_band.y)));
  float d=smoothstep(1.-c-u_cov.w,1.-c+u_cov.w,f);float lit=clamp((f-f2)*4.5+.55,0.,1.);vec3 col=mix(u_cd,u_cl,lit);return vec4(col,d);}
void main(){vec2 uv=UV();float asp=u_res.x/u_res.y;if(u_shim>0.)uv.x+=sin(uv.y*90.+u_t*3.)*.0016*u_shim*smoothstep(.45,1.,uv.y);
  vec3 sky=uv.y<.55?mix(u_cTop,u_cMid,uv.y/.55):mix(u_cMid,u_cBot,(uv.y-.55)/.45);sky+=u_hazeC*u_hazeK*smoothstep(.55,1.,uv.y);
  vec2 P=vec2(uv.x*asp,uv.y);vec2 G=vec2(u_glow.x*asp,u_glow.y);float gd=length(P-G);sky+=u_glowC*u_glow.z*exp(-gd*gd*5.);
  if(u_stars>0.)sky+=starfield(P,u_stars);
  if(u_mets>0.)sky+=meteorsGL(P,asp,u_mets); 
  if(u_sun.z>0.){vec2 d=P-vec2(u_sun.x*asp,u_sun.y);float r=length(d),an=atan(d.y,d.x); 
    float br=1.+.08*sin(u_t*2.1)*u_flare.y; float core=(exp(-r*r*900.)*1.1+exp(-r*9.)*.42+exp(-r*3.2)*.22+exp(-r*1.1)*.08)*br;
    float streak=exp(-pow((P.y-u_sun.y)*asp/.012,2.))*exp(-abs(P.x*asp-u_sun.x*asp)*3.)*.18*u_flare.y; sky+=vec3(1.,.97,.9)*streak;
    float sp=(pow(abs(cos(an*2.+.35+u_t*.03)),90.)*.06)*exp(-r*11.)*(.85+.15*sin(u_t*1.7)); 
    float R=.34,ring=exp(-(((r-R)/.035)*((r-R)/.035)))*.018;vec3 halo=vec3(1.,.7,.62)*exp(-(((r-R+.01)/.02)*((r-R+.01)/.02)))*.03+vec3(.7,.84,1.)*exp(-(((r-R-.012)/.03)*((r-R-.012)/.03)))*.03+vec3(ring)*.5; 
    vec2 O=vec2(u_sun.x*asp,u_sun.y)+vec2(-.16,.34);float orb=exp(-pow(length(P-O)/.035,2.))*.05+exp(-pow(length(P-O)/.07,2.))*.025;
    sky+=(vec3(1.,.98,.93)*(core+sp)+halo+vec3(.8,.88,1.)*orb)*u_sun.z;}
  if(u_mw>0.){float v=(P.x-.55*asp)*.86+(P.y-.6)*.5;float mwb=exp(-v*v*28.)*(.45+.55*fbm3(P*5.+3.));sky+=vec3(.6,.5,.85)*mwb*u_mw*.3;}
  float ml=0.;if(u_moon.w>0.){vec2 q=(P-vec2(u_moon.x*asp,u_moon.y))/u_moon.z;float r=length(q);float o=max(r-1.,0.); 
    float term0=-.42*sqrt(max(0.,1.-min(q.y*q.y,1.)));float side=smoothstep(-.6,.4,q.x-term0); 
    sky+=vec3(.86,.8,1.)*(exp(-o*.55)*.1+exp(-o*1.8)*.2*(.3+.7*side)+exp(-o*6.)*.36*side*smoothstep(.96,1.04,r))*u_moon.w;sky+=vec3(.95,.8,1.)*exp(-(((r-2.1)/.16)*((r-2.1)/.16)))*.05*u_moon.w; 
    ml=exp(-o*o*.5)*u_moon.w;
    if(r<1.02){vec3 tc=texture2D(u_moontex,q*.5*.9875+.5).rgb;float term=-.42*sqrt(max(0.,1.-q.y*q.y));float lt=smoothstep(-.18,.18,q.x-term);float edge=(1.-smoothstep(.965,1.,r));
      vec3 mc=(1.-exp(-tc*2.9))*vec3(1.,.98,.95);mc+=vec3(.12,.1,.16)*pow(max(r,0.),4.);mc=mix(mc,sky,.08);sky=mix(sky,mc,edge*(.05+.95*lt)*u_moon.w);}}
  vec4 far=layer(P,uv,u_scl*.62,.55,3.1),near=layer(P,uv,u_scl,1.,0.);vec3 lift=u_glowC*u_glow.z*1.4;
  float bd=length(P-vec2(u_bolt.x*asp,u_bolt.y));vec3 bl=vec3(.72,.8,1.)*u_bolt.z*exp(-bd*bd*7.);
  far.rgb+=lift*exp(-gd*gd*3.)+bl*.8;near.rgb+=lift*exp(-gd*gd*3.)+bl;vec3 mlc=vec3(.95,.9,1.)*ml;far.rgb+=mlc*(.1+.35*(1.-far.a));near.rgb+=mlc*(.12+.45*(1.-near.a)); 
  sky=mix(sky,far.rgb,far.a*.72*u_cloudA);sky=mix(sky,near.rgb,near.a*u_cloudA);
  if(u_rain>0.)sky+=vec3(.82,.88,.98)*(rainL(uv,asp,70.,9.,1.)*.15+rainL(uv,asp,125.,6.5,2.)*.09)*u_rain*(1.+u_bolt.z*.8); 
  gl_FragColor=vec4(sky+dith(),1.);}
"""#
    static let fog = common + #"""
void main(){vec2 uv=UV();vec2 p=vec2(uv.x*u_res.x/u_res.y,uv.y)*2.2;
  vec2 q=vec2(fbm(p+vec2(u_t*.07,u_t*.02)),fbm(p+vec2(5.2,1.3)-vec2(u_t*.055,-u_t*.02)));float f=fbm(p+1.8*q+vec2(u_t*.09,u_t*.025)); 
  vec3 dark=vec3(.36,.4,.48),mid=vec3(.45,.49,.57),lite=vec3(.57,.61,.69);vec3 c=mix(dark,mid,smoothstep(.22,.55,f));c=mix(c,lite,smoothstep(.55,.88,f));
  float f2=fbm(p*.45+vec2(-u_t*.02,u_t*.006)+q*.6);c=mix(c,lite*1.04,.28*smoothstep(.45,.85,f2));c=mix(c,dark*.92,.22*(1.-smoothstep(.2,.55,f2))*uv.y); 
  c+=.05*exp(-((uv.x-.5)*(uv.x-.5))*5.-((uv.y-.36)*(uv.y-.36))*4.);c=mix(c,lite,.18*uv.y);gl_FragColor=vec4(c+dith(),1.);}
"""#
}
