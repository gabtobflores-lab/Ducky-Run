#!/bin/bash
# photographic finish for one frame: a soft halation glow at two sizes, colour kept
in=$1; out=$2; W=$(identify -format %w "$in")
convert "$in" \
  \( +clone -blur 0x$((W/50)) -modulate 100,125 -evaluate multiply 0.22 \) -compose screen -composite \
  \( "$in" -blur 0x$((W/12)) -modulate 100,135 -evaluate multiply 0.16 \) -compose screen -composite \
  "$out"
