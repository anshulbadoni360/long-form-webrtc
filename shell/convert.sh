#!/bin/bash

FILE_V=$2/$1-webcam-video-0.mjr
if test -f "$FILE_V"; then
  /opt/janus/bin/janus-pp-rec $2/$1-webcam-video-0.mjr $2/$1-webcam.webm 2>&1; echo $?
fi
FILE_A=$2/$1-webcam-audio.mjr
if test -f "$FILE_A"; then
  /opt/janus/bin/janus-pp-rec $2/$1-webcam-audio.mjr $2/$1-audio.opus 2>&1; echo $?
fi
if test -f "$FILE_A" && test -f "$FILE_V"; then
  sudo ffmpeg -threads 1 -i $2/$1-webcam.webm -i $2/$1-audio.opus  -c:v copy -c:a copy $2/$1-final-webcam.webm -y
fi
FILE_SC=$2/$1___$1-screen-video-0.mjr
if test -f "$FILE_SC"; then
  /opt/janus/bin/janus-pp-rec $2/$1___$1-screen-video-0.mjr $2/$1___$1-screen.webm 2>&1; echo $?
fi
