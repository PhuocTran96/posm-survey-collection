class ProgressDashboard {
  constructor() {
    this.user = null;
    this.refreshInterval = null;
    this.init();
  }

  async init() {
    // Check authentication first
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      return; // User will be redirected to login
    }

    this.bindEvents();
    this.loadAllData();
    this.startAutoRefresh();
    this.initNavigation();
  }

  async checkAuthentication() {
    const token = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');

    if (!token || !user) {
      this.redirectToAdminLogin('No access token or user data found');
      return false;
    }

    try {
      const userData = JSON.parse(user);
      console.log('Progress Dashboard: Checking auth for user:', userData.username, userData.role);

      // Check if user is admin
      if (userData.role !== 'admin') {
        alert('Access denied: Admin privileges required');
        localStorage.clear();
        window.location.replace('/login.html');
        return false;
      }

      // Verify token is still valid
      const response = await fetch('/api/auth/verify', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        this.user = userData;
        return true;
      } else {
        // Token invalid, clear storage
        localStorage.clear();
        this.redirectToAdminLogin('Session expired or invalid');
        return false;
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      localStorage.clear();
      this.redirectToAdminLogin('Session expired or invalid');
      return false;
    }
  }

  redirectToAdminLogin(reason) {
    console.log('Redirecting to admin login:', reason);
    if (!window.location.pathname.includes('admin-login.html')) {
      window.location.replace('/admin-login.html');
    }
  }

  initNavigation() {
    // Mobile navigation toggle
    const navToggle = document.getElementById('navMobileToggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
      navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
      });
    }
  }

  bindEvents() {
    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => this.loadAllData());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        this.loadAllData();
      }
    });
  }

  startAutoRefresh() {
    // Auto refresh every 5 minutes
    this.refreshInterval = setInterval(
      () => {
        this.loadAllData(true); // Silent refresh
      },
      5 * 60 * 1000
    );
  }

  async loadAllData(silent = false) {
    if (!silent) {
      this.showLoading();
    }

    try {
      // Load all data in parallel for better performance
      const [overview, stores, models, posms] = await Promise.all([
        this.loadOverviewData(),
        this.loadStoreProgress(),
        this.loadModelProgress(),
        this.loadPOSMProgress(),
      ]);

      // Render all sections
      if (overview) this.renderOverviewStats(overview);
      if (stores) this.renderStoreProgress(stores);
      if (models) this.renderModelProgress(models);
      if (posms) this.renderPOSMProgress(posms);
      
      // Mount React POSM Matrix component
      this.mountPOSMMatrix();

      if (!silent) {
        this.showNotification('✅ Data has been updated', 'success');
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (!silent) {
        this.showNotification('❌ Error loading data: ' + error.message, 'error');
      }
    } finally {
      if (!silent) {
        this.hideLoading();
      }
    }
  }

  async makeAuthenticatedRequest(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      this.redirectToAdminLogin('No access token');
      return null;
    }

    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    try {
      const response = await fetch(url, authOptions);

      // If unauthorized, clear tokens and redirect
      if (response.status === 401) {
        localStorage.clear();
        this.redirectToAdminLogin('Session expired');
        return null;
      }

      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async loadOverviewData() {
    try {
      const response = await this.makeAuthenticatedRequest('/api/progress/overview');
      if (response && response.ok) {
        const result = await response.json();
        return result.data.overview;
      }
    } catch (error) {
      console.error('Error loading overview data:', error);
      return null;
    }
  }

  async loadStoreProgress() {
    try {
      const response = await this.makeAuthenticatedRequest('/api/progress/stores?limit=10');
      if (response && response.ok) {
        const result = await response.json();
        return result.data;
      }
    } catch (error) {
      console.error('Error loading store progress:', error);
      return null;
    }
  }

  async loadModelProgress() {
    try {
      const response = await this.makeAuthenticatedRequest('/api/progress/models');
      if (response && response.ok) {
        const result = await response.json();
        return result.data;
      }
    } catch (error) {
      console.error('Error loading model progress:', error);
      return null;
    }
  }

  async loadPOSMProgress() {
    try {
      const response = await this.makeAuthenticatedRequest('/api/progress/posm-types');
      if (response && response.ok) {
        const result = await response.json();
        return result.data;
      }
    } catch (error) {
      console.error('Error loading POSM progress:', error);
      return null;
    }
  }


  renderOverviewStats(data) {
    const container = document.getElementById('overviewStats');
    if (!container || !data) {
      // Render mock data for demonstration
      const mockData = {
        totalStores: 30,
        storesWithPOSM: 22,
        totalModels: 8,
        totalPOSM: 50,
        overallCompletion: 73,
      };

      container.innerHTML = `
        <div class="stat-card">
          <div class="stat-number">${mockData.totalStores}</div>
          <div class="stat-label">Total stores</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-number">${mockData.storesWithPOSM}</div>
          <div class="stat-label">Stores with complet POSM</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-number">${mockData.totalModels}</div>
          <div class="stat-label">Total models</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-number">${mockData.totalPOSM}</div>
          <div class="stat-label">Total POSM</div>
        </div>
        
        <div class="stat-card completion-card">
          <div class="circular-progress" style="--progress: ${mockData.overallCompletion * 3.6}deg;">
            <div class="percentage">${mockData.overallCompletion}%</div>
          </div>
          <div class="stat-label">Overall completion</div>
        </div>
      `;
      return;
    }

    const overallCompletion = data.overallCompletion || 0;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${data.totalStores || 0}</div>
        <div class="stat-label">Total stores</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-number">${data.storesWithCompletPOSM || 0}</div>
        <div class="stat-label">Stores with complet POSM</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-number">${data.totalModels || 0}</div>
        <div class="stat-label">Total models</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-number">${data.totalPOSM || 0}</div>
        <div class="stat-label">Total POSM</div>
      </div>
      
      <div class="stat-card completion-card">
        <div class="circular-progress" style="--progress: ${overallCompletion * 3.6}deg;">
          <div class="percentage">${overallCompletion}%</div>
        </div>
        <div class="stat-label">Overall completion</div>
      </div>
    `;
  }

  renderStoreProgress(stores) {
    const container = document.getElementById('storeProgressContent');
    if (!container) return;

    if (!stores || stores.length === 0) {
      // Render mock data for demonstration
      const mockStores = [
        { name: 'Store A', status: 'Complete', models: 5, posm: 20, completion: 100 },
        { name: 'Store B', status: 'Partially complete', models: 3, posm: 12, completion: 60 },
        { name: 'Store C', status: 'Not deployed', models: 4, posm: 16, completion: 0 },
      ];

      const html = mockStores
        .map(
          (store) => `
        <tr>
          <td><strong>${store.name}</strong></td>
          <td>
            <span class="status-badge ${this.getStatusClassNew(store.status)}">${store.status}</span>
          </td>
          <td>${store.models}</td>
          <td>${store.posm}</td>
          <td><strong>${store.completion}%</strong></td>
        </tr>
      `
        )
        .join('');

      container.innerHTML = html;
      return;
    }

    const html = stores
      .map((store) => {
        const statusClass = this.getStatusClass(store.status);
        const statusText = this.getStatusText(store.status);

        return `
        <tr>
          <td><strong>${this.escapeHtml(store.storeName)}</strong></td>
          <td>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </td>
          <td>${store.modelCount || store.models?.length || 0}</td>
          <td>${store.totalRequiredPOSMs || store.totalDisplays || 0}</td>
          <td><strong>${store.completionRate}%</strong></td>
        </tr>
      `;
      })
      .join('');

    container.innerHTML = html;
  }

  renderModelProgress(models) {
    const container = document.getElementById('modelProgressContent');
    if (!container) return;

    if (!models || models.length === 0) {
      // Render mock data for demonstration
      const mockModels = [
        { name: 'Model A', stores: 20, completedStores: 20, completion: 100 },
        { name: 'Model B', stores: 15, completedStores: 12, completion: 80 },
        { name: 'Model C', stores: 10, completedStores: 5, completion: 50 },
        { name: 'Model D', stores: 5, completedStores: 0, completion: 0 },
      ];

      const html = mockModels
        .map(
          (model) => `
        <tr>
          <td><strong>${model.name}</strong></td>
          <td>${model.stores}</td>
          <td>${model.completedStores}</td>
          <td><strong>${model.completion}%</strong></td>
        </tr>
      `
        )
        .join('');

      container.innerHTML = html;
      return;
    }

    const html = models
      .map((model) => {
        const completionRate = parseFloat(model.completionRate || 0);

        return `
        <tr>
          <td><strong>${this.escapeHtml(model.model)}</strong></td>
          <td>${model.storeCount || 0}</td>
          <td>${model.completedStores || 0}</td>
          <td><strong>${Math.round(completionRate)}%</strong></td>
        </tr>
      `;
      })
      .join('');

    container.innerHTML = html;
  }

  renderPOSMProgress(posms) {
    const container = document.getElementById('posmProgressContent');
    if (!container) return;

    if (!posms || posms.length === 0) {
      container.innerHTML =
        '<tr><td colspan="4" style="text-align: center; color: #64748b;">No POSM data available</td></tr>';
      return;
    }

    const html = posms
      .map(
        (posm) => `
      <tr>
        <td><strong>${this.escapeHtml(posm.type)}</strong></td>
        <td>${posm.requiredStores || 0}</td>
        <td>${posm.completedStores || 0}</td>
        <td><strong>${posm.completion || 0}%</strong></td>
      </tr>
    `
      )
      .join('');

    container.innerHTML = html;
  }

  mountPOSMMatrix() {
    const container = document.getElementById('posm-matrix-container');
    if (!container) {
      console.warn('POSM Matrix container not found');
      return;
    }

    // Check if React and the POSM Matrix component are available
    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
      console.error('React or ReactDOM not loaded');
      container.innerHTML = `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div class="flex">
            <div class="text-yellow-400">⚠️</div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800">React Libraries Missing</h3>
              <div class="mt-2 text-sm text-yellow-700">Please ensure React and ReactDOM are loaded.</div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (typeof POSMMatrix === 'undefined' || !POSMMatrix.default) {
      console.error('POSM Matrix component not loaded');
      container.innerHTML = `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div class="flex">
            <div class="text-yellow-400">⚠️</div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800">POSM Matrix Component Missing</h3>
              <div class="mt-2 text-sm text-yellow-700">The POSM Matrix bundle failed to load.</div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    try {
      // Clear container first
      container.innerHTML = '';
      
      // Mount the React component
      const root = ReactDOM.createRoot ? ReactDOM.createRoot(container) : null;
      if (root) {
        // React 18+ createRoot API
        root.render(React.createElement(POSMMatrix.default));
      } else {
        // React 17 render API fallback
        ReactDOM.render(React.createElement(POSMMatrix.default), container);
      }
      
      console.log('POSM Matrix component mounted successfully');
    } catch (error) {
      console.error('Error mounting POSM Matrix component:', error);
      container.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex">
            <div class="text-red-400">⚠️</div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">Component Mount Error</h3>
              <div class="mt-2 text-sm text-red-700">Failed to mount POSM Matrix: ${error.message}</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  getStatusClass(status) {
    switch (status) {
      case 'complete':
        return 'status-complete';
      case 'partial':
        return 'status-partial';
      case 'not_verified':
        return 'status-not-verified';
      case 'no_displays':
        return 'status-no-displays';
      default:
        return 'status-no-displays';
    }
  }

  getStatusText(status) {
    switch (status) {
      case 'complete':
        return 'Complete';
      case 'partial':
        return 'Partially complete';
      case 'not_verified':
        return 'Not verified';
      case 'no_displays':
        return 'No displays';
      default:
        return 'Unknown';
    }
  }

  getStatusClassNew(status) {
    switch (status) {
      case 'Complete':
        return 'status-complete';
      case 'Partially complete':
        return 'status-partial';
      case 'Not deployed':
        return 'status-not-verified';
      default:
        return 'status-no-displays';
    }
  }

  getCompletionCircleClass(rate) {
    if (rate >= 80) return 'completion-high';
    if (rate >= 50) return 'completion-medium';
    return 'completion-low';
  }

  showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }
  }

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach((n) => n.remove());

    const typeStyles = {
      success: 'background: #d4edda; border-color: #c3e6cb; color: #155724;',
      error: 'background: #f8d7da; border-color: #f5c6cb; color: #721c24;',
      warning: 'background: #fff3cd; border-color: #ffeaa7; color: #856404;',
      info: 'background: #d1ecf1; border-color: #bee5eb; color: #0c5460;',
    };

    const notificationHtml = `
      <div class="notification" style="
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        padding: 15px 20px;
        border: 1px solid;
        border-radius: 4px;
        max-width: 400px;
        white-space: pre-line;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        ${typeStyles[type]}
      ">
        <button onclick="this.parentElement.remove()" style="
          position: absolute;
          top: 5px;
          right: 10px;
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: inherit;
        ">×</button>
        <div style="margin-right: 20px;">${message}</div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', notificationHtml);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        const notification = document.querySelector('.notification');
        if (notification) {
          notification.remove();
        }
      }, duration);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    // Cleanup when component is destroyed
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// Global instance
let progressDashboard;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  progressDashboard = new ProgressDashboard();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (progressDashboard) {
    progressDashboard.destroy();
  }
});
