#!/bin/bash
# photographic finish for one frame: a tight halation glow plus a wide soft glow that spills into the dark sky (colour kept)
in=$1; out=$2; W=$(identify -format %w "$in")
convert "$in" \
  \( +clone -blur 0x$((W/120)) -modulate 100,130 -evaluate multiply 0.2 \) -compose screen -composite \
  \( "$in" -blur 0x$((W/9)) -modulate 100,140 -evaluate multiply 0.42 \) -compose screen -composite \
  "$out"
