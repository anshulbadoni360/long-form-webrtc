#!/bin/bash

# sudo setfacl -m user:ec2-user:rw /var/run/docker.sock
docker exec  mstreamer_mstreamer_1 janus-gateway/janus-pp-rec /tmp/$1-webcam-video.mjr /tmp/$1-webcam.webm 2>&1; echo $?
docker exec  mstreamer_mstreamer_1 janus-gateway/janus-pp-rec /tmp/$1-webcam-audio.mjr /tmp/$1-audio.opus 2>&1; echo $?
sudo ffmpeg -threads 1 -i /var/www/html/webrtc/mstreamer/target/tmp/$1-webcam.webm -i /var/www/html/webrtc/mstreamer/target/tmp/$1-audio.opus  -c:v copy -c:a copy /var/www/html/webrtc/mstreamer/target/tmp/$1-final-webcam.webm
docker exec  mstreamer_mstreamer_1 janus-gateway/janus-pp-rec /tmp/$1___$1-screen-video.mjr /tmp/$1___$1-screen.webm 2>&1; echo $?
