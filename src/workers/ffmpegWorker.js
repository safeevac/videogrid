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
    ffmpegProcess.stdout.on('data', (data) => {
      parentPort.postMessage({
        type: 'data',
        data: data
      });
    });

    // Handle stderr (FFmpeg logs)
    ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();
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
