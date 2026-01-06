# VideoGrid - MJPEG Stream Multiplexer

A Node.js service that combines multiple MJPEG camera streams into a single grid layout using FFmpeg. Perfect for displaying multiple camera feeds on a single monitor without maintaining multiple connections.

## Features

- 🎬 Combines multiple MJPEG streams into a single grid layout
- 🔄 Uses FFmpeg for high-performance video processing
- 🧵 Worker thread architecture for managing multiple grid configurations
- 🌐 RESTful API for stream management
- 📡 Outputs as MJPEG stream for easy consumption
- 🔌 Connection pooling - maintains source connections independently of clients

## Prerequisites

- Node.js 16.x or higher
- FFmpeg installed and available in PATH

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html)

## Installation

```bash
cd videogrid
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
HOST=0.0.0.0

DEFAULT_GRID_COLUMNS=2
DEFAULT_GRID_ROWS=2
DEFAULT_OUTPUT_WIDTH=1920
DEFAULT_OUTPUT_HEIGHT=1080
DEFAULT_FRAMERATE=15
```

## Usage

### Start the server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### API Endpoints

#### Create a new stream

```bash
POST /streams
Content-Type: application/json

{
  "streamId": "grid1",
  "streamUrls": [
    "http://camera1/stream",
    "http://camera2/stream",
    "http://camera3/stream",
    "http://camera4/stream"
  ],
  "columns": 2,
  "rows": 2,
  "outputWidth": 1920,
  "outputHeight": 1080,
  "framerate": 15
}
```

Example with curl:
```bash
curl -X POST http://localhost:3000/streams \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "grid1",
    "streamUrls": [
      "http://192.168.1.100:8081/stream",
      "http://192.168.1.101:8081/stream",
      "http://192.168.1.102:8081/stream",
      "http://192.168.1.103:8081/stream"
    ],
    "columns": 2,
    "rows": 2
  }'
```

Response:
```json
{
  "streamId": "grid1",
  "config": {
    "streamUrls": [...],
    "columns": 2,
    "rows": 2,
    "outputWidth": 1920,
    "outputHeight": 1080,
    "framerate": 15
  },
  "streamUrl": "/streams/grid1/output"
}
```

#### List all streams

```bash
GET /streams
```

#### Get stream info

```bash
GET /streams/:streamId
```

#### Watch the grid stream

```bash
GET /streams/:streamId/output
```

View in browser:
```
http://localhost:3000/streams/grid1/output
```

Or use in an `<img>` tag:
```html
<img src="http://localhost:3000/streams/grid1/output" alt="Camera Grid" />
```

#### Stop a stream

```bash
DELETE /streams/:streamId
```

#### Health check

```bash
GET /health
```

## Architecture

```
┌─────────────────────────────────────────┐
│           Main Thread (API)             │
│  - Express HTTP server                  │
│  - Stream management API                │
│  - Client connection handling           │
└───────────────┬─────────────────────────┘
                │
                ├── Worker Thread 1 (FFmpeg)
                │   └── Grid Stream 1
                │
                ├── Worker Thread 2 (FFmpeg)
                │   └── Grid Stream 2
                │
                └── Worker Thread N (FFmpeg)
                    └── Grid Stream N
```

### Component Overview

- **Main Thread (`src/index.js`)**: HTTP API server that manages client connections
- **StreamManager (`src/api/streamManager.js`)**: Manages worker threads and stream lifecycle
- **FFmpeg Worker (`src/workers/ffmpegWorker.js`)**: Worker thread that runs FFmpeg process
- **FFmpeg Builder (`src/utils/ffmpegBuilder.js`)**: Builds FFmpeg command-line arguments

## How It Works

1. **Client creates stream**: POST to `/streams` with camera URLs and grid configuration
2. **Worker spawned**: StreamManager creates a worker thread with FFmpeg process
3. **FFmpeg processes**: Fetches all camera streams, scales them, and combines into grid
4. **Output buffered**: Recent frames are buffered for new clients
5. **Clients connect**: Multiple clients can connect to `/streams/:id/output` simultaneously
6. **Efficient streaming**: Source cameras are only connected once, regardless of client count

## Grid Layouts

Common configurations:

- **2x2 Grid** (4 cameras): 1920x1080, each camera 960x540
- **3x3 Grid** (9 cameras): 1920x1080, each camera 640x360
- **4x4 Grid** (16 cameras): 1920x1080, each camera 480x270

## Example: Full Workflow

```bash
# 1. Create a 2x2 grid
curl -X POST http://localhost:3000/streams \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "lobby-grid",
    "streamUrls": [
      "http://cam1.local/stream",
      "http://cam2.local/stream",
      "http://cam3.local/stream",
      "http://cam4.local/stream"
    ],
    "columns": 2,
    "rows": 2
  }'

# 2. Check stream status
curl http://localhost:3000/streams/lobby-grid

# 3. Open in browser or display on monitor
# http://localhost:3000/streams/lobby-grid/output

# 4. Stop the stream when done
curl -X DELETE http://localhost:3000/streams/lobby-grid
```

## Troubleshooting

### FFmpeg not found
Ensure FFmpeg is installed and in your PATH:
```bash
ffmpeg -version
```

### Stream not starting
Check the logs for FFmpeg errors. Common issues:
- Invalid stream URLs
- Network connectivity to cameras
- Insufficient system resources

### High CPU usage
- Reduce output resolution
- Lower framerate
- Use fewer cameras per grid
- Check FFmpeg encoding settings

## Performance Tips

- Use lower framerates (10-15 fps) for monitoring
- Match output resolution to display resolution
- Consider hardware acceleration if available
- Monitor worker thread memory usage

## License

ISC

## Credits

FFmpeg grid layout approach based on: https://michalzuber.wordpress.com/2020/05/04/mosaic-grid-view-of-rtsp-streams-with-ffmpeg/

## Persistent Configuration

VideoGrid supports saving stream configurations to avoid re-entering camera URLs.

### Configuration File

Configurations are stored in `configs.json` (auto-created, git-ignored).

**Example** (`configs.example.json`):
```json
[
  {
    "id": "config_example_1",
    "name": "lobby-cameras",
    "streamUrls": ["http://camera1.local/stream", ...],
    "columns": 2,
    "rows": 2,
    "outputWidth": 1920,
    "outputHeight": 1080,
    "framerate": 15,
    "autoStart": false
  }
]
```

### API Endpoints

#### Get All Configurations
```bash
GET /configs
```

#### Save a Configuration
```bash
POST /configs
Content-Type: application/json

{
  "name": "lobby-cameras",
  "streamUrls": ["http://camera1/stream", ...],
  "columns": 2,
  "rows": 2,
  "autoStart": false
}
```

#### Start Stream from Saved Config
```bash
POST /streams/from-config/:configId
Content-Type: application/json

{
  "streamId": "lobby-grid"  // Optional, defaults to config name
}
```

#### Update Configuration
```bash
PUT /configs/:configId
```

#### Delete Configuration
```bash
DELETE /configs/:configId
```

### Auto-Start on Boot

Set `autoStart: true` in a configuration to automatically start that stream when VideoGrid starts:

```json
{
  "name": "monitoring-grid",
  "autoStart": true,
  ...
}
```

### Workflow

1. **Create and Save**: When creating a stream, check "Save Configuration"
2. **Reuse**: Next time, load from saved config instead of re-entering URLs
3. **Auto-Start**: Mark important streams to start on boot
4. **Manage**: Edit, delete, or duplicate configurations as needed

