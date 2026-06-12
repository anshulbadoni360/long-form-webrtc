#!/bin/bash
# This script runs on EC2 instance startup (user data or AMI)
# Creates wrapper so host can use janus-pp-rec via Docker

mkdir -p /opt/janus/bin/

cat > /opt/janus/bin/janus-pp-rec << 'EOF'
#!/bin/bash
docker exec janus /opt/janus/bin/janus-pp-rec "$@"
EOF

chmod +x /opt/janus/bin/janus-pp-rec

echo "janus-pp-rec wrapper created"
