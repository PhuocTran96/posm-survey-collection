class DataUploadApp {
  constructor() {
    this.init();
  }

  init() {
    this.checkAuthentication();
    this.initNavigation();
    this.initUploadFunctionality();
  }

  // Authentication methods
  checkAuthentication() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('⚠️ No access token found. Redirecting to admin login...');
      window.location.href = '/admin-login.html';
      return false;
    }
    return true;
  }

  clearAuthData() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  // Token refresh method
  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      console.log('No refresh token available');
      return false;
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Update tokens in localStorage
          localStorage.setItem('accessToken', result.data.accessToken);
          localStorage.setItem('refreshToken', result.data.refreshToken);
          localStorage.setItem('user', JSON.stringify(result.data.user));
          console.log('Token refreshed successfully');
          return true;
        }
      }

      console.log('Token refresh failed:', response.status);
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  // Authenticated fetch with token refresh
  async authenticatedFetch(url, options = {}, retryCount = 0) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('🚫 No access token found in localStorage');
      window.location.href = '/admin-login.html';
      return null;
    }

    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    };

    // Only set Content-Type to application/json if not uploading files
    if (!(options.body instanceof FormData) && !authOptions.headers['Content-Type']) {
      authOptions.headers['Content-Type'] = 'application/json';
    }

    console.log(`🌐 Making authenticated request to: ${url}`);

    try {
      const response = await fetch(url, authOptions);

      console.log(`📡 Response status: ${response.status} ${response.statusText}`);

      // If unauthorized, try to refresh token once
      if (response.status === 401 && retryCount === 0) {
        console.log('🔄 Token expired (401), attempting refresh...');

        const refreshSuccess = await this.refreshToken();
        if (refreshSuccess) {
          console.log('✅ Token refreshed, retrying request...');
          // Retry the original request with new token
          return await this.authenticatedFetch(url, options, 1);
        } else {
          console.error('❌ Token refresh failed, redirecting to login');
          // Refresh failed, redirect to login
          this.clearAuthData();
          window.location.href = '/admin-login.html';
          return null;
        }
      } else if (response.status === 401) {
        console.error('❌ Authentication failed after retry, redirecting to login');
        // Already retried once, redirect to login
        this.clearAuthData();
        window.location.href = '/admin-login.html';
        return null;
      }

      return response;
    } catch (error) {
      console.error('❌ API call failed:', error);
      throw error;
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

  initUploadFunctionality() {
    this.initUploadTabs();
    this.initFileUpload('stores');
    this.initFileUpload('posm');
    this.bindUploadEvents();
    this.loadUploadStats();
  }

  initUploadTabs() {
    const tabs = document.querySelectorAll('.upload-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchUploadTab(tabName);
      });
    });
  }

  switchUploadTab(tabName) {
    // Remove active class from all tabs and panels
    document.querySelectorAll('.upload-tab').forEach((tab) => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.upload-panel').forEach((panel) => {
      panel.classList.remove('active');
    });

    // Add active class to selected tab and panel
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Panel`).classList.add('active');

    // Load stats when switching to stats tab
    if (tabName === 'stats') {
      this.loadUploadStats();
    }
  }

  initFileUpload(type) {
    const dropZone = document.getElementById(`${type}DropZone`);
    const fileInput = document.getElementById(`${type}FileInput`);
    const browseLink = dropZone.querySelector('.file-browse-link');
    const selectedFileDiv = document.getElementById(`${type}SelectedFile`);
    const uploadBtn = document.querySelector(`#${type}UploadForm .upload-btn`);

    // Click to browse files
    browseLink.addEventListener('click', () => {
      fileInput.click();
    });

    dropZone.addEventListener('click', (e) => {
      if (e.target === dropZone || e.target.closest('.file-drop-content')) {
        fileInput.click();
      }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFileSelection(type, file);
      }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('dragover');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');

      const file = e.dataTransfer.files[0];
      if (file && file.type === 'text/csv') {
        fileInput.files = e.dataTransfer.files;
        this.handleFileSelection(type, file);
      } else {
        alert('Vui lòng chọn file CSV');
      }
    });

    // Remove file button
    const removeBtn = selectedFileDiv.querySelector('.file-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        this.removeSelectedFile(type);
      });
    }
  }

  handleFileSelection(type, file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Vui lòng chọn file CSV');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      alert('File quá lớn. Vui lòng chọn file nhỏ hơn 10MB.');
      return;
    }

    const dropZone = document.getElementById(`${type}DropZone`);
    const selectedFileDiv = document.getElementById(`${type}SelectedFile`);
    const uploadBtn = document.querySelector(`#${type}UploadForm .upload-btn`);

    // Hide drop zone and show selected file
    dropZone.style.display = 'none';
    selectedFileDiv.style.display = 'flex';
    selectedFileDiv.querySelector('.file-name').textContent = file.name;

    // Enable upload button
    uploadBtn.disabled = false;
  }

  removeSelectedFile(type) {
    const dropZone = document.getElementById(`${type}DropZone`);
    const selectedFileDiv = document.getElementById(`${type}SelectedFile`);
    const fileInput = document.getElementById(`${type}FileInput`);
    const uploadBtn = document.querySelector(`#${type}UploadForm .upload-btn`);

    // Clear file input
    fileInput.value = '';

    // Show drop zone and hide selected file
    dropZone.style.display = 'block';
    selectedFileDiv.style.display = 'none';

    // Disable upload button
    uploadBtn.disabled = true;

    // Clear any previous results
    const resultDiv = document.getElementById(`${type}Result`);
    if (resultDiv) {
      resultDiv.style.display = 'none';
    }
  }

  bindUploadEvents() {
    // Stores upload form
    const storesForm = document.getElementById('storesUploadForm');
    storesForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUpload('stores');
    });

    // POSM upload form
    const posmForm = document.getElementById('posmUploadForm');
    posmForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUpload('posm');
    });

    // Refresh stats button
    const refreshBtn = document.getElementById('refreshStats');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadUploadStats();
      });
    }
  }

  async handleUpload(type) {
    const form = document.getElementById(`${type}UploadForm`);
    const fileInput = document.getElementById(`${type}FileInput`);
    const uploadBtn = form.querySelector('.upload-btn');
    const resultDiv = document.getElementById(`${type}Result`);

    // Check if we have an access token
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('❌ No access token found in localStorage');
      this.showUploadResult(type, 'error', {
        message: 'Không tìm thấy thông tin đăng nhập. Vui lòng đăng nhập lại từ trang Admin Login.',
      });
      window.location.href = '/admin-login.html';
      return;
    }

    if (!fileInput.files[0]) {
      alert('Vui lòng chọn file CSV');
      return;
    }

    const formData = new FormData();
    formData.append('csvFile', fileInput.files[0]);

    // Add options
    const clearExisting = form.querySelector('[name="clearExisting"]').checked;
    const skipDuplicates = form.querySelector('[name="skipDuplicates"]').checked;
    formData.append('clearExisting', clearExisting);
    formData.append('skipDuplicates', skipDuplicates);

    if (type === 'posm') {
      const updateMode = form.querySelector('[name="updateMode"]').value;
      formData.append('updateMode', updateMode);
    }

    try {
      // Show loading state
      uploadBtn.classList.add('loading');
      uploadBtn.disabled = true;
      resultDiv.style.display = 'none';

      console.log(`📤 Starting ${type} upload...`);

      // Debug: Check token status before upload
      const currentToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      console.log(
        `🔑 Token status - Access: ${currentToken ? 'Present' : 'Missing'}, Refresh: ${refreshToken ? 'Present' : 'Missing'}`
      );

      const response = await this.authenticatedFetch(`/api/data-upload/${type}`, {
        method: 'POST',
        body: formData,
      });

      // Check if authentication failed (response is null)
      if (!response) {
        this.showUploadResult(type, 'error', {
          message: 'Xác thực không thành công. Vui lòng thử đăng nhập lại.',
        });
        return;
      }

      // Check for HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // Use the raw text if it's not JSON
          if (errorText) {
            errorMessage = errorText;
          }
        }

        this.showUploadResult(type, 'error', {
          message: errorMessage,
        });
        return;
      }

      const result = await response.json();

      if (result.success) {
        this.showUploadResult(type, 'success', result);
        // Refresh stats after successful upload
        this.loadUploadStats();
      } else {
        this.showUploadResult(type, 'error', result);
      }
    } catch (error) {
      console.error(`❌ ${type} upload failed:`, error);
      this.showUploadResult(type, 'error', {
        message: 'Lỗi kết nối mạng hoặc server: ' + error.message,
      });
    } finally {
      // Hide loading state
      uploadBtn.classList.remove('loading');
      uploadBtn.disabled = false;
    }
  }

  showUploadResult(type, status, result) {
    const resultDiv = document.getElementById(`${type}Result`);
    resultDiv.className = `upload-result ${status}`;
    resultDiv.style.display = 'block';

    let html = '';
    if (status === 'success') {
      const stats = result.stats;
      html = `
                <div><strong>✅ Upload thành công!</strong></div>
                <div class="result-stats">
                    ${stats.uploaded ? `<div>🎆 Bản ghi mới: <strong>${stats.uploaded}</strong></div>` : ''}
                    ${stats.updated ? `<div>🔄 Bản ghi cập nhật: <strong>${stats.updated}</strong></div>` : ''}
                    ${stats.errors ? `<div>⚠️ Lỗi/Trùng lặp: <strong>${stats.errors}</strong></div>` : ''}
                    <div>📊 Tổng trong database: <strong>${stats.totalInDatabase}</strong></div>
                    ${stats.uniqueModels ? `<div>📋 Model duy nhất: <strong>${stats.uniqueModels}</strong></div>` : ''}
                    ${stats.uniqueLeaders ? `<div>👥 Leader duy nhất: <strong>${stats.uniqueLeaders}</strong></div>` : ''}
                </div>
            `;

      if (stats.parseErrors && stats.parseErrors.length > 0) {
        html += `
                    <div class="result-errors">
                        <strong>Cảnh báo khi đọc file:</strong>
                        ${stats.parseErrors.map((error) => `<div>• ${error}</div>`).join('')}
                    </div>
                `;
      }
    } else {
      html = `
                <div><strong>❌ Lỗi upload!</strong></div>
                <div>${result.message}</div>
            `;

      if (result.errors && result.errors.length > 0) {
        html += `
                    <div class="result-errors">
                        <strong>Chi tiết lỗi:</strong>
                        ${result.errors.map((error) => `<div>• ${error}</div>`).join('')}
                    </div>
                `;
      }
    }

    resultDiv.innerHTML = html;

    // Auto-scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async loadUploadStats() {
    try {
      const response = await this.authenticatedFetch('/api/data-upload/stats');

      if (!response) {
        console.error('Failed to load upload stats: Authentication failed');
        return;
      }

      const result = await response.json();

      if (result.success) {
        this.renderUploadStats(result.stats);
      } else {
        console.error('Failed to load upload stats:', result.message);
      }
    } catch (error) {
      console.error('Error loading upload stats:', error);
    }
  }

  renderUploadStats(stats) {
    const statsContainer = document.getElementById('uploadStats');
    if (!statsContainer) {
      return;
    }

    const html = `
            <div class="upload-stats">
                <div class="stats-card">
                    <div class="stats-number">${stats.stores.total}</div>
                    <div class="stats-label">Tổng Stores</div>
                    <div class="stats-sublabel">${stats.stores.uniqueLeaders} Leader</div>
                </div>
                <div class="stats-card">
                    <div class="stats-number">${stats.posm.total}</div>
                    <div class="stats-label">Tổng POSM</div>
                    <div class="stats-sublabel">${stats.posm.uniqueModels} Model</div>
                </div>
            </div>
        `;

    statsContainer.innerHTML = html;
  }

  // Loading overlay methods
  showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.add('show');
    }
  }

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.remove('show');
    }
  }
}

// Global instance of DataUploadApp
let dataUploadApp;

// Initialize the data upload app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  dataUploadApp = new DataUploadApp();
});
