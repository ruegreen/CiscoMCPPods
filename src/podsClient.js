import { config } from './config.js';

/**
 * Pods API Client for Cisco API Gateway
 * Handles all pod management CRUD operations
 */
class PodsClient {
  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.authMode = config.authMode;
    this.apiKey = config.apiKeyPods;
    this.jwtToken = config.jwtToken;
  }

  /**
   * Get authentication headers based on configured auth mode
   */
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.authMode === 'apikey' && this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    } else if (this.authMode === 'jwt' && this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
    }

    return headers;
  }

  /**
   * Make API request with error handling
   */
  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `API request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  /**
   * Get pod keyword record
   */
  async getPodKeyword() {
    const url = `${this.baseUrl}/api/v2/pods/keyword`;
    return this.makeRequest(url, { method: 'GET' });
  }

  /**
   * Update pod keyword record
   * @param {string} keyword - New keyword/password value
   */
  async updatePodKeyword(keyword) {
    const url = `${this.baseUrl}/api/v2/pods/keyword`;
    return this.makeRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ keyword }),
    });
  }

  /**
   * Get all pods from a collection
   * @param {string} collection - Collection name (e.g., 'ciscolivepods', 'coelabpods')
   */
  async getAllPods(collection) {
    const url = `${this.baseUrl}/api/v2/pods/${collection}`;
    return this.makeRequest(url, { method: 'GET' });
  }

  /**
   * Get specific pod by number from a collection
   * @param {string} collection - Collection name
   * @param {number} number - Pod number
   */
  async getPodByNumber(collection, number) {
    const url = `${this.baseUrl}/api/v2/pods/${collection}/${number}`;
    return this.makeRequest(url, { method: 'GET' });
  }

  /**
   * Create new pod in a collection
   * @param {string} collection - Collection name
   * @param {Object} podData - Pod information
   */
  async createPod(collection, podData) {
    const url = `${this.baseUrl}/api/v2/pods/${collection}`;
    return this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(podData),
    });
  }

  /**
   * Update existing pod in a collection
   * @param {string} collection - Collection name
   * @param {number} number - Pod number
   * @param {Object} updates - Fields to update
   */
  async updatePod(collection, number, updates) {
    const url = `${this.baseUrl}/api/v2/pods/${collection}/${number}`;
    return this.makeRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete pod from a collection
   * @param {string} collection - Collection name
   * @param {number} number - Pod number
   */
  async deletePod(collection, number) {
    const url = `${this.baseUrl}/api/v2/pods/${collection}/${number}`;
    return this.makeRequest(url, { method: 'DELETE' });
  }
}

// Export singleton instance
export const podsClient = new PodsClient();
