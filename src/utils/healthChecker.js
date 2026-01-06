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
        method: 'HEAD',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        timeout: timeout,
        headers: {
          'User-Agent': 'VideoGrid-HealthCheck/1.0'
        }
      };

      const req = protocol.request(options, (res) => {
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;

        resolve({
          url: url,
          status: isSuccess ? 'ok' : 'error',
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          reachable: true,
          responseTime: Date.now() - startTime
        });

        // Abort the request to free resources
        req.destroy();
      });

      const startTime = Date.now();

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
