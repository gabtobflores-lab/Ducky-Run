#!/bin/bash
# eval.sh NAME RES: renders frames 0 and 180, finishes them, puts them under the game screen, prints tone/colour/texture numbers, makes a comparison image
S=/tmp/claude-0/-home-user-Ducky-Run/fa041a2f-02cd-5a71-b96f-1391ec6270f7/scratchpad; cd $S/vol; N=$1; W=${2:-360}; H=$((W*13/6))
rm -rf e_$N; mkdir e_$N
timeout 290 node render.js $W $H e_$N 0 1; timeout 290 node render.js $W $H e_$N 180 181
for f in 0000 0180; do ./post.sh e_$N/f$f.png e_$N/p$f.png; done
cd $S; for f in 0000 0180; do timeout 110 node aur/shotbg.js /home/user/Ducky-Run/mirror.html vol/e_$N/g$f 1 $PWD/vol/e_$N/p$f.png >/dev/null; done
python3 vol/stats.py aur/old-0.png vol/e_$N/g0000-0.png vol/e_$N/g0180-0.png | sed 's/mean sat of lit/sat/'
for f in aur/old-0.png vol/e_$N/g0000-0.png vol/e_$N/g0180-0.png; do c="-crop 100%x75%+0+120 -colorspace gray"
  mid=$(convert $f $c \( +clone -blur 0x2 \) \( -clone 0 -blur 0x12 \) -delete 0 -compose difference -composite -format "%[fx:mean*1000]" info:)
  big=$(convert $f $c \( +clone -blur 0x12 \) \( -clone 0 -blur 0x60 \) -delete 0 -compose difference -composite -format "%[fx:mean*1000]" info:)
  printf "%s medium %.1f large %.1f\n" $(basename $f) $mid $big; done
timeout 60 node aur/cmp.js vol/e_$N/cmp.png aur/old-0.png vol/e_$N/g0000-0.png vol/e_$N/g0180-0.png
