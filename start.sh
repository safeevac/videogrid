#!/bin/bash
# VideoGrid startup script

echo "🎬 Starting VideoGrid..."
echo ""

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: FFmpeg is not installed"
    echo "Install FFmpeg:"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu: sudo apt-get install ffmpeg"
    exit 1
fi

echo "✓ FFmpeg found: $(ffmpeg -version | head -n1)"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found, copying from .env.example"
    cp .env.example .env
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Start the server
echo "🚀 Starting server..."
echo "   API: http://localhost:4003"
echo "   UI:  http://localhost:4003"
echo ""
npm start
