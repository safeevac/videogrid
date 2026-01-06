const { parentPort, workerData } = require('worker_threads');
const { spawn } = require('child_process');
const { buildFFmpegArgs } = require('../utils/ffmpegBuilder');

let ffmpegProcess = null;
let isRunning = false;

/**
 * Start FFmpeg process with the given configuration
 * @param {Object} config - Stream configuration
 */
function startFFmpeg(config) {
  if (isRunning) {
    parentPort.postMessage({
      type: 'error',
      error: 'FFmpeg process is already running'
    });
    return;
  }

  try {
    const args = buildFFmpegArgs(config);

    console.log('[Worker] Starting FFmpeg with args:', args.join(' '));

    ffmpegProcess = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    isRunning = true;

    // Send ready message
    parentPort.postMessage({
      type: 'started',
      pid: ffmpegProcess.pid
    });

    // Handle stdout (MJPEG stream data)
    let totalBytes = 0;
    let frameCount = 0;
    let buffer = Buffer.alloc(0);

    ffmpegProcess.stdout.on('data', (chunk) => {
      totalBytes += chunk.length;
      buffer = Buffer.concat([buffer, chunk]);

      // Look for JPEG markers (FFI D8 = start, FF D9 = end)
      let startIndex = 0;

      while (startIndex < buffer.length) {
        // Find JPEG start marker (0xFF 0xD8)
        const jpegStart = buffer.indexOf(Buffer.from([0xFF, 0xD8]), startIndex);
        if (jpegStart === -1) break;

        // Find JPEG end marker (0xFF 0xD9)
        const jpegEnd = buffer.indexOf(Buffer.from([0xFF, 0xD9]), jpegStart + 2);
        if (jpegEnd === -1) break; // Incomplete frame, wait for more data

        // Extract complete JPEG frame
        const frameData = buffer.slice(jpegStart, jpegEnd + 2);
        frameCount++;

        // Log first few frames
        if (frameCount <= 3) {
          console.log(`[Worker] Received frame ${frameCount}, size: ${frameData.length} bytes`);
        }

        // Send frame with multipart boundaries
        const boundary = '--jpgboundary\r\n';
        const header = `Content-Type: image/jpeg\r\nContent-Length: ${frameData.length}\r\n\r\n`;
        const frameWithBoundary = Buffer.concat([
          Buffer.from(boundary),
          Buffer.from(header),
          frameData,
          Buffer.from('\r\n')
        ]);

        parentPort.postMessage({
          type: 'data',
          data: frameWithBoundary
        });

        startIndex = jpegEnd + 2;
      }

      // Keep remaining incomplete data in buffer
      if (startIndex > 0) {
        buffer = buffer.slice(startIndex);
      }
    });

    // Handle stderr (FFmpeg logs)
    ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();

      // Log errors to console immediately
      if (message.toLowerCase().includes('error')) {
        console.error('[Worker] FFmpeg Error:', message.trim());
      }

      parentPort.postMessage({
        type: 'log',
        message: message
      });
    });

    // Handle process exit
    ffmpegProcess.on('exit', (code, signal) => {
      isRunning = false;
      parentPort.postMessage({
        type: 'exit',
        code: code,
        signal: signal
      });
    });

    // Handle process errors
    ffmpegProcess.on('error', (error) => {
      isRunning = false;
      parentPort.postMessage({
        type: 'error',
        error: error.message
      });
    });

  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      error: error.message
    });
  }
}

/**
 * Stop FFmpeg process
 */
function stopFFmpeg() {
  if (!ffmpegProcess || !isRunning) {
    parentPort.postMessage({
      type: 'error',
      error: 'No FFmpeg process running'
    });
    return;
  }

  ffmpegProcess.kill('SIGTERM');

  // Force kill after 5 seconds if still running
  setTimeout(() => {
    if (isRunning) {
      console.log('[Worker] Force killing FFmpeg process');
      ffmpegProcess.kill('SIGKILL');
    }
  }, 5000);
}

// Handle messages from main thread
parentPort.on('message', (message) => {
  switch (message.type) {
    case 'start':
      startFFmpeg(message.config);
      break;
    case 'stop':
      stopFFmpeg();
      break;
    default:
      parentPort.postMessage({
        type: 'error',
        error: `Unknown message type: ${message.type}`
      });
  }
});

// Handle worker termination
process.on('SIGTERM', () => {
  if (ffmpegProcess && isRunning) {
    ffmpegProcess.kill('SIGTERM');
  }
  process.exit(0);
});
