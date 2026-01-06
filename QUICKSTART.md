# VideoGrid Quick Start

## What Was Built

VideoGrid is an MJPEG stream multiplexer that combines multiple camera streams into a single grid layout using FFmpeg. It includes:

- **Worker Thread Architecture**: Main API thread + FFmpeg worker threads
- **RESTful API**: Create, manage, and stream grids
- **Web UI**: Dark-themed interface matching SafeEVAC style
- **Proxy-Ready**: Relative API paths for reverse proxy setup

## Port Configuration

- **VideoGrid Service**: `4003` (matches SafeEVAC port scheme)
- **Controller Backend**: `4000`
- **Controller Frontend**: `4001`
- **Simulators**: `4002`

## Quick Start

### Option 1: Direct Launch

```bash
cd /Users/cgaspard/Projects/safeevac/videogrid
./start.sh
```

Then open: http://localhost:4003

### Option 2: Using Launcher (from monorepo)

```bash
cd /Users/cgaspard/Projects/safeevac/monorepo
node backend-controller/utils/videogrid_launcher.js
```

## Project Structure

```
videogrid/
├── src/
│   ├── index.js              # Main API server
│   ├── api/
│   │   └── streamManager.js  # Manages workers & streams
│   ├── workers/
│   │   └── ffmpegWorker.js   # FFmpeg worker thread
│   ├── utils/
│   │   └── ffmpegBuilder.js  # FFmpeg command builder
│   └── config/
│       └── default.js        # Configuration
├── public/
│   ├── index.html            # Web UI
│   ├── css/
│   │   └── styles.css        # SafeEVAC-themed styles
│   └── js/
│       └── app.js            # UI logic
├── .env                      # Configuration (PORT=4003)
├── start.sh                  # Startup script
├── README.md                 # Full documentation
└── PROXY_SETUP.md            # Proxy configuration guide
```

## Basic Usage

### 1. Create a Stream

**Via UI**: http://localhost:4003
- Enter stream ID
- Select grid layout (2x2, 3x3, 4x4)
- Add camera URLs
- Click "Create Stream"

**Via API**:
```bash
curl -X POST http://localhost:4003/streams \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "lobby-grid",
    "streamUrls": [
      "http://camera1.local/stream",
      "http://camera2.local/stream",
      "http://camera3.local/stream",
      "http://camera4.local/stream"
    ],
    "columns": 2,
    "rows": 2
  }'
```

### 2. View the Grid

**In browser**:
```
http://localhost:4003/streams/lobby-grid/output
```

**In HTML**:
```html
<img src="http://localhost:4003/streams/lobby-grid/output">
```

### 3. Stop a Stream

```bash
curl -X DELETE http://localhost:4003/streams/lobby-grid
```

## Proxy Setup for SafeEVAC

Add to `frontend-controller/config/proxyInit.js`:

```javascript
const videogridTarget = 'http://localhost:4003';

app.use('/videogrid', createProxyMiddleware({
  target: videogridTarget,
  changeOrigin: true,
  pathRewrite: {
    '^/videogrid': ''
  },
  logLevel: 'warn',
  onProxyRes: (proxyRes, req, res) => {
    if (req.url.includes('/output')) {
      proxyRes.headers['x-accel-buffering'] = 'no';
    }
  }
}));
```

Then access via: `http://localhost:4001/videogrid`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/streams` | Create new stream |
| GET | `/streams` | List all streams |
| GET | `/streams/:id` | Get stream info |
| GET | `/streams/:id/output` | MJPEG stream output |
| DELETE | `/streams/:id` | Stop stream |

## Troubleshooting

### FFmpeg Not Found
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg
```

### Port Already in Use
Edit `.env` and change `PORT=4003` to another port

### Stream Not Loading
- Check FFmpeg logs in terminal
- Verify camera URLs are accessible
- Ensure cameras output MJPEG format

## Next Steps

1. **Test with your cameras**: Replace example URLs with your actual camera streams
2. **Set up proxy**: Follow PROXY_SETUP.md to integrate with SafeEVAC
3. **Production deployment**: Use PM2 or systemd for process management
4. **Customize grid layouts**: Adjust columns/rows/resolution as needed

## Features

- ✅ Worker thread architecture (scalable)
- ✅ Multiple simultaneous grids
- ✅ Live preview in web UI
- ✅ SafeEVAC color scheme
- ✅ Proxy-ready API paths
- ✅ Connection pooling (maintains source connections)
- ✅ Real-time client updates
- ✅ Health checks
- ✅ FFmpeg-based (efficient, high quality)

## Resources

- Full docs: `README.md`
- Proxy setup: `PROXY_SETUP.md`
- FFmpeg grid guide: https://michalzuber.wordpress.com/2020/05/04/mosaic-grid-view-of-rtsp-streams-with-ffmpeg/
