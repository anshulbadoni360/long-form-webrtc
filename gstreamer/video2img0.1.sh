#!/bin/sh

gst-launch-1.0 -ev \
	udpsrc port=$1 caps="application/x-rtp, media=(string)video, clock-rate=(int)90000" ! \
		rtpvp8depay ! vp8dec ! videoconvert ! \
		videorate ! video/x-raw,framerate='(fraction)'1/5 ! \
		jpegenc ! multifilesink location=$2+"/img%04d.jpg"

gst-launch-1.0 -ev udpsrc port=2000 caps="application/x-rtp, media=(string)video, clock-rate=(int)90000" ! rtpvp8depay ! vp8dec ! videoconvert ! videorate ! video/x-raw,framerate='(fraction)'1/5 ! jpegenc ! fakesink dump=1