class DisplayManagement {
  constructor() {
    this.displays = [];
    this.selectedDisplayIds = new Set();
    this.editingDisplayId = null;
    this.deleteDisplayId = null;
    this.filters = {
      store_id: '',
      model: '',
      is_displayed: '',
      search: '',
    };

    this.pagination = null;
    this.init();
  }

  async init() {
    // Check authentication first
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      return; // User will be redirected to login
    }

    this.addLogoutButton();
    this.bindEvents();
    this.initializePagination();
    this.loadDisplays();
  }

  addLogoutButton() {
    // Add Change Password and logout buttons
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
      // Add Change Password link
      const changePasswordBtn = document.createElement('a');
      changePasswordBtn.href = '/change-password.html';
      changePasswordBtn.className = 'nav-item';
      changePasswordBtn.innerHTML = '🔐 Đổi mật khẩu';
      changePasswordBtn.style.cssText = 'color: #0ea5e9; border: 1px solid #0ea5e9;';
      navMenu.appendChild(changePasswordBtn);

      // Add logout button
      const logoutBtn = document.createElement('a');
      logoutBtn.href = '#';
      logoutBtn.className = 'nav-item logout';
      logoutBtn.innerHTML = '🚪 Đăng xuất';
      logoutBtn.style.cssText = 'color: #dc2626; border: 1px solid #dc2626;';
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.logout();
      });
      navMenu.appendChild(logoutBtn);
    }
  }

  initializePagination() {
    this.pagination = new PaginationComponent('paginationContainer', {
      defaultPageSize: 25,
      pageSizeOptions: [10, 25, 50, 100],
      showPageInfo: true,
      showPageSizeSelector: true,
      maxVisiblePages: 7,
    });

    this.pagination.setCallbacks(
      (page) => this.handlePageChange(page),
      (pageSize) => this.handlePageSizeChange(pageSize)
    );
  }

  handlePageChange(page) {
    this.loadDisplays(page);
  }

  handlePageSizeChange(pageSize) {
    this.loadDisplays(1, pageSize);
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
      console.log('Display Management: Checking auth for user:', userData.username, userData.role);

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

  // Helper method to make authenticated API requests
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
      },
    };

    // Only set Content-Type to application/json if not uploading files
    if (!(options.body instanceof FormData)) {
      authOptions.headers['Content-Type'] = 'application/json';
    }

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

  bindEvents() {
    // ESC key to close modals
    document.addEventListener('keydown', (e) => this.handleEscapeKey(e));

    // Action buttons
    document
      .getElementById('addDisplayBtn')
      .addEventListener('click', () => this.showAddDisplayModal());
    document
      .getElementById('importDisplayBtn')
      .addEventListener('click', () => this.showImportModal());
    document
      .getElementById('exportDisplayBtn')
      .addEventListener('click', () => this.exportDisplays());

    // Filter events
    document.getElementById('storeIdFilter').addEventListener('input', () => this.applyFilters());
    document.getElementById('modelFilter').addEventListener('input', () => this.applyFilters());
    document
      .getElementById('displayStatusFilter')
      .addEventListener('change', () => this.applyFilters());
    document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
    document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearFilters());

    // Bulk action events
    document
      .getElementById('selectAllDisplaysBtn')
      .addEventListener('click', () => this.handleSelectAll());
    document
      .getElementById('bulkShowBtn')
      .addEventListener('click', () => this.handleBulkDisplay());
    document.getElementById('bulkHideBtn').addEventListener('click', () => this.handleBulkHide());
    document
      .getElementById('bulkDeleteBtn')
      .addEventListener('click', () => this.handleBulkDelete());

    // Modal events
    document
      .getElementById('closeDisplayModal')
      .addEventListener('click', () => this.hideDisplayModal());
    document
      .getElementById('cancelDisplayBtn')
      .addEventListener('click', () => this.hideDisplayModal());
    document.getElementById('saveDisplayBtn').addEventListener('click', () => this.saveDisplay());

    // Import modal events
    document
      .getElementById('closeImportModal')
      .addEventListener('click', () => this.hideImportModal());
    document
      .getElementById('cancelImportBtn')
      .addEventListener('click', () => this.hideImportModal());
    document
      .getElementById('selectFileBtn')
      .addEventListener('click', () => document.getElementById('csvFileInput').click());
    document
      .getElementById('csvFileInput')
      .addEventListener('change', (e) => this.handleFileSelect(e));
    document
      .getElementById('removeFileBtn')
      .addEventListener('click', () => this.removeSelectedFile());
    document
      .getElementById('startImportBtn')
      .addEventListener('click', () => this.importDisplays());

    // Delete confirmation events
    document
      .getElementById('confirmDeleteBtn')
      .addEventListener('click', () => this.confirmDelete());
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.cancelDelete());

    // File drop zone events
    const dropZone = document.getElementById('fileUploadArea');
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect({ target: { files } });
      }
    });
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

  async loadDisplays(page = null, pageSize = null) {
    try {
      this.showLoading();

      const currentPage = page || this.pagination?.getCurrentPage() || 1;
      const limit = pageSize || this.pagination?.getPageSize() || 25;

      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: limit,
      });

      // Add filters
      Object.keys(this.filters).forEach((key) => {
        if (this.filters[key]) {
          queryParams.set(key, this.filters[key]);
        }
      });

      // Load displays and stats in parallel
      const [displaysResponse, statsResponse] = await Promise.all([
        this.makeAuthenticatedRequest(`/api/displays?${queryParams}`),
        this.makeAuthenticatedRequest('/api/displays/stats'),
      ]);

      if (displaysResponse && displaysResponse.ok) {
        const displaysData = await displaysResponse.json();
        console.log('Displays API response:', displaysData);

        if (displaysData.success && displaysData.data) {
          this.displays = Array.isArray(displaysData.data) ? displaysData.data : [];

          // Update pagination component
          if (this.pagination && displaysData.pagination) {
            this.pagination.setData(displaysData.pagination);
          }
        } else {
          this.displays = [];
          console.warn('Unexpected displays response format:', displaysData);
        }

        this.renderDisplays();
      } else {
        console.error(
          'Failed to load displays:',
          displaysResponse ? displaysResponse.status : 'No response'
        );
        this.showNotification('Không thể tải danh sách display', 'error');
      }

      if (statsResponse && statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('Display stats API response:', statsData);

        if (statsData.success && statsData.data) {
          this.renderStats(statsData.data);
        } else {
          console.warn('Unexpected stats response format:', statsData);
        }
      } else {
        console.error(
          'Failed to load display stats:',
          statsResponse ? statsResponse.status : 'No response'
        );
      }
    } catch (error) {
      console.error('Error loading displays:', error);
      this.showNotification('Lỗi khi tải danh sách display: ' + error.message, 'error');

      this.displays = [];
      this.renderDisplays(); // Render empty state
    } finally {
      this.hideLoading();
    }
  }

  applyFilters() {
    this.filters = {
      store_id: document.getElementById('storeIdFilter')?.value || '',
      model: document.getElementById('modelFilter')?.value || '',
      is_displayed:
        document.getElementById('displayStatusFilter')?.value === 'true'
          ? 'true'
          : document.getElementById('displayStatusFilter')?.value === 'false'
            ? 'false'
            : '',
      search: document.getElementById('searchInput')?.value || '',
    };

    // Reset to first page when filters change
    this.selectedDisplayIds.clear();
    this.loadDisplays(1);
  }

  clearFilters() {
    const filters = ['storeIdFilter', 'modelFilter', 'displayStatusFilter', 'searchInput'];
    filters.forEach((filterId) => {
      const element = document.getElementById(filterId);
      if (element) {
        element.value = '';
      }
    });
    this.applyFilters();
  }

  renderStats(stats) {
    const container = document.getElementById('displayStatsContainer');
    if (!container || !stats) {
      return;
    }

    const overview = stats.overview || {};
    const modelStats = stats.modelDistribution || [];
    const storeStats = stats.storeStats || {};

    container.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${overview.totalRecords || 0}</div>
                <div class="stat-label">Tổng bản ghi</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${overview.displayedCount || 0}</div>
                <div class="stat-label">Đang hiển thị</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${overview.notDisplayedCount || 0}</div>
                <div class="stat-label">Không hiển thị</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${storeStats.totalStores || 0}</div>
                <div class="stat-label">Tổng số store</div>
            </div>
        `;
  }

  renderDisplays() {
    const container = document.getElementById('displaysContainer');
    if (!container) {
      console.warn('displaysContainer element not found');
      return;
    }

    if (!Array.isArray(this.displays)) {
      console.warn('this.displays is not an array:', this.displays);
      this.displays = [];
    }

    if (this.displays.length === 0) {
      const message =
        'Chưa có bản ghi display nào trong hệ thống hoặc không có kết quả phù hợp với bộ lọc';
      container.innerHTML = `<div class="no-data">${message}</div>`;
      this.updateBulkActionButtons();
      return;
    }

    let html = `
            <div class="displays-table">
                <div class="table-header">
                    <div class="table-row">
                        <div class="table-cell checkbox-cell">
                            <input type="checkbox" id="selectAllDisplaysCheckbox" onchange="displayManager.toggleSelectAll()">
                        </div>
                        <div class="table-cell">Store ID</div>
                        <div class="table-cell">Store Name</div>
                        <div class="table-cell">Model</div>
                        <div class="table-cell">Trạng thái hiển thị</div>
                        <div class="table-cell">Cập nhật lần cuối</div>
                        <div class="table-cell">Thao tác</div>
                    </div>
                </div>
                <div class="table-body">
        `;

    this.displays.forEach((display) => {
      const isSelected = this.selectedDisplayIds.has(display._id);
      const lastUpdate = display.updatedAt
        ? new Date(display.updatedAt).toLocaleString('vi-VN')
        : 'Chưa cập nhật';
      const statusClass = display.is_displayed ? 'status-displayed' : 'status-hidden';
      const statusText = display.is_displayed ? 'Đang hiển thị' : 'Ẩn';

      html += `
                <div class="table-row">
                    <div class="table-cell checkbox-cell">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onchange="displayManager.toggleDisplaySelection('${display._id}')">
                    </div>
                    <div class="table-cell">
                        <strong>${display.store_id}</strong>
                    </div>
                    <div class="table-cell">${display.store_name || 'N/A'}</div>
                    <div class="table-cell">${display.model}</div>
                    <div class="table-cell">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="table-cell date-cell">${lastUpdate}</div>
                    <div class="table-cell">
                        <div class="action-buttons">
                            <button class="btn-action btn-edit" onclick="displayManager.editDisplay('${display._id}')" title="Chỉnh sửa">
                                ✏️
                            </button>
                            <button class="btn-action btn-toggle" onclick="displayManager.toggleDisplayStatus('${display._id}')" title="${display.is_displayed ? 'Ẩn display' : 'Hiển thị display'}">
                                ${display.is_displayed ? '👁️' : '🙈'}
                            </button>
                            <button class="btn-action btn-delete" onclick="displayManager.deleteDisplay('${display._id}')" title="Xóa">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            `;
    });

    html += `
                </div>
            </div>
        `;

    container.innerHTML = html;
    this.updateBulkActionButtons();
  }

  toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllDisplaysCheckbox');
    const isChecked = selectAllCheckbox ? selectAllCheckbox.checked : false;

    if (isChecked) {
      if (Array.isArray(this.displays)) {
        this.displays.forEach((display) => {
          if (display && display._id) {
            this.selectedDisplayIds.add(display._id);
          }
        });
      }
    } else {
      this.selectedDisplayIds.clear();
    }

    this.renderDisplays();
  }

  handleSelectAll() {
    const selectAllBtn = document.getElementById('selectAllDisplaysBtn');
    if (!selectAllBtn || !Array.isArray(this.displays)) {
      return;
    }

    const hasDisplays = this.displays.length > 0;
    const selectedCount = this.selectedDisplayIds.size;
    const allSelected = hasDisplays && selectedCount === this.displays.length;

    if (allSelected) {
      this.selectedDisplayIds.clear();
    } else {
      this.displays.forEach((display) => {
        if (display && display._id) {
          this.selectedDisplayIds.add(display._id);
        }
      });
    }

    this.renderDisplays();
  }

  toggleDisplaySelection(displayId) {
    if (this.selectedDisplayIds.has(displayId)) {
      this.selectedDisplayIds.delete(displayId);
    } else {
      this.selectedDisplayIds.add(displayId);
    }
    this.updateBulkActionButtons();
  }

  updateBulkActionButtons() {
    const selectedCount = this.selectedDisplayIds ? this.selectedDisplayIds.size : 0;
    const buttons = ['bulkShowBtn', 'bulkHideBtn', 'bulkDeleteBtn'];

    buttons.forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.disabled = selectedCount === 0;
        if (btnId === 'bulkDeleteBtn') {
          btn.innerHTML =
            selectedCount > 0
              ? `🗑️ Xóa ${selectedCount} bản ghi đã chọn`
              : '🗑️ Xóa các bản ghi đã chọn';
        }
      }
    });

    // Update select all button
    const selectAllBtn = document.getElementById('selectAllDisplaysBtn');
    if (selectAllBtn) {
      const hasDisplays = Array.isArray(this.displays) && this.displays.length > 0;
      const allSelected = hasDisplays && selectedCount === this.displays.length;

      if (allSelected) {
        selectAllBtn.innerHTML = '❌ Bỏ chọn tất cả';
      } else {
        selectAllBtn.innerHTML = '☑️ Chọn tất cả';
      }
      selectAllBtn.disabled = !hasDisplays;
    }
  }

  // Handle ESC key to close modals
  handleEscapeKey(event) {
    if (event.key === 'Escape') {
      const displayModal = document.getElementById('displayModal');
      const importModal = document.getElementById('importModal');
      const confirmDeleteDialog = document.getElementById('deleteModal');

      if (displayModal && displayModal.style.display === 'flex') {
        this.hideDisplayModal();
      } else if (importModal && importModal.style.display === 'flex') {
        this.hideImportModal();
      } else if (confirmDeleteDialog && confirmDeleteDialog.style.display === 'flex') {
        this.cancelDelete();
      }
    }
  }

  // Display CRUD operations
  showAddDisplayModal() {
    this.editingDisplayId = null;
    document.getElementById('displayModalTitle').textContent = 'Thêm bản ghi display mới';
    document.getElementById('displayForm').reset();
    document.getElementById('displayId').value = '';

    document.getElementById('displayModal').style.display = 'flex';
  }

  async editDisplay(displayId) {
    try {
      this.showLoading();
      const response = await this.makeAuthenticatedRequest(`/api/displays/${displayId}`);

      if (response && response.ok) {
        const displayData = await response.json();
        console.log('Edit display API response:', displayData);

        let display = null;
        if (displayData.success && displayData.data) {
          display = displayData.data;
        } else {
          display = displayData;
        }

        if (!display || !display._id) {
          throw new Error('Invalid display data received');
        }

        this.editingDisplayId = displayId;
        document.getElementById('displayModalTitle').textContent = 'Chỉnh sửa bản ghi display';
        document.getElementById('displayId').value = display._id;
        document.getElementById('storeIdInput').value = display.store_id || '';
        document.getElementById('modelInput').value = display.model || '';
        document.getElementById('isDisplayedInput').checked = display.is_displayed !== false;

        document.getElementById('displayModal').style.display = 'flex';
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: Failed to load display record`
        );
      }
    } catch (error) {
      console.error('Error loading display:', error);
      this.showNotification('Lỗi khi tải thông tin display: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  hideDisplayModal() {
    document.getElementById('displayModal').style.display = 'none';
    document.getElementById('displayForm').reset();
    this.editingDisplayId = null;
  }

  async saveDisplay() {
    const form = document.getElementById('displayForm');
    const formData = new FormData(form);

    // Validate required fields
    if (!formData.get('store_id') || !formData.get('model')) {
      this.showNotification('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
      return;
    }

    try {
      this.showLoading();

      const displayData = {
        store_id: formData.get('store_id'),
        model: formData.get('model'),
        is_displayed: formData.get('is_displayed') === 'on',
      };

      const url = this.editingDisplayId
        ? `/api/displays/${this.editingDisplayId}`
        : '/api/displays';
      const method = this.editingDisplayId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest(url, {
        method,
        body: JSON.stringify(displayData),
      });

      if (response && response.ok) {
        const result = await response.json();
        this.showNotification(result.message || 'Lưu thành công!', 'success');
        this.hideDisplayModal();
        this.loadDisplays();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Lỗi khi lưu bản ghi display');
      }
    } catch (error) {
      console.error('Error saving display:', error);
      this.showNotification('Lỗi khi lưu: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async toggleDisplayStatus(displayId) {
    try {
      this.showLoading();
      const display = this.displays.find((d) => d._id === displayId);
      if (!display) {
        return;
      }

      const response = await this.makeAuthenticatedRequest(`/api/displays/${displayId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_displayed: !display.is_displayed }),
      });

      if (response && response.ok) {
        const result = await response.json();
        this.showNotification(result.message || 'Cập nhật trạng thái thành công!', 'success');
        this.loadDisplays();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Lỗi khi cập nhật trạng thái');
      }
    } catch (error) {
      console.error('Error toggling display status:', error);
      this.showNotification('Lỗi khi cập nhật trạng thái: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  deleteDisplay(displayId) {
    const display = this.displays.find((d) => d._id === displayId);
    if (!display) {
      return;
    }

    document.getElementById('deleteMessage').textContent =
      `Bạn có chắc chắn muốn xóa bản ghi display "${display.store_id} - ${display.model}"?`;
    this.deleteDisplayId = displayId;
    document.getElementById('deleteModal').style.display = 'flex';
  }

  async confirmDelete() {
    if (!this.deleteDisplayId) {
      return;
    }

    try {
      this.showLoading();
      const response = await this.makeAuthenticatedRequest(
        `/api/displays/${this.deleteDisplayId}`,
        {
          method: 'DELETE',
        }
      );

      if (response && response.ok) {
        const result = await response.json();
        this.showNotification(result.message || 'Xóa thành công!', 'success');
        this.cancelDelete();
        this.loadDisplays();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Lỗi khi xóa bản ghi display');
      }
    } catch (error) {
      console.error('Error deleting display:', error);
      this.showNotification('Lỗi khi xóa: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  cancelDelete() {
    document.getElementById('deleteModal').style.display = 'none';
    this.deleteDisplayId = null;
  }

  // Bulk operations
  async handleBulkDisplay() {
    if (this.selectedDisplayIds.size === 0) {
      return;
    }

    if (!confirm(`Hiển thị ${this.selectedDisplayIds.size} bản ghi đã chọn?`)) {
      return;
    }

    try {
      this.showLoading();
      const displayIds = Array.from(this.selectedDisplayIds);

      const promises = displayIds.map((displayId) =>
        this.makeAuthenticatedRequest(`/api/displays/${displayId}`, {
          method: 'PUT',
          body: JSON.stringify({ is_displayed: true }),
        })
      );

      await Promise.all(promises);
      this.showNotification(`Đã hiển thị ${displayIds.length} bản ghi thành công!`, 'success');
      this.selectedDisplayIds.clear();
      this.loadDisplays();
    } catch (error) {
      console.error('Error bulk displaying:', error);
      this.showNotification('Lỗi khi hiển thị bản ghi: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async handleBulkHide() {
    if (this.selectedDisplayIds.size === 0) {
      return;
    }

    if (!confirm(`Ẩn ${this.selectedDisplayIds.size} bản ghi đã chọn?`)) {
      return;
    }

    try {
      this.showLoading();
      const displayIds = Array.from(this.selectedDisplayIds);

      const promises = displayIds.map((displayId) =>
        this.makeAuthenticatedRequest(`/api/displays/${displayId}`, {
          method: 'PUT',
          body: JSON.stringify({ is_displayed: false }),
        })
      );

      await Promise.all(promises);
      this.showNotification(`Đã ẩn ${displayIds.length} bản ghi thành công!`, 'success');
      this.selectedDisplayIds.clear();
      this.loadDisplays();
    } catch (error) {
      console.error('Error bulk hiding:', error);
      this.showNotification('Lỗi khi ẩn bản ghi: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async handleBulkDelete() {
    if (this.selectedDisplayIds.size === 0) {
      return;
    }

    if (
      !confirm(
        `XÓA VĨNH VIỄN ${this.selectedDisplayIds.size} bản ghi đã chọn? Hành động này không thể hoàn tác!`
      )
    ) {
      return;
    }

    try {
      this.showLoading();
      const response = await this.makeAuthenticatedRequest('/api/displays/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ ids: Array.from(this.selectedDisplayIds) }),
      });

      if (response && response.ok) {
        const result = await response.json();
        this.showNotification(result.message || 'Xóa thành công!', 'success');
        this.selectedDisplayIds.clear();
        this.loadDisplays();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Lỗi khi xóa bản ghi display');
      }
    } catch (error) {
      console.error('Error bulk deleting displays:', error);
      this.showNotification('Lỗi khi xóa: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  // Import/Export functions
  showImportModal() {
    document.getElementById('importModal').style.display = 'flex';
    this.removeSelectedFile();
  }

  hideImportModal() {
    document.getElementById('importModal').style.display = 'none';
    this.removeSelectedFile();
  }

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    // Validate file type
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some((ext) => fileName.endsWith(ext));

    if (!hasValidExtension) {
      this.showNotification('Chỉ hỗ trợ file CSV, XLSX, XLS', 'error');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      this.showNotification('File quá lớn. Tối đa 5MB', 'error');
      return;
    }

    // Show selected file
    document.getElementById('selectedFileName').textContent = file.name;
    document.getElementById('selectedFileInfo').style.display = 'flex';
    document.getElementById('fileUploadArea').style.display = 'none';
    document.getElementById('startImportBtn').disabled = false;
  }

  removeSelectedFile() {
    document.getElementById('csvFileInput').value = '';
    document.getElementById('selectedFileInfo').style.display = 'none';
    document.getElementById('fileUploadArea').style.display = 'flex';
    document.getElementById('startImportBtn').disabled = true;
  }

  async importDisplays() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];

    if (!file) {
      this.showNotification('Vui lòng chọn file để import', 'error');
      return;
    }

    try {
      this.showLoading();
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await this.makeAuthenticatedRequest('/api/displays/import', {
        method: 'POST',
        body: formData,
      });

      if (response && response.ok) {
        const result = await response.json();
        this.showNotification(result.message || 'Import thành công!', 'success');
        this.hideImportModal();
        this.loadDisplays();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Lỗi khi import dữ liệu');
      }
    } catch (error) {
      console.error('Error importing displays:', error);
      this.showNotification('Lỗi khi import: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async exportDisplays() {
    try {
      this.showLoading();
      const response = await this.makeAuthenticatedRequest('/api/displays/export');

      if (response && response.ok) {
        // Create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `displays-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        this.showNotification('Export thành công!', 'success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Lỗi khi export dữ liệu');
      }
    } catch (error) {
      console.error('Error exporting displays:', error);
      this.showNotification('Lỗi khi export: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  // Notification system
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

  async logout() {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.clear();
      window.location.replace('/admin-login.html');
    }
  }
}

// Global instance
let displayManager;
