# Proxy Setup for VideoGrid

This document explains how to set up VideoGrid behind a reverse proxy, such as in the SafeEVAC frontend-controller.

## Architecture

```
Client Browser
    ↓
Frontend Controller (http://localhost:4001/videogrid)
    ↓ (proxy)
VideoGrid Service (http://localhost:3000)
```

## Proxy Configuration

### Option 1: Using proxyInit.js (SafeEVAC)

Add to your `frontend-controller/config/proxyInit.js`:

```javascript
// VideoGrid service proxy
const videogridTarget = 'http://localhost:4003';

app.use('/videogrid', createProxyMiddleware({
  target: videogridTarget,
  changeOrigin: true,
  pathRewrite: {
    '^/videogrid': '' // Remove /videogrid prefix when forwarding
  },
  logLevel: 'warn',
  onError: (err, req, res) => {
    console.error('[Proxy] VideoGrid error:', err.message);
    res.status(502).json({ error: 'VideoGrid service unavailable' });
  },
  onProxyReq: (proxyReq, req, res) => {
    // Handle MJPEG streaming properly
    if (req.url.includes('/streams/') && req.url.includes('/output')) {
      proxyReq.setHeader('Connection', 'keep-alive');
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Ensure MJPEG streams are not buffered
    if (req.url.includes('/output')) {
      proxyRes.headers['x-accel-buffering'] = 'no';
    }
  }
}));
```

### Option 2: NGINX Reverse Proxy

```nginx
location /videogrid/ {
    proxy_pass http://localhost:4003/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;

    # Disable buffering for MJPEG streams
    proxy_buffering off;
    proxy_request_buffering off;
}
```

## API Paths

All API calls use relative paths, making them proxy-friendly:

- `GET /health` - Health check
- `POST /streams` - Create stream
- `GET /streams` - List streams
- `GET /streams/:id` - Get stream info
- `GET /streams/:id/output` - MJPEG stream output
- `DELETE /streams/:id` - Stop stream

## Testing the Proxy

1. Start VideoGrid service:
   ```bash
   cd videogrid
   npm start
   ```

2. Start your main application with proxy configured

3. Access via proxy:
   ```
   http://localhost:4001/videogrid
   ```

4. Verify API calls are being proxied:
   ```bash
   curl http://localhost:4001/videogrid/health
   ```

## Troubleshooting

### MJPEG Stream Not Loading
- Ensure proxy is not buffering the stream
- Check that `Connection: keep-alive` header is set
- Verify `x-accel-buffering: no` header for NGINX

### 502 Bad Gateway
- Check that VideoGrid service is running on correct port (4003)
- Verify firewall settings allow connection to port 4003
- Check VideoGrid logs for errors

### CORS Issues
- VideoGrid includes CORS middleware by default
- If issues persist, check proxy CORS configuration

## Production Deployment

For production, consider:

1. **Run VideoGrid as a systemd service**:
   ```bash
   sudo nano /etc/systemd/system/videogrid.service
   ```

2. **Use PM2 for process management**:
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name videogrid
   pm2 save
   pm2 startup
   ```

3. **Set up health checks** in your load balancer/proxy

4. **Monitor resource usage** as FFmpeg can be CPU-intensive
