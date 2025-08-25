class StoreManagement {
    constructor() {
        this.stores = [];
        this.selectedStores = new Set();
        this.isEditMode = false;
        this.currentStoreId = null;
        this.filters = {
            channel: '',
            region: '',
            province: '',
            mcp: '',
            isActive: '',
            search: ''
        };

        // Initialize pagination component
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
        this.initializePagination();
        this.loadStoreStats();
        this.loadStores();
        this.loadFilterOptions();
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
            console.log('Store Management: Checking auth for user:', userData.username, userData.role);
            
            // Check if user is admin
            if (userData.role !== 'admin') {
                alert('Access denied: Admin privileges required');
                localStorage.clear();
                window.location.replace('/admin-login.html');
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
                this.token = token;
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
                await this.logout();
            });
            navMenu.appendChild(logoutBtn);
        }
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.clear();
            window.location.replace('/admin-login.html');
        }
    }

    initializePagination() {
        this.pagination = new PaginationComponent('storesPaginationContainer', {
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
        this.loadStores(page);
    }

    handlePageSizeChange(pageSize) {
        this.loadStores(1, pageSize);
    }

    bindEvents() {
        // ESC key to close modals
        document.addEventListener('keydown', (e) => this.handleEscapeKey(e));
        
        // Navigation toggle
        document.getElementById('navMobileToggle')?.addEventListener('click', () => {
            document.querySelector('.admin-nav').classList.toggle('active');
        });

        // Action buttons
        document.getElementById('addStoreBtn').addEventListener('click', () => this.showStoreModal());
        document.getElementById('importStoresBtn').addEventListener('click', () => this.showImportModal());
        document.getElementById('exportStoresBtn').addEventListener('click', () => this.exportStores());

        // Filter events
        document.getElementById('channelFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('regionFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('provinceFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('mcpFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('searchInput').addEventListener('input', this.debounce(() => this.applyFilters(), 300));
        document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearFilters());

        // Bulk actions
        document.getElementById('selectAllStoresBtn').addEventListener('click', () => this.toggleSelectAll());
        document.getElementById('bulkActivateBtn').addEventListener('click', () => this.bulkUpdateStatus(true));
        document.getElementById('bulkDeactivateBtn').addEventListener('click', () => this.bulkUpdateStatus(false));
        document.getElementById('bulkDeleteStoresBtn').addEventListener('click', () => this.bulkDeleteStores());

        // Modal events
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideStoreModal());
        document.getElementById('cancelStoreBtn').addEventListener('click', () => this.hideStoreModal());
        document.getElementById('saveStoreBtn').addEventListener('click', () => this.saveStore());

        // Import modal events
        document.getElementById('closeImportModalBtn').addEventListener('click', () => this.hideImportModal());
        document.getElementById('cancelImportBtn').addEventListener('click', () => this.hideImportModal());
        document.getElementById('selectFileBtn').addEventListener('click', () => document.getElementById('csvFileInput').click());
        document.getElementById('csvFileInput').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('importBtn').addEventListener('click', () => this.importStores());
        document.getElementById('removeFileBtn').addEventListener('click', () => this.removeSelectedFile());

        // File drop zone
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
                document.getElementById('csvFileInput').files = files;
                this.handleFileSelect({ target: { files } });
            }
        });

        // Confirm delete events
        document.getElementById('btnConfirmDelete').addEventListener('click', () => this.confirmDelete());
        document.getElementById('btnCancelDelete').addEventListener('click', () => this.hideConfirmDialog());
    }

    async loadStoreStats() {
        try {
            const response = await fetch('/api/stores/stats', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to load stats');

            const result = await response.json();
            this.displayStats(result.data);
        } catch (error) {
            console.error('Error loading store stats:', error);
        }
    }

    displayStats(stats) {
        const container = document.getElementById('storeStatsContainer');
        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">🏪</div>
                <div class="stat-info">
                    <h3>${stats.overview.totalStores || 0}</h3>
                    <p>Tổng số cửa hàng</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-info">
                    <h3>${stats.overview.activeStores || 0}</h3>
                    <p>Đang hoạt động</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">❌</div>
                <div class="stat-info">
                    <h3>${stats.overview.inactiveStores || 0}</h3>
                    <p>Ngưng hoạt động</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-info">
                    <h3>${stats.channelDistribution?.length || 0}</h3>
                    <p>Kênh phân phối</p>
                </div>
            </div>
        `;
    }

    async loadFilterOptions() {
        try {
            const response = await fetch('/api/stores?limit=1000', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to load stores for filters');

            const result = await response.json();
            const stores = result.data;

            // Get unique values for filters
            const channels = [...new Set(stores.map(s => s.channel))].sort();
            const regions = [...new Set(stores.map(s => s.region))].sort();
            const provinces = [...new Set(stores.map(s => s.province))].sort();

            // Populate filter dropdowns
            this.populateSelect('channelFilter', channels);
            this.populateSelect('regionFilter', regions);
            this.populateSelect('provinceFilter', provinces);

        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }

    populateSelect(selectId, options) {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        
        // Keep the first "All" option and add new options
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });

        // Restore selected value if it still exists
        if (currentValue && options.includes(currentValue)) {
            select.value = currentValue;
        }
    }

    async loadStores(page = null, pageSize = null) {
        this.showLoading(true);
        
        try {
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

            const response = await fetch(`/api/stores?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to load stores');

            const result = await response.json();
            this.stores = result.data || [];
            
            // Update pagination component
            if (this.pagination && result.pagination) {
                this.pagination.setData(result.pagination);
            }
            
            this.displayStores();

        } catch (error) {
            console.error('Error loading stores:', error);
            this.showError('Không thể tải danh sách cửa hàng');
        } finally {
            this.showLoading(false);
        }
    }

    displayStores() {
        const container = document.getElementById('storesContainer');
        
        if (this.stores.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏪</div>
                    <h3>Không có cửa hàng nào</h3>
                    <p>Chưa có dữ liệu cửa hàng hoặc không có kết quả phù hợp với bộ lọc</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <div class="table-container">
                <table class="stores-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="selectAll" ${this.selectedStores.size === this.stores.length ? 'checked' : ''}></th>
                            <th>Store ID</th>
                            <th>Store Code</th>
                            <th>Tên cửa hàng</th>
                            <th>Kênh</th>
                            <th>HC</th>
                            <th>Vùng</th>
                            <th>Tỉnh/TP</th>
                            <th>MCP</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.stores.map(store => `
                            <tr class="${store.isActive ? '' : 'inactive'}">
                                <td>
                                    <input type="checkbox" class="store-checkbox" 
                                           data-store-id="${store._id}" 
                                           ${this.selectedStores.has(store._id) ? 'checked' : ''}>
                                </td>
                                <td class="store-id">${store.store_id}</td>
                                <td class="store-code">${store.store_code || '-'}</td>
                                <td class="store-name">${store.store_name}</td>
                                <td class="channel">${store.channel}</td>
                                <td class="hc">${store.hc}</td>
                                <td class="region">${store.region}</td>
                                <td class="province">${store.province}</td>
                                <td class="mcp">
                                    <span class="badge ${store.mcp === 'Y' ? 'badge-success' : 'badge-secondary'}">
                                        ${store.mcp === 'Y' ? '✓' : '✗'}
                                    </span>
                                </td>
                                <td class="status">
                                    <span class="badge ${store.isActive ? 'badge-success' : 'badge-danger'}">
                                        ${store.isActive ? '● Hoạt động' : '● Tạm dừng'}
                                    </span>
                                </td>
                                <td class="actions">
                                    <button class="btn-icon btn-edit" onclick="storeManager.editStore('${store._id}')" title="Chỉnh sửa cửa hàng">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                        </svg>
                                    </button>
                                    <button class="btn-icon btn-delete" onclick="storeManager.deleteStore('${store._id}')" title="Xóa cửa hàng">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="3,6 5,6 21,6"></polyline>
                                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHTML;

        // Bind checkbox events
        document.getElementById('selectAll').addEventListener('change', (e) => {
            this.handleSelectAll(e.target.checked);
        });

        document.querySelectorAll('.store-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleStoreSelect(e.target.dataset.storeId, e.target.checked);
            });
        });

        this.updateBulkActions();
    }

    displayPagination(pagination) {
        // Implementation similar to user management pagination
        const container = document.querySelector('.pagination-container') || 
                         document.createElement('div');
        container.className = 'pagination-container';

        if (pagination.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="pagination">';
        
        // Previous button
        if (pagination.hasPrevPage) {
            paginationHTML += `<button class="pagination-btn" onclick="storeManager.changePage(${pagination.currentPage - 1})">‹</button>`;
        }

        // Page numbers
        for (let i = Math.max(1, pagination.currentPage - 2); 
             i <= Math.min(pagination.totalPages, pagination.currentPage + 2); 
             i++) {
            paginationHTML += `<button class="pagination-btn ${i === pagination.currentPage ? 'active' : ''}" 
                              onclick="storeManager.changePage(${i})">${i}</button>`;
        }

        // Next button
        if (pagination.hasNextPage) {
            paginationHTML += `<button class="pagination-btn" onclick="storeManager.changePage(${pagination.currentPage + 1})">›</button>`;
        }

        paginationHTML += '</div>';
        container.innerHTML = paginationHTML;

        // Append to stores container if not already present
        if (!document.querySelector('.pagination-container')) {
            document.getElementById('storesContainer').appendChild(container);
        }
    }

    changePage(page) {
        this.currentPage = page;
        this.loadStores();
    }

    applyFilters() {
        this.filters = {
            channel: document.getElementById('channelFilter').value,
            region: document.getElementById('regionFilter').value,
            province: document.getElementById('provinceFilter').value,
            mcp: document.getElementById('mcpFilter').value,
            isActive: document.getElementById('statusFilter').value === 'active' ? 'true' : 
                     document.getElementById('statusFilter').value === 'inactive' ? 'false' : '',
            search: document.getElementById('searchInput').value
        };

        // Reset to first page when filters change
        this.selectedStores.clear();
        this.loadStores(1);
    }

    clearFilters() {
        document.getElementById('channelFilter').value = '';
        document.getElementById('regionFilter').value = '';
        document.getElementById('provinceFilter').value = '';
        document.getElementById('mcpFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('searchInput').value = '';
        
        this.applyFilters();
    }

    handleSelectAll(checked) {
        this.stores.forEach(store => {
            if (checked) {
                this.selectedStores.add(store._id);
            } else {
                this.selectedStores.delete(store._id);
            }
        });

        document.querySelectorAll('.store-checkbox').forEach(checkbox => {
            checkbox.checked = checked;
        });

        this.updateBulkActions();
    }

    handleStoreSelect(storeId, checked) {
        if (checked) {
            this.selectedStores.add(storeId);
        } else {
            this.selectedStores.delete(storeId);
        }

        // Update select all checkbox
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.indeterminate = this.selectedStores.size > 0 && this.selectedStores.size < this.stores.length;
            selectAllCheckbox.checked = this.selectedStores.size === this.stores.length;
        }

        this.updateBulkActions();
    }

    toggleSelectAll() {
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = !selectAllCheckbox.checked;
            this.handleSelectAll(selectAllCheckbox.checked);
        }
    }

    updateBulkActions() {
        const hasSelected = this.selectedStores.size > 0;
        document.getElementById('bulkActivateBtn').disabled = !hasSelected;
        document.getElementById('bulkDeactivateBtn').disabled = !hasSelected;
        document.getElementById('bulkDeleteStoresBtn').disabled = !hasSelected;

        // Update select all button text
        const selectAllBtn = document.getElementById('selectAllStoresBtn');
        if (this.selectedStores.size > 0) {
            selectAllBtn.textContent = `☑️ Bỏ chọn tất cả (${this.selectedStores.size})`;
        } else {
            selectAllBtn.textContent = '☑️ Chọn tất cả';
        }
    }

    // Handle ESC key to close modals
    handleEscapeKey(event) {
        if (event.key === 'Escape') {
            // Check which modal is currently open and close it
            const storeModal = document.getElementById('storeModal');
            const importModal = document.getElementById('importModal');
            const confirmDeleteDialog = document.getElementById('confirmDeleteDialog');
            
            if (storeModal && storeModal.style.display === 'flex') {
                this.hideStoreModal();
            } else if (importModal && importModal.style.display === 'flex') {
                this.hideImportModal();
            } else if (confirmDeleteDialog && confirmDeleteDialog.style.display === 'flex') {
                this.cancelDelete();
            }
        }
    }

    showStoreModal(store = null) {
        this.isEditMode = !!store;
        this.currentStoreId = store?._id || null;

        document.getElementById('modalTitle').textContent = 
            this.isEditMode ? 'Chỉnh sửa cửa hàng' : 'Thêm cửa hàng mới';

        // Reset form
        document.getElementById('storeForm').reset();
        document.getElementById('storeId').value = store?._id || '';

        if (store) {
            document.getElementById('store_id').value = store.store_id || '';
            document.getElementById('store_code').value = store.store_code || '';
            document.getElementById('store_name').value = store.store_name || '';
            document.getElementById('channel').value = store.channel || '';
            document.getElementById('hc').value = store.hc || '';
            document.getElementById('region').value = store.region || '';
            document.getElementById('province').value = store.province || '';
            document.getElementById('mcp').value = store.mcp || '';
            document.getElementById('isActive').checked = store.isActive !== false;
        } else {
            document.getElementById('isActive').checked = true;
        }

        document.getElementById('storeModal').style.display = 'flex';
    }

    hideStoreModal() {
        document.getElementById('storeModal').style.display = 'none';
        this.isEditMode = false;
        this.currentStoreId = null;
    }

    async editStore(storeId) {
        try {
            const response = await fetch(`/api/stores/${storeId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch store');

            const result = await response.json();
            this.showStoreModal(result.data);

        } catch (error) {
            console.error('Error fetching store:', error);
            this.showError('Không thể tải thông tin cửa hàng');
        }
    }

    async saveStore() {
        try {
            const formData = new FormData(document.getElementById('storeForm'));
            const storeData = Object.fromEntries(formData.entries());
            
            // Convert checkbox to boolean
            storeData.isActive = document.getElementById('isActive').checked;
            
            // Convert hc to number
            storeData.hc = parseInt(storeData.hc) || 0;

            const url = this.isEditMode ? `/api/stores/${this.currentStoreId}` : '/api/stores';
            const method = this.isEditMode ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(storeData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to save store');
            }

            this.hideStoreModal();
            this.loadStores();
            this.loadStoreStats();
            this.showSuccess(result.message);

        } catch (error) {
            console.error('Error saving store:', error);
            this.showError(error.message || 'Không thể lưu thông tin cửa hàng');
        }
    }

    deleteStore(storeId) {
        const store = this.stores.find(s => s._id === storeId);
        if (!store) return;

        document.getElementById('deleteConfirmText').textContent = 
            `Bạn có chắc chắn muốn xóa cửa hàng "${store.store_name}"?`;
        
        this.currentStoreId = storeId;
        document.getElementById('confirmDeleteDialog').style.display = 'flex';
    }

    async confirmDelete() {
        if (!this.currentStoreId) return;

        try {
            const response = await fetch(`/api/stores/${this.currentStoreId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to delete store');
            }

            this.hideConfirmDialog();
            this.loadStores();
            this.loadStoreStats();
            this.showSuccess(result.message);

        } catch (error) {
            console.error('Error deleting store:', error);
            this.showError(error.message || 'Không thể xóa cửa hàng');
        }
    }

    hideConfirmDialog() {
        document.getElementById('confirmDeleteDialog').style.display = 'none';
        this.currentStoreId = null;
    }

    async bulkDeleteStores() {
        if (this.selectedStores.size === 0) return;

        const confirmed = confirm(`Bạn có chắc chắn muốn xóa ${this.selectedStores.size} cửa hàng đã chọn?`);
        if (!confirmed) return;

        try {
            const response = await fetch('/api/stores/bulk-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ ids: Array.from(this.selectedStores) })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to delete stores');
            }

            this.selectedStores.clear();
            this.loadStores();
            this.loadStoreStats();
            this.showSuccess(result.message);

        } catch (error) {
            console.error('Error bulk deleting stores:', error);
            this.showError(error.message || 'Không thể xóa các cửa hàng đã chọn');
        }
    }

    async bulkUpdateStatus(isActive) {
        if (this.selectedStores.size === 0) return;

        const action = isActive ? 'kích hoạt' : 'ngưng hoạt động';
        const confirmed = confirm(`Bạn có chắc chắn muốn ${action} ${this.selectedStores.size} cửa hàng đã chọn?`);
        if (!confirmed) return;

        try {
            const updatePromises = Array.from(this.selectedStores).map(storeId => 
                fetch(`/api/stores/${storeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ isActive })
                })
            );

            await Promise.all(updatePromises);

            this.selectedStores.clear();
            this.loadStores();
            this.loadStoreStats();
            this.showSuccess(`Đã ${action} các cửa hàng thành công`);

        } catch (error) {
            console.error('Error bulk updating stores:', error);
            this.showError(`Không thể ${action} các cửa hàng`);
        }
    }

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

        const allowedTypes = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(fileExtension)) {
            this.showError('Chỉ hỗ trợ file .csv, .xlsx, .xls');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showError('File không được vượt quá 5MB');
            return;
        }

        document.getElementById('selectedFileName').textContent = file.name;
        document.getElementById('selectedFileInfo').style.display = 'block';
        document.getElementById('fileDropZone').style.display = 'none';
        document.getElementById('importBtn').disabled = false;
    }

    removeSelectedFile() {
        document.getElementById('csvFileInput').value = '';
        document.getElementById('selectedFileInfo').style.display = 'none';
        document.getElementById('fileDropZone').style.display = 'block';
        document.getElementById('importBtn').disabled = true;
    }

    async importStores() {
        const fileInput = document.getElementById('csvFileInput');
        const file = fileInput.files[0];

        if (!file) {
            this.showError('Vui lòng chọn file để import');
            return;
        }

        const formData = new FormData();
        formData.append('csvFile', file);

        try {
            this.showLoading(true);

            const response = await fetch('/api/stores/import', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to import stores');
            }

            this.hideImportModal();
            this.loadStores();
            this.loadStoreStats();

            // Show detailed import results
            const stats = result.data.stats;
            let message = `Import hoàn tất!\n`;
            message += `• Tạo mới: ${stats.created}\n`;
            message += `• Cập nhật: ${stats.updated}\n`;
            if (stats.errors > 0) {
                message += `• Lỗi: ${stats.errors}\n`;
            }

            this.showSuccess(message);

            if (result.data.errors.length > 0) {
                console.log('Import errors:', result.data.errors);
            }

        } catch (error) {
            console.error('Error importing stores:', error);
            this.showError(error.message || 'Không thể import dữ liệu');
        } finally {
            this.showLoading(false);
        }
    }

    async exportStores() {
        try {
            const response = await fetch('/api/stores/export', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to export stores');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Get filename from response headers or use default
            const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 
                           `stores-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showSuccess('Export dữ liệu thành công');

        } catch (error) {
            console.error('Error exporting stores:', error);
            this.showError('Không thể export dữ liệu');
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showSuccess(message) {
        // Create and show success notification
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        // Create and show error notification
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
}

// Initialize store management
const storeManager = new StoreManagement();