#!/bin/bash
# dark corners: light falls off away from a centre just left of middle, deepest at the top left
convert "$1" \( +clone -fx "1-0.95*pow(min(hypot((i/w-0.45)/0.85,(j/h-0.58)/0.7)+1.5*max(0,0.4-i/w)*max(0,0.45-j/h),1),1.9)" \) -compose multiply -composite "$2"
