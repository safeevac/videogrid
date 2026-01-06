const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * Check if a camera URL is accessible
 * @param {string} url - Camera URL to check
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Status result
 */
async function checkCameraUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        method: 'GET', // Use GET for MJPEG streams
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        timeout: timeout,
        headers: {
          'User-Agent': 'VideoGrid-HealthCheck/1.0',
          'Accept': 'multipart/x-mixed-replace'
        }
      };

      const startTime = Date.now();
      let dataReceived = false;
      let bytesReceived = 0;

      const req = protocol.request(options, (res) => {
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;

        if (!isSuccess) {
          req.destroy();
          resolve({
            url: url,
            status: 'error',
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            reachable: false,
            responseTime: Date.now() - startTime
          });
          return;
        }

        // For MJPEG streams, wait for some data to confirm it's working
        const dataHandler = (chunk) => {
          dataReceived = true;
          bytesReceived += chunk.length;

          // Once we receive some data, the stream is confirmed working
          req.destroy();
          resolve({
            url: url,
            status: 'ok',
            statusCode: res.statusCode,
            statusMessage: `Streaming (${bytesReceived} bytes)`,
            reachable: true,
            responseTime: Date.now() - startTime
          });
        };

        res.once('data', dataHandler);

        // If no data after 2 seconds, still consider it OK if status is 200
        setTimeout(() => {
          if (!dataReceived) {
            req.destroy();
            resolve({
              url: url,
              status: 'ok',
              statusCode: res.statusCode,
              statusMessage: 'Connected',
              reachable: true,
              responseTime: Date.now() - startTime
            });
          }
        }, 2000);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          url: url,
          status: 'timeout',
          statusCode: null,
          statusMessage: 'Request timeout',
          reachable: false,
          responseTime: timeout
        });
      });

      req.on('error', (error) => {
        resolve({
          url: url,
          status: 'error',
          statusCode: null,
          statusMessage: error.message,
          reachable: false,
          responseTime: Date.now() - startTime
        });
      });

      req.end();
    } catch (error) {
      resolve({
        url: url,
        status: 'error',
        statusCode: null,
        statusMessage: error.message,
        reachable: false,
        responseTime: 0
      });
    }
  });
}

/**
 * Check multiple camera URLs in parallel
 * @param {string[]} urls - Array of camera URLs
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Array>} Array of status results
 */
async function checkMultipleCameras(urls, timeout = 5000) {
  const promises = urls.map(url => checkCameraUrl(url, timeout));
  return Promise.all(promises);
}

module.exports = {
  checkCameraUrl,
  checkMultipleCameras
};
