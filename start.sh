#!/bin/bash
# ================================================================
# Cyber Cafe Manager — One-Click Start Script
# ================================================================

echo ""
echo "🚀 Starting Cyber Cafe Manager Server..."
echo ""

# Kill any existing process on port 5000
fuser -k 5000/tcp 2>/dev/null || true
sleep 1

# Navigate to server folder
cd "$(dirname "$0")/server"

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies (first time)..."
  npm install
  echo ""
fi

# Start server
echo "▶️  Starting server on port 5000..."
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  🌐 Click 'Web Preview' → 'Change Port' → 5000"
echo "════════════════════════════════════════════════════════════"
echo ""

node server.js