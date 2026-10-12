#!/bin/sh
# Small media fixtures (needs ffmpeg). Run from this folder.
set -e
V="-f lavfi -i testsrc2=size=320x240:rate=25:duration=3"
A="-f lavfi -i sine=frequency=440:duration=3"
ffmpeg -y -loglevel error $V $A -c:v libx264 -pix_fmt yuv420p -preset veryfast -c:a aac -b:a 96k -shortest -movflags +faststart clip.mp4
ffmpeg -y -loglevel error $V $A -c:v libvpx-vp9 -b:v 300k -c:a libopus -shortest clip.webm
ffmpeg -y -loglevel error $V $A -c:v mpeg4 -c:a libmp3lame -shortest clip.avi
ffmpeg -y -loglevel error $A -c:a pcm_s16le tone.wav
ffmpeg -y -loglevel error $A -c:a libmp3lame -b:a 96k tone.mp3
ffmpeg -y -loglevel error $A -c:a libopus -b:a 32k voice.ogg
