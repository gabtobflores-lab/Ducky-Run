#!/bin/bash
# frames -> seamless looping aurora.mp4: photographic finish, in-between frames for smooth 24 fps, phone resolution, H.264
set -e; cd /tmp/claude-0/-home-user-Ducky-Run/fa041a2f-02cd-5a71-b96f-1391ec6270f7/scratchpad/vol/final
rm -rf seq; mkdir seq; n=0
for i in $(seq 0 2 286); do f=$(printf f%04d.png $i); [ -f $f ] || { echo "missing $f"; exit 1; }
  ../post.sh $f seq/$(printf %04d.png $n); n=$((n+1)); done
cp seq/0000.png seq/$(printf %04d.png $n)          # the first frame again at the end, so the in-between frames close the loop
ffmpeg -y -loglevel error -framerate 12 -i seq/%04d.png \
  -vf "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,trim=end_frame=288,scale=1080:2340:flags=lanczos,unsharp=5:5:0.35,format=yuv420p" \
  -c:v libx264 -profile:v high -level 5.1 -preset slow -crf 19 -movflags +faststart -an aurora.mp4
ffprobe -v error -show_entries stream=width,height,r_frame_rate,nb_frames,codec_name,profile,level -of compact aurora.mp4; ls -la aurora.mp4
