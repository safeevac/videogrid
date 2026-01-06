const { Worker } = require('worker_threads');
const path = require('path');
const EventEmitter = require('events');

/**
 * Manages FFmpeg worker threads and stream lifecycle
 */
class StreamManager extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map(); // streamId -> { worker, config, clients, buffer }
  }

  /**
   * Create a new stream
   * @param {string} streamId - Unique stream identifier
   * @param {Object} config - Stream configuration
   * @returns {Promise<string>} Stream ID
   */
  async createStream(streamId, config) {
    if (this.streams.has(streamId)) {
      throw new Error(`Stream ${streamId} already exists`);
    }

    const worker = new Worker(path.join(__dirname, '../workers/ffmpegWorker.js'));

    const streamData = {
      worker,
      config,
      clients: new Set(),
      buffer: [], // Buffer to store recent frames for new clients
      maxBufferSize: 10,
      isReady: false,
      cameraStatus: {}, // Track individual camera health
      lastFrameTime: Date.now(),
      frameCount: 0
    };

    // Initialize camera status tracking
    config.streamUrls.forEach((url, index) => {
      streamData.cameraStatus[index] = {
        url: url,
        status: 'unknown', // unknown, ok, timeout, error
        lastCheck: null,
        errorCount: 0
      };
    });

    this.streams.set(streamId, streamData);

    // Set up worker message handling
    worker.on('message', (message) => {
      this.handleWorkerMessage(streamId, message);
    });

    worker.on('error', (error) => {
      console.error(`[StreamManager] Worker error for stream ${streamId}:`, error);
      this.emit('stream:error', { streamId, error });
    });

    worker.on('exit', (code) => {
      console.log(`[StreamManager] Worker exited for stream ${streamId} with code ${code}`);
      this.streams.delete(streamId);
      this.emit('stream:ended', { streamId, code });
    });

    // Start the FFmpeg process
    worker.postMessage({
      type: 'start',
      config
    });

    return streamId;
  }

  /**
   * Handle messages from worker thread
   * @param {string} streamId - Stream ID
   * @param {Object} message - Message from worker
   */
  handleWorkerMessage(streamId, message) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    switch (message.type) {
      case 'started':
        console.log(`[StreamManager] Stream ${streamId} started (PID: ${message.pid})`);
        stream.isReady = true;
        this.emit('stream:started', { streamId, pid: message.pid });
        break;

      case 'data':
        // Update frame tracking
        stream.lastFrameTime = Date.now();
        stream.frameCount++;

        // Store frame in buffer
        stream.buffer.push(message.data);
        if (stream.buffer.length > stream.maxBufferSize) {
          stream.buffer.shift();
        }

        // Send to all connected clients
        stream.clients.forEach(client => {
          try {
            client.write(message.data);
          } catch (error) {
            console.error(`[StreamManager] Error writing to client:`, error);
            stream.clients.delete(client);
          }
        });
        break;

      case 'camera-status':
        // Update camera status from FFmpeg monitoring
        if (message.cameraIndex !== undefined && message.status) {
          const cameraStatus = stream.cameraStatus[message.cameraIndex];
          if (cameraStatus) {
            cameraStatus.status = message.status;
            cameraStatus.lastCheck = Date.now();
            if (message.status === 'error' || message.status === 'timeout') {
              cameraStatus.errorCount++;
            }
          }
        }
        break;

      case 'log':
        console.log(`[FFmpeg ${streamId}]`, message.message.trim());
        break;

      case 'exit':
        console.log(`[StreamManager] Stream ${streamId} exited (code: ${message.code}, signal: ${message.signal})`);
        break;

      case 'error':
        console.error(`[StreamManager] Stream ${streamId} error:`, message.error);
        this.emit('stream:error', { streamId, error: message.error });
        break;
    }
  }

  /**
   * Add a client to a stream
   * @param {string} streamId - Stream ID
   * @param {Object} response - HTTP response object
   */
  addClient(streamId, response) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    // Set up response for MJPEG streaming
    response.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--jpgboundary',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'close'
    });

    // Send buffered frames to new client
    stream.buffer.forEach(frame => {
      try {
        response.write(frame);
      } catch (error) {
        console.error('[StreamManager] Error sending buffered frame:', error);
      }
    });

    stream.clients.add(response);

    // Remove client when connection closes
    response.on('close', () => {
      stream.clients.delete(response);
      console.log(`[StreamManager] Client disconnected from stream ${streamId} (${stream.clients.size} remaining)`);
    });

    console.log(`[StreamManager] Client connected to stream ${streamId} (${stream.clients.size} total)`);
  }

  /**
   * Stop a stream
   * @param {string} streamId - Stream ID
   */
  async stopStream(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    // Close all client connections
    stream.clients.forEach(client => {
      try {
        client.end();
      } catch (error) {
        // Ignore errors when closing
      }
    });
    stream.clients.clear();

    // Stop the worker
    stream.worker.postMessage({ type: 'stop' });

    // Remove from map
    this.streams.delete(streamId);
  }

  /**
   * Get stream info
   * @param {string} streamId - Stream ID
   * @returns {Object} Stream information
   */
  getStreamInfo(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return null;
    }

    // Calculate stream health
    const timeSinceLastFrame = Date.now() - stream.lastFrameTime;
    const isStale = timeSinceLastFrame > 10000; // 10 seconds

    return {
      streamId,
      config: stream.config,
      clients: stream.clients.size,
      isReady: stream.isReady,
      cameraStatus: stream.cameraStatus,
      health: {
        lastFrameTime: stream.lastFrameTime,
        timeSinceLastFrame,
        isStale,
        frameCount: stream.frameCount,
        totalCameras: stream.config.streamUrls.length,
        healthyCameras: Object.values(stream.cameraStatus).filter(c => c.status === 'ok').length
      }
    };
  }

  /**
   * List all streams
   * @returns {Array} Array of stream information
   */
  listStreams() {
    const streams = [];
    this.streams.forEach((stream, streamId) => {
      streams.push(this.getStreamInfo(streamId));
    });
    return streams;
  }

  /**
   * Monitor stream health
   */
  startHealthMonitoring() {
    // Check all streams every 5 seconds
    setInterval(() => {
      this.streams.forEach((stream, streamId) => {
        const timeSinceLastFrame = Date.now() - stream.lastFrameTime;

        // Mark stream as stale if no frames in 10 seconds
        if (timeSinceLastFrame > 10000 && stream.isReady) {
          console.warn(`[StreamManager] Stream ${streamId} appears stale (${Math.round(timeSinceLastFrame / 1000)}s since last frame)`);

          // Mark all cameras as timeout if stream is stale
          Object.keys(stream.cameraStatus).forEach(index => {
            if (stream.cameraStatus[index].status !== 'error') {
              stream.cameraStatus[index].status = 'timeout';
              stream.cameraStatus[index].lastCheck = Date.now();
            }
          });
        } else if (stream.isReady) {
          // Stream is healthy, mark cameras as OK
          Object.keys(stream.cameraStatus).forEach(index => {
            if (stream.cameraStatus[index].status === 'timeout') {
              stream.cameraStatus[index].status = 'ok';
              stream.cameraStatus[index].lastCheck = Date.now();
            }
          });
        }
      });
    }, 5000);
  }

  /**
   * Cleanup all streams
   */
  async cleanup() {
    const promises = [];
    this.streams.forEach((stream, streamId) => {
      promises.push(this.stopStream(streamId));
    });
    await Promise.all(promises);
  }
}

module.exports = StreamManager;
