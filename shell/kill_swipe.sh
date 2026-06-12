#!/bin/bash
ps_out=`ps -ef | grep gst | grep -v 'grep' | grep -v $0`
result=$(echo $ps_out | grep "gst")
if [[ "$result" != "" ]];then
            echo "Killing Gstreamer"
            sudo pkill gst-launch-1.0
    else
                echo "Not Running"
fi