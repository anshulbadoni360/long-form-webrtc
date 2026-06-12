#!/bin/bash
ID=$1
ROOMID=$2

# Capture all output and errors to a log file for debugging on EC2, and also print to stdout/stderr
exec > >(tee -a /tmp/process_media_${ID}.log) 2>&1
echo "Starting media processing for ID: $ID, roomid: $ROOMID"

# Ensure AWS CLI knows which region to use
export AWS_DEFAULT_REGION=${AWS_REGION:-us-west-2}


# 1. Find the files using wildcards (checks both absolute /tmp and relative `./tmp` / `tmp`)
AUDIOFILE=$(find /tmp ./tmp tmp /home/ubuntu/Conference-Call/tmp -maxdepth 2 -name "${ID}*-audio*.mjr" 2>/dev/null | head -n 1)
VIDEOFILE=$(find /tmp ./tmp tmp /home/ubuntu/Conference-Call/tmp -maxdepth 2 -name "${ID}*-video*.mjr" 2>/dev/null | head -n 1)

# Ensure absolute paths so that the Docker container can resolve the mounted volume
if [[ -n "$AUDIOFILE" && "$AUDIOFILE" != /* ]]; then
    AUDIOFILE="$(pwd)/${AUDIOFILE#./}"
fi
if [[ -n "$VIDEOFILE" && "$VIDEOFILE" != /* ]]; then
    VIDEOFILE="$(pwd)/${VIDEOFILE#./}"
fi

echo "Processing session: $ID"
echo "Found Audio: $AUDIOFILE"
echo "Found Video: $VIDEOFILE"

# 2. Process Audio if found
if [ -f "$AUDIOFILE" ]; then
    echo "Converting Audio..."
    /opt/janus/bin/janus-pp-rec "$AUDIOFILE" /tmp/${ID}.opus
    # upload audio mjr to s3
    aws s3 mv "$AUDIOFILE" s3://monet-live-videos/longform/mjr-audio/${ROOMID}/${ID}-audio.mjr --acl public-read
fi

# 3. Process Video if found
if [ -f "$VIDEOFILE" ]; then
    echo "Converting Video..."
    /opt/janus/bin/janus-pp-rec "$VIDEOFILE" /tmp/${ID}.webm
    # upload video mjr to s3
    aws s3 mv "$VIDEOFILE" s3://monet-live-videos/longform/mjr-video/${ROOMID}/${ID}-video.mjr --acl public-read
fi

# 4. Merge if both converted successfully
if [ -f /tmp/${ID}.opus ] && [ -f /tmp/${ID}.webm ]; then
    echo "Merging into final webm..."
    ffmpeg -threads 1 -i /tmp/${ID}.webm -i /tmp/${ID}.opus -c:v copy -c:a copy /tmp/${ID}-merged.webm -y
    # Clean up temp files
    rm /tmp/${ID}.opus /tmp/${ID}.webm
fi

# 5. Export to S3 (checks both merged and video-only)
if [ -f /tmp/${ID}-merged.webm ]; then
    echo "Exporting merged video to S3..."
    aws s3 mv /tmp/${ID}-merged.webm s3://monet-live-videos/longform/merged-video/${ROOMID}/${ID}.webm --acl public-read
    echo "Export SUCCESS: ${ID}.webm"
elif [ -f /tmp/${ID}.webm ]; then
    echo "Exporting video-only to S3..."
    aws s3 mv /tmp/${ID}.webm s3://monet-live-videos/longform/video-only/${ROOMID}/${ID}.webm --acl public-read
    echo "Export SUCCESS: ${ID}.webm (No audio)"
else
    echo "Error: No files found to export."
fi


# Final Cleanup of original .mjr files
[ -f "$AUDIOFILE" ] && rm "$AUDIOFILE"
[ -f "$VIDEOFILE" ] && rm "$VIDEOFILE"

exit 0
