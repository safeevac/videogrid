const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/default');
const StreamManager = require('./api/streamManager');
const { validateStreamConfig } = require('./utils/ffmpegBuilder');
const configStore = require('./utils/configStore');

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
 * GET /configs
 * Get all saved configurations
 */
app.get('/configs', (req, res) => {
  const configs = configStore.getAll();
  res.json({ configs });
});

/**
 * GET /configs/:configId
 * Get a specific configuration
 */
app.get('/configs/:configId', (req, res) => {
  const { configId } = req.params;
  const config = configStore.get(configId);

  if (!config) {
    return res.status(404).json({ error: 'Configuration not found' });
  }

  res.json(config);
});

/**
 * POST /configs
 * Save a new configuration (doesn't start the stream)
 */
app.post('/configs', async (req, res) => {
  try {
    const {
      name,
      streamUrls,
      columns = config.stream.defaultGridColumns,
      rows = config.stream.defaultGridRows,
      outputWidth = config.stream.defaultOutputWidth,
      outputHeight = config.stream.defaultOutputHeight,
      framerate = config.stream.defaultFramerate,
      autoStart = false
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
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

    // Save configuration
    const savedConfig = await configStore.set({
      name,
      ...streamConfig,
      autoStart
    });

    res.status(201).json(savedConfig);
  } catch (error) {
    console.error('[API] Error saving configuration:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /configs/:configId
 * Update an existing configuration
 */
app.put('/configs/:configId', async (req, res) => {
  try {
    const { configId } = req.params;
    const existingConfig = configStore.get(configId);

    if (!existingConfig) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const {
      name,
      streamUrls,
      columns,
      rows,
      outputWidth,
      outputHeight,
      framerate,
      autoStart
    } = req.body;

    const streamConfig = {
      streamUrls: streamUrls || existingConfig.streamUrls,
      columns: columns || existingConfig.columns,
      rows: rows || existingConfig.rows,
      outputWidth: outputWidth || existingConfig.outputWidth,
      outputHeight: outputHeight || existingConfig.outputHeight,
      framerate: framerate || existingConfig.framerate,
      loglevel: config.ffmpeg.loglevel
    };

    // Validate configuration
    validateStreamConfig(streamConfig);

    // Update configuration
    const updatedConfig = await configStore.set({
      id: configId,
      name: name || existingConfig.name,
      ...streamConfig,
      autoStart: autoStart !== undefined ? autoStart : existingConfig.autoStart
    });

    res.json(updatedConfig);
  } catch (error) {
    console.error('[API] Error updating configuration:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /configs/:configId
 * Delete a saved configuration
 */
app.delete('/configs/:configId', async (req, res) => {
  try {
    const { configId } = req.params;
    const deleted = await configStore.delete(configId);

    if (!deleted) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    res.json({ message: `Configuration deleted` });
  } catch (error) {
    console.error('[API] Error deleting configuration:', error);
    res.status(400).json({ error: error.message });
  }
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
 *   "framerate": 15,
 *   "saveConfig": false  // Optional: save this configuration
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
      framerate = config.stream.defaultFramerate,
      saveConfig = false,
      configId = null
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

    // Save configuration if requested
    if (saveConfig) {
      await configStore.set({
        id: configId || undefined,
        name: streamId,
        ...streamConfig,
        autoStart: false
      });
    }

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
 * POST /streams/from-config/:configId
 * Create a stream from a saved configuration
 */
app.post('/streams/from-config/:configId', async (req, res) => {
  try {
    const { configId } = req.params;
    const { streamId } = req.body;

    const savedConfig = configStore.get(configId);
    if (!savedConfig) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const finalStreamId = streamId || savedConfig.name;

    const streamConfig = {
      streamUrls: savedConfig.streamUrls,
      columns: savedConfig.columns,
      rows: savedConfig.rows,
      outputWidth: savedConfig.outputWidth,
      outputHeight: savedConfig.outputHeight,
      framerate: savedConfig.framerate,
      loglevel: config.ffmpeg.loglevel
    };

    // Create stream
    await streamManager.createStream(finalStreamId, streamConfig);

    res.status(201).json({
      streamId: finalStreamId,
      config: streamConfig,
      streamUrl: `/streams/${finalStreamId}/output`,
      configId: configId
    });
  } catch (error) {
    console.error('[API] Error creating stream from config:', error);
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
const server = app.listen(config.server.port, config.server.host, async () => {
  console.log(`VideoGrid server listening on ${config.server.host}:${config.server.port}`);
  console.log(`Health check: http://localhost:${config.server.port}/health`);
  console.log(`API docs: http://localhost:${config.server.port}/`);

  // Load saved configurations
  await configStore.load();

  // Auto-start streams if configured
  const configs = configStore.getAll();
  const autoStartConfigs = configs.filter(c => c.autoStart);

  if (autoStartConfigs.length > 0) {
    console.log(`[AutoStart] Starting ${autoStartConfigs.length} configured streams...`);

    for (const config of autoStartConfigs) {
      try {
        const streamConfig = {
          streamUrls: config.streamUrls,
          columns: config.columns,
          rows: config.rows,
          outputWidth: config.outputWidth,
          outputHeight: config.outputHeight,
          framerate: config.framerate,
          loglevel: config.ffmpeg.loglevel
        };

        await streamManager.createStream(config.name, streamConfig);
        console.log(`[AutoStart] Started stream: ${config.name}`);
      } catch (error) {
        console.error(`[AutoStart] Failed to start stream ${config.name}:`, error.message);
      }
    }
  }
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
