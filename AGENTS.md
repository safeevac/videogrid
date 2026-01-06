# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL RULE: NO COMMITS OR PUSHES WITHOUT USER APPROVAL

**AGENTS MUST NEVER commit or push code without explicit user approval and testing.**

### Mandatory Workflow:
1. **Make code changes** as requested
2. **STOP and inform the user** that changes are ready for review
3. **Wait for user to:**
   - Review the changes
   - Test the changes locally
   - Verify the changes work as expected
4. **ONLY AFTER user explicitly requests it:**
   - Create commits with `git add` and `git commit`
   - Push to remote with `git push`
   - Create pull requests with `gh pr create`

## Project Overview

VideoGrid is an MJPEG stream multiplexer that combines multiple camera streams into a single grid layout using FFmpeg. It's designed to reduce connection overhead when displaying multiple camera feeds on monitors.

### Architecture
- **Node.js** with Express API server (port 4003)
- **Worker Threads** for managing FFmpeg processes
- **FFmpeg** for high-performance video processing
- **Web UI** with SafeEVAC themed interface

### Key Technologies
- **Express.js**: API server
- **Worker Threads**: Parallel FFmpeg process management
- **FFmpeg**: Video stream multiplexing
- **Vanilla JS**: Frontend (no framework)

## Development Setup

### Prerequisites
```bash
# FFmpeg must be installed
brew install ffmpeg  # macOS
# or
sudo apt-get install ffmpeg  # Ubuntu
```

### Quick Start
```bash
npm install
npm run dev  # Development with auto-reload
# or
npm start    # Production mode
```

### VS Code
Use the provided launch configurations:
- **Launch VideoGrid**: Start the service with debugger
- **Launch VideoGrid (watch)**: Start with nodemon for auto-reload

## Code Organization

```
src/
├── index.js              # Main API server (Express)
├── api/
│   └── streamManager.js  # Manages worker threads & streams
├── workers/
│   └── ffmpegWorker.js   # Worker thread running FFmpeg
├── utils/
│   └── ffmpegBuilder.js  # FFmpeg command construction
└── config/
    └── default.js        # Configuration

public/
├── index.html            # Web UI
├── css/styles.css        # SafeEVAC themed styles
└── js/app.js             # UI logic (vanilla JS)
```

## Code Quality Standards

### JavaScript Guidelines
- Use ES6+ features (async/await, destructuring, template literals)
- Prefer `const` over `let`, avoid `var`
- Use async/await over promise chains
- Add JSDoc comments for complex functions
- Use descriptive variable names

### Error Handling
```javascript
// Worker message handling
worker.on('error', (error) => {
  console.error('[StreamManager] Worker error:', error);
  this.emit('stream:error', { streamId, error });
});

// API error handling
try {
  validateStreamConfig(streamConfig);
  await streamManager.createStream(streamId, streamConfig);
  res.status(201).json({ streamId, config: streamConfig });
} catch (error) {
  console.error('[API] Error creating stream:', error);
  res.status(400).json({ error: error.message });
}
```

### Logging Conventions
Use descriptive prefixes for log messages:
- `[Worker]` - Worker thread messages
- `[StreamManager]` - Stream management operations
- `[FFmpeg streamId]` - FFmpeg process output
- `[API]` - API endpoint operations

## Common Workflows

### Adding a New API Endpoint
1. Add route to `src/index.js`
2. Add method to `StreamManager` if needed
3. Update `public/js/app.js` if UI needs it
4. Test with curl or Postman
5. Update API documentation in README.md

### Modifying FFmpeg Command
1. Edit `src/utils/ffmpegBuilder.js`
2. Update `buildFFmpegArgs()` function
3. Test with actual camera streams
4. Validate output quality
5. Update documentation

### UI Changes
1. Edit HTML in `public/index.html`
2. Update styles in `public/css/styles.css` (maintain SafeEVAC theme)
3. Update logic in `public/js/app.js`
4. Test in browser
5. Verify proxy compatibility (use relative paths)

## Testing

### Manual Testing
```bash
# Create a stream
curl -X POST http://localhost:4003/streams \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "test",
    "streamUrls": ["http://cam1/stream", "http://cam2/stream", ...],
    "columns": 2,
    "rows": 2
  }'

# View the stream
open http://localhost:4003/streams/test/output

# Stop the stream
curl -X DELETE http://localhost:4003/streams/test
```

### Health Check
```bash
curl http://localhost:4003/health
```

## Integration with SafeEVAC

This service is designed to integrate with the SafeEVAC monorepo:

### Proxy Setup
Add to `monorepo/frontend-controller/config/proxyInit.js`:
```javascript
const videogridTarget = 'http://localhost:4003';
app.use('/videogrid', createProxyMiddleware({
  target: videogridTarget,
  changeOrigin: true,
  pathRewrite: { '^/videogrid': '' }
}));
```

### Launcher
Use the provided launcher from monorepo:
```bash
node backend-controller/utils/videogrid_launcher.js
```

## Common Gotchas

### FFmpeg Not Found
- Ensure FFmpeg is installed and in PATH
- Check with: `ffmpeg -version`

### Port Already in Use
- Change PORT in `.env` file
- Default is 4003 (casdor's old port)

### Worker Thread Errors
- Check Node.js version (requires v16+)
- Ensure worker script path is correct
- Check for syntax errors in worker code

### MJPEG Stream Issues
- Verify camera URLs are accessible
- Ensure cameras output MJPEG format
- Check FFmpeg logs for encoding errors
- Verify grid dimensions match camera count

### UI Not Loading
- Check that static files are served correctly
- Verify Express static middleware is configured
- Check browser console for errors

## Performance Considerations

### CPU Usage
- Each FFmpeg process is CPU-intensive
- Limit concurrent grids based on hardware
- Monitor with `top` or `htop`

### Memory Usage
- Worker threads share memory efficiently
- Buffer size limited to 10 frames per stream
- Monitor with process manager

### Network Bandwidth
- Each camera stream consumes bandwidth
- Grid output streams are compressed (MJPEG q:v 3)
- Multiple clients share the same source connections

## Security

### Input Validation
- All stream configurations are validated before use
- FFmpeg arguments are built programmatically (no injection)
- URL validation prevents malformed inputs

### Network Security
- CORS enabled by default
- Consider adding authentication for production
- Use HTTPS in production environments

## Troubleshooting

### Debug Mode
Set environment variable for verbose logging:
```bash
FFMPEG_LOGLEVEL=debug npm start
```

### Common Issues
1. **Stream won't start**: Check FFmpeg logs for errors
2. **High CPU**: Reduce framerate or resolution
3. **Memory leaks**: Check worker cleanup on stream stop
4. **Connection issues**: Verify camera network accessibility

## Resources

- **FFmpeg Documentation**: https://ffmpeg.org/documentation.html
- **FFmpeg Grid Tutorial**: https://michalzuber.wordpress.com/2020/05/04/mosaic-grid-view-of-rtsp-streams-with-ffmpeg/
- **Node.js Worker Threads**: https://nodejs.org/api/worker_threads.html
- **Express.js Guide**: https://expressjs.com/en/guide/routing.html

## Contributing

When making changes:
1. Test thoroughly with real camera streams
2. Verify worker thread cleanup
3. Check for memory leaks
4. Update documentation
5. Follow the commit workflow above
6. Wait for user approval before committing
