import cv2, numpy as np
def lum(c): return (c@np.array([.2126,.7152,.0722],np.float32))[...,None]
def save(c,a,name,OW=1179):
  out=np.dstack([np.clip(c,0,1)[...,::-1],a]); h,w=out.shape[:2]; out=cv2.resize(out,(OW,int(h*OW/w)),interpolation=cv2.INTER_AREA); cv2.imwrite(name,(out*255).astype(np.uint8)); print(name,out.shape)
# ---- golden hour: the sea of clouds, cut below its horizon, graded to three lights
im=cv2.imread('clouds.jpg').astype(np.float32)/255.; H,W=im.shape[:2]; c=im[...,::-1]
g=cv2.cvtColor((im*255).astype(np.uint8),cv2.COLOR_BGR2GRAY).astype(np.float32)
# the horizon: where the bright cloud deck starts below the blue sky
rows=g.mean(1); hz=int(np.argmax(np.diff(cv2.GaussianBlur(rows[:,None],(1,9),0)[:,0])[:int(H*.4)]))
y0=max(0,hz-6); c=c[y0:]; h=c.shape[0]; Y=np.linspace(0,1,h)[:,None,None]
a=(np.clip(np.arange(h)[:,None]/(h*.16),0,1)**1.6)*np.ones((1,W)); a=a[...,None]
L=lum(c); Ls=cv2.GaussianBlur(L,(0,0),2)[...,None] if L.ndim==2 else cv2.GaussianBlur(L[...,0],(0,0),2)[...,None]
for name,(hi,mid,lo,hz_c) in {'cloudG':((1.,.94,.8),(.84,.78,.8),(.3,.3,.46),(1.,.86,.66)),'cloudS':((1.,.66,.5),(.8,.48,.56),(.28,.2,.38),(1.,.62,.46)),'cloudB':((.62,.5,.7),(.36,.3,.52),(.08,.08,.2),(.72,.42,.5))}.items():
  hi,mid,lo,hzc=[np.array(v,np.float32) for v in (hi,mid,lo,hz_c)]
  t=np.clip((Ls-.12)/.82,0,1)**1.25; col=np.where(t<.5,lo+(mid-lo)*(t/.5),mid+(hi-mid)*((t-.5)/.5)) # luminance mapped onto the event's light
  col=col+(c-L)*.35 # keep a touch of the photo's own colour variation
  haze=np.exp(-Y*14.)*.45; col=col*(1-haze)+hzc*haze # haze toward the horizon
  g2=cv2.GaussianBlur(col,(0,0),10); col=1-(1-col)*(1-g2*.18)
  save(col,a,name+'.png')
# ---- ice halo: the Denali spruces, the misty hills fading into the sky
im=cv2.imread('forest.jpg').astype(np.float32)/255.; H,W=im.shape[:2]; c=im[...,::-1][int(H*.08):]; h=c.shape[0]; Y=np.linspace(0,1,h)[:,None,None]
L=lum(c); c=L+(c-L)*.6 # muted
c=.06+.94*c; c=c*np.array([.93,.97,1.06],np.float32) # cool, clean winter light
sh=(1-L)**2; c=c*(1-sh*.25)+np.array([.3,.4,.56],np.float32)*sh*.25 # blue shadows
mist=np.clip(1-(Y-.05)/.45,0,1)**1.5*.55; c=c*(1-mist)+np.array([.84,.9,.97],np.float32)*mist # the far hills dissolve into the pale sky near the horizon
a=np.clip((Y[...,0]-.0)/.22,0,1)[...,None]*np.ones((1,W,1)) # the top fades into the live sky
save(np.clip(c,0,1),a,'forestP.png')
