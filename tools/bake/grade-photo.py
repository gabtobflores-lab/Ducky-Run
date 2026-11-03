import cv2, numpy as np, sys
src,dst=sys.argv[1],sys.argv[2]
im=cv2.imread(src,cv2.IMREAD_UNCHANGED).astype(np.float32)/255.; a=im[...,3:4]; c=im[...,:3][...,::-1].copy() # RGB
h,w=c.shape[:2]; Y=np.linspace(0,1,h)[:,None,None]
lum=(c@np.array([.2126,.7152,.0722],np.float32))[...,None]
# 1. soften the busy lower half (town, forest) like a shallow depth of field
blur=cv2.GaussianBlur(c,(0,0),3.2); dof=np.clip((Y-.3)/.08,0,1)*np.clip((.56-Y)/.04,0,1); c=c*(1-dof*.85)+blur*dof*.85
# 2. pastel grade: lift and tint the shadows lavender, warm the highlights, ease saturation
c=.13+.8*c
sh=(1-lum)**2; c=c*(1-sh*.35)+np.array([.62,.56,.78],np.float32)*sh*.35
hi=np.clip((lum-.6)/.4,0,1); c=c*(1-hi*.18)+np.array([1.,.92,.94],np.float32)*hi*.18
l2=(c@np.array([.2126,.7152,.0722],np.float32))[...,None]; c=l2+(c-l2)*.82
# 3. spring haze: soft pink air over the shore and the far valley, so the town reads as distant detail
haze=np.clip((Y-.3)/.1,0,1)*np.clip((.56-Y)/.05,0,1)*.42; c=c*(1-haze)+np.array([.98,.88,.92],np.float32)*haze
# 4. a gentle glow, as the game's light does
g=cv2.GaussianBlur(c,(0,0),14); c=1-(1-c)*(1-g*.22)
# 5. the lake: calmer and paler, matching the game's soft blues
lake=np.clip((Y-.53)/.03,0,1); c=c*(1-lake*.12)+np.array([.8,.85,.97],np.float32)*lake*.12
out=np.dstack([np.clip(c,0,1)[...,::-1],a]); cv2.imwrite(dst,(out*255).astype(np.uint8))
