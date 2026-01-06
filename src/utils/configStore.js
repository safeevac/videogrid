const fs = require('fs').promises;
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../configs.json');

/**
 * Configuration Store
 * Manages persistent storage of stream configurations
 */
class ConfigStore {
  constructor() {
    this.configs = [];
  }

  /**
   * Load configurations from disk
   */
  async load() {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf8');
      this.configs = JSON.parse(data);
      console.log(`[ConfigStore] Loaded ${this.configs.length} saved configurations`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[ConfigStore] No saved configurations found, starting fresh');
        this.configs = [];
      } else {
        console.error('[ConfigStore] Error loading configurations:', error);
        this.configs = [];
      }
    }
  }

  /**
   * Save configurations to disk
   */
  async save() {
    try {
      const data = JSON.stringify(this.configs, null, 2);
      await fs.writeFile(CONFIG_FILE, data, 'utf8');
      console.log(`[ConfigStore] Saved ${this.configs.length} configurations`);
    } catch (error) {
      console.error('[ConfigStore] Error saving configurations:', error);
      throw error;
    }
  }

  /**
   * Get all saved configurations
   */
  getAll() {
    return this.configs;
  }

  /**
   * Get a configuration by ID
   */
  get(configId) {
    return this.configs.find(c => c.id === configId);
  }

  /**
   * Add or update a configuration
   */
  async set(config) {
    // Ensure config has an ID
    if (!config.id) {
      config.id = this.generateId();
    }

    // Add timestamp
    config.savedAt = new Date().toISOString();

    // Update or add
    const index = this.configs.findIndex(c => c.id === config.id);
    if (index >= 0) {
      this.configs[index] = config;
    } else {
      this.configs.push(config);
    }

    await this.save();
    return config;
  }

  /**
   * Delete a configuration
   */
  async delete(configId) {
    const index = this.configs.findIndex(c => c.id === configId);
    if (index >= 0) {
      this.configs.splice(index, 1);
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * Generate a unique ID
   */
  generateId() {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
module.exports = new ConfigStore();
