/**
 * Build FFmpeg command for creating a grid/mosaic of MJPEG streams
 * Based on: https://michalzuber.wordpress.com/2020/05/04/mosaic-grid-view-of-rtsp-streams-with-ffmpeg/
 */

/**
 * Build FFmpeg arguments for grid layout
 * @param {Object} options - Configuration options
 * @param {string[]} options.streamUrls - Array of MJPEG stream URLs
 * @param {number} options.columns - Number of columns in grid
 * @param {number} options.rows - Number of rows in grid
 * @param {number} options.outputWidth - Output width in pixels
 * @param {number} options.outputHeight - Output height in pixels
 * @param {number} options.framerate - Output framerate
 * @param {string} options.loglevel - FFmpeg log level
 * @returns {string[]} Array of FFmpeg arguments
 */
function buildFFmpegArgs(options) {
  const {
    streamUrls,
    columns,
    rows,
    outputWidth,
    outputHeight,
    framerate,
    loglevel
  } = options;

  const totalStreams = streamUrls.length;
  const expectedStreams = columns * rows;

  if (totalStreams < expectedStreams) {
    throw new Error(`Not enough streams: got ${totalStreams}, expected ${expectedStreams} (${columns}x${rows})`);
  }

  // Calculate individual stream dimensions
  const streamWidth = Math.floor(outputWidth / columns);
  const streamHeight = Math.floor(outputHeight / rows);

  const args = [
    '-loglevel', loglevel,
    // Low latency flags - minimize buffering
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-avioflags', 'direct',
    '-probesize', '32',
    '-analyzeduration', '0'
  ];

  // Add input streams with fault tolerance
  streamUrls.slice(0, expectedStreams).forEach(url => {
    args.push(
      // Input-specific options before -i
      '-reconnect', '1',              // Enable reconnection
      '-reconnect_streamed', '1',     // Reconnect even if stream started
      '-reconnect_delay_max', '5',    // Max 5 seconds between reconnect attempts
      '-timeout', '10000000',         // 10 second timeout (in microseconds)
      '-thread_queue_size', '512',    // Smaller queue for lower latency
      '-i', url,
      '-r', framerate.toString()
    );
  });

  // Build filter complex for grid layout
  // First, scale all inputs to the same size
  const scaleFilters = [];
  for (let i = 0; i < expectedStreams; i++) {
    scaleFilters.push(`[${i}:v]scale=${streamWidth}:${streamHeight}[v${i}]`);
  }

  // Build xstack filter for grid layout
  // Format: [v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[out]
  const layoutParts = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = col === 0 ? '0' : `w${col - 1}`;
      const y = row === 0 ? '0' : `h${row - 1}`;

      if (col === 0 && row === 0) {
        layoutParts.push('0_0');
      } else if (col === 0) {
        layoutParts.push(`0_h${row - 1}`);
      } else if (row === 0) {
        layoutParts.push(`w${col - 1}_0`);
      } else {
        layoutParts.push(`w${col - 1}_h${row - 1}`);
      }
    }
  }

  const inputRefs = Array.from({ length: expectedStreams }, (_, i) => `[v${i}]`).join('');
  const xstackFilter = `${inputRefs}xstack=inputs=${expectedStreams}:layout=${layoutParts.join('|')}[out]`;

  const filterComplex = [...scaleFilters, xstackFilter].join(';');

  args.push(
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-c:v', 'mjpeg',
    '-q:v', '3',
    // Output format options for low latency
    '-f', 'mjpeg',
    '-flush_packets', '1',  // Flush packets immediately
    '-fflags', '+flush_packets',
    '-'
  );

  return args;
}

/**
 * Validate stream configuration
 * @param {Object} config - Stream configuration
 * @throws {Error} If configuration is invalid
 */
function validateStreamConfig(config) {
  const { streamUrls, columns, rows, outputWidth, outputHeight, framerate } = config;

  if (!Array.isArray(streamUrls) || streamUrls.length === 0) {
    throw new Error('streamUrls must be a non-empty array');
  }

  if (!Number.isInteger(columns) || columns < 1) {
    throw new Error('columns must be a positive integer');
  }

  if (!Number.isInteger(rows) || rows < 1) {
    throw new Error('rows must be a positive integer');
  }

  if (!Number.isInteger(outputWidth) || outputWidth < 1) {
    throw new Error('outputWidth must be a positive integer');
  }

  if (!Number.isInteger(outputHeight) || outputHeight < 1) {
    throw new Error('outputHeight must be a positive integer');
  }

  if (!Number.isInteger(framerate) || framerate < 1 || framerate > 60) {
    throw new Error('framerate must be an integer between 1 and 60');
  }

  const expectedStreams = columns * rows;
  if (streamUrls.length < expectedStreams) {
    throw new Error(`Not enough streams: got ${streamUrls.length}, need ${expectedStreams} for ${columns}x${rows} grid`);
  }
}

module.exports = {
  buildFFmpegArgs,
  validateStreamConfig
};
