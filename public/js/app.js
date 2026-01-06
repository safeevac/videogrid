// API Configuration - use relative paths for proxy compatibility
const API_BASE = '';

// State
let streams = [];
let streamUrls = [];

// DOM Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const createStreamForm = document.getElementById('createStreamForm');
const columnsSelect = document.getElementById('columns');
const rowsSelect = document.getElementById('rows');
const gridInfo = document.getElementById('gridInfo');
const streamUrlsContainer = document.getElementById('streamUrls');
const addUrlBtn = document.getElementById('addUrlBtn');
const streamsList = document.getElementById('streamsList');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeForm();
  checkServerStatus();
  loadStreams();

  // Set up periodic refresh
  setInterval(loadStreams, 5000);
});

// Form initialization
function initializeForm() {
  // Add initial URL inputs
  for (let i = 0; i < 4; i++) {
    addStreamUrlInput();
  }

  // Update grid info when layout changes
  columnsSelect.addEventListener('change', updateGridInfo);
  rowsSelect.addEventListener('change', updateGridInfo);
  updateGridInfo();

  // Add URL button
  addUrlBtn.addEventListener('click', addStreamUrlInput);

  // Form submission
  createStreamForm.addEventListener('submit', handleCreateStream);
}

// Update grid info text
function updateGridInfo() {
  const columns = parseInt(columnsSelect.value);
  const rows = parseInt(rowsSelect.value);
  const total = columns * rows;
  gridInfo.textContent = `(${total} cameras)`;

  // Ensure we have enough URL inputs
  while (streamUrls.length < total) {
    addStreamUrlInput();
  }
}

// Add stream URL input
function addStreamUrlInput() {
  const div = document.createElement('div');
  div.className = 'stream-url-item';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = `http://camera${streamUrls.length + 1}.local/stream`;
  input.required = true;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove';
  removeBtn.textContent = '×';
  removeBtn.onclick = () => {
    div.remove();
    streamUrls.splice(streamUrls.indexOf(input), 1);
  };

  div.appendChild(input);
  div.appendChild(removeBtn);
  streamUrlsContainer.appendChild(div);
  streamUrls.push(input);
}

// Check server status
async function checkServerStatus() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();

    if (data.status === 'ok') {
      statusIndicator.classList.add('connected');
      statusText.textContent = `Connected • ${data.streams} active streams`;
    }
  } catch (error) {
    statusIndicator.classList.remove('connected');
    statusText.textContent = 'Disconnected';
  }
}

// Load streams
async function loadStreams() {
  try {
    const response = await fetch(`${API_BASE}/streams`);
    const data = await response.json();

    streams = data.streams || [];
    renderStreams();
    checkServerStatus();
  } catch (error) {
    console.error('Error loading streams:', error);
  }
}

// Render streams list (simplified)
function renderStreams() {
  if (streams.length === 0) {
    streamsList.innerHTML = '<p class="empty-state">No active streams</p>';
    return;
  }

  streamsList.innerHTML = streams.map(stream => `
    <div class="stream-list-item" onclick="showStreamDetail('${stream.streamId}')">
      <div class="stream-list-header">
        <div class="stream-list-title">${stream.streamId}</div>
        <div class="stream-list-badge">
          <span class="badge-dot"></span>
          ${stream.clients} ${stream.clients === 1 ? 'client' : 'clients'}
        </div>
      </div>
      <div class="stream-list-info">
        <span class="info-chip">${stream.config.columns}×${stream.config.rows} grid</span>
        <span class="info-chip">${stream.config.outputWidth}×${stream.config.outputHeight}</span>
        <span class="info-chip">${stream.config.framerate} fps</span>
        <span class="info-chip">${stream.config.streamUrls.length} cameras</span>
      </div>
      <div class="stream-list-actions" onclick="event.stopPropagation()">
        <button class="btn-action" onclick="openStreamUrl('${stream.streamId}')" title="Open stream">
          ↗
        </button>
        <button class="btn-action btn-danger-action" onclick="deleteStream('${stream.streamId}')" title="Stop stream">
          ⏹
        </button>
      </div>
    </div>
  `).join('');
}

// Show stream detail modal
function showStreamDetail(streamId) {
  const stream = streams.find(s => s.streamId === streamId);
  if (!stream) return;

  document.getElementById('modalTitle').textContent = `${stream.streamId}`;
  document.getElementById('modalBody').innerHTML = `
    <div class="detail-section">
      <h3>Configuration</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Grid Layout</span>
          <span class="detail-value">${stream.config.columns}×${stream.config.rows}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Resolution</span>
          <span class="detail-value">${stream.config.outputWidth}×${stream.config.outputHeight}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Framerate</span>
          <span class="detail-value">${stream.config.framerate} fps</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Active Clients</span>
          <span class="detail-value">${stream.clients}</span>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h3>Stream URL</h3>
      <div class="url-container">
        <input type="text"
               class="url-input"
               value="${window.location.origin}/streams/${stream.streamId}/output"
               readonly
               id="modal-url-${stream.streamId}"
               onclick="this.select()">
        <button class="btn-copy" onclick="copyStreamUrl('${stream.streamId}', 'modal-')" title="Copy URL">
          📋
        </button>
        <button class="btn-open" onclick="openStreamUrl('${stream.streamId}')" title="Open in new tab">
          ↗
        </button>
      </div>
    </div>

    <div class="detail-section">
      <h3>Live Preview</h3>
      <div class="stream-preview">
        <img src="${API_BASE}/streams/${stream.streamId}/output?t=${Date.now()}"
             alt="${stream.streamId}"
             onerror="this.style.display='none'"
             onload="this.style.display='block'">
      </div>
    </div>

    <div class="detail-section">
      <h3>Camera Sources (${stream.config.streamUrls.length})</h3>
      <div class="camera-sources-list">
        ${stream.config.streamUrls.map((url, index) => `
          <div class="camera-source-item">
            <div class="camera-source-number">#${index + 1}</div>
            <div class="camera-source-url">${url}</div>
            <div class="camera-source-status">
              <span class="status-dot status-unknown" title="Status unknown"></span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn-danger" onclick="deleteStreamFromModal('${stream.streamId}')">
        Stop Stream
      </button>
    </div>
  `;

  document.getElementById('streamDetailModal').style.display = 'flex';
}

// Handle create stream
async function handleCreateStream(e) {
  e.preventDefault();

  const streamId = document.getElementById('streamId').value;
  const columns = parseInt(columnsSelect.value);
  const rows = parseInt(rowsSelect.value);
  const outputWidth = parseInt(document.getElementById('outputWidth').value);
  const outputHeight = parseInt(document.getElementById('outputHeight').value);
  const framerate = parseInt(document.getElementById('framerate').value);

  const urls = streamUrls
    .map(input => input.value.trim())
    .filter(url => url.length > 0);

  if (urls.length < columns * rows) {
    showError(`Please provide at least ${columns * rows} camera URLs`);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/streams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        streamId,
        streamUrls: urls,
        columns,
        rows,
        outputWidth,
        outputHeight,
        framerate
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create stream');
    }

    showSuccess('Stream created successfully!');
    createStreamForm.reset();

    // Reset URL inputs
    streamUrlsContainer.innerHTML = '';
    streamUrls = [];
    for (let i = 0; i < 4; i++) {
      addStreamUrlInput();
    }

    loadStreams();
  } catch (error) {
    showError(error.message);
  }
}

// Delete stream
async function deleteStream(streamId) {
  if (!confirm(`Are you sure you want to stop stream "${streamId}"?`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/streams/${streamId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete stream');
    }

    showSuccess('Stream stopped successfully!');
    loadStreams();
  } catch (error) {
    showError(error.message);
  }
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;

  const form = document.querySelector('.card');
  form.insertBefore(errorDiv, form.firstChild);

  setTimeout(() => errorDiv.remove(), 5000);
}

// Show success message
function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.textContent = message;

  const form = document.querySelector('.card');
  form.insertBefore(successDiv, form.firstChild);

  setTimeout(() => successDiv.remove(), 5000);
}

// Close detail modal
function closeDetailModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('streamDetailModal').style.display = 'none';
  }
}

// Delete stream from modal
async function deleteStreamFromModal(streamId) {
  closeDetailModal();
  await deleteStream(streamId);
}

// Copy stream URL to clipboard
function copyStreamUrl(streamId, prefix = '') {
  const input = document.getElementById(`${prefix}url-${streamId}`);
  input.select();
  input.setSelectionRange(0, 99999); // For mobile devices

  try {
    navigator.clipboard.writeText(input.value).then(() => {
      showSuccess(`Stream URL copied to clipboard!`);
    }).catch(() => {
      // Fallback for older browsers
      document.execCommand('copy');
      showSuccess(`Stream URL copied to clipboard!`);
    });
  } catch (error) {
    console.error('Failed to copy:', error);
    showError('Failed to copy URL to clipboard');
  }
}

// Open stream URL in new tab
function openStreamUrl(streamId) {
  const url = `${window.location.origin}/streams/${streamId}/output`;
  window.open(url, '_blank');
}

// Check camera health
async function checkCameraHealth() {
  const urls = streamUrls
    .map(input => input.value.trim())
    .filter(url => url.length > 0);

  if (urls.length === 0) {
    showError('Please add camera URLs first');
    return;
  }

  // Show health check modal
  document.getElementById('healthCheckModal').style.display = 'flex';
  const healthCheckBody = document.getElementById('healthCheckBody');

  healthCheckBody.innerHTML = `
    <p class="text-secondary mb-3">Testing ${urls.length} camera${urls.length > 1 ? 's' : ''}...</p>
    <div class="health-check-list">
      ${urls.map((url, index) => `
        <div class="health-check-item" id="health-${index}">
          <div class="health-number">#${index + 1}</div>
          <div class="health-url">${url}</div>
          <div class="health-status">
            <div class="spinner-small"></div>
            <span class="health-text">Testing...</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Test each camera
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const healthItem = document.getElementById(`health-${i}`);
    const statusDiv = healthItem.querySelector('.health-status');

    try {
      // Try to fetch the stream URL
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // Allow cross-origin checks
      });

      clearTimeout(timeoutId);

      // Even with no-cors, if we get here without error, the URL is reachable
      statusDiv.innerHTML = `
        <span class="status-dot status-ok"></span>
        <span class="health-text text-success">Reachable</span>
      `;
    } catch (error) {
      if (error.name === 'AbortError') {
        statusDiv.innerHTML = `
          <span class="status-dot status-timeout"></span>
          <span class="health-text text-warning">Timeout</span>
        `;
      } else {
        // With no-cors, we can't actually verify the response, so we just check if it doesn't error
        // This is a limitation of browser CORS - in production, backend should handle health checks
        statusDiv.innerHTML = `
          <span class="status-dot status-unknown"></span>
          <span class="health-text text-secondary">Unknown (CORS)</span>
        `;
      }
    }
  }
}

// Close health check modal
function closeHealthCheckModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('healthCheckModal').style.display = 'none';
  }
}
