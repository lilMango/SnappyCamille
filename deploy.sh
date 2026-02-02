#!/bin/bash

# FTP Deploy Script for SnappyCamille
# Uploads contents of public/ to PorkBun hosting

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load credentials from .env file
if [ -f .env ]; then
  source .env
else
  echo "Error: .env file not found"
  echo "Create .env with:"
  echo "  FTP_HOST=ftp.yourdomain.com"
  echo "  FTP_USER=your_username"
  echo "  FTP_PASS=your_password"
  exit 1
fi

# Check required variables
if [ -z "$FTP_HOST" ] || [ -z "$FTP_USER" ] || [ -z "$FTP_PASS" ]; then
  echo "Error: Missing FTP credentials in .env"
  exit 1
fi

echo "Deploying to $FTP_HOST..."

# Use lftp to mirror upload public/ to remote root
lftp -c "
set ftp:ssl-allow no;
open -u $FTP_USER,$FTP_PASS $FTP_HOST;
mirror --reverse --delete --verbose public/ /;
quit
"

if [ $? -eq 0 ]; then
  echo "Deploy complete!"
else
  echo "Deploy failed!"
  exit 1
fi
