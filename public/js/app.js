// API Configuration - use relative paths for proxy compatibility
const API_BASE = '';

// State
let streams = [];
let streamUrls = [];
let configs = [];
let cameras = [];
let selectedCameraIds = [];

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
  loadConfigs();
  loadCameras();

  // Set up periodic refresh
  setInterval(loadStreams, 5000);
  setInterval(loadConfigs, 10000);
  setInterval(loadCameras, 15000);
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

  // Update camera selector
  updateCameraSelector();

  // Ensure we have enough URL inputs for manual mode
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

// Load saved configurations
async function loadConfigs() {
  try {
    const response = await fetch(`${API_BASE}/configs`);
    const data = await response.json();

    configs = data.configs || [];
    renderConfigs();
  } catch (error) {
    console.error('Error loading configs:', error);
  }
}

// Render saved configurations list
function renderConfigs() {
  const configsList = document.getElementById('configsList');

  if (configs.length === 0) {
    configsList.innerHTML = '<p class="empty-state">No saved configurations</p>';
    return;
  }

  configsList.innerHTML = configs.map(config => `
    <div class="config-list-item">
      <div class="config-list-header">
        <div class="config-list-title">
          ${config.name}
          ${config.autoStart ? '<span class="auto-start-badge">Auto-Start</span>' : ''}
        </div>
        <div class="config-list-info">
          <span class="info-chip">${config.columns}×${config.rows}</span>
          <span class="info-chip">${config.streamUrls.length} cameras</span>
        </div>
      </div>
      <div class="config-list-actions" onclick="event.stopPropagation()">
        <button class="btn-action btn-success-action" onclick="startFromConfig('${config.id}')" title="Start stream">
          ▶
        </button>
        <button class="btn-action" onclick="viewConfig('${config.id}')" title="View details">
          👁
        </button>
        <button class="btn-action btn-danger-action" onclick="deleteConfig('${config.id}')" title="Delete">
          🗑
        </button>
      </div>
    </div>
  `).join('');
}

// Start stream from saved config
async function startFromConfig(configId) {
  const config = configs.find(c => c.id === configId);
  if (!config) return;

  const streamId = prompt(`Enter stream ID (or leave blank to use "${config.name}"):`, config.name);
  if (streamId === null) return; // User cancelled

  try {
    const response = await fetch(`${API_BASE}/streams/from-config/${configId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        streamId: streamId || config.name
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start stream');
    }

    showSuccess(`Stream "${streamId || config.name}" started from saved configuration!`);
    loadStreams();
  } catch (error) {
    showError(error.message);
  }
}

// View config details
function viewConfig(configId) {
  const config = configs.find(c => c.id === configId);
  if (!config) return;

  document.getElementById('modalTitle').textContent = `Configuration: ${config.name}`;
  document.getElementById('modalBody').innerHTML = `
    <div class="detail-section">
      <h3>Settings</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Grid Layout</span>
          <span class="detail-value">${config.columns}×${config.rows}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Resolution</span>
          <span class="detail-value">${config.outputWidth}×${config.outputHeight}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Framerate</span>
          <span class="detail-value">${config.framerate} fps</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Auto-Start</span>
          <span class="detail-value">${config.autoStart ? 'Yes' : 'No'}</span>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h3>Camera URLs (${config.streamUrls.length})</h3>
      <div class="camera-sources-list">
        ${config.streamUrls.map((url, index) => `
          <div class="camera-source-item">
            <div class="camera-source-number">#${index + 1}</div>
            <div class="camera-source-url">${url}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-info">
        <span class="text-secondary">Saved: ${new Date(config.savedAt).toLocaleString()}</span>
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn-primary" onclick="startFromConfigModal('${config.id}')">
        Start Stream
      </button>
      <button class="btn-danger" onclick="deleteConfigFromModal('${config.id}')">
        Delete Configuration
      </button>
    </div>
  `;

  document.getElementById('streamDetailModal').style.display = 'flex';
}

// Start from config (from modal)
async function startFromConfigModal(configId) {
  closeDetailModal();
  await startFromConfig(configId);
}

// Delete config
async function deleteConfig(configId) {
  const config = configs.find(c => c.id === configId);
  if (!config) return;

  if (!confirm(`Delete configuration "${config.name}"?`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/configs/${configId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete configuration');
    }

    showSuccess('Configuration deleted!');
    loadConfigs();
  } catch (error) {
    showError(error.message);
  }
}

// Delete config from modal
async function deleteConfigFromModal(configId) {
  closeDetailModal();
  await deleteConfig(configId);
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
      ${stream.health ? `
        <div class="health-summary">
          <span class="health-stat">
            <span class="health-label">Healthy:</span>
            <span class="health-value">${stream.health.healthyCameras}/${stream.health.totalCameras}</span>
          </span>
          <span class="health-stat">
            <span class="health-label">Frames:</span>
            <span class="health-value">${stream.health.frameCount}</span>
          </span>
          <span class="health-stat">
            <span class="health-label">Last Frame:</span>
            <span class="health-value">${formatTimeSince(stream.health.timeSinceLastFrame)}</span>
          </span>
        </div>
      ` : ''}
      <div class="camera-sources-list">
        ${stream.config.streamUrls.map((url, index) => {
          const cameraStatus = stream.cameraStatus && stream.cameraStatus[index]
            ? stream.cameraStatus[index]
            : { status: 'unknown' };
          const statusClass = `status-${cameraStatus.status}`;
          const statusText = cameraStatus.status.charAt(0).toUpperCase() + cameraStatus.status.slice(1);

          return `
            <div class="camera-source-item">
              <div class="camera-source-number">#${index + 1}</div>
              <div class="camera-source-url">${url}</div>
              <div class="camera-source-status">
                <span class="status-dot ${statusClass}" title="${statusText}"></span>
                <span class="status-text">${statusText}</span>
              </div>
            </div>
          `;
        }).join('')}
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
  const saveConfig = document.getElementById('saveConfig').checked;
  const autoStart = document.getElementById('autoStart').checked;
  const cameraMode = document.querySelector('input[name="cameraMode"]:checked').value;

  let urls = [];
  let cameraIds = [];

  if (cameraMode === 'library') {
    // Use selected cameras from library
    cameraIds = selectedCameraIds;
    const selectedCameras = cameras.filter(c => cameraIds.includes(c.id));
    urls = selectedCameras.map(c => c.url);

    if (cameraIds.length < columns * rows) {
      showError(`Please select ${columns * rows} cameras for your ${columns}×${rows} grid`);
      return;
    }
  } else {
    // Use manual URLs
    urls = streamUrls
      .map(input => input.value.trim())
      .filter(url => url.length > 0);

    if (urls.length < columns * rows) {
      showError(`Please provide at least ${columns * rows} camera URLs`);
      return;
    }
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
        cameraIds: cameraIds,
        columns,
        rows,
        outputWidth,
        outputHeight,
        framerate,
        saveConfig,
        autoStart
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create stream');
    }

    showSuccess(`Stream created successfully!${saveConfig ? ' Configuration saved.' : ''}`);
    createStreamForm.reset();

    // Reset checkboxes to default
    document.getElementById('saveConfig').checked = true;
    document.getElementById('autoStart').checked = false;

    // Reset URL inputs
    streamUrlsContainer.innerHTML = '';
    streamUrls = [];
    for (let i = 0; i < 4; i++) {
      addStreamUrlInput();
    }

    loadStreams();
    if (saveConfig) {
      loadConfigs();
    }
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

  try {
    // Call backend health check API
    const response = await fetch(`${API_BASE}/health-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        urls: urls,
        timeout: 5000
      })
    });

    if (!response.ok) {
      throw new Error('Health check request failed');
    }

    const data = await response.json();

    // Update UI with results
    data.results.forEach((result, index) => {
      const healthItem = document.getElementById(`health-${index}`);
      if (!healthItem) return;

      const statusDiv = healthItem.querySelector('.health-status');

      let statusHtml;
      if (result.status === 'ok') {
        statusHtml = `
          <span class="status-dot status-ok"></span>
          <span class="health-text text-success">OK (${result.responseTime}ms)</span>
        `;
      } else if (result.status === 'timeout') {
        statusHtml = `
          <span class="status-dot status-timeout"></span>
          <span class="health-text text-warning">Timeout</span>
        `;
      } else {
        statusHtml = `
          <span class="status-dot status-error"></span>
          <span class="health-text text-danger">${result.statusMessage || 'Error'}</span>
        `;
      }

      statusDiv.innerHTML = statusHtml;
    });
  } catch (error) {
    console.error('Health check failed:', error);
    showError('Failed to check camera health. Please try again.');
    closeHealthCheckModal();
  }
}

// Close health check modal
function closeHealthCheckModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('healthCheckModal').style.display = 'none';
  }
}

// Format time since in human readable format
function formatTimeSince(ms) {
  if (ms < 1000) return 'just now';
  if (ms < 60000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  return `${Math.round(ms / 3600000)}h ago`;
}

// ========== Camera Library Functions ==========

// Load cameras
async function loadCameras() {
  try {
    const response = await fetch(`${API_BASE}/cameras`);
    const data = await response.json();

    cameras = data.cameras || [];
    renderCameras();
    updateCameraSelector();
  } catch (error) {
    console.error('Error loading cameras:', error);
  }
}

// Render camera library list
function renderCameras() {
  const camerasList = document.getElementById('camerasList');

  if (cameras.length === 0) {
    camerasList.innerHTML = '<p class="empty-state">No cameras defined. Click "+ Add Camera" to get started.</p>';
    return;
  }

  camerasList.innerHTML = cameras.map(camera => `
    <div class="camera-item">
      <div class="camera-item-header">
        <div class="camera-item-title">${camera.name}</div>
        ${camera.location ? `<div class="camera-item-location">${camera.location}</div>` : ''}
      </div>
      <div class="camera-item-url">${camera.url}</div>
      ${camera.notes ? `<div class="camera-item-notes">${camera.notes}</div>` : ''}
      <div class="camera-item-actions">
        <button class="btn-action" onclick="editCamera('${camera.id}')" title="Edit">
          ✏️
        </button>
        <button class="btn-action btn-danger-action" onclick="deleteCamera('${camera.id}')" title="Delete">
          🗑
        </button>
      </div>
    </div>
  `).join('');
}

// Update camera selector grid
function updateCameraSelector() {
  const selector = document.getElementById('cameraGridSelector');
  const gridSize = parseInt(columnsSelect.value) * parseInt(rowsSelect.value);

  if (cameras.length === 0) {
    selector.innerHTML = '<p class="text-secondary">No cameras available. Add cameras to the library first.</p>';
    return;
  }

  selector.innerHTML = `
    <div class="camera-selector-info">
      Select ${gridSize} cameras for your ${columnsSelect.value}×${rowsSelect.value} grid:
    </div>
    ${cameras.map(camera => `
      <label class="camera-checkbox-label">
        <input type="checkbox"
               class="camera-checkbox"
               value="${camera.id}"
               onchange="updateSelectedCameras()"
               ${selectedCameraIds.includes(camera.id) ? 'checked' : ''}>
        <div class="camera-checkbox-content">
          <div class="camera-checkbox-name">${camera.name}</div>
          ${camera.location ? `<div class="camera-checkbox-location">${camera.location}</div>` : ''}
        </div>
      </label>
    `).join('')}
  `;
}

// Update selected cameras
function updateSelectedCameras() {
  const checkboxes = document.querySelectorAll('.camera-checkbox:checked');
  selectedCameraIds = Array.from(checkboxes).map(cb => cb.value);

  const gridSize = parseInt(columnsSelect.value) * parseInt(rowsSelect.value);
  if (selectedCameraIds.length > gridSize) {
    // Uncheck the last one if too many selected
    checkboxes[checkboxes.length - 1].checked = false;
    selectedCameraIds = selectedCameraIds.slice(0, gridSize);
  }
}

// Toggle camera mode (library vs manual)
function toggleCameraMode() {
  const mode = document.querySelector('input[name="cameraMode"]:checked').value;
  const librarySection = document.getElementById('cameraLibrarySection');
  const manualSection = document.getElementById('manualUrlSection');

  if (mode === 'library') {
    librarySection.style.display = 'block';
    manualSection.style.display = 'none';
  } else {
    librarySection.style.display = 'none';
    manualSection.style.display = 'block';
  }
}

// Show add camera modal
function showAddCameraModal() {
  document.getElementById('cameraModalTitle').textContent = 'Add Camera';
  document.getElementById('cameraForm').reset();
  document.getElementById('editCameraId').value = '';
  document.getElementById('cameraModal').style.display = 'flex';
}

// Edit camera
function editCamera(cameraId) {
  const camera = cameras.find(c => c.id === cameraId);
  if (!camera) return;

  document.getElementById('cameraModalTitle').textContent = 'Edit Camera';
  document.getElementById('editCameraId').value = camera.id;
  document.getElementById('cameraName').value = camera.name;
  document.getElementById('cameraUrl').value = camera.url;
  document.getElementById('cameraLocation').value = camera.location || '';
  document.getElementById('cameraNotes').value = camera.notes || '';
  document.getElementById('cameraModal').style.display = 'flex';
}

// Handle save camera
async function handleSaveCamera(e) {
  e.preventDefault();

  const cameraId = document.getElementById('editCameraId').value;
  const name = document.getElementById('cameraName').value;
  const url = document.getElementById('cameraUrl').value;
  const location = document.getElementById('cameraLocation').value;
  const notes = document.getElementById('cameraNotes').value;

  try {
    const isEdit = !!cameraId;
    const endpoint = isEdit ? `${API_BASE}/cameras/${cameraId}` : `${API_BASE}/cameras`;
    const method = isEdit ? 'PUT' : 'POST';

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        url,
        location,
        notes
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save camera');
    }

    showSuccess(`Camera ${isEdit ? 'updated' : 'added'} successfully!`);
    closeCameraModal();
    loadCameras();
  } catch (error) {
    showError(error.message);
  }
}

// Delete camera
async function deleteCamera(cameraId) {
  const camera = cameras.find(c => c.id === cameraId);
  if (!camera) return;

  if (!confirm(`Delete camera "${camera.name}"?`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/cameras/${cameraId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete camera');
    }

    showSuccess('Camera deleted!');
    loadCameras();
  } catch (error) {
    showError(error.message);
  }
}

// Close camera modal
function closeCameraModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('cameraModal').style.display = 'none';
  }
}
