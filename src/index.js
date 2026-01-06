const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/default');
const StreamManager = require('./api/streamManager');
const { validateStreamConfig } = require('./utils/ffmpegBuilder');
const configStore = require('./utils/configStore');
const cameraStore = require('./utils/cameraStore');
const { checkMultipleCameras } = require('./utils/healthChecker');

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
 * GET /cameras
 * Get all cameras
 */
app.get('/cameras', (req, res) => {
  const cameras = cameraStore.getAll();
  res.json({ cameras });
});

/**
 * GET /cameras/:cameraId
 * Get a specific camera
 */
app.get('/cameras/:cameraId', (req, res) => {
  const { cameraId } = req.params;
  const camera = cameraStore.get(cameraId);

  if (!camera) {
    return res.status(404).json({ error: 'Camera not found' });
  }

  res.json(camera);
});

/**
 * POST /cameras
 * Add a new camera
 */
app.post('/cameras', async (req, res) => {
  try {
    const { name, url, highResUrl, location, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    const camera = await cameraStore.set({
      name,
      url,
      highResUrl: highResUrl || '',
      location: location || '',
      notes: notes || ''
    });

    res.status(201).json(camera);
  } catch (error) {
    console.error('[API] Error adding camera:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /cameras/:cameraId
 * Update a camera
 */
app.put('/cameras/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const existingCamera = cameraStore.get(cameraId);

    if (!existingCamera) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    const { name, url, highResUrl, location, notes } = req.body;

    const updatedCamera = await cameraStore.set({
      ...existingCamera,
      name: name || existingCamera.name,
      url: url || existingCamera.url,
      highResUrl: highResUrl !== undefined ? highResUrl : existingCamera.highResUrl,
      location: location !== undefined ? location : existingCamera.location,
      notes: notes !== undefined ? notes : existingCamera.notes
    });

    res.json(updatedCamera);
  } catch (error) {
    console.error('[API] Error updating camera:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /cameras/:cameraId
 * Delete a camera
 */
app.delete('/cameras/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const deleted = await cameraStore.delete(cameraId);

    if (!deleted) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    res.json({ message: 'Camera deleted' });
  } catch (error) {
    console.error('[API] Error deleting camera:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /health-check
 * Check health of camera URLs
 */
app.post('/health-check', async (req, res) => {
  try {
    const { urls, timeout = 5000 } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'urls must be a non-empty array' });
    }

    if (urls.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 URLs per request' });
    }

    const results = await checkMultipleCameras(urls, timeout);
    res.json({ results });
  } catch (error) {
    console.error('[API] Error checking camera health:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
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
      cameraIds,
      columns = config.stream.defaultGridColumns,
      rows = config.stream.defaultGridRows,
      outputWidth = config.stream.defaultOutputWidth,
      outputHeight = config.stream.defaultOutputHeight,
      framerate = config.stream.defaultFramerate,
      layout = 'grid',
      saveConfig = false,
      configId = null
    } = req.body;

    if (!streamId) {
      return res.status(400).json({ error: 'streamId is required' });
    }

    // Accept either cameraIds (from camera library) or direct streamUrls
    let finalStreamUrls = streamUrls;

    if (cameraIds && Array.isArray(cameraIds) && cameraIds.length > 0) {
      const cameras = cameraStore.getByIds(cameraIds);

      // Choose URL based on layout type and camera position
      finalStreamUrls = cameras.map((camera, index) => {
        // For featured layout: use high-res for main camera (index 0), low-res for thumbnails
        if (layout === 'featured' && index === 0 && camera.highResUrl) {
          return camera.highResUrl;
        }
        // For PIP layout: use high-res for main camera (index 0), low-res for PIP
        if (layout === 'pip' && index === 0 && camera.highResUrl) {
          return camera.highResUrl;
        }
        // For grid layout or thumbnails: always use low-res
        return camera.url;
      });
    }

    if (!finalStreamUrls || !Array.isArray(finalStreamUrls) || finalStreamUrls.length === 0) {
      return res.status(400).json({ error: 'streamUrls or cameraIds must be provided' });
    }

    const streamConfig = {
      streamUrls: finalStreamUrls,
      columns,
      rows,
      outputWidth,
      outputHeight,
      framerate,
      layout,
      loglevel: config.ffmpeg.loglevel
    };

    // Validate configuration
    validateStreamConfig(streamConfig);

    // Save configuration if requested
    if (saveConfig) {
      const savedConfig = await configStore.set({
        id: configId || undefined,
        name: streamId,
        streamUrls: finalStreamUrls,
        cameraIds: cameraIds || [],
        columns,
        rows,
        outputWidth,
        outputHeight,
        framerate,
        layout,
        autoStart: req.body.autoStart || false
      });
      console.log(`[API] Saved configuration: ${savedConfig.name} (ID: ${savedConfig.id})`);
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
 * GET /streams/:streamId/status
 * Get detailed status of stream and all sub-feeds
 */
app.get('/streams/:streamId/status', (req, res) => {
  const { streamId } = req.params;
  const info = streamManager.getStreamInfo(streamId);

  if (!info) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  // Build detailed status for each sub-feed
  const subFeeds = info.config.streamUrls.map((url, index) => {
    const cameraStatus = info.cameraStatus[index] || {};
    return {
      index: index,
      identifier: `${streamId}_camera_${index}`,
      url: url,
      status: cameraStatus.status || 'unknown',
      errorCount: cameraStatus.errorCount || 0,
      lastCheck: cameraStatus.lastCheck,
      position: {
        row: Math.floor(index / info.config.columns),
        column: index % info.config.columns
      }
    };
  });

  res.json({
    streamId: streamId,
    outputUrl: `/streams/${streamId}/output`,
    layout: info.config.layout || 'grid',
    gridSize: {
      columns: info.config.columns,
      rows: info.config.rows
    },
    resolution: {
      width: info.config.outputWidth,
      height: info.config.outputHeight
    },
    framerate: info.config.framerate,
    health: info.health,
    subFeeds: subFeeds,
    clients: info.clients,
    isReady: info.isReady
  });
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

  // Load saved data
  await configStore.load();
  await cameraStore.load();

  // Start health monitoring
  streamManager.startHealthMonitoring();

  // Auto-start streams if configured
  const savedConfigs = configStore.getAll();
  const autoStartConfigs = savedConfigs.filter(c => c.autoStart);

  if (autoStartConfigs.length > 0) {
    console.log(`[AutoStart] Starting ${autoStartConfigs.length} configured streams...`);

    for (const savedConfig of autoStartConfigs) {
      try {
        const streamConfig = {
          streamUrls: savedConfig.streamUrls,
          columns: savedConfig.columns,
          rows: savedConfig.rows,
          outputWidth: savedConfig.outputWidth,
          outputHeight: savedConfig.outputHeight,
          framerate: savedConfig.framerate,
          loglevel: config.ffmpeg.loglevel
        };

        await streamManager.createStream(savedConfig.name, streamConfig);
        console.log(`[AutoStart] Started stream: ${savedConfig.name}`);
      } catch (error) {
        console.error(`[AutoStart] Failed to start stream ${savedConfig.name}:`, error.message);
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
