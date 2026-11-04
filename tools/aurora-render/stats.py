import subprocess,sys,colorsys
def px(f):
    # crop away the game UI area at top and the balls, sample the sky only, downsized
    out=subprocess.run(['convert',f,'-crop','100%x75%+0+120','-resize','90x','-depth','8','txt:'],capture_output=True,text=True).stdout
    for l in out.splitlines()[1:]:
        try:
            rgb=l.split('(')[1].split(')')[0].split(',')[:3]; yield [int(float(v))/255 for v in rgb]
        except: pass
for f in sys.argv[1:]:
    P=list(px(f)); n=len(P)
    L=[.2126*r+.7152*g+.0722*b for r,g,b in P]
    hsv=[colorsys.rgb_to_hsv(*p) for p in P]
    dark=sum(l<.06 for l in L)/n; mid=sum(.06<=l<.3 for l in L)/n; bright=sum(l>=.3 for l in L)/n; hot=sum(l>=.55 for l in L)/n
    lit=[h for h,l in zip(hsv,L) if l>.12]
    def hb(lo,hi): return sum(lo<=h[0]*360<hi for h in lit)/max(1,len(lit))
    print(f.split('/')[-1], f"dark {dark:.0%}  dim {mid:.0%}  bright {bright:.0%}  hot {hot:.0%} | lit hue: green-teal(150-180) {hb(150,180):.0%} cyan(180-200) {hb(180,200):.0%} blue(200-235) {hb(200,235):.0%} indigo-violet(235-290) {hb(235,290):.0%} | mean sat of lit {sum(h[1] for h in lit)/max(1,len(lit)):.2f}")
