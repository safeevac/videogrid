const fs = require('fs').promises;
const path = require('path');

const CAMERA_FILE = path.join(__dirname, '../../cameras.json');

/**
 * Camera Store
 * Manages persistent storage of camera definitions
 */
class CameraStore {
  constructor() {
    this.cameras = [];
  }

  /**
   * Load cameras from disk
   */
  async load() {
    try {
      const data = await fs.readFile(CAMERA_FILE, 'utf8');
      this.cameras = JSON.parse(data);
      console.log(`[CameraStore] Loaded ${this.cameras.length} cameras`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[CameraStore] No saved cameras found, starting fresh');
        this.cameras = [];
      } else {
        console.error('[CameraStore] Error loading cameras:', error);
        this.cameras = [];
      }
    }
  }

  /**
   * Save cameras to disk
   */
  async save() {
    try {
      const data = JSON.stringify(this.cameras, null, 2);
      await fs.writeFile(CAMERA_FILE, data, 'utf8');
      console.log(`[CameraStore] Saved ${this.cameras.length} cameras`);
    } catch (error) {
      console.error('[CameraStore] Error saving cameras:', error);
      throw error;
    }
  }

  /**
   * Get all cameras
   */
  getAll() {
    return this.cameras;
  }

  /**
   * Get a camera by ID
   */
  get(cameraId) {
    return this.cameras.find(c => c.id === cameraId);
  }

  /**
   * Get cameras by IDs
   */
  getByIds(cameraIds) {
    return cameraIds.map(id => this.get(id)).filter(c => c !== undefined);
  }

  /**
   * Add or update a camera
   */
  async set(camera) {
    // Ensure camera has an ID
    if (!camera.id) {
      camera.id = this.generateId();
      camera.createdAt = new Date().toISOString();
    }

    // Update timestamp
    camera.updatedAt = new Date().toISOString();

    // Update or add
    const index = this.cameras.findIndex(c => c.id === camera.id);
    if (index >= 0) {
      this.cameras[index] = camera;
    } else {
      this.cameras.push(camera);
    }

    await this.save();
    return camera;
  }

  /**
   * Delete a camera
   */
  async delete(cameraId) {
    const index = this.cameras.findIndex(c => c.id === cameraId);
    if (index >= 0) {
      this.cameras.splice(index, 1);
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * Generate a unique ID
   */
  generateId() {
    return `camera_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
module.exports = new CameraStore();
