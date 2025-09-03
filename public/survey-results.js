class SurveyResultsApp {
  constructor() {
    this.responses = [];
    this.filteredResponses = [];
    this.deleteID = null;
    this.selectedIds = new Set();
    this.expandedSurveys = new Set(); // Track which surveys are expanded
    this.allShops = []; // Store all shop names for autocomplete
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.totalPages = 1;
    this.totalCount = 0;
    this.pagination = null;
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
    this.initNavigation();
    this.setupAuthUI();
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
      console.log('Admin page: Checking auth for user:', userData.username, userData.role);

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

  setupAuthUI() {
    // Add user info to the admin header
    const adminHeader = document.querySelector('.nav-brand h1');
    if (adminHeader && this.user) {
      const userInfo = document.createElement('div');
      userInfo.style.cssText =
        'font-size: 12px; color: #64748b; font-weight: normal; margin-top: 4px;';
      userInfo.textContent = `Logged in as: ${this.user.username} (${this.user.role})`;
      adminHeader.appendChild(userInfo);
    }

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
        if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
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
            localStorage.clear();
            window.location.replace('/admin-login.html');
          }
        }
      });
      navMenu.appendChild(logoutBtn);
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
    // When uploading FormData, browser will set the correct Content-Type with boundary
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
    // ESC key to close modals
    document.addEventListener('keydown', (e) => this.handleEscapeKey(e));

    const exportDataBtn = document.getElementById('exportData');
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', () => this.exportData());
    }

    // Handle submittedBy filter change
    const submittedByFilter = document.getElementById('submittedByFilter');
    if (submittedByFilter) {
      submittedByFilter.addEventListener('change', () => {
        // Reset to page 1 and reload with filters
        this.currentPage = 1;
        this.loadResponses(1);
      });
    }

    // Handle shop filter with autocomplete
    this.setupShopAutocomplete();

    // Handle other filter changes

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

  async loadResponses(page = 1) {
    try {
      this.showLoading();

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: this.itemsPerPage.toString(),
      });

      // Add filters
      const submittedByFilter = document.getElementById('submittedByFilter');
      if (submittedByFilter && submittedByFilter.value) {
        params.append('submittedBy', submittedByFilter.value);
      }

      const shopFilter = document.getElementById('shopFilter');
      if (shopFilter && shopFilter.value.trim()) {
        params.append('shopName', shopFilter.value.trim());
      }

      const dateFromFilter = document.getElementById('dateFromFilter');
      if (dateFromFilter && dateFromFilter.value) {
        params.append('dateFrom', dateFromFilter.value);
      }

      const dateToFilter = document.getElementById('dateToFilter');
      if (dateToFilter && dateToFilter.value) {
        params.append('dateTo', dateToFilter.value);
      }

      console.log('Loading responses with params:', params.toString());

      const response = await this.makeAuthenticatedRequest(`/api/responses?${params}`);

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
      const response = await this.makeAuthenticatedRequest('/api/responses?limit=10000');
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

    // Populate submittedBy dropdown
    const submittedByUsers = [
      ...new Set(responsesToUse.map((r) => r.submittedBy).filter(Boolean)),
    ].sort();

    const submittedBySelect = document.getElementById('submittedByFilter');
    if (submittedBySelect) {
      const currentValue = submittedBySelect.value;
      submittedBySelect.innerHTML = '<option value="">Tất cả người dùng</option>';
      submittedByUsers.forEach((user) => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        option.selected = user === currentValue;
        submittedBySelect.appendChild(option);
      });
    }

    // Store all shop names for autocomplete
    this.allShops = [...new Set(responsesToUse.map((r) => r.shopName).filter(Boolean))].sort();
  }

  renderStats() {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) {
      return;
    }

    const totalResponses = this.totalCount || this.responses.length;
    const uniqueSubmitters = [...new Set(this.responses.map((r) => r.submittedBy).filter(Boolean))]
      .length;
    const uniqueShops = [...new Set(this.responses.map((r) => r.shopName))].length;

    let totalModels = 0;
    this.responses.forEach((response) => {
      totalModels += response.responses?.length || 0;
    });

    statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${totalResponses}</div>
                <div class="stat-label">Tổng khảo sát</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${uniqueSubmitters}</div>
                <div class="stat-label">Người dùng</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${uniqueShops}</div>
                <div class="stat-label">Shop</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalModels}</div>
                <div class="stat-label">Model được khảo sát</div>
            </div>
        `;
  }

  renderResponses() {
    const container = document.getElementById('responsesContainer');
    if (!container || this.responses.length === 0) {
      if (container) {
        container.innerHTML = '<div class="no-data">Không có dữ liệu khảo sát</div>';
      }
      return;
    }

    let html = '';
    this.responses.forEach((response) => {
      const responseDate = new Date(response.createdAt).toLocaleString('vi-VN');
      const isSelected = this.selectedIds.has(response._id);
      const isExpanded = this.expandedSurveys.has(response._id);
      const totalModels = response.responses ? response.responses.length : 0;
      const totalImages = response.responses
        ? response.responses.reduce((sum, r) => sum + (r.images ? r.images.length : 0), 0)
        : 0;

      html += `
                <div class="accordion-survey-item ${isExpanded ? 'expanded' : ''}">
                    <div class="accordion-header" onclick="surveyResultsApp.toggleSurveyExpansion('${response._id}')">
                        <div class="accordion-left">
                            <input type="checkbox" ${isSelected ? 'checked' : ''} 
                                   onchange="surveyResultsApp.toggleSelection('${response._id}')"
                                   onclick="event.stopPropagation()"
                                   class="survey-checkbox">
                            <div class="survey-summary">
                                <div class="survey-title">
                                    <span class="survey-date">${responseDate}</span>
                                    <span class="survey-info">${response.submittedBy || 'Unknown User'} - ${response.shopName}</span>
                                </div>
                                <div class="survey-stats">
                                    <span class="stat-badge models">📋 ${totalModels} models</span>
                                    <span class="stat-badge images">📷 ${totalImages} images</span>
                                </div>
                            </div>
                        </div>
                        <div class="accordion-right">
                            <button class="expand-btn" title="${isExpanded ? 'Thu gọn' : 'Mở rộng'} chi tiết">
                                <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6,9 12,15 18,9"></polyline>
                                </svg>
                            </button>
                            <button class="edit-btn" onclick="event.stopPropagation(); surveyResultsApp.openEditDialog('${response._id}')" title="Chỉnh sửa khảo sát">
                                ✏️
                            </button>
                            <button class="delete-btn" onclick="event.stopPropagation(); surveyResultsApp.showDeleteDialog('${response._id}')" title="Xóa khảo sát">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <div class="accordion-content">
                        <div class="accordion-details">
                            ${this.renderModelResponses(response.responses)}
                        </div>
                    </div>
                </div>
            `;
    });

    container.innerHTML = html;
  }

  renderModelResponses(responses) {
    if (!responses || responses.length === 0) {
      return '<p class="no-data">Không có dữ liệu model</p>';
    }

    return responses
      .map((modelResponse) => {
        const posmTags = modelResponse.allSelected
          ? '<span class="posm-tag all-selected">TẤT CẢ POSM</span>'
          : modelResponse.posmSelections
              .map((posm) => `<span class="posm-tag">${posm.posmCode}</span>`)
              .join('');

        const images =
          modelResponse.images && modelResponse.images.length > 0
            ? modelResponse.images
                .map(
                  (img) =>
                    `<img src="${img}" alt="POSM Image" style="max-width:100px;max-height:80px;margin:5px;border-radius:5px;cursor:pointer;" onclick="window.open('${img}')">`
                )
                .join('')
            : '';

        return `
                <div class="model-response">
                    <div class="model-title">
                        ${modelResponse.model} (Số lượng: ${modelResponse.quantity || 1})
                    </div>
                    <div class="posm-selections">${posmTags}</div>
                    ${images ? `<div class="response-images" style="margin-top:10px;">${images}</div>` : ''}
                </div>
            `;
      })
      .join('');
  }

  renderPagination() {
    const paginationHtml = `
            <div class="pagination-container">
                <div class="pagination-info">
                    Hiển thị ${(this.currentPage - 1) * this.itemsPerPage + 1}-${Math.min(this.currentPage * this.itemsPerPage, this.totalCount)} 
                    trong tổng số ${this.totalCount} kết quả
                </div>
                <div class="pagination-controls">
                    <button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
                            onclick="surveyResultsApp.goToPage(${this.currentPage - 1})" 
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        ‹ Trước
                    </button>
                    ${this.generatePageNumbers()}
                    <button class="pagination-btn ${this.currentPage === this.totalPages ? 'disabled' : ''}" 
                            onclick="surveyResultsApp.goToPage(${this.currentPage + 1})" 
                            ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        Sau ›
                    </button>
                </div>
            </div>
        `;

    // Insert pagination after responses container
    const responsesContainer = document.getElementById('responsesContainer');
    let paginationContainer = responsesContainer.nextElementSibling;

    if (!paginationContainer || !paginationContainer.classList.contains('pagination-container')) {
      paginationContainer = document.createElement('div');
      responsesContainer.parentNode.insertBefore(
        paginationContainer,
        responsesContainer.nextSibling
      );
    }

    paginationContainer.outerHTML = paginationHtml;
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
      pageNumbers += `<button class="pagination-btn page-number" onclick="surveyResultsApp.goToPage(1)">1</button>`;
      if (startPage > 2) {
        pageNumbers += '<span class="pagination-ellipsis">...</span>';
      }
    }

    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage ? 'active' : '';
      pageNumbers += `<button class="pagination-btn page-number ${isActive}" onclick="surveyResultsApp.goToPage(${i})">${i}</button>`;
    }

    // Add last page and ellipsis if needed
    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) {
        pageNumbers += '<span class="pagination-ellipsis">...</span>';
      }
      pageNumbers += `<button class="pagination-btn page-number" onclick="surveyResultsApp.goToPage(${this.totalPages})">${this.totalPages}</button>`;
    }

    return pageNumbers;
  }

  goToPage(page) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadResponses(page);
    }
  }

  toggleSelection(responseId) {
    if (this.selectedIds.has(responseId)) {
      this.selectedIds.delete(responseId);
    } else {
      this.selectedIds.add(responseId);
    }
    this.updateBulkDeleteButton();
  }

  handleSelectAll() {
    const selectAllBtn = document.getElementById('selectAllBtn');
    const isSelectingAll = selectAllBtn.textContent.includes('Chọn tất cả');

    if (isSelectingAll) {
      // Select all current page responses
      this.responses.forEach((response) => {
        this.selectedIds.add(response._id);
      });
      selectAllBtn.innerHTML = '❌ Bỏ chọn tất cả trang này';
      selectAllBtn.title = `Đã chọn tất cả ${this.responses.length} khảo sát trên trang này`;
    } else {
      // Deselect all
      this.selectedIds.clear();
      selectAllBtn.innerHTML = '☑️ Chọn tất cả trang này';
      selectAllBtn.title = 'Chọn tất cả khảo sát trên trang hiện tại';
    }

    this.renderResponses();
    this.updateBulkDeleteButton();
  }

  updateBulkDeleteButton() {
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
      const count = this.selectedIds.size;
      bulkDeleteBtn.disabled = count === 0;
      if (count === 0) {
        bulkDeleteBtn.innerHTML = '🗑️ Xóa các khảo sát đã chọn';
        bulkDeleteBtn.title = 'Chọn ít nhất một khảo sát để xóa';
      } else {
        bulkDeleteBtn.innerHTML = `🗑️ Xóa ${count} khảo sát đã chọn`;
        bulkDeleteBtn.title = `Xóa ${count} khảo sát đã chọn (hành động không thể hoàn tác)`;
      }
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

  showDeleteDialog(responseId) {
    this.deleteID = responseId;
    const dialog = document.getElementById('confirmDeleteDialog');
    if (dialog) {
      dialog.style.display = 'flex';
    }
  }

  cancelDelete() {
    this.deleteID = null;
    const dialog = document.getElementById('confirmDeleteDialog');
    if (dialog) {
      dialog.style.display = 'none';
    }
  }

  async confirmDelete() {
    if (!this.deleteID) {
      return;
    }

    try {
      this.showLoading();
      const response = await this.makeAuthenticatedRequest(`/api/responses/${this.deleteID}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        this.cancelDelete();

        // If we deleted the only item on current page and it's not page 1, go to previous page
        if (this.responses.length === 1 && this.currentPage > 1) {
          this.currentPage--;
        }

        await this.loadResponses(this.currentPage);
        this.showNotification('✅ Xóa khảo sát thành công!', 'success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Lỗi khi xóa');
      }
    } catch (error) {
      console.error('Error deleting response:', error);
      this.showNotification(`❌ Lỗi khi xóa khảo sát: ${error.message}`, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async handleBulkDelete() {
    if (this.selectedIds.size === 0) {
      return;
    }

    // Show enhanced confirmation dialog
    if (!(await this.showBulkDeleteConfirmation())) {
      return;
    }

    try {
      this.showLoading();
      console.log(`🗑️ Starting bulk delete of ${this.selectedIds.size} survey responses`);

      const response = await this.makeAuthenticatedRequest('/api/responses/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({
          ids: Array.from(this.selectedIds),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Clear selections and reload current page
        this.selectedIds.clear();
        this.updateBulkDeleteButton();

        // If we deleted all items on current page and it's not page 1, go to previous page
        if (this.responses.length === result.deletedCount && this.currentPage > 1) {
          this.currentPage--;
        }

        await this.loadResponses(this.currentPage);

        // Show detailed success message
        let message = `✅ ${result.message}`;
        if (result.warnings && result.warnings.length > 0) {
          message += '\n\n⚠️ Cảnh báo:\n' + result.warnings.join('\n');
        }

        this.showNotification(message, 'success');
      } else {
        throw new Error(result.message || 'Lỗi không xác định khi xóa khảo sát');
      }
    } catch (error) {
      console.error('Error bulk deleting responses:', error);
      this.showNotification(`❌ Lỗi khi xóa khảo sát: ${error.message}`, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async exportData() {
    try {
      this.showLoading();

      // Build query parameters for export (same as current filters)
      const params = new URLSearchParams();

      const submittedByFilter = document.getElementById('submittedByFilter');
      if (submittedByFilter && submittedByFilter.value) {
        params.append('submittedBy', submittedByFilter.value);
      }

      const shopFilter = document.getElementById('shopFilter');
      if (shopFilter && shopFilter.value.trim()) {
        params.append('shopName', shopFilter.value.trim());
      }

      const dateFromFilter = document.getElementById('dateFromFilter');
      if (dateFromFilter && dateFromFilter.value) {
        params.append('dateFrom', dateFromFilter.value);
      }

      const dateToFilter = document.getElementById('dateToFilter');
      if (dateToFilter && dateToFilter.value) {
        params.append('dateTo', dateToFilter.value);
      }

      // Fetch all data for export (no pagination)
      params.append('limit', '10000');

      const response = await this.makeAuthenticatedRequest(`/api/responses?${params}`);
      if (!response.ok) {
        throw new Error('Lỗi khi tải dữ liệu export');
      }

      const data = await response.json();
      const responses = data.data || data;

      if (!responses || responses.length === 0) {
        alert('Không có dữ liệu để xuất');
        return;
      }

      this.generateExcel(responses);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Lỗi khi xuất dữ liệu: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  generateExcel(responses) {
    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Headers
    worksheetData.push([
      'Ngày khảo sát',
      'TDL',
      'Shop',
      'Model',
      'Số lượng',
      'POSM',
      'Tất cả POSM',
      'Hình ảnh',
      'User ID',
      'Username',
    ]);

    // Data rows
    responses.forEach((response) => {
      const responseDate = new Date(response.createdAt).toLocaleDateString('vi-VN');

      if (response.responses && response.responses.length > 0) {
        response.responses.forEach((modelResponse) => {
          const posmList = modelResponse.allSelected
            ? 'TẤT CẢ'
            : modelResponse.posmSelections.map((p) => p.posmCode).join(', ');

          const images = modelResponse.images ? modelResponse.images.join('; ') : '';

          worksheetData.push([
            responseDate,
            response.leader || 'Unknown User',
            response.shopName,
            modelResponse.model,
            modelResponse.quantity || 1,
            posmList,
            modelResponse.allSelected ? 'Có' : 'Không',
            images,
            response.submittedById || '',
            response.submittedBy || '',
          ]);
        });
      } else {
        worksheetData.push([
          responseDate,
          response.submittedBy || 'Unknown User',
          response.shopName,
          '',
          '',
          '',
          '',
          '',
          response.submittedById || '',
          response.submittedBy || '',
        ]);
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kết quả khảo sát');

    // Generate filename with current date
    const now = new Date();
    const filename = `ket-qua-khao-sat-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}.xlsx`;

    XLSX.writeFile(workbook, filename);
  }

  // Enhanced confirmation dialog for bulk delete
  showBulkDeleteConfirmation() {
    return new Promise((resolve) => {
      const selectedCount = this.selectedIds.size;
      const selectedResponses = this.responses.filter((r) => this.selectedIds.has(r._id));

      let detailsHtml = '';
      if (selectedResponses.length > 0) {
        detailsHtml = selectedResponses
          .slice(0, 5)
          .map(
            (r) =>
              `<li>${r.submittedBy || 'Unknown User'} - ${r.shopName} (${new Date(r.createdAt).toLocaleDateString('vi-VN')})</li>`
          )
          .join('');
        if (selectedCount > 5) {
          detailsHtml += `<li style="font-style: italic;">... và ${selectedCount - 5} khảo sát khác</li>`;
        }
      }

      // Create enhanced confirmation dialog
      const dialogHtml = `
                <div id="bulkDeleteDialog" class="confirm-dialog" style="display: flex;">
                    <div class="confirm-content" style="max-width: 500px;">
                        <h3>🗑️ Xác nhận xóa hàng loạt</h3>
                        <p>Bạn có chắc chắn muốn xóa <strong>${selectedCount} khảo sát</strong> đã chọn?</p>
                        ${
                          detailsHtml
                            ? `
                            <div style="margin: 15px 0;">
                                <strong>Các khảo sát sẽ bị xóa:</strong>
                                <ul style="max-height: 120px; overflow-y: auto; margin: 5px 0; padding-left: 20px;">
                                    ${detailsHtml}
                                </ul>
                            </div>
                        `
                            : ''
                        }
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 10px 0;">
                            <strong>⚠️ Cảnh báo:</strong> Hành động này không thể hoàn tác. Tất cả dữ liệu và hình ảnh liên quan sẽ bị xóa vĩnh viễn.
                        </div>
                        <div class="confirm-buttons">
                            <button id="btnConfirmBulkDelete" class="btn-confirm" style="background: #dc3545;">Xóa ${selectedCount} khảo sát</button>
                            <button id="btnCancelBulkDelete" class="btn-cancel">Hủy</button>
                        </div>
                    </div>
                </div>
            `;

      // Remove existing dialog if any
      const existingDialog = document.getElementById('bulkDeleteDialog');
      if (existingDialog) {
        existingDialog.remove();
      }

      // Add dialog to body
      document.body.insertAdjacentHTML('beforeend', dialogHtml);

      // Add event listeners
      document.getElementById('btnConfirmBulkDelete').addEventListener('click', () => {
        document.getElementById('bulkDeleteDialog').remove();
        resolve(true);
      });

      document.getElementById('btnCancelBulkDelete').addEventListener('click', () => {
        document.getElementById('bulkDeleteDialog').remove();
        resolve(false);
      });

      // Close on background click
      document.getElementById('bulkDeleteDialog').addEventListener('click', (e) => {
        if (e.target.id === 'bulkDeleteDialog') {
          document.getElementById('bulkDeleteDialog').remove();
          resolve(false);
        }
      });
    });
  }

  // Enhanced notification system
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

  toggleSurveyExpansion(surveyId) {
    if (this.expandedSurveys.has(surveyId)) {
      this.expandedSurveys.delete(surveyId);
    } else {
      this.expandedSurveys.add(surveyId);
    }
    this.renderResponses();
  }

  setupShopAutocomplete() {
    const shopFilter = document.getElementById('shopFilter');
    const dropdown = document.getElementById('shopDropdown');

    if (!shopFilter || !dropdown) {
      return;
    }

    let highlightedIndex = -1;

    // Handle input events
    shopFilter.addEventListener('input', (e) => {
      const value = e.target.value.toLowerCase();
      highlightedIndex = -1;

      if (value.length === 0) {
        dropdown.classList.remove('show');
        dropdown.innerHTML = '';
        return;
      }

      // Filter shops based on input
      const filteredShops = (this.allShops || []).filter((shop) =>
        shop.toLowerCase().includes(value)
      );

      if (filteredShops.length === 0) {
        dropdown.classList.remove('show');
        dropdown.innerHTML = '';
        return;
      }

      // Populate dropdown
      dropdown.innerHTML = filteredShops
        .map(
          (shop, index) =>
            `<div class="autocomplete-item" data-index="${index}" data-shop="${shop}">
                    ${shop}
                </div>`
        )
        .join('');

      dropdown.classList.add('show');

      // Add click handlers to dropdown items
      dropdown.querySelectorAll('.autocomplete-item').forEach((item) => {
        item.addEventListener('click', () => {
          shopFilter.value = item.dataset.shop;
          dropdown.classList.remove('show');
          dropdown.innerHTML = '';

          // Trigger filter reload
          this.currentPage = 1;
          this.loadResponses(1);
        });
      });
    });

    // Handle keyboard navigation
    shopFilter.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.autocomplete-item');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
        this.updateHighlight(items, highlightedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, -1);
        this.updateHighlight(items, highlightedIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          items[highlightedIndex].click();
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('show');
        dropdown.innerHTML = '';
        highlightedIndex = -1;
      }
    });

    // Handle filter change to reload data
    shopFilter.addEventListener('blur', () => {
      // Delay to allow click events to fire
      setTimeout(() => {
        dropdown.classList.remove('show');
        dropdown.innerHTML = '';

        // Trigger filter reload if value changed
        this.currentPage = 1;
        this.loadResponses(1);
      }, 150);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!shopFilter.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
        dropdown.innerHTML = '';
      }
    });
  }

  updateHighlight(items, index) {
    items.forEach((item, i) => {
      item.classList.toggle('highlighted', i === index);
    });

    // Scroll highlighted item into view
    if (index >= 0 && items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  // Edit functionality
  async openEditDialog(surveyId) {
    try {
      // Fetch full survey data
      const surveyData = await this.fetchSurveyForEdit(surveyId);
      if (!surveyData) {
        return;
      }

      // Generate edit form
      const editForm = this.generateEditForm(surveyData);

      // Show modal
      document.getElementById('editModalBody').innerHTML = editForm;
      document.getElementById('editSurveyDialog').style.display = 'flex';

      // Bind save event
      document.getElementById('btnSaveEdit').onclick = () => this.saveSurveyEdit(surveyId);
    } catch (error) {
      console.error('Error opening edit dialog:', error);
      this.showNotification('Lỗi khi mở dialog chỉnh sửa: ' + error.message, 'error');
    }
  }

  async fetchSurveyForEdit(surveyId) {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/responses/${surveyId}`, {
        method: 'GET',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return result.data;
        } else {
          throw new Error(result.message || 'Invalid response format');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching survey for edit:', error);
      this.showNotification('Lỗi khi tải dữ liệu khảo sát: ' + error.message, 'error');
      return null;
    }
  }

  generateEditForm(surveyData) {
    return `
            <form id="editSurveyForm" class="edit-form">
                <!-- Store Information Section -->
                <div class="form-section">
                    <h4>📍 Thông tin cửa hàng (Chỉ xem)</h4>
                    <div class="form-group">
                        <label>Tên cửa hàng:</label>
                        <input type="text" value="${this.escapeHtml(surveyData.shopName || '')}" readonly class="readonly-field">
                        <input type="hidden" name="shopName" value="${this.escapeHtml(surveyData.shopName || '')}">
                    </div>
                    <div class="form-group">
                        <label>Mã cửa hàng:</label>
                        <input type="text" value="${this.escapeHtml(surveyData.leader || '')}" readonly class="readonly-field">
                        <input type="hidden" name="shopId" value="${this.escapeHtml(surveyData.leader || '')}">
                    </div>
                    <div class="form-group">
                        <label>Người thực hiện:</label>
                        <input type="text" value="${this.escapeHtml(surveyData.submittedBy || '')}" readonly class="readonly-field">
                        <input type="hidden" name="submittedBy" value="${this.escapeHtml(surveyData.submittedBy || '')}">
                    </div>
                </div>
                
                <!-- Survey Responses Section -->
                <div class="form-section">
                    <h4>📋 Phản hồi khảo sát</h4>
                    <div id="editableResponses">
                        ${this.generateEditableResponses(surveyData.responses || [])}
                    </div>
                    <button type="button" onclick="surveyResultsApp.addNewResponse()" class="btn-add-response">
                        ➕ Thêm model mới
                    </button>
                </div>
            </form>
        `;
  }

  generateEditableResponses(responses) {
    return responses
      .map((response, index) => `
        <div class="editable-response" data-index="${index}" data-response-index="${index}">
            <div class="model-header">
                <h5>📦 Model ${index + 1}:</h5>
                <button type="button" onclick="surveyResultsApp.removeResponse(${index})" class="btn-remove-inline">
                    🗑️ Xóa
                </button>
            </div>
            <div class="form-group">
                <label>Tên model:</label>
                <input type="text" 
                       name="responses[${index}][model]" 
                       value="${this.escapeHtml(response.model || '')}" 
                       onchange="surveyResultsApp.handleModelChange(${index}, this.value)"
                       required>
            </div>
            <div class="form-group">
                <label>Số lượng:</label>
                <input type="number" 
                       name="responses[${index}][quantity]" 
                       value="${response.quantity || 0}" 
                       min="0" 
                       required>
            </div>
            <div class="form-group">
                <label>POSM có thể chọn:</label>
                <div class="posm-container" data-response-index="${index}">
                    ${this.generatePosmCheckboxesForModel(response.model, response.posmSelections || [], index)}
                </div>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" 
                           name="responses[${index}][allSelected]" 
                           ${response.allSelected ? 'checked' : ''}>
                    Chọn tất cả POSM
                </label>
            </div>
            <div class="form-group">
                <label>Ghi chú:</label>
                <textarea name="responses[${index}][notes]" 
                          rows="3">${this.escapeHtml(response.notes || '')}</textarea>
            </div>
        </div>
      `)
      .join('');
  }

  generatePosmCheckboxes(posmSelections, responseIndex) {
    // Define common POSM items
    const commonPosmItems = [
      { code: 'DISPLAY', name: 'Display' },
      { code: 'SHELF_TALKER', name: 'Shelf Talker' },
      { code: 'BANNER', name: 'Banner' },
      { code: 'POSTER', name: 'Poster' },
      { code: 'STANDEE', name: 'Standee' },
      { code: 'FLYER', name: 'Flyer' },
      { code: 'BROCHURE', name: 'Brochure' },
      { code: 'WOBBLER', name: 'Wobbler' },
    ];

    return `
            <div class="posm-checkboxes">
                ${commonPosmItems
                  .map((item) => {
                    const isSelected = posmSelections.some(
                      (p) =>
                        (p.posmCode === item.code || p.code === item.code) &&
                        (p.selected || p.isSelected !== false)
                    );
                    return `
                        <div class="posm-checkbox">
                            <input type="checkbox" 
                                   name="responses[${responseIndex}][posmSelections]" 
                                   value="${item.code}" 
                                   ${isSelected ? 'checked' : ''}>
                            <span>${item.name}</span>
                        </div>
                    `;
                  })
                  .join('')}
            </div>
        `;
  }

  // Dynamic POSM Loading Methods
  async loadPosmForModel(modelName, responseIndex) {
    try {
      if (!modelName || modelName.trim() === '') {
        return this.generateDefaultPosmCheckboxes([], responseIndex);
      }

      const response = await this.makeAuthenticatedRequest(`/api/model-posm/${encodeURIComponent(modelName)}`, {
        method: 'GET',
      });

      if (response.ok) {
        const result = await response.json();
        const posmData = result.success ? result.data : result; // Handle both formats
        return this.generateDynamicPosmCheckboxes(posmData, [], responseIndex);
      } else {
        console.warn(`No POSM data found for model: ${modelName}, using default`);
        return this.generateDefaultPosmCheckboxes([], responseIndex);
      }
    } catch (error) {
      console.error('Error loading POSM for model:', error);
      return this.generateDefaultPosmCheckboxes([], responseIndex);
    }
  }

  generateDynamicPosmCheckboxes(availablePosmItems, selectedPosmItems, responseIndex) {
    if (!availablePosmItems || availablePosmItems.length === 0) {
      return `<div class="no-posm-message">Không có POSM nào cho model này</div>`;
    }

    return `
      <div class="posm-checkboxes">
          ${availablePosmItems.map((item) => {
            const isSelected = selectedPosmItems.some(
              (p) =>
                (p.posmCode === item.posmCode || p.code === item.posmCode) &&
                (p.selected || p.isSelected !== false)
            );
            return `
              <div class="posm-checkbox">
                  <input type="checkbox" 
                         name="responses[${responseIndex}][posmSelections]" 
                         value="${item.posmCode}" 
                         ${isSelected ? 'checked' : ''}>
                  <span>${item.posmName}</span>
              </div>
            `;
          }).join('')}
      </div>
    `;
  }

  generateDefaultPosmCheckboxes(selectedPosmItems, responseIndex) {
    const defaultItems = [
      { posmCode: 'DISPLAY', posmName: 'Display' },
      { posmCode: 'SHELF_TALKER', posmName: 'Shelf Talker' },
      { posmCode: 'BANNER', posmName: 'Banner' },
      { posmCode: 'POSTER', posmName: 'Poster' },
    ];
    
    return this.generateDynamicPosmCheckboxes(defaultItems, selectedPosmItems, responseIndex);
  }

  async handleModelChange(responseIndex, modelName) {
    const posmContainer = document.querySelector(`[data-response-index="${responseIndex}"] .posm-container`);
    if (posmContainer) {
      posmContainer.innerHTML = '<div class="loading">Đang tải POSM...</div>';
      const posmHtml = await this.loadPosmForModel(modelName, responseIndex);
      posmContainer.innerHTML = posmHtml;
    }
  }

  generatePosmCheckboxesForModel(modelName, selectedPosmItems, responseIndex) {
    // For initial load, we'll load POSM asynchronously after the form is rendered
    // This is a placeholder that will be replaced by dynamic loading
    setTimeout(() => {
      this.loadAndUpdatePosmForResponse(modelName, selectedPosmItems, responseIndex);
    }, 100);
    
    return '<div class="loading">Đang tải POSM...</div>';
  }

  async loadAndUpdatePosmForResponse(modelName, selectedPosmItems, responseIndex) {
    try {
      const posmHtml = await this.loadPosmForModel(modelName, responseIndex);
      const container = document.querySelector(`[data-response-index="${responseIndex}"] .posm-container`);
      if (container) {
        container.innerHTML = posmHtml;
        
        // Restore selected items
        selectedPosmItems.forEach(selected => {
          const checkbox = container.querySelector(`input[value="${selected.posmCode || selected.code}"]`);
          if (checkbox) {
            checkbox.checked = true;
          }
        });
      }
    } catch (error) {
      console.error('Error loading POSM for response:', error);
    }
  }

  async saveSurveyEdit(surveyId) {
    try {
      const formData = new FormData(document.getElementById('editSurveyForm'));
      const editData = this.serializeEditForm(formData);

      // Show loading
      this.showSaveLoading();

      const response = await this.makeAuthenticatedRequest(`/api/responses/${surveyId}`, {
        method: 'PUT',
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        const result = await response.json();

        // Log the changes
        await this.logSurveyChanges(surveyId, editData);

        // Success
        this.showNotification('Khảo sát đã được cập nhật thành công', 'success');
        this.closeEditDialog();
        this.loadResponses(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error saving survey edit:', error);
      this.showNotification('Lỗi khi lưu thay đổi: ' + error.message, 'error');
    } finally {
      this.hideSaveLoading();
    }
  }

  async logSurveyChanges(surveyId, editData) {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const changeLog = {
        surveyId,
        changedBy: user ? user.username : 'unknown',
        changedAt: new Date().toISOString(),
        changes: editData,
        action: 'SURVEY_EDITED',
      };

      await this.makeAuthenticatedRequest('/api/audit/log', {
        method: 'POST',
        body: JSON.stringify(changeLog),
      });
    } catch (error) {
      console.warn('Could not log survey changes:', error);
      // Don't fail the edit operation if logging fails
    }
  }

  serializeEditForm(formData) {
    const data = {
      shopName: formData.get('shopName'),
      shopId: formData.get('shopId'),
      submittedBy: formData.get('submittedBy'),
      responses: [],
    };

    // Process responses
    const responses = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('responses[')) {
        const matches = key.match(/responses\[(\d+)\]\[([^\]]+)\]/);
        if (matches) {
          const [, index, field] = matches;
          if (!responses[index]) {
            responses[index] = {
              posmSelections: [],
            };
          }

          if (field === 'posmSelections') {
            responses[index].posmSelections.push({
              posmCode: value,
              code: value,
              selected: true,
              isSelected: true,
            });
          } else if (field === 'allSelected') {
            responses[index][field] = value === 'on';
          } else {
            responses[index][field] = value;
          }
        }
      }
    }

    data.responses = Object.values(responses);
    return data;
  }

  closeEditDialog() {
    document.getElementById('editSurveyDialog').style.display = 'none';
    document.getElementById('editModalBody').innerHTML = '';
  }

  showSaveLoading() {
    const saveBtn = document.getElementById('btnSaveEdit');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Đang lưu...';
  }

  hideSaveLoading() {
    const saveBtn = document.getElementById('btnSaveEdit');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '💾 Lưu thay đổi';
  }

  addNewResponse() {
    const responsesContainer = document.getElementById('editableResponses');
    const currentResponses = responsesContainer.querySelectorAll('.editable-response');
    const newIndex = currentResponses.length;

    const newResponseHtml = `
      <div class="editable-response" data-index="${newIndex}" data-response-index="${newIndex}">
          <div class="model-header">
              <h5>📦 Model ${newIndex + 1}:</h5>
              <button type="button" onclick="surveyResultsApp.removeResponse(${newIndex})" class="btn-remove-inline">
                  🗑️ Xóa
              </button>
          </div>
          <div class="form-group">
              <label>Tên model:</label>
              <input type="text" 
                     name="responses[${newIndex}][model]" 
                     value="" 
                     onchange="surveyResultsApp.handleModelChange(${newIndex}, this.value)"
                     required>
          </div>
          <div class="form-group">
              <label>Số lượng:</label>
              <input type="number" 
                     name="responses[${newIndex}][quantity]" 
                     value="0" 
                     min="0" 
                     required>
          </div>
          <div class="form-group">
              <label>POSM có thể chọn:</label>
              <div class="posm-container" data-response-index="${newIndex}">
                  <div class="no-posm-message">Nhập tên model để xem POSM có thể chọn</div>
              </div>
          </div>
          <div class="form-group">
              <label>
                  <input type="checkbox" name="responses[${newIndex}][allSelected]">
                  Chọn tất cả POSM
              </label>
          </div>
          <div class="form-group">
              <label>Ghi chú:</label>
              <textarea name="responses[${newIndex}][notes]" rows="3"></textarea>
          </div>
      </div>
    `;

    responsesContainer.insertAdjacentHTML('beforeend', newResponseHtml);
  }

  removeResponse(index) {
    const responseElement = document.querySelector(`.editable-response[data-index="${index}"]`);
    if (responseElement && confirm('Bạn có chắc chắn muốn xóa model này?')) {
      responseElement.remove();
    }
  }

  // Utility function to escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global instance of SurveyResultsApp
let surveyResultsApp;

// Initialize the survey results app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  surveyResultsApp = new SurveyResultsApp();
});
