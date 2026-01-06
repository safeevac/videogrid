const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/default');
const StreamManager = require('./api/streamManager');
const { validateStreamConfig } = require('./utils/ffmpegBuilder');

const app = express();
const streamManager = new StreamManager();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    streams: streamManager.listStreams().length
  });
});

/**
 * POST /streams
 * Create a new stream
 *
 * Body:
 * {
 *   "streamId": "grid1",
 *   "streamUrls": ["http://camera1/stream", "http://camera2/stream", ...],
 *   "columns": 2,
 *   "rows": 2,
 *   "outputWidth": 1920,
 *   "outputHeight": 1080,
 *   "framerate": 15
 * }
 */
app.post('/streams', async (req, res) => {
  try {
    const {
      streamId,
      streamUrls,
      columns = config.stream.defaultGridColumns,
      rows = config.stream.defaultGridRows,
      outputWidth = config.stream.defaultOutputWidth,
      outputHeight = config.stream.defaultOutputHeight,
      framerate = config.stream.defaultFramerate
    } = req.body;

    if (!streamId) {
      return res.status(400).json({ error: 'streamId is required' });
    }

    if (!streamUrls || !Array.isArray(streamUrls) || streamUrls.length === 0) {
      return res.status(400).json({ error: 'streamUrls must be a non-empty array' });
    }

    const streamConfig = {
      streamUrls,
      columns,
      rows,
      outputWidth,
      outputHeight,
      framerate,
      loglevel: config.ffmpeg.loglevel
    };

    // Validate configuration
    validateStreamConfig(streamConfig);

    // Create stream
    await streamManager.createStream(streamId, streamConfig);

    res.status(201).json({
      streamId,
      config: streamConfig,
      streamUrl: `/streams/${streamId}/output`
    });
  } catch (error) {
    console.error('[API] Error creating stream:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /streams
 * List all streams
 */
app.get('/streams', (req, res) => {
  const streams = streamManager.listStreams();
  res.json({ streams });
});

/**
 * GET /streams/:streamId
 * Get stream info
 */
app.get('/streams/:streamId', (req, res) => {
  const { streamId } = req.params;
  const info = streamManager.getStreamInfo(streamId);

  if (!info) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  res.json(info);
});

/**
 * GET /streams/:streamId/output
 * Get the MJPEG stream output
 */
app.get('/streams/:streamId/output', (req, res) => {
  const { streamId } = req.params;

  try {
    streamManager.addClient(streamId, res);
  } catch (error) {
    console.error('[API] Error adding client to stream:', error);
    res.status(404).json({ error: error.message });
  }
});

/**
 * DELETE /streams/:streamId
 * Stop and delete a stream
 */
app.delete('/streams/:streamId', async (req, res) => {
  const { streamId } = req.params;

  try {
    await streamManager.stopStream(streamId);
    res.json({ message: `Stream ${streamId} stopped` });
  } catch (error) {
    console.error('[API] Error stopping stream:', error);
    res.status(404).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(config.server.port, config.server.host, () => {
  console.log(`VideoGrid server listening on ${config.server.host}:${config.server.port}`);
  console.log(`Health check: http://localhost:${config.server.port}/health`);
  console.log(`API docs: http://localhost:${config.server.port}/`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');

  server.close(() => {
    console.log('HTTP server closed');
  });

  await streamManager.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');

  server.close(() => {
    console.log('HTTP server closed');
  });

  await streamManager.cleanup();
  process.exit(0);
});
