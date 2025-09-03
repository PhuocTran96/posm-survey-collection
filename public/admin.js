class AdminApp {
  constructor() {
    this.responses = [];
    this.filteredResponses = [];
    this.deleteID = null;
    this.selectedIds = new Set();
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.totalPages = 1;
    this.totalCount = 0;
    this.pagination = null;
    this.user = null;
    this.init();
  }

  async init() {
    // Check authentication first
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      return; // User will be redirected to login
    }

    this.bindEvents();
    this.loadResponses();
    this.initUploadFunctionality();
    this.setupAuthUI();
  }

  async checkAuthentication() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      this.redirectToAdminLogin('No access token found');
      return false;
    }

    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        this.user = result.data.user;

        // Check if user is admin
        if (this.user.role !== 'admin') {
          alert('Access denied: Admin privileges required');
          this.clearAuthData();
          window.location.replace('/login.html');
          return false;
        }

        return true;
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Authentication failed' }));
        console.log('Auth verification failed:', errorData.message);
        this.clearAuthData();
        this.redirectToAdminLogin('Session expired or invalid');
        return false;
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      this.clearAuthData();
      this.redirectToAdminLogin('Network error during authentication');
      return false;
    }
  }

  clearAuthData() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  redirectToAdminLogin(reason) {
    console.log('Redirecting to admin login:', reason);
    // Prevent redirect loops by checking current location
    if (!window.location.pathname.includes('admin-login.html')) {
      window.location.replace('/admin-login.html');
    }
  }

  setupAuthUI() {
    // Add user info to the admin header
    const adminHeader = document.querySelector('.admin-header');
    if (adminHeader) {
      const userInfo = document.createElement('div');
      userInfo.className = 'admin-user-info';
      userInfo.innerHTML = `
                <div class="admin-user-details">
                    <span class="admin-user-name">${this.user.username}</span>
                    <span class="admin-user-role">ADMIN</span>
                </div>
                <div class="admin-buttons">
                    <a href="/change-password.html" class="admin-change-password-btn">🔐 Đổi mật khẩu</a>
                    <button onclick="adminApp.logout()" class="admin-logout-btn">Đăng xuất</button>
                </div>
            `;

      adminHeader.appendChild(userInfo);
    }
  }

  async logout() {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and redirect
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/admin-login.html';
    }
  }

  // Helper method for authenticated API calls with token refresh
  async authenticatedFetch(url, options = {}, retryCount = 0) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('🚫 No access token found in localStorage');
      this.redirectToAdminLogin('No access token');
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
          this.redirectToAdminLogin('Session expired, please login again');
          return null;
        }
      } else if (response.status === 401) {
        console.error('❌ Authentication failed after retry, redirecting to login');
        // Already retried once, redirect to login
        this.clearAuthData();
        this.redirectToAdminLogin('Authentication failed');
        return null;
      }

      return response;
    } catch (error) {
      console.error('❌ API call failed:', error);
      throw error;
    }
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

  bindEvents() {
    // ESC key to close modals
    document.addEventListener('keydown', (e) => this.handleEscapeKey(e));

    const exportDataBtn = document.getElementById('exportData');
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', () => this.exportData());
    }

    // Handle leader filter change
    const leaderFilter = document.getElementById('leaderFilter');
    if (leaderFilter) {
      leaderFilter.addEventListener('change', () => {
        // Clear shop selection when leader changes
        const shopFilter = document.getElementById('shopFilter');
        if (shopFilter) {
          shopFilter.value = '';
        }
        // Reset to page 1 and reload with filters
        this.currentPage = 1;
        this.loadResponses(1);
      });
    }

    // Handle other filter changes
    const shopFilter = document.getElementById('shopFilter');
    if (shopFilter) {
      shopFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.loadResponses(1);
      });
    }

    const dateFromFilter = document.getElementById('dateFromFilter');
    if (dateFromFilter) {
      dateFromFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.loadResponses(1);
      });
    }

    const dateToFilter = document.getElementById('dateToFilter');
    if (dateToFilter) {
      dateToFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.loadResponses(1);
      });
    }

    // Handle delete confirmation
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => this.confirmDelete());
    }

    const btnCancelDelete = document.getElementById('btnCancelDelete');
    if (btnCancelDelete) {
      btnCancelDelete.addEventListener('click', () => this.cancelDelete());
    }

    // Bulk delete button
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', () => this.handleBulkDelete());
    }

    // Select All button
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => this.handleSelectAll());
    }

    // Page size selector
    const pageSizeSelector = document.getElementById('pageSizeSelector');
    if (pageSizeSelector) {
      pageSizeSelector.addEventListener('change', (e) => {
        this.itemsPerPage = parseInt(e.target.value);
        this.currentPage = 1;
        this.loadResponses(1);
      });
    }
  }

  // Add loading overlay methods
  async deleteResponse(id, shopName, leader) {
    this.deleteID = id;
    const confirmDialog = document.querySelector('#confirmDeleteDialog p');
    if (confirmDialog) {
      confirmDialog.textContent = `Bạn có chắc chắn muốn xóa khảo sát của shop "${shopName}" do leader "${leader}" thực hiện không?`;
    }
    const dialog = document.getElementById('confirmDeleteDialog');
    if (dialog) {
      dialog.style.display = 'flex';
    }
  }

  // Confirm delete action
  async confirmDelete() {
    if (!this.deleteID) {
      return;
    }

    try {
      this.showLoading();
      const response = await this.authenticatedFetch(`/api/responses/${this.deleteID}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        alert('Xóa khảo sát thành công.');
        await this.loadResponses();
      } else {
        alert('Lỗi khi xóa khảo sát: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting response:', error);
      alert('Lỗi khi xóa khảo sát: ' + error.message);
    } finally {
      this.hideLoading();
      this.cancelDelete();
    }
  }

  // Handle ESC key to close modals
  handleEscapeKey(event) {
    if (event.key === 'Escape') {
      // Check which modal is currently open and close it
      const confirmDeleteDialog = document.getElementById('confirmDeleteDialog');

      if (confirmDeleteDialog && confirmDeleteDialog.style.display === 'flex') {
        this.cancelDelete();
      }
    }
  }

  cancelDelete() {
    this.deleteID = null;
    const dialog = document.getElementById('confirmDeleteDialog');
    if (dialog) {
      dialog.style.display = 'none';
    }
  }

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

  async loadResponses(page = 1) {
    try {
      this.showLoading();

      // Build query parameters for pagination and filters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: this.itemsPerPage.toString(),
      });

      // Add filter parameters
      const leaderFilter = document.getElementById('leaderFilter');
      const shopFilter = document.getElementById('shopFilter');
      const dateFromFilter = document.getElementById('dateFromFilter');
      const dateToFilter = document.getElementById('dateToFilter');

      if (leaderFilter && leaderFilter.value) {
        params.append('leader', leaderFilter.value);
      }
      if (shopFilter && shopFilter.value) {
        params.append('shopName', shopFilter.value);
      }
      if (dateFromFilter && dateFromFilter.value) {
        params.append('dateFrom', dateFromFilter.value);
      }
      if (dateToFilter && dateToFilter.value) {
        params.append('dateTo', dateToFilter.value);
      }

      const response = await this.authenticatedFetch(`/api/responses?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();

      // Handle new paginated response format
      if (responseData.data && responseData.pagination) {
        this.responses = responseData.data;
        this.filteredResponses = [...this.responses];
        this.pagination = responseData.pagination;
        this.currentPage = responseData.pagination.currentPage;
        this.totalPages = responseData.pagination.totalPages;
        this.totalCount = responseData.pagination.totalCount;

        // Load all responses for filters (only on initial load or filter changes)
        if (page === 1) {
          await this.loadAllResponsesForFilters();
        }

        this.renderStats();
        this.renderResponses();
        this.renderPagination();
      } else if (Array.isArray(responseData)) {
        // Fallback for old response format
        this.responses = responseData;
        this.filteredResponses = [...this.responses];

        this.populateFilters();
        this.renderStats();
        this.renderResponses();
      } else if (responseData.success === false) {
        throw new Error(responseData.message || 'Server returned an error');
      } else {
        throw new Error('Unexpected response format from server');
      }
    } catch (error) {
      console.error('Error loading responses:', error);
      alert('Lỗi khi tải dữ liệu: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async loadAllResponsesForFilters() {
    try {
      // Load all responses without pagination for filter population
      const response = await this.authenticatedFetch('/api/responses?limit=10000');
      if (response.ok) {
        const data = await response.json();
        const allResponses = data.data || data;
        this.populateFilters(allResponses);
      }
    } catch (error) {
      console.error('Error loading responses for filters:', error);
      // Use current page responses as fallback
      this.populateFilters(this.responses);
    }
  }

  populateFilters(responses = null) {
    const responsesToUse = responses || this.responses;
    const leaderFilter = document.getElementById('leaderFilter');
    const leaderSelect = document.getElementById('leaderFilter');

    if (!leaderSelect) {
      return;
    }

    const currentSelectedLeader = leaderSelect.value; // Store current selection

    // Populate leader filter
    const leaders = [...new Set(responsesToUse.map((r) => r.leader))];
    leaderSelect.innerHTML = '<option value="">Tất cả Leader</option>';
    leaders.forEach((leader) => {
      const option = document.createElement('option');
      option.value = leader;
      option.textContent = leader;
      option.selected = leader === currentSelectedLeader; // Restore selection
      leaderSelect.appendChild(option);
    });

    // Populate shop filter based on selected leader
    let filteredShops;
    if (leaderFilter && leaderFilter.value) {
      // If leader is selected, only show shops for that leader
      filteredShops = [
        ...new Set(
          responsesToUse.filter((r) => r.leader === leaderFilter.value).map((r) => r.shopName)
        ),
      ];
    } else {
      // If no leader selected, show all shops
      filteredShops = [...new Set(responsesToUse.map((r) => r.shopName))];
    }

    const shopSelect = document.getElementById('shopFilter');
    if (shopSelect) {
      shopSelect.innerHTML = '<option value="">Tất cả Shop</option>';
      filteredShops.forEach((shop) => {
        const option = document.createElement('option');
        option.value = shop;
        option.textContent = shop;
        shopSelect.appendChild(option);
      });
    }
  }

  applyFilters() {
    // With pagination, filters are now applied server-side
    // This method is deprecated but kept for compatibility
    this.currentPage = 1;
    this.loadResponses(1);
  }

  renderStats() {
    const container = document.getElementById('statsContainer');

    // Use totalCount from pagination for filtered results, or current page results as fallback
    const totalResponses = this.pagination ? this.totalCount : this.filteredResponses.length;
    const currentPageResponses =
      this.filteredResponses.length > 0 ? this.filteredResponses : this.responses;

    const totalLeaders = new Set(currentPageResponses.map((r) => r.leader)).size;
    const totalShops = new Set(currentPageResponses.map((r) => r.shopName)).size;

    // Calculate total POSM issues from current page
    let totalPOSMIssues = 0;
    currentPageResponses.forEach((response) => {
      response.responses.forEach((modelResponse) => {
        totalPOSMIssues += modelResponse.posmSelections.length;
      });
    });

    container.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${totalResponses}</div>
                <div class="stat-label">Tổng số khảo sát${this.pagination ? ' (đã lọc)' : ''}</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalLeaders}</div>
                <div class="stat-label">Số Leader${this.pagination && this.currentPage > 1 ? ' (trang hiện tại)' : ''}</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalShops}</div>
                <div class="stat-label">Số Shop${this.pagination && this.currentPage > 1 ? ' (trang hiện tại)' : ''}</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalPOSMIssues}</div>
                <div class="stat-label">POSM cần thay thế${this.pagination && this.currentPage > 1 ? ' (trang hiện tại)' : ''}</div>
            </div>
        `;
  }

  renderResponses() {
    const container = document.getElementById('responsesContainer');

    // Bulk delete button - add null check
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.disabled = this.selectedIds.size === 0;
    }

    if (this.filteredResponses.length === 0) {
      container.innerHTML = `
                <div class="no-data">
                    <h3>Không có dữ liệu</h3>
                    <p>Không tìm thấy kết quả khảo sát nào phù hợp với bộ lọc hiện tại.</p>
                </div>
            `;
      return;
    }
    container.innerHTML = this.filteredResponses
      .map(
        (response) => `
            <div class="response-item">
                <div class="response-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" class="select-response-checkbox" data-id="${response._id}" ${this.selectedIds.has(response._id) ? 'checked' : ''}>
                    </div>
                    <div class="response-info">
                        <h3>${response.shopName}</h3>
                        <div class="response-meta">Leader: ${response.leader}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="response-date">
                            ${this.formatDate(response.submittedAt)}
                        </div>
                        <button class="delete-btn"
                            onclick="adminApp.deleteResponse('${response._id}', '${response.shopName}', '${response.leader}')">
                            🗑️ Xóa
                        </button>
                    </div>
                </div>
                <div class="response-details">
                    ${this.renderModelResponses(response.responses)}
                </div>
            </div>
        `
      )
      .join('');
    // Bind checkboxes
    container.querySelectorAll('.select-response-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) {
          this.selectedIds.add(id);
        } else {
          this.selectedIds.delete(id);
        }
        // Add null check for bulkDeleteBtn
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        if (bulkDeleteBtn) {
          bulkDeleteBtn.disabled = this.selectedIds.size === 0;
        }
      });
    });

    // Update Select All button text after rendering
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
      const checkboxes = container.querySelectorAll('.select-response-checkbox');
      const allSelected = checkboxes.length > 0 && Array.from(checkboxes).every((cb) => cb.checked);
      selectAllBtn.textContent = allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
    }
  }

  renderModelResponses(responses) {
    return responses
      .map(
        (modelResponse) => `
            <div class="model-response">
                <div class="model-title">Model: ${modelResponse.model}</div>
                <div class="posm-selections">
                    ${
                      modelResponse.allSelected
                        ? '<span class="posm-tag all-selected">TẤT CẢ POSM</span>'
                        : modelResponse.posmSelections
                            .map((posm) => `<span class="posm-tag">${posm.posmCode}</span>`)
                            .join('')
                    }
                </div>
                ${
                  modelResponse.images && modelResponse.images.length > 0
                    ? `
                    <div class="admin-image-preview">
                        ${modelResponse.images
                          .map(
                            (url) => `
                            <a href="${url}" target="_blank">
                                <img src="${url}" style="max-width:100px;max-height:100px;margin:5px;border:1px solid #ccc;border-radius:4px;">
                            </a>
                        `
                          )
                          .join('')}
                    </div>
                `
                    : ''
                }
            </div>
        `
      )
      .join('');
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  async exportData() {
    try {
      this.showLoading();

      // Get all filtered data for export (not just current page)
      const params = new URLSearchParams({
        limit: '10000', // Large limit to get all data
      });

      // Add current filter parameters
      const leaderFilter = document.getElementById('leaderFilter');
      const shopFilter = document.getElementById('shopFilter');
      const dateFromFilter = document.getElementById('dateFromFilter');
      const dateToFilter = document.getElementById('dateToFilter');

      if (leaderFilter && leaderFilter.value) {
        params.append('leader', leaderFilter.value);
      }
      if (shopFilter && shopFilter.value) {
        params.append('shopName', shopFilter.value);
      }
      if (dateFromFilter && dateFromFilter.value) {
        params.append('dateFrom', dateFromFilter.value);
      }
      if (dateToFilter && dateToFilter.value) {
        params.append('dateTo', dateToFilter.value);
      }

      const response = await this.authenticatedFetch(`/api/responses?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch export data');
      }

      const data = await response.json();
      const exportResponses = data.data || data;

      if (exportResponses.length === 0) {
        alert('Không có dữ liệu để xuất.');
        return;
      }

      // Prepare data for Excel export
      const excelData = [];
      // Add header row
      excelData.push([
        'Leader',
        'Shop Name',
        'Model',
        'Quantity',
        'POSM Code',
        'POSM Name',
        'All Selected',
        'Image URL',
        'Submitted At',
        'User ID',
        'Username',
      ]);
      // Add data rows
      exportResponses.forEach((response) => {
        response.responses.forEach((modelResponse) => {
          const imageUrl =
            modelResponse.images && modelResponse.images.length > 0 ? modelResponse.images[0] : '';
          const quantity = modelResponse.quantity || 1; // Default to 1 if not specified
          if (modelResponse.allSelected) {
            excelData.push([
              response.leader,
              response.shopName,
              modelResponse.model,
              quantity,
              'ALL',
              'TẤT CẢ POSM',
              'Yes',
              imageUrl,
              this.formatDate(response.submittedAt),
              response.submittedById || '',
              response.submittedBy || '',
            ]);
          } else {
            modelResponse.posmSelections.forEach((posm) => {
              excelData.push([
                response.leader,
                response.shopName,
                modelResponse.model,
                quantity,
                posm.posmCode,
                posm.posmName,
                'No',
                imageUrl,
                this.formatDate(response.submittedAt),
                response.submittedById || '',
                response.submittedBy || '',
              ]);
            });
          }
        });
      });

      // Create Excel workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Auto-size columns
      const maxWidths = [];
      excelData.forEach((row) => {
        row.forEach((cell, colIndex) => {
          const cellLength = cell ? cell.toString().length : 0;
          maxWidths[colIndex] = Math.max(maxWidths[colIndex] || 0, cellLength + 2);
        });
      });

      worksheet['!cols'] = maxWidths.map((width) => ({ width: Math.min(width, 50) }));

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'POSM Survey Results');

      // Generate filename with current date
      const filename = `posm_survey_results_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Save the file
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Lỗi khi xuất dữ liệu: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async handleBulkDelete() {
    if (this.selectedIds.size === 0) {
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa ${this.selectedIds.size} khảo sát đã chọn?`)) {
      return;
    }
    try {
      this.showLoading();
      const res = await this.authenticatedFetch('/api/responses/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(this.selectedIds) }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.success) {
        alert(
          `Đã xóa ${data.deletedIds.length} khảo sát. ${data.errors.length ? 'Một số lỗi xảy ra, kiểm tra console.' : ''}`
        );
        if (data.errors.length) {
          console.error('Bulk delete errors:', data.errors);
        }
        this.selectedIds.clear();
        await this.loadResponses();
      } else {
        alert('Lỗi khi xóa hàng loạt: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error in bulk delete:', error);
      alert('Lỗi khi xóa hàng loạt: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  handleSelectAll() {
    const checkboxes = document.querySelectorAll('.select-response-checkbox');
    const allSelected = Array.from(checkboxes).every((cb) => cb.checked);
    checkboxes.forEach((cb) => {
      cb.checked = !allSelected;
      const id = cb.dataset.id;
      if (!allSelected) {
        this.selectedIds.add(id);
      } else {
        this.selectedIds.delete(id);
      }
    });
    // Update bulk delete button state
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.disabled = this.selectedIds.size === 0;
    }
    // Update Select All button text
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
      selectAllBtn.textContent = allSelected ? 'Chọn tất cả' : 'Bỏ chọn tất cả';
    }
  }

  renderPagination() {
    if (!this.pagination) {
      return;
    }

    const container = document.getElementById('responsesContainer');
    let paginationHTML = '';

    if (this.pagination.totalPages > 1) {
      paginationHTML = `
                <div class="pagination-container">
                    <div class="pagination-info">
                        Hiển thị ${(this.currentPage - 1) * this.itemsPerPage + 1} - ${Math.min(this.currentPage * this.itemsPerPage, this.totalCount)} 
                        trong tổng số ${this.totalCount} kết quả
                    </div>
                    <div class="pagination-controls">
                        ${
                          this.pagination.hasPrevPage
                            ? `<button class="pagination-btn" onclick="adminApp.goToPage(${this.currentPage - 1})">
                                ← Trang trước
                            </button>`
                            : '<button class="pagination-btn disabled">← Trang trước</button>'
                        }
                        
                        ${this.generatePageNumbers()}
                        
                        ${
                          this.pagination.hasNextPage
                            ? `<button class="pagination-btn" onclick="adminApp.goToPage(${this.currentPage + 1})">
                                Trang sau →
                            </button>`
                            : '<button class="pagination-btn disabled">Trang sau →</button>'
                        }
                    </div>
                </div>
            `;
    }

    container.insertAdjacentHTML('beforeend', paginationHTML);
  }

  generatePageNumbers() {
    let pageNumbers = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Add first page and ellipsis if needed
    if (startPage > 1) {
      pageNumbers += `<button class="pagination-btn page-number" onclick="adminApp.goToPage(1)">1</button>`;
      if (startPage > 2) {
        pageNumbers += '<span class="pagination-ellipsis">...</span>';
      }
    }

    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage ? 'active' : '';
      pageNumbers += `<button class="pagination-btn page-number ${isActive}" onclick="adminApp.goToPage(${i})">${i}</button>`;
    }

    // Add last page and ellipsis if needed
    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) {
        pageNumbers += '<span class="pagination-ellipsis">...</span>';
      }
      pageNumbers += `<button class="pagination-btn page-number" onclick="adminApp.goToPage(${this.totalPages})">${this.totalPages}</button>`;
    }

    return pageNumbers;
  }

  goToPage(page) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadResponses(page);
    }
  }

  // Upload Functionality
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
      console.log('🔍 localStorage contents:', {
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
        user: localStorage.getItem('user'),
      });
      this.showUploadResult(type, 'error', {
        message: 'Không tìm thấy thông tin đăng nhập. Vui lòng đăng nhập lại từ trang Admin Login.',
      });
      this.redirectToAdminLogin('No access token for upload');
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
        // Refresh survey results to show updated data
        this.loadResponses();
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
}

// Global instance of AdminApp
let adminApp;

// Initialize the admin app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  adminApp = new AdminApp();
});
