#!/bin/bash

echo "Starting Conference Call Services..."

echo "[1/6] Cleaning up old containers..."
docker rm -f janus 2>/dev/null

echo "[2/6] Starting Janus container..."
docker run -d \
    --name janus \
    --network host \
    --restart unless-stopped \
    -v /tmp:/tmp \
    -v /home/ubuntu/Conference-Call/tmp:/home/ubuntu/Conference-Call/tmp \
    janus-gateway

echo "[3/6] Setting up janus-pp-rec wrapper..."
mkdir -p /opt/janus/bin/
cat > /opt/janus/bin/janus-pp-rec << 'EOF'
#!/bin/bash
docker exec janus /opt/janus/bin/janus-pp-rec "$@"
EOF
chmod +x /opt/janus/bin/janus-pp-rec

echo "[4/6] Waiting for Janus to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8088/janus/info > /dev/null 2>&1; then
        echo "Janus is ready! (took ${i}s)"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "WARNING: Janus did not start within 30 seconds!"
        docker logs janus --tail 20
    fi
    sleep 1
done

echo "[5/6] Starting Node.js app..."
cd /home/ubuntu/Conference-Call
sudo pm2 restart all
sudo pm2 save

echo "[6/6] Verifying services..."
echo ""
echo "Docker containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo ""
echo "PM2 processes:"
pm2 list
echo ""
echo "Janus API:"
curl -s http://localhost:8088/janus/info | head -5
echo ""
echo "All services started!"

