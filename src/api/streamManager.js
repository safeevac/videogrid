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
      isReady: false
    };

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

    return {
      streamId,
      config: stream.config,
      clients: stream.clients.size,
      isReady: stream.isReady
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
