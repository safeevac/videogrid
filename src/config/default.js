require('dotenv').config();

module.exports = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0'
  },

  ffmpeg: {
    loglevel: process.env.FFMPEG_LOGLEVEL || 'warning'
  },

  stream: {
    defaultGridColumns: parseInt(process.env.DEFAULT_GRID_COLUMNS || '2', 10),
    defaultGridRows: parseInt(process.env.DEFAULT_GRID_ROWS || '2', 10),
    defaultOutputWidth: parseInt(process.env.DEFAULT_OUTPUT_WIDTH || '1920', 10),
    defaultOutputHeight: parseInt(process.env.DEFAULT_OUTPUT_HEIGHT || '1080', 10),
    defaultFramerate: parseInt(process.env.DEFAULT_FRAMERATE || '15', 10),
    // Fault tolerance settings
    reconnectDelayMax: parseInt(process.env.RECONNECT_DELAY_MAX || '5', 10),
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '10', 10)
  }
};
