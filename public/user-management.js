class UserManagementApp {
    constructor() {
        // Always initialize as empty arrays to prevent iteration errors
        this.users = [];
        this.filteredUsers = [];
        this.selectedUserIds = new Set();
        this.editingUserId = null;
        this.deleteUserId = null;
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
        this.loadUsers();
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

        // Import modal events
        document.getElementById('closeImportModalBtn').addEventListener('click', () => this.hideImportModal());
        document.getElementById('cancelImportBtn').addEventListener('click', () => this.hideImportModal());
        document.getElementById('selectFileBtn').addEventListener('click', () => document.getElementById('csvFileInput').click());
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

    async loadUsers() {
        try {
            this.showLoading();

            // Initialize as empty arrays to prevent iteration errors
            this.users = [];
            this.filteredUsers = [];

            // Load users and stats in parallel
            const [usersResponse, statsResponse] = await Promise.all([
                this.makeAuthenticatedRequest('/api/users'),
                this.makeAuthenticatedRequest('/api/users/stats')
            ]);

            if (usersResponse && usersResponse.ok) {
                const usersData = await usersResponse.json();
                console.log('Users API response:', usersData);
                
                // Handle the correct API response format
                if (usersData.success && usersData.data) {
                    this.users = Array.isArray(usersData.data) ? usersData.data : [];
                    this.pagination = usersData.pagination || null;
                } else {
                    this.users = [];
                    console.warn('Unexpected users response format:', usersData);
                }
                
                this.filteredUsers = [...this.users];
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
            this.filteredUsers = [];
            this.renderUsers(); // Render empty state
        } finally {
            this.hideLoading();
        }
    }

    populateFilters() {
        // Ensure users is an array and not null/undefined
        if (!Array.isArray(this.users)) {
            console.warn('this.users is not an array:', this.users);
            this.users = [];
            this.filteredUsers = [];
        }

        // Populate leader filter
        const leaders = [...new Set(this.users.map(u => u && u.leader).filter(Boolean))];
        const leaderFilter = document.getElementById('leaderFilter');
        
        if (leaderFilter) {
            leaderFilter.innerHTML = '<option value="">Tất cả Leader</option>';
            leaders.forEach(leader => {
                const option = document.createElement('option');
                option.value = leader;
                option.textContent = leader;
                leaderFilter.appendChild(option);
            });
        }
    }

    applyFilters() {
        // Ensure users is an array before filtering
        if (!Array.isArray(this.users)) {
            console.warn('Cannot apply filters: this.users is not an array');
            this.filteredUsers = [];
            this.renderUsers();
            return;
        }

        const roleFilter = document.getElementById('roleFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const leaderFilter = document.getElementById('leaderFilter')?.value || '';
        const searchInput = document.getElementById('searchInput')?.value?.toLowerCase() || '';

        this.filteredUsers = this.users.filter(user => {
            // Ensure user object exists and has required properties
            if (!user) return false;
            
            const matchesRole = !roleFilter || user.role === roleFilter;
            const matchesStatus = !statusFilter || 
                (statusFilter === 'active' && user.isActive) ||
                (statusFilter === 'inactive' && !user.isActive);
            const matchesLeader = !leaderFilter || user.leader === leaderFilter;
            const matchesSearch = !searchInput || 
                (user.username && user.username.toLowerCase().includes(searchInput)) ||
                (user.userid && user.userid.toLowerCase().includes(searchInput)) ||
                (user.loginid && user.loginid.toLowerCase().includes(searchInput));

            return matchesRole && matchesStatus && matchesLeader && matchesSearch;
        });

        this.renderUsers();
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

        // Ensure filteredUsers is an array
        if (!Array.isArray(this.filteredUsers)) {
            console.warn('this.filteredUsers is not an array:', this.filteredUsers);
            this.filteredUsers = [];
        }

        if (this.filteredUsers.length === 0) {
            const message = Array.isArray(this.users) && this.users.length === 0 
                ? 'Chưa có người dùng nào trong hệ thống' 
                : 'Không tìm thấy người dùng nào phù hợp với bộ lọc';
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

        this.filteredUsers.forEach(user => {
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
            if (Array.isArray(this.filteredUsers)) {
                this.filteredUsers.forEach(user => {
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
        if (!selectAllBtn || !Array.isArray(this.filteredUsers)) return;

        const hasUsers = this.filteredUsers.length > 0;
        const selectedCount = this.selectedUserIds.size;
        const allSelected = hasUsers && selectedCount === this.filteredUsers.length;
        
        if (allSelected) {
            // Deselect all
            this.selectedUserIds.clear();
        } else {
            // Select all current page users
            this.filteredUsers.forEach(user => {
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
            const hasUsers = Array.isArray(this.filteredUsers) && this.filteredUsers.length > 0;
            const allSelected = hasUsers && selectedCount === this.filteredUsers.length;
            
            if (allSelected) {
                selectAllBtn.innerHTML = '❌ Bỏ chọn tất cả';
            } else {
                selectAllBtn.innerHTML = '☑️ Chọn tất cả';
            }
            selectAllBtn.disabled = !hasUsers;
        }
    }

    // User CRUD operations
    showAddUserModal() {
        this.editingUserId = null;
        document.getElementById('modalTitle').textContent = 'Thêm người dùng mới';
        document.getElementById('userForm').reset();
        document.getElementById('userId').value = '';
        document.getElementById('password').required = true;
        document.getElementById('userModal').style.display = 'flex';
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
                document.getElementById('leader').value = user.leader || '';
                document.getElementById('isActive').checked = user.isActive !== false;
                document.getElementById('password').required = false;
                document.getElementById('password').placeholder = 'Để trống nếu không đổi mật khẩu';
                document.getElementById('password').value = '';
                
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
                isActive: formData.get('isActive') === 'on'
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
        document.getElementById('importModal').style.display = 'flex';
        this.removeSelectedFile();
    }

    hideImportModal() {
        document.getElementById('importModal').style.display = 'none';
        this.removeSelectedFile();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const fileName = file.name.toLowerCase();
        const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

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
        document.getElementById('fileDropZone').style.display = 'none';
        document.getElementById('importBtn').disabled = false;
    }

    removeSelectedFile() {
        document.getElementById('csvFileInput').value = '';
        document.getElementById('selectedFileInfo').style.display = 'none';
        document.getElementById('fileDropZone').style.display = 'flex';
        document.getElementById('importBtn').disabled = true;
    }

    async importUsers() {
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

            const response = await this.makeAuthenticatedRequest('/api/users/import/csv', {
                method: 'POST',
                body: formData
            });

            if (response && response.ok) {
                const result = await response.json();
                this.showNotification(result.message || 'Import thành công!', 'success');
                this.hideImportModal();
                this.loadUsers();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Lỗi khi import dữ liệu');
            }
        } catch (error) {
            console.error('Error importing users:', error);
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
                a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
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