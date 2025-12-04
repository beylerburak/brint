#!/bin/bash

# Wait for MinIO to be ready
echo "Waiting for MinIO to start..."
sleep 5

# Install mc (MinIO Client) if not present
if ! command -v mc &> /dev/null; then
    echo "Installing MinIO Client..."
    brew install minio-mc 2>/dev/null || {
        echo "Please install MinIO Client manually:"
        echo "  brew install minio-mc"
        exit 1
    }
fi

# Configure MinIO Client
mc alias set local http://localhost:9000 minioadmin minioadmin

# Create media bucket
echo "Creating media bucket..."
mc mb local/brint-media-dev --ignore-existing

# Set bucket policy to public read
echo "Setting bucket policy..."
cat > /tmp/policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": ["*"]
      },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::brint-media-dev/*"]
    }
  ]
}
EOF

mc anonymous set-json /tmp/policy.json local/brint-media-dev

echo "✅ MinIO setup complete!"
echo ""
echo "MinIO Console: http://localhost:9001"
echo "Username: minioadmin"
echo "Password: minioadmin"
echo ""
echo "S3 Endpoint: http://localhost:9000"
echo "Bucket: brint-media-dev"

