#!/bin/bash

# ---------------------------------
# Get local IP address
# ---------------------------------
IP=$(hostname -I | awk '{print $1}')
if [ -z "$IP" ]; then
  IP=$(ipconfig getifaddr en0 2>/dev/null) # macOS
fi
if [ -z "$IP" ]; then
  echo "❌ Could not detect local IP address."
  exit 1
fi

echo "✅ Detected IP: $IP"

# ---------------------------------
# Update client/.env
# ---------------------------------
CLIENT_ENV="client/.env"
if [ ! -f "$CLIENT_ENV" ]; then
  touch "$CLIENT_ENV"
fi

# Remove existing line
sed -i.bak "/^VITE_BACKEND_URL=/d" $CLIENT_ENV

# Add new line
echo "VITE_BACKEND_URL=http://$IP:8000" >> $CLIENT_ENV
echo "📦 Updated client/.env with:"
echo "    VITE_BACKEND_URL=http://$IP:8000"

# ---------------------------------
# Update server/.env
# ---------------------------------
SERVER_ENV="server/.env"
if [ ! -f "$SERVER_ENV" ]; then
  touch "$SERVER_ENV"
fi

# Remove existing line
sed -i.bak "/^CORS_ORIGIN=/d" $SERVER_ENV

# Add new line
echo "CORS_ORIGIN=http://$IP:5173" >> $SERVER_ENV
echo "📦 Updated server/.env with:"
echo "    CORS_ORIGIN=http://$IP:5173"

# ---------------------------------
# Cleanup backups
# ---------------------------------
rm -f client/.env.bak server/.env.bak

echo "✅ Environment setup complete!"
