/**
 * Layout-specific FFmpeg filter builders
 */

/**
 * Build featured layout (one large + row of thumbnails)
 */
function buildFeaturedLayout(options) {
  const {
    streamUrls,
    outputWidth,
    outputHeight,
    framerate,
    loglevel
  } = options;

  const totalStreams = streamUrls.length;
  if (totalStreams < 2) {
    throw new Error('Featured layout requires at least 2 streams');
  }

  // Layout: Main camera takes ~75% of height, thumbnails in row at bottom
  const mainHeight = Math.floor(outputHeight * 0.75);
  const thumbHeight = outputHeight - mainHeight;
  const thumbWidth = Math.floor(outputWidth / (totalStreams - 1));

  const args = [
    '-loglevel', loglevel,
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-avioflags', 'direct',
    '-probesize', '32',
    '-analyzeduration', '0'
  ];

  // Add input streams
  streamUrls.forEach(url => {
    args.push(
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-timeout', '10000000',
      '-thread_queue_size', '512',
      '-i', url,
      '-r', framerate.toString()
    );
  });

  // Scale filters
  const scaleFilters = [
    `[0:v]scale=${outputWidth}:${mainHeight}[main]`
  ];

  for (let i = 1; i < totalStreams; i++) {
    scaleFilters.push(`[${i}:v]scale=${thumbWidth}:${thumbHeight}[thumb${i}]`);
  }

  // Build thumbnail row
  const thumbInputs = Array.from({ length: totalStreams - 1 }, (_, i) => `[thumb${i + 1}]`).join('');
  const thumbLayout = Array.from({ length: totalStreams - 1 }, (_, i) =>
    i === 0 ? '0_0' : `w${i}_0`
  ).join('|');

  const filterComplex = [
    ...scaleFilters,
    `${thumbInputs}xstack=inputs=${totalStreams - 1}:layout=${thumbLayout}[thumbrow]`,
    `[main][thumbrow]vstack=inputs=2[out]`
  ].join(';');

  args.push(
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-c:v', 'mjpeg',
    '-q:v', '3',
    '-f', 'mjpeg',
    '-flush_packets', '1',
    '-fflags', '+flush_packets',
    '-'
  );

  return args;
}

/**
 * Build picture-in-picture layout
 */
function buildPipLayout(options) {
  const {
    streamUrls,
    outputWidth,
    outputHeight,
    framerate,
    loglevel
  } = options;

  if (streamUrls.length < 2) {
    throw new Error('PIP layout requires at least 2 streams');
  }

  // Main stream full size, second stream as PIP (15% of width) in top-right
  const pipWidth = Math.floor(outputWidth * 0.15);
  const pipHeight = Math.floor(pipWidth * 9 / 16); // 16:9 aspect ratio
  const pipX = outputWidth - pipWidth - 20;
  const pipY = 20;

  const args = [
    '-loglevel', loglevel,
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-avioflags', 'direct',
    '-probesize', '32',
    '-analyzeduration', '0'
  ];

  // Add main and PIP streams
  streamUrls.slice(0, 2).forEach(url => {
    args.push(
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-timeout', '10000000',
      '-thread_queue_size', '512',
      '-i', url,
      '-r', framerate.toString()
    );
  });

  const filterComplex = [
    `[0:v]scale=${outputWidth}:${outputHeight}[main]`,
    `[1:v]scale=${pipWidth}:${pipHeight}[pip]`,
    `[main][pip]overlay=${pipX}:${pipY}[out]`
  ].join(';');

  args.push(
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-c:v', 'mjpeg',
    '-q:v', '3',
    '-f', 'mjpeg',
    '-flush_packets', '1',
    '-fflags', '+flush_packets',
    '-'
  );

  return args;
}

module.exports = {
  buildFeaturedLayout,
  buildPipLayout
};
