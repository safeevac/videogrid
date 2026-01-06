# Development Guide

## Quick Start for Developers

### Prerequisites
```bash
# Install FFmpeg
brew install ffmpeg  # macOS
# or
sudo apt-get install ffmpeg  # Ubuntu

# Install Node.js 16+ (if not already installed)
node --version  # Should be v16.0.0 or higher
```

### Setup

```bash
# Clone the repository
git clone https://github.com/safeevac/videogrid.git
cd videogrid

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server with auto-reload
npm run dev

# Or start in production mode
npm start
```

### VS Code Setup

1. **Open Workspace**:
   ```bash
   code videogrid.code-workspace
   ```
   This opens both VideoGrid and SafeEVAC monorepo for integrated development.

2. **Recommended Extensions** (will prompt on first open):
   - Prettier - Code formatter
   - ESLint - JavaScript linting
   - npm Intellisense - Autocomplete npm modules
   - Error Lens - Inline error highlighting

3. **Launch Configurations**:
   - **Launch VideoGrid**: Start with debugger attached
   - **Launch VideoGrid (watch)**: Auto-reload on file changes
   - **Attach to Process**: Attach debugger to running process

4. **Available Tasks** (Cmd/Ctrl+Shift+P → "Run Task"):
   - Start VideoGrid
   - Start VideoGrid (dev)
   - Check FFmpeg
   - Test API Health
   - List Active Streams
   - Open UI in Browser

### Project Structure

```
videogrid/
├── .vscode/                   # VS Code configuration
│   ├── launch.json           # Debugger configurations
│   ├── tasks.json            # Task runner
│   ├── settings.json         # Editor settings
│   └── extensions.json       # Recommended extensions
├── src/
│   ├── index.js              # Main Express server
│   ├── api/
│   │   └── streamManager.js  # Worker thread & stream lifecycle
│   ├── workers/
│   │   └── ffmpegWorker.js   # FFmpeg worker thread
│   ├── utils/
│   │   └── ffmpegBuilder.js  # FFmpeg command construction
│   └── config/
│       └── default.js        # Configuration loader
├── public/
│   ├── index.html            # Web UI
│   ├── css/styles.css        # SafeEVAC themed styles
│   └── js/app.js             # UI logic
├── .eslintrc.json            # ESLint configuration
├── .prettierrc               # Prettier configuration
├── AGENTS.md                 # Claude Code guidance
├── CLAUDE.md                 # Symlink to AGENTS.md
└── videogrid.code-workspace  # Multi-project workspace
```

## Development Workflow

### Starting Development

```bash
# Option 1: Command line with auto-reload
npm run dev

# Option 2: VS Code debugger
# Press F5 or use "Launch VideoGrid (watch)" configuration

# Option 3: Using launcher from monorepo
cd ../monorepo
node backend-controller/utils/videogrid_launcher.js
```

### Making Changes

1. **Backend Changes** (`src/`):
   - Edit files in `src/`
   - Nodemon will auto-reload
   - Check terminal for errors
   - Test with curl or Postman

2. **Frontend Changes** (`public/`):
   - Edit HTML/CSS/JS files
   - Refresh browser to see changes
   - Check browser console for errors

3. **Configuration Changes**:
   - Edit `.env` file
   - Restart server manually
   - Verify changes take effect

### Testing

#### Manual API Testing
```bash
# Health check
curl http://localhost:4003/health

# Create stream
curl -X POST http://localhost:4003/streams \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "test",
    "streamUrls": [
      "http://camera1/stream",
      "http://camera2/stream",
      "http://camera3/stream",
      "http://camera4/stream"
    ],
    "columns": 2,
    "rows": 2
  }'

# View stream
open http://localhost:4003/streams/test/output

# List streams
curl http://localhost:4003/streams

# Delete stream
curl -X DELETE http://localhost:4003/streams/test
```

#### Using VS Code Tasks
- `Test API Health` - Quick health check
- `List Active Streams` - See all running streams
- `Open UI in Browser` - Launch web interface

### Debugging

#### Using VS Code Debugger
1. Set breakpoints in code (click left margin)
2. Press F5 or use "Launch VideoGrid (watch)"
3. Code execution will pause at breakpoints
4. Inspect variables, step through code

#### Worker Thread Debugging
```javascript
// Add debug logging in workers
console.log('[Worker] Debug info:', data);

// Check worker messages in main thread
worker.on('message', (msg) => {
  console.log('[Main] Worker message:', msg);
});
```

#### FFmpeg Output
```bash
# Enable verbose FFmpeg logging
FFMPEG_LOGLEVEL=debug npm start

# Or edit .env
FFMPEG_LOGLEVEL=debug
```

### Code Style

#### Auto-formatting
- Save file (Cmd/Ctrl+S) - Prettier formats automatically
- Or manually: Cmd/Ctrl+Shift+P → "Format Document"

#### Linting
```bash
# Run ESLint
npx eslint src/

# Fix auto-fixable issues
npx eslint src/ --fix
```

#### Style Guidelines
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- 100 character line length
- Descriptive variable names
- JSDoc for complex functions

### Common Development Tasks

#### Adding a New API Endpoint
1. Add route in `src/index.js`
2. Implement handler function
3. Update StreamManager if needed
4. Test with curl
5. Update UI if needed
6. Update README.md

#### Modifying FFmpeg Command
1. Edit `src/utils/ffmpegBuilder.js`
2. Update `buildFFmpegArgs()` function
3. Test with real streams
4. Verify output quality
5. Update documentation

#### UI Changes
1. Edit `public/index.html` (structure)
2. Edit `public/css/styles.css` (styling)
3. Edit `public/js/app.js` (logic)
4. Refresh browser
5. Test all functionality

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: description of feature"

# Push to GitHub
git push -u origin feature/your-feature-name

# Create pull request
gh pr create --title "Feature: Your Feature" --body "Description"
```

### Performance Monitoring

```bash
# Monitor CPU/Memory
top -pid $(pgrep -f "node.*videogrid")

# Or use htop
htop -p $(pgrep -f "node.*videogrid")

# Check worker threads
ps aux | grep "node.*videogrid"
```

### Troubleshooting

#### Server Won't Start
- Check port 4003 is available: `lsof -i :4003`
- Verify Node.js version: `node --version`
- Check for syntax errors in code

#### FFmpeg Errors
- Verify FFmpeg installed: `ffmpeg -version`
- Check camera URL accessibility
- Review FFmpeg logs in console
- Try command manually for debugging

#### UI Not Loading
- Check Express static middleware
- Verify files in `public/` directory
- Check browser console for errors
- Clear browser cache

#### Worker Thread Issues
- Check Node.js version (v16+ required)
- Verify worker script path
- Check for syntax errors
- Review worker error logs

### Resources

- **GitHub**: https://github.com/safeevac/videogrid
- **FFmpeg Docs**: https://ffmpeg.org/documentation.html
- **Node.js Workers**: https://nodejs.org/api/worker_threads.html
- **Express Guide**: https://expressjs.com/

### Getting Help

1. Check documentation in `README.md`
2. Review `AGENTS.md` for code guidelines
3. Search GitHub issues
4. Create new issue with details
