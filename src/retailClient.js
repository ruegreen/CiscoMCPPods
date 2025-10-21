import { config } from './config.js';

/**
 * Retail API Client for Cisco API Gateway
 * Handles all retail customer CRUD operations
 */
class RetailClient {
  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.authMode = config.authMode;
    this.apiKey = config.apiKeyRetail;
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
   * Get customer by phone number or order ID
   * @param {string} number - Phone number or order ID
   */
  async getCustomer(number) {
    const encodedNumber = encodeURIComponent(number);
    const url = `${this.baseUrl}/api/v2/retail?number=${encodedNumber}`;
    return this.makeRequest(url, { method: 'GET' });
  }

  /**
   * Get all customers with pagination
   * @param {number} limit - Number of records to return (default: 100)
   * @param {number} skip - Number of records to skip (default: 0)
   */
  async getAllCustomers(limit = 100, skip = 0) {
    const url = `${this.baseUrl}/api/v2/retail/all?limit=${limit}&skip=${skip}`;
    return this.makeRequest(url, { method: 'GET' });
  }

  /**
   * Create new retail customer
   * @param {Object} customerData - Customer information
   */
  async createCustomer(customerData) {
    const url = `${this.baseUrl}/api/v2/retail`;
    return this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  }

  /**
   * Update existing customer
   * @param {string} number - Phone number or order ID
   * @param {Object} updates - Fields to update
   */
  async updateCustomer(number, updates) {
    const encodedNumber = encodeURIComponent(number);
    const url = `${this.baseUrl}/api/v2/retail?number=${encodedNumber}`;
    return this.makeRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete customer
   * @param {string} number - Phone number or order ID
   */
  async deleteCustomer(number) {
    const encodedNumber = encodeURIComponent(number);
    const url = `${this.baseUrl}/api/v2/retail?number=${encodedNumber}`;
    return this.makeRequest(url, { method: 'DELETE' });
  }
}

// Export singleton instance
export const retailClient = new RetailClient();
