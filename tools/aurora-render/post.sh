#!/bin/bash
# photographic finish for one frame: a tight halation glow (colour kept); keeps blacks deep
in=$1; out=$2; W=$(identify -format %w "$in")
convert "$in" \
  \( +clone -blur 0x$((W/70)) -modulate 100,130 -evaluate multiply 0.2 \) -compose screen -composite \
  \( "$in" -blur 0x$((W/16)) -modulate 100,140 -evaluate multiply 0.1 \) -compose screen -composite \
  "$out"
