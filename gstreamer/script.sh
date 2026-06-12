#!/bin/sh
cd /var/www/html/webrtc/mstreamer
docker-compose up
mkdir testing
sudo chmod 666 /var/run/docker.sock
cd /var/www/html/webRTC-proctor
pm2 start server.js