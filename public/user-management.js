class UserManagementApp {
    constructor() {
        this.users = [];
        this.selectedUserIds = new Set();
        this.editingUserId = null;
        this.deleteUserId = null;
        this.filters = {
            role: '',
            isActive: '',
            leader: '',
            search: ''
        };

        // Initialize pagination component
        this.pagination = null;
        
        // Store transfer properties
        this.allStores = [];
        this.availableStores = [];
        this.assignedStoresList = [];
        this.filteredAvailableStores = [];
        this.selectedAvailableStores = new Set();
        this.selectedAssignedStores = new Set();
        this.storeTransferInitialized = false;

        this.init();
    }

    async init() {
        // Check authentication first
        const isAuthenticated = await this.checkAuthentication();
        if (!isAuthenticated) {
            return; // User will be redirected to login
        }
        
        this.bindEvents();
        this.initializePagination();
        this.loadUsers();
        this.initNavigation();
        this.setupAuthUI();
    }

    initializePagination() {
        this.pagination = new PaginationComponent('usersPaginationContainer', {
            defaultPageSize: 25,
            pageSizeOptions: [10, 25, 50, 100],
            showPageInfo: true,
            showPageSizeSelector: true,
            maxVisiblePages: 7
        });

        this.pagination.setCallbacks(
            (page) => this.handlePageChange(page),
            (pageSize) => this.handlePageSizeChange(pageSize)
        );
    }

    handlePageChange(page) {
        this.loadUsers(page);
    }

    handlePageSizeChange(pageSize) {
        this.loadUsers(1, pageSize);
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
            console.log('User Management: Checking auth for user:', userData.username, userData.role);
            
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
                    'Authorization': `Bearer ${token}`
                }
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
            userInfo.style.cssText = 'font-size: 12px; color: #64748b; font-weight: normal; margin-top: 4px;';
            userInfo.textContent = `Logged in as: ${this.user.username} (${this.user.role})`;
            adminHeader.appendChild(userInfo);
        }

        // Add logout button
        const navMenu = document.querySelector('.nav-menu');
        if (navMenu) {
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
                                    'Authorization': `Bearer ${token}`
                                }
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
                'Authorization': `Bearer ${token}`
            }
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
        
        // Action buttons
        document.getElementById('addUserBtn').addEventListener('click', () => this.showAddUserModal());
        document.getElementById('importUsersBtn').addEventListener('click', () => this.showImportModal());
        document.getElementById('exportUsersBtn').addEventListener('click', () => this.exportUsers());

        // Filter events
        document.getElementById('roleFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('leaderFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
        document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearFilters());

        // Bulk action events
        document.getElementById('selectAllUsersBtn').addEventListener('click', () => this.handleSelectAll());
        document.getElementById('bulkActivateBtn').addEventListener('click', () => this.handleBulkActivate());
        document.getElementById('bulkDeactivateBtn').addEventListener('click', () => this.handleBulkDeactivate());
        document.getElementById('bulkDeleteUsersBtn').addEventListener('click', () => this.handleBulkDelete());

        // Modal events
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideUserModal());
        document.getElementById('cancelUserBtn').addEventListener('click', () => this.hideUserModal());
        document.getElementById('saveUserBtn').addEventListener('click', () => this.saveUser());
        
        // Role change event to update leader dropdown
        document.getElementById('role').addEventListener('change', (e) => this.onRoleChange(e.target.value));

        // Import modal events
        document.getElementById('closeImportModalBtn').addEventListener('click', () => this.hideImportModal());
        document.getElementById('cancelImportBtn').addEventListener('click', () => this.hideImportModal());
        document.getElementById('selectFileBtn').addEventListener('click', () => {
            console.log('🔘 Select file button clicked');
            const fileInput = document.getElementById('csvFileInput');
            console.log('📁 File input element found:', fileInput);
            if (fileInput) {
                fileInput.click();
                console.log('✅ File input clicked');
            } else {
                console.error('❌ File input element not found');
            }
        });
        document.getElementById('csvFileInput').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('removeFileBtn').addEventListener('click', () => this.removeSelectedFile());
        document.getElementById('importBtn').addEventListener('click', () => this.importUsers());

        // Delete confirmation events
        document.getElementById('btnConfirmDelete').addEventListener('click', () => this.confirmDelete());
        document.getElementById('btnCancelDelete').addEventListener('click', () => this.cancelDelete());

        // File drop zone events
        const dropZone = document.getElementById('fileDropZone');
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
            console.log('📂 Files dropped:', files.length, 'files');
            
            if (files.length > 0) {
                const file = files[0];
                console.log('📄 First dropped file:', file.name, file.type, file.size);
                
                // Set the file in the actual file input element
                const fileInput = document.getElementById('csvFileInput');
                if (fileInput) {
                    // Create a new FileList-like object and assign it
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    fileInput.files = dt.files;
                    
                    console.log('✅ File set in input element:', fileInput.files[0]?.name);
                    
                    // Trigger the change event to handle file selection
                    const changeEvent = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(changeEvent);
                } else {
                    console.error('❌ File input element not found for drag-drop');
                }
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

    async loadUsers(page = null, pageSize = null) {
        try {
            this.showLoading();

            const currentPage = page || this.pagination?.getCurrentPage() || 1;
            const limit = pageSize || this.pagination?.getPageSize() || 25;

            const queryParams = new URLSearchParams({
                page: currentPage,
                limit: limit
            });

            // Add filters
            Object.keys(this.filters).forEach(key => {
                if (this.filters[key]) {
                    queryParams.set(key, this.filters[key]);
                }
            });

            // Load users and stats in parallel
            const [usersResponse, statsResponse] = await Promise.all([
                this.makeAuthenticatedRequest(`/api/users?${queryParams}`),
                this.makeAuthenticatedRequest('/api/users/stats')
            ]);

            if (usersResponse && usersResponse.ok) {
                const usersData = await usersResponse.json();
                console.log('Users API response:', usersData);
                
                // Handle the correct API response format
                if (usersData.success && usersData.data) {
                    this.users = Array.isArray(usersData.data) ? usersData.data : [];
                    
                    // Update pagination component
                    if (this.pagination && usersData.pagination) {
                        this.pagination.setData(usersData.pagination);
                    }
                } else {
                    this.users = [];
                    console.warn('Unexpected users response format:', usersData);
                }
                
                this.populateFilters();
                this.renderUsers();
            } else {
                console.error('Failed to load users:', usersResponse ? usersResponse.status : 'No response');
                this.showNotification('Không thể tải danh sách người dùng', 'error');
            }

            if (statsResponse && statsResponse.ok) {
                const statsData = await statsResponse.json();
                console.log('Stats API response:', statsData);
                
                // Handle the correct stats response format
                if (statsData.success && statsData.data) {
                    const stats = {
                        total: statsData.data.overview.totalUsers || 0,
                        active: statsData.data.overview.activeUsers || 0,
                        inactive: statsData.data.overview.inactiveUsers || 0,
                        roles: {}
                    };
                    
                    // Process role distribution
                    if (statsData.data.roleDistribution) {
                        statsData.data.roleDistribution.forEach(role => {
                            stats.roles[role._id] = role.count;
                        });
                    }
                    
                    this.renderStats(stats);
                } else {
                    console.warn('Unexpected stats response format:', statsData);
                }
            } else {
                console.error('Failed to load stats:', statsResponse ? statsResponse.status : 'No response');
            }

        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Lỗi khi tải danh sách người dùng: ' + error.message, 'error');
            
            // Ensure users is always an array even on error
            this.users = [];
            this.renderUsers(); // Render empty state
        } finally {
            this.hideLoading();
        }
    }

    populateFilters() {
        // For server-side pagination, we'll keep the static filter options
        // Leader filter will be populated from server data if needed
        // For now, keep it simple with existing static options
    }

    applyFilters() {
        this.filters = {
            role: document.getElementById('roleFilter')?.value || '',
            isActive: document.getElementById('statusFilter')?.value === 'active' ? 'true' : 
                     document.getElementById('statusFilter')?.value === 'inactive' ? 'false' : '',
            leader: document.getElementById('leaderFilter')?.value || '',
            search: document.getElementById('searchInput')?.value || ''
        };

        // Reset to first page when filters change
        this.selectedUserIds.clear();
        this.loadUsers(1);
    }

    clearFilters() {
        // Clear all filter values safely
        const filters = ['roleFilter', 'statusFilter', 'leaderFilter', 'searchInput'];
        filters.forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.value = '';
            }
        });
        this.applyFilters();
    }

    renderStats(stats) {
        const container = document.getElementById('userStatsContainer');
        if (!container || !stats) return;

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.total || 0}</div>
                <div class="stat-label">Tổng người dùng</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.active || 0}</div>
                <div class="stat-label">Đang hoạt động</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.inactive || 0}</div>
                <div class="stat-label">Đã khóa</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.roles ? Object.keys(stats.roles).length : 0}</div>
                <div class="stat-label">Loại vai trò</div>
            </div>
        `;
    }

    renderUsers() {
        const container = document.getElementById('usersContainer');
        if (!container) {
            console.warn('usersContainer element not found');
            return;
        }

        // Ensure users is an array
        if (!Array.isArray(this.users)) {
            console.warn('this.users is not an array:', this.users);
            this.users = [];
        }

        if (this.users.length === 0) {
            const message = 'Chưa có người dùng nào trong hệ thống hoặc không có kết quả phù hợp với bộ lọc';
            container.innerHTML = `<div class="no-data">${message}</div>`;
            this.updateBulkActionButtons();
            return;
        }

        let html = `
            <div class="users-table">
                <div class="table-header">
                    <div class="table-row">
                        <div class="table-cell checkbox-cell">
                            <input type="checkbox" id="selectAllCheckbox" onchange="userManagementApp.toggleSelectAll()">
                        </div>
                        <div class="table-cell">User ID</div>
                        <div class="table-cell">Họ và tên</div>
                        <div class="table-cell">Login ID</div>
                        <div class="table-cell">Vai trò</div>
                        <div class="table-cell">Leader</div>
                        <div class="table-cell">Trạng thái</div>
                        <div class="table-cell">Đăng nhập cuối</div>
                        <div class="table-cell">Thao tác</div>
                    </div>
                </div>
                <div class="table-body">
        `;

        this.users.forEach(user => {
            const isSelected = this.selectedUserIds.has(user._id);
            const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString('vi-VN') : 'Chưa đăng nhập';
            const statusClass = user.isActive ? 'status-active' : 'status-inactive';
            const statusText = user.isActive ? 'Hoạt động' : 'Đã khóa';

            html += `
                <div class="table-row">
                    <div class="table-cell checkbox-cell">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onchange="userManagementApp.toggleUserSelection('${user._id}')">
                    </div>
                    <div class="table-cell">
                        <strong>${user.userid}</strong>
                    </div>
                    <div class="table-cell">${user.username}</div>
                    <div class="table-cell">${user.loginid}</div>
                    <div class="table-cell">
                        <span class="role-badge role-${user.role.toLowerCase()}">${user.role}</span>
                    </div>
                    <div class="table-cell">${user.leader || '-'}</div>
                    <div class="table-cell">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="table-cell">${lastLogin}</div>
                    <div class="table-cell">
                        <div class="action-buttons">
                            <button class="btn-action btn-edit" onclick="userManagementApp.editUser('${user._id}')" title="Chỉnh sửa">
                                ✏️
                            </button>
                            <button class="btn-action btn-reset" onclick="userManagementApp.resetUserPassword('${user._id}')" title="Reset mật khẩu">
                                🔑
                            </button>
                            <button class="btn-action btn-toggle" onclick="userManagementApp.toggleUserStatus('${user._id}')" title="${user.isActive ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}">
                                ${user.isActive ? '❌' : '✅'}
                            </button>
                            <button class="btn-action btn-delete" onclick="userManagementApp.deleteUser('${user._id}')" title="Xóa">
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
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        const isChecked = selectAllCheckbox ? selectAllCheckbox.checked : false;
        
        if (isChecked) {
            if (Array.isArray(this.users)) {
                this.users.forEach(user => {
                    if (user && user._id) {
                        this.selectedUserIds.add(user._id);
                    }
                });
            }
        } else {
            this.selectedUserIds.clear();
        }
        
        this.renderUsers();
    }

    handleSelectAll() {
        // This method is called by the bulk action button
        const selectAllBtn = document.getElementById('selectAllUsersBtn');
        if (!selectAllBtn || !Array.isArray(this.users)) return;

        const hasUsers = this.users.length > 0;
        const selectedCount = this.selectedUserIds.size;
        const allSelected = hasUsers && selectedCount === this.users.length;
        
        if (allSelected) {
            // Deselect all
            this.selectedUserIds.clear();
        } else {
            // Select all current page users
            this.users.forEach(user => {
                if (user && user._id) {
                    this.selectedUserIds.add(user._id);
                }
            });
        }
        
        this.renderUsers();
    }

    toggleUserSelection(userId) {
        if (this.selectedUserIds.has(userId)) {
            this.selectedUserIds.delete(userId);
        } else {
            this.selectedUserIds.add(userId);
        }
        this.updateBulkActionButtons();
    }

    updateBulkActionButtons() {
        const selectedCount = this.selectedUserIds ? this.selectedUserIds.size : 0;
        const buttons = ['bulkActivateBtn', 'bulkDeactivateBtn', 'bulkDeleteUsersBtn'];
        
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = selectedCount === 0;
                if (btnId === 'bulkDeleteUsersBtn') {
                    btn.innerHTML = selectedCount > 0 ? 
                        `🗑️ Xóa ${selectedCount} tài khoản đã chọn` : 
                        '🗑️ Xóa các tài khoản đã chọn';
                }
            }
        });

        // Update select all button
        const selectAllBtn = document.getElementById('selectAllUsersBtn');
        if (selectAllBtn) {
            const hasUsers = Array.isArray(this.users) && this.users.length > 0;
            const allSelected = hasUsers && selectedCount === this.users.length;
            
            if (allSelected) {
                selectAllBtn.innerHTML = '❌ Bỏ chọn tất cả';
            } else {
                selectAllBtn.innerHTML = '☑️ Chọn tất cả';
            }
            selectAllBtn.disabled = !hasUsers;
        }
    }

    // Store Transfer List Management - Properties added to existing constructor

    async loadStoresForAssignment() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/stores?limit=5000');
            if (response && response.ok) {
                const storesData = await response.json();
                this.allStores = storesData.success ? storesData.data : [];
                this.populateFilterOptions();
                return this.allStores;
            }
        } catch (error) {
            console.error('Error loading stores:', error);
        }
        this.allStores = [];
        return [];
    }

    populateFilterOptions() {
        // Populate region filter
        const regions = [...new Set(this.allStores.map(store => store.region))].sort();
        const regionSelect = document.getElementById('regionFilterSelect');
        if (regionSelect) {
            regionSelect.innerHTML = '<option value="">🌍 Tất cả vùng</option>' +
                regions.map(region => `<option value="${region}">${region}</option>`).join('');
        }
    }

    async renderStoreTransferInterface(userAssignedStores = []) {
        if (!this.storeTransferInitialized) {
            this.initializeStoreTransferEvents();
            this.storeTransferInitialized = true;
        }

        await this.loadStoresForAssignment();
        
        // Set assigned stores based on user data
        const assignedStoreIds = userAssignedStores.map(store => 
            typeof store === 'string' ? store : store._id
        );
        
        this.assignedStoresList = this.allStores.filter(store => 
            assignedStoreIds.includes(store._id)
        );
        
        this.availableStores = this.allStores.filter(store => 
            !assignedStoreIds.includes(store._id)
        );

        this.applyStoreFilters();
        this.renderStoreLists();
        this.renderStoreChips();
    }

    initializeStoreTransferEvents() {
        // Search and filter events
        document.getElementById('storeSearchInput').addEventListener('input', 
            this.debounce(() => this.applyStoreFilters(), 300));
        document.getElementById('regionFilterSelect').addEventListener('change', 
            () => this.applyStoreFilters());
        document.getElementById('statusFilterSelect').addEventListener('change', 
            () => this.applyStoreFilters());

        // Transfer button events
        document.getElementById('assignSelectedBtn').addEventListener('click', 
            () => this.assignSelectedStores());
        document.getElementById('assignAllBtn').addEventListener('click', 
            () => this.assignAllVisibleStores());
        document.getElementById('removeSelectedBtn').addEventListener('click', 
            () => this.removeSelectedStores());
        document.getElementById('removeAllBtn').addEventListener('click', 
            () => this.removeAllAssignedStores());

        // Bulk action events
        document.getElementById('selectAllVisibleBtn').addEventListener('click', 
            () => this.selectAllVisible());
        document.getElementById('selectByRegionBtn').addEventListener('click', 
            () => this.selectByRegion());
        document.getElementById('selectAllAssignedBtn').addEventListener('click', 
            () => this.selectAllAssigned());
        document.getElementById('clearAllAssignedBtn').addEventListener('click', 
            () => this.clearAllAssigned());
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    applyStoreFilters() {
        const searchTerm = document.getElementById('storeSearchInput').value.toLowerCase();
        const regionFilter = document.getElementById('regionFilterSelect').value;
        const statusFilter = document.getElementById('statusFilterSelect').value;

        this.filteredAvailableStores = this.availableStores.filter(store => {
            const matchesSearch = !searchTerm || 
                store.store_name.toLowerCase().includes(searchTerm) ||
                store.store_id.toLowerCase().includes(searchTerm) ||
                (store.store_code && store.store_code.toLowerCase().includes(searchTerm));
            
            const matchesRegion = !regionFilter || store.region === regionFilter;
            
            const matchesStatus = !statusFilter || 
                (statusFilter === 'active' && store.isActive) ||
                (statusFilter === 'inactive' && !store.isActive);

            return matchesSearch && matchesRegion && matchesStatus;
        });

        this.renderAvailableStores();
        this.updateCounts();
    }

    getSelectedStores() {
        return this.assignedStoresList.map(store => store._id);
    }

    // Store rendering methods
    renderStoreLists() {
        this.renderAvailableStores();
        this.renderAssignedStores();
        this.updateCounts();
        this.updateTransferButtons();
    }

    renderAvailableStores() {
        const container = document.getElementById('availableStoresList');
        if (!container) return;

        if (this.filteredAvailableStores.length === 0) {
            container.innerHTML = '<div class="empty-placeholder">Không có cửa hàng nào khả dụng</div>';
            return;
        }

        container.innerHTML = this.filteredAvailableStores.map(store => this.createStoreItemHTML(store, 'available')).join('');
        
        // Add click events to store items
        container.querySelectorAll('.store-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleStoreItemClick(e, 'available'));
        });
    }

    renderAssignedStores() {
        const container = document.getElementById('assignedStoresList');
        if (!container) return;

        if (this.assignedStoresList.length === 0) {
            container.innerHTML = '<div class="empty-placeholder">Chưa có cửa hàng nào được phân quyền</div>';
            return;
        }

        container.innerHTML = this.assignedStoresList.map(store => this.createStoreItemHTML(store, 'assigned')).join('');
        
        // Add click events to store items
        container.querySelectorAll('.store-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleStoreItemClick(e, 'assigned'));
        });
    }

    createStoreItemHTML(store, listType) {
        const isSelected = listType === 'available' ? 
            this.selectedAvailableStores.has(store._id) : 
            this.selectedAssignedStores.has(store._id);
        
        const statusClass = store.isActive ? 'store-status-active' : 'store-status-inactive';
        
        return `
            <div class="store-item ${isSelected ? 'selected' : ''}" data-store-id="${store._id}">
                <input type="checkbox" ${isSelected ? 'checked' : ''} tabindex="-1">
                <div class="store-item-content">
                    <div class="store-name">${store.store_name}</div>
                    <div class="store-status-indicator ${statusClass}"></div>
                </div>
            </div>
        `;
    }

    renderStoreChips() {
        const container = document.getElementById('assignedStoreChips');
        if (!container) return;

        if (this.assignedStoresList.length === 0) {
            container.className = 'store-chips-container empty';
            container.innerHTML = 'Chưa có cửa hàng nào được phân quyền';
            return;
        }

        container.className = 'store-chips-container';
        container.innerHTML = this.assignedStoresList.map(store => `
            <div class="store-chip">
                <span class="chip-text">${store.store_name}</span>
                <button type="button" class="chip-remove" onclick="userManagementApp.removeStoreFromChips('${store._id}')">
                    ×
                </button>
            </div>
        `).join('');
    }

    removeStoreFromChips(storeId) {
        const store = this.assignedStoresList.find(s => s._id === storeId);
        if (store) {
            this.assignedStoresList = this.assignedStoresList.filter(s => s._id !== storeId);
            this.availableStores.push(store);
            this.applyStoreFilters();
            this.renderStoreLists();
            this.renderStoreChips();
        }
    }

    // Store interaction methods
    handleStoreItemClick(e, listType) {
        const storeItem = e.target.closest('.store-item');
        if (!storeItem) return;
        
        const storeId = storeItem.dataset.storeId;
        const checkbox = storeItem.querySelector('input[type="checkbox"]');
        
        if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
        }
        
        if (listType === 'available') {
            if (checkbox.checked) {
                this.selectedAvailableStores.add(storeId);
            } else {
                this.selectedAvailableStores.delete(storeId);
            }
        } else {
            if (checkbox.checked) {
                this.selectedAssignedStores.add(storeId);
            } else {
                this.selectedAssignedStores.delete(storeId);
            }
        }
        
        storeItem.classList.toggle('selected', checkbox.checked);
        this.updateTransferButtons();
    }

    // Transfer actions
    assignSelectedStores() {
        const selectedIds = Array.from(this.selectedAvailableStores);
        const storesToMove = this.availableStores.filter(store => selectedIds.includes(store._id));
        
        this.assignedStoresList = [...this.assignedStoresList, ...storesToMove];
        this.availableStores = this.availableStores.filter(store => !selectedIds.includes(store._id));
        this.selectedAvailableStores.clear();
        
        this.applyStoreFilters();
        this.renderStoreLists();
        this.renderStoreChips();
    }

    assignAllVisibleStores() {
        this.assignedStoresList = [...this.assignedStoresList, ...this.filteredAvailableStores];
        this.availableStores = this.availableStores.filter(store => 
            !this.filteredAvailableStores.some(filtered => filtered._id === store._id)
        );
        this.selectedAvailableStores.clear();
        
        this.applyStoreFilters();
        this.renderStoreLists();
        this.renderStoreChips();
    }

    removeSelectedStores() {
        const selectedIds = Array.from(this.selectedAssignedStores);
        const storesToMove = this.assignedStoresList.filter(store => selectedIds.includes(store._id));
        
        this.availableStores = [...this.availableStores, ...storesToMove];
        this.assignedStoresList = this.assignedStoresList.filter(store => !selectedIds.includes(store._id));
        this.selectedAssignedStores.clear();
        
        this.applyStoreFilters();
        this.renderStoreLists();
        this.renderStoreChips();
    }

    removeAllAssignedStores() {
        this.availableStores = [...this.availableStores, ...this.assignedStoresList];
        this.assignedStoresList = [];
        this.selectedAssignedStores.clear();
        
        this.applyStoreFilters();
        this.renderStoreLists();
        this.renderStoreChips();
    }

    // Bulk selection methods
    selectAllVisible() {
        this.filteredAvailableStores.forEach(store => {
            this.selectedAvailableStores.add(store._id);
        });
        this.renderAvailableStores();
        this.updateTransferButtons();
    }

    selectByRegion() {
        const regionFilter = document.getElementById('regionFilterSelect').value;
        if (!regionFilter) {
            alert('Vui lòng chọn vùng miền trước');
            return;
        }
        
        this.filteredAvailableStores
            .filter(store => store.region === regionFilter)
            .forEach(store => {
                this.selectedAvailableStores.add(store._id);
            });
        
        this.renderAvailableStores();
        this.updateTransferButtons();
    }

    selectAllAssigned() {
        this.assignedStoresList.forEach(store => {
            this.selectedAssignedStores.add(store._id);
        });
        this.renderAssignedStores();
        this.updateTransferButtons();
    }

    clearAllAssigned() {
        if (confirm('Bạn có chắc chắn muốn xóa tất cả cửa hàng đã phân quyền?')) {
            this.removeAllAssignedStores();
        }
    }

    // UI Update methods
    updateCounts() {
        const availableCountEl = document.getElementById('availableCount');
        const assignedCountEl = document.getElementById('assignedCount');
        
        if (availableCountEl) {
            availableCountEl.textContent = this.filteredAvailableStores.length;
        }
        
        if (assignedCountEl) {
            assignedCountEl.textContent = this.assignedStoresList.length;
        }
    }

    updateTransferButtons() {
        const assignSelectedBtn = document.getElementById('assignSelectedBtn');
        const assignAllBtn = document.getElementById('assignAllBtn');
        const removeSelectedBtn = document.getElementById('removeSelectedBtn');
        const removeAllBtn = document.getElementById('removeAllBtn');
        
        if (assignSelectedBtn) {
            assignSelectedBtn.disabled = this.selectedAvailableStores.size === 0;
        }
        
        if (assignAllBtn) {
            assignAllBtn.disabled = this.filteredAvailableStores.length === 0;
        }
        
        if (removeSelectedBtn) {
            removeSelectedBtn.disabled = this.selectedAssignedStores.size === 0;
        }
        
        if (removeAllBtn) {
            removeAllBtn.disabled = this.assignedStoresList.length === 0;
        }
    }

    // Handle ESC key to close modals
    handleEscapeKey(event) {
        if (event.key === 'Escape') {
            // Check which modal is currently open and close it
            const userModal = document.getElementById('userModal');
            const importModal = document.getElementById('importModal');
            const confirmDeleteDialog = document.getElementById('confirmDeleteDialog');
            
            if (userModal && userModal.style.display === 'flex') {
                this.hideUserModal();
            } else if (importModal && importModal.style.display === 'flex') {
                this.hideImportModal();
            } else if (confirmDeleteDialog && confirmDeleteDialog.style.display === 'flex') {
                this.cancelDelete();
            }
        }
    }

    // Handle role change to filter appropriate leaders
    async onRoleChange(role) {
        await this.loadLeadersDropdown(null, role);
    }

    // Load available leaders for dropdown
    async loadLeadersDropdown(selectedLeader = null, userRole = null) {
        try {
            const response = await this.makeAuthenticatedRequest('/api/users?limit=1000'); // Get all users for leader dropdown
            if (response && response.ok) {
                const usersData = await response.json();
                const users = usersData.success && usersData.data ? usersData.data : [];
                
                // Filter users who can be leaders - show all potential leaders (TDS, TDL, admin)
                // Let the server handle hierarchy validation
                const currentRole = userRole || document.getElementById('role').value;
                
                // Always show all potential leaders regardless of current role
                const potentialLeaders = users.filter(user => 
                    ['TDS', 'TDL', 'admin'].includes(user.role) && user.isActive
                );
                
                console.log('📊 All users loaded:', users.length);
                console.log('👥 Users by role:', users.reduce((acc, user) => {
                    acc[user.role] = (acc[user.role] || 0) + 1;
                    return acc;
                }, {}));
                console.log('👑 Potential leaders found:', potentialLeaders.map(u => `${u.username} (${u.role})`));
                
                // Check if the current role should have a leader
                const rolesNeedingLeader = ['PRT', 'TDS', 'user'];
                const needsLeader = rolesNeedingLeader.includes(currentRole);
                
                const leaderSelect = document.getElementById('leader');
                
                if (!needsLeader) {
                    // No leader needed for this role (TDL, admin)
                    leaderSelect.innerHTML = '<option value="">Không cần Leader</option>';
                    leaderSelect.disabled = true;
                } else {
                    leaderSelect.disabled = false;
                    leaderSelect.innerHTML = '<option value="">Chọn Leader</option>';
                    
                    if (potentialLeaders.length === 0) {
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = 'Không có Leader trong hệ thống';
                        option.disabled = true;
                        leaderSelect.appendChild(option);
                    } else {
                        potentialLeaders.forEach(leader => {
                            const option = document.createElement('option');
                            option.value = leader.username;
                            option.textContent = `${leader.username} (${leader.role})`;
                            if (selectedLeader && leader.username === selectedLeader) {
                                option.selected = true;
                            }
                            leaderSelect.appendChild(option);
                        });
                        
                        console.log(`✅ Loaded ${potentialLeaders.length} potential leaders for role: ${currentRole}`);
                    }
                }
                
            } else {
                console.error('Failed to load leaders for dropdown');
            }
        } catch (error) {
            console.error('Error loading leaders dropdown:', error);
        }
    }

    // User CRUD operations
    async showAddUserModal() {
        this.editingUserId = null;
        document.getElementById('modalTitle').textContent = 'Thêm người dùng mới';
        document.getElementById('userForm').reset();
        document.getElementById('userId').value = '';
        document.getElementById('password').required = true;
        
        // Load available leaders for dropdown
        await this.loadLeadersDropdown();
        
        document.getElementById('userModal').style.display = 'flex';
        
        // Load stores for assignment with dual list interface
        await this.renderStoreTransferInterface();
    }

    async editUser(userId) {
        try {
            this.showLoading();
            const response = await this.makeAuthenticatedRequest(`/api/users/${userId}`);
            
            if (response && response.ok) {
                const userData = await response.json();
                console.log('Edit user API response:', userData);
                
                // Handle the correct API response format
                let user = null;
                if (userData.success && userData.data) {
                    user = userData.data;
                } else if (userData.user) {
                    user = userData.user;
                } else {
                    user = userData;
                }
                
                if (!user || !user._id) {
                    throw new Error('Invalid user data received');
                }
                
                this.editingUserId = userId;
                document.getElementById('modalTitle').textContent = 'Chỉnh sửa người dùng';
                document.getElementById('userId').value = user._id;
                document.getElementById('userid').value = user.userid || '';
                document.getElementById('username').value = user.username || '';
                document.getElementById('loginid').value = user.loginid || '';
                document.getElementById('role').value = user.role || '';
                
                // Load available leaders for dropdown and set current value
                await this.loadLeadersDropdown(user.leader);
                
                document.getElementById('isActive').checked = user.isActive !== false;
                document.getElementById('password').required = false;
                document.getElementById('password').placeholder = 'Để trống nếu không đổi mật khẩu';
                document.getElementById('password').value = '';
                
                // Load stores for assignment with dual list interface
                await this.renderStoreTransferInterface(user.assignedStores || []);
                
                document.getElementById('userModal').style.display = 'flex';
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: Failed to load user`);
            }
        } catch (error) {
            console.error('Error loading user:', error);
            this.showNotification('Lỗi khi tải thông tin người dùng: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    hideUserModal() {
        document.getElementById('userModal').style.display = 'none';
        document.getElementById('userForm').reset();
        this.editingUserId = null;
    }

    async saveUser() {
        const form = document.getElementById('userForm');
        const formData = new FormData(form);
        
        // Validate required fields
        if (!formData.get('userid') || !formData.get('username') || !formData.get('loginid') || !formData.get('role')) {
            this.showNotification('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
            return;
        }

        // Validate password for new users
        if (!this.editingUserId && !formData.get('password')) {
            this.showNotification('Vui lòng nhập mật khẩu cho người dùng mới', 'error');
            return;
        }

        try {
            this.showLoading();
            
            const userData = {
                userid: formData.get('userid'),
                username: formData.get('username'),
                loginid: formData.get('loginid'),
                role: formData.get('role'),
                leader: formData.get('leader') || null,
                isActive: formData.get('isActive') === 'on',
                assignedStores: this.getSelectedStores()
            };

            // Only include password if provided
            if (formData.get('password')) {
                userData.password = formData.get('password');
            }

            const url = this.editingUserId ? `/api/users/${this.editingUserId}` : '/api/users';
            const method = this.editingUserId ? 'PUT' : 'POST';
            
            const response = await this.makeAuthenticatedRequest(url, {
                method,
                body: JSON.stringify(userData)
            });

            if (response && response.ok) {
                const result = await response.json();
                this.showNotification(result.message || 'Lưu thành công!', 'success');
                this.hideUserModal();
                this.loadUsers();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Lỗi khi lưu người dùng');
            }
        } catch (error) {
            console.error('Error saving user:', error);
            this.showNotification('Lỗi khi lưu: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async resetUserPassword(userId) {
        const newPassword = prompt('Nhập mật khẩu mới (ít nhất 6 ký tự):');
        if (!newPassword) return;
        
        if (newPassword.length < 6) {
            this.showNotification('Mật khẩu phải có ít nhất 6 ký tự', 'error');
            return;
        }

        try {
            this.showLoading();
            const response = await this.makeAuthenticatedRequest(`/api/users/${userId}/reset-password`, {
                method: 'POST',
                body: JSON.stringify({ newPassword })
            });

            if (response && response.ok) {
                const result = await response.json();
                this.showNotification(result.message || 'Reset mật khẩu thành công!', 'success');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Lỗi khi reset mật khẩu');
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            this.showNotification('Lỗi khi reset mật khẩu: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async toggleUserStatus(userId) {
        try {
            this.showLoading();
            const user = this.users.find(u => u._id === userId);
            if (!user) return;

            const response = await this.makeAuthenticatedRequest(`/api/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ isActive: !user.isActive })
            });

            if (response && response.ok) {
                const result = await response.json();
                this.showNotification(result.message || 'Cập nhật trạng thái thành công!', 'success');
                this.loadUsers();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Lỗi khi cập nhật trạng thái');
            }
        } catch (error) {
            console.error('Error toggling user status:', error);
            this.showNotification('Lỗi khi cập nhật trạng thái: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    deleteUser(userId) {
        const user = this.users.find(u => u._id === userId);
        if (!user) return;

        document.getElementById('deleteConfirmText').textContent = 
            `Bạn có chắc chắn muốn xóa người dùng "${user.username}" (${user.userid})?`;
        this.deleteUserId = userId;
        document.getElementById('confirmDeleteDialog').style.display = 'flex';
    }

    async confirmDelete() {
        if (!this.deleteUserId) return;

        try {
            this.showLoading();
            const response = await this.makeAuthenticatedRequest(`/api/users/${this.deleteUserId}`, {
                method: 'DELETE'
            });

            if (response && response.ok) {
                const result = await response.json();
                this.showNotification(result.message || 'Xóa thành công!', 'success');
                this.cancelDelete();
                this.loadUsers();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Lỗi khi xóa người dùng');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showNotification('Lỗi khi xóa: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    cancelDelete() {
        document.getElementById('confirmDeleteDialog').style.display = 'none';
        this.deleteUserId = null;
    }

    // Bulk operations
    async handleBulkActivate() {
        if (this.selectedUserIds.size === 0) return;
        
        if (!confirm(`Kích hoạt ${this.selectedUserIds.size} tài khoản đã chọn?`)) return;

        try {
            this.showLoading();
            const userIds = Array.from(this.selectedUserIds);
            
            // Update each user individually (since we don't have a bulk update endpoint)
            const promises = userIds.map(userId => 
                this.makeAuthenticatedRequest(`/api/users/${userId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ isActive: true })
                })
            );

            await Promise.all(promises);
            this.showNotification(`Đã kích hoạt ${userIds.length} tài khoản thành công!`, 'success');
            this.selectedUserIds.clear();
            this.loadUsers();
        } catch (error) {
            console.error('Error bulk activating users:', error);
            this.showNotification('Lỗi khi kích hoạt tài khoản: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleBulkDeactivate() {
        if (this.selectedUserIds.size === 0) return;
        
        if (!confirm(`Khóa ${this.selectedUserIds.size} tài khoản đã chọn?`)) return;

        try {
            this.showLoading();
            const userIds = Array.from(this.selectedUserIds);
            
            // Update each user individually
            const promises = userIds.map(userId => 
                this.makeAuthenticatedRequest(`/api/users/${userId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ isActive: false })
                })
            );

            await Promise.all(promises);
            this.showNotification(`Đã khóa ${userIds.length} tài khoản thành công!`, 'success');
            this.selectedUserIds.clear();
            this.loadUsers();
        } catch (error) {
            console.error('Error bulk deactivating users:', error);
            this.showNotification('Lỗi khi khóa tài khoản: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleBulkDelete() {
        if (this.selectedUserIds.size === 0) return;
        
        if (!confirm(`XÓA VĨNH VIỄN ${this.selectedUserIds.size} tài khoản đã chọn? Hành động này không thể hoàn tác!`)) return;

        try {
            this.showLoading();
            const response = await this.makeAuthenticatedRequest('/api/users/bulk/delete', {
                method: 'DELETE',
                body: JSON.stringify({ userIds: Array.from(this.selectedUserIds) })
            });

            if (response && response.ok) {
                const result = await response.json();
                this.showNotification(result.message || 'Xóa thành công!', 'success');
                this.selectedUserIds.clear();
                this.loadUsers();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Lỗi khi xóa người dùng');
            }
        } catch (error) {
            console.error('Error bulk deleting users:', error);
            this.showNotification('Lỗi khi xóa: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Import/Export functions
    showImportModal() {
        console.log('📤 Opening import modal');
        document.getElementById('importModal').style.display = 'flex';
        this.removeSelectedFile();
        console.log('✅ Import modal opened and reset');
    }

    hideImportModal() {
        console.log('📥 Closing import modal');
        document.getElementById('importModal').style.display = 'none';
        this.removeSelectedFile();
        console.log('✅ Import modal closed and cleaned up');
    }

    handleFileSelect(event) {
        console.log('📁 File selection event triggered:', event);
        const file = event.target.files[0];
        console.log('📄 Selected file:', file);
        
        if (!file) {
            console.log('❌ No file in event');
            return;
        }

        // Validate file type
        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const fileName = file.name.toLowerCase();
        const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

        if (!hasValidExtension) {
            console.log('❌ Invalid file extension:', fileName);
            this.showNotification('Chỉ hỗ trợ file CSV, XLSX, XLS', 'error');
            // Clear the file input
            event.target.value = '';
            return;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            console.log('❌ File too large:', file.size);
            this.showNotification('File quá lớn. Tối đa 5MB', 'error');
            // Clear the file input
            event.target.value = '';
            return;
        }

        console.log('✅ File validation passed:', fileName, 'Size:', file.size);

        // Show selected file
        document.getElementById('selectedFileName').textContent = file.name;
        document.getElementById('selectedFileInfo').style.display = 'flex';
        document.getElementById('fileDropZone').style.display = 'none';
        
        // Enable import button
        const importBtn = document.getElementById('importBtn');
        importBtn.disabled = false;
        console.log('✅ Import button enabled, file ready:', file.name);
    }

    removeSelectedFile() {
        console.log('🗑️ Removing selected file');
        const fileInput = document.getElementById('csvFileInput');
        if (fileInput) {
            fileInput.value = '';
            console.log('✅ File input cleared');
        }
        document.getElementById('selectedFileInfo').style.display = 'none';
        document.getElementById('fileDropZone').style.display = 'flex';
        document.getElementById('importBtn').disabled = true;
        console.log('✅ UI reset, import button disabled');
    }

    async importUsers() {
        const fileInput = document.getElementById('csvFileInput');
        console.log('🔄 Import users called');
        console.log('📁 File input element:', fileInput);
        console.log('📁 Files in input:', fileInput ? fileInput.files : 'No input element');
        
        if (!fileInput) {
            console.log('❌ File input element not found');
            this.showNotification('Lỗi: Không tìm thấy file input element', 'error');
            return;
        }
        
        const file = fileInput.files[0];
        console.log('📄 Selected file:', file);
        
        if (!file) {
            console.log('❌ No file selected');
            this.showNotification('Vui lòng chọn file CSV để import trước khi nhấn Import', 'error');
            return;
        }

        try {
            this.showLoading();
            const formData = new FormData();
            formData.append('csvFile', file);
            
            console.log('📤 Sending import request to /api/users/import/csv');
            console.log('📁 File details:', {
                name: file.name,
                size: file.size,
                type: file.type
            });

            const response = await this.makeAuthenticatedRequest('/api/users/import/csv', {
                method: 'POST',
                body: formData
            });
            
            console.log('📥 Import response status:', response?.status);

            if (response && response.ok) {
                const result = await response.json();
                console.log('✅ Import successful:', result);
                this.showNotification(result.message || 'Import thành công!', 'success');
                this.hideImportModal();
                this.loadUsers();
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Import failed:', response?.status, errorData);
                throw new Error(errorData.message || `Server error: ${response?.status || 'Unknown'}`);
            }
        } catch (error) {
            console.error('❌ Error importing users:', error);
            this.showNotification('Lỗi khi import: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async exportUsers() {
        try {
            this.showLoading();
            const response = await this.makeAuthenticatedRequest('/api/users/export/csv');
            
            if (response && response.ok) {
                // Create download link
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `users-export-${new Date().toISOString().split('T')[0]}.xlsx`;
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
            console.error('Error exporting users:', error);
            this.showNotification('Lỗi khi export: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Notification system
    showNotification(message, type = 'info', duration = 5000) {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());

        const typeStyles = {
            success: 'background: #d4edda; border-color: #c3e6cb; color: #155724;',
            error: 'background: #f8d7da; border-color: #f5c6cb; color: #721c24;',
            warning: 'background: #fff3cd; border-color: #ffeaa7; color: #856404;',
            info: 'background: #d1ecf1; border-color: #bee5eb; color: #0c5460;'
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
}

// Global instance
let userManagementApp;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    userManagementApp = new UserManagementApp();
});