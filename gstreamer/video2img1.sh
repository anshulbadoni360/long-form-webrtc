#!/bin/sh

gst-launch-1.0 -ev \
	udpsrc port=2000 caps="application/x-rtp, media=(string)video, clock-rate=(int)90000" ! \
		rtpvp8depay ! vp8dec ! videoconvert ! \
		videorate ! video/x-raw,framerate='(fraction)'1/5 ! \
		jpegenc ! multifilesink location="/tmp/111/12343/1595217838427/images/img%04d.jpg"gst-launch-1.0 -ev \


gst-launch-1.0  -ev udpsrc port=2000 caps="application/x-rtp, media=(string)video, clock-rate=(int)90000" ! rtpvp8depay ! vp8dec ! videoconvert ! videorate ! video/x-raw,framerate='(fraction)'1/5 ! jpegenc ! multifilesink location="/tmp/1234/7110207e-8f9d-4a9f-b42e-b6fdb48f4389/1616135277684/images/img%04d.jpg"