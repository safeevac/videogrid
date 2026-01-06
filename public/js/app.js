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

// Render streams list
function renderStreams() {
  if (streams.length === 0) {
    streamsList.innerHTML = '<p class="empty-state">No active streams</p>';
    return;
  }

  streamsList.innerHTML = streams.map(stream => `
    <div class="stream-item" data-stream-id="${stream.streamId}">
      <div class="stream-header">
        <div class="stream-title">${stream.streamId}</div>
        <div class="stream-badge">
          <span>${stream.clients} ${stream.clients === 1 ? 'client' : 'clients'}</span>
        </div>
      </div>

      <div class="stream-info">
        <div class="info-item">
          <span class="info-label">Grid Layout</span>
          <span class="info-value">${stream.config.columns}×${stream.config.rows}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Resolution</span>
          <span class="info-value">${stream.config.outputWidth}×${stream.config.outputHeight}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Framerate</span>
          <span class="info-value">${stream.config.framerate} fps</span>
        </div>
        <div class="info-item">
          <span class="info-label">Cameras</span>
          <span class="info-value">${stream.config.streamUrls.length}</span>
        </div>
      </div>

      <div class="stream-preview">
        <img src="${API_BASE}/streams/${stream.streamId}/output?t=${Date.now()}"
             alt="${stream.streamId}"
             onerror="this.style.display='none'"
             onload="this.style.display='block'">
      </div>

      <div class="camera-list">
        <div class="camera-list-title">Camera URLs:</div>
        ${stream.config.streamUrls.map(url => `
          <div class="camera-url">${url}</div>
        `).join('')}
      </div>

      <div class="stream-actions">
        <button class="btn-danger" onclick="deleteStream('${stream.streamId}')">
          Stop Stream
        </button>
      </div>
    </div>
  `).join('');
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
