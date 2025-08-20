class SurveyResultsApp {
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
        try {
            return await window.authManager.makeAuthenticatedRequest(url, options);
        } catch (error) {
            console.error('API request failed:', error);
            if (error.message.includes('Authentication failed')) {
                this.redirectToAdminLogin('Authentication failed');
            }
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
                limit: this.itemsPerPage.toString()
            });

            // Add filters
            const leaderFilter = document.getElementById('leaderFilter');
            if (leaderFilter && leaderFilter.value) {
                params.append('leader', leaderFilter.value);
            }

            const shopFilter = document.getElementById('shopFilter');
            if (shopFilter && shopFilter.value) {
                params.append('shop', shopFilter.value);
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
        const leaderFilter = document.getElementById('leaderFilter');
        const leaderSelect = document.getElementById('leaderFilter');
        
        if (!leaderSelect) return;
        
        const currentSelectedLeader = leaderSelect.value; // Store current selection
        
        // Populate leader filter
        const leaders = [...new Set(responsesToUse.map(r => r.leader))];
        leaderSelect.innerHTML = '<option value="">Tất cả Leader</option>';
        leaders.forEach(leader => {
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
            filteredShops = [...new Set(responsesToUse
                .filter(r => r.leader === leaderFilter.value)
                .map(r => r.shopName))];
        } else {
            // If no leader selected, show all shops
            filteredShops = [...new Set(responsesToUse.map(r => r.shopName))];
        }

        const shopSelect = document.getElementById('shopFilter');
        if (shopSelect) {
            shopSelect.innerHTML = '<option value="">Tất cả Shop</option>';
            filteredShops.forEach(shop => {
                const option = document.createElement('option');
                option.value = shop;
                option.textContent = shop;
                shopSelect.appendChild(option);
            });
        }
    }

    renderStats() {
        const statsContainer = document.getElementById('statsContainer');
        if (!statsContainer) return;

        const totalResponses = this.totalCount || this.responses.length;
        const uniqueLeaders = [...new Set(this.responses.map(r => r.leader))].length;
        const uniqueShops = [...new Set(this.responses.map(r => r.shopName))].length;
        
        let totalModels = 0;
        this.responses.forEach(response => {
            totalModels += response.responses?.length || 0;
        });

        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${totalResponses}</div>
                <div class="stat-label">Tổng khảo sát</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${uniqueLeaders}</div>
                <div class="stat-label">Leader</div>
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
        this.responses.forEach(response => {
            const responseDate = new Date(response.createdAt).toLocaleString('vi-VN');
            const isSelected = this.selectedIds.has(response._id);

            html += `
                <div class="response-item">
                    <div class="response-header">
                        <div class="response-info">
                            <h3>
                                <input type="checkbox" ${isSelected ? 'checked' : ''} 
                                       onchange="surveyResultsApp.toggleSelection('${response._id}')"
                                       style="margin-right: 10px;">
                                ${response.leader} - ${response.shopName}
                            </h3>
                            <div class="response-meta">
                                Ngày khảo sát: ${responseDate}
                            </div>
                        </div>
                        <button class="delete-btn" onclick="surveyResultsApp.showDeleteDialog('${response._id}')">
                            🗑️ Xóa
                        </button>
                    </div>
                    <div class="response-details">
                        ${this.renderModelResponses(response.responses)}
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

        return responses.map(modelResponse => {
            const posmTags = modelResponse.allSelected ? 
                '<span class="posm-tag all-selected">TẤT CẢ POSM</span>' :
                modelResponse.posmSelections.map(posm => 
                    `<span class="posm-tag">${posm.posmCode}</span>`
                ).join('');

            const images = modelResponse.images && modelResponse.images.length > 0 ? 
                modelResponse.images.map(img => 
                    `<img src="${img}" alt="POSM Image" style="max-width:100px;max-height:80px;margin:5px;border-radius:5px;cursor:pointer;" onclick="window.open('${img}')">`
                ).join('') : '';

            return `
                <div class="model-response">
                    <div class="model-title">
                        ${modelResponse.model} (Số lượng: ${modelResponse.quantity || 1})
                    </div>
                    <div class="posm-selections">${posmTags}</div>
                    ${images ? `<div class="response-images" style="margin-top:10px;">${images}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    renderPagination() {
        const paginationHtml = `
            <div class="pagination-container">
                <div class="pagination-info">
                    Hiển thị ${((this.currentPage - 1) * this.itemsPerPage) + 1}-${Math.min(this.currentPage * this.itemsPerPage, this.totalCount)} 
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
            responsesContainer.parentNode.insertBefore(paginationContainer, responsesContainer.nextSibling);
        }
        
        paginationContainer.outerHTML = paginationHtml;
    }

    generatePageNumbers() {
        let pageNumbers = '';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

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
            this.responses.forEach(response => {
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
        if (!this.deleteID) return;

        try {
            this.showLoading();
            const response = await this.makeAuthenticatedRequest(`/api/responses/${this.deleteID}`, {
                method: 'DELETE'
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
        if (this.selectedIds.size === 0) return;

        // Show enhanced confirmation dialog
        if (!await this.showBulkDeleteConfirmation()) {
            return;
        }

        try {
            this.showLoading();
            console.log(`🗑️ Starting bulk delete of ${this.selectedIds.size} survey responses`);
            
            const response = await this.makeAuthenticatedRequest('/api/responses/bulk-delete', {
                method: 'DELETE',
                body: JSON.stringify({
                    ids: Array.from(this.selectedIds)
                })
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

            const leaderFilter = document.getElementById('leaderFilter');
            if (leaderFilter && leaderFilter.value) {
                params.append('leader', leaderFilter.value);
            }

            const shopFilter = document.getElementById('shopFilter');
            if (shopFilter && shopFilter.value) {
                params.append('shop', shopFilter.value);
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
            'Leader', 
            'Shop',
            'Model',
            'Số lượng',
            'POSM',
            'Tất cả POSM',
            'Hình ảnh'
        ]);

        // Data rows
        responses.forEach(response => {
            const responseDate = new Date(response.createdAt).toLocaleDateString('vi-VN');
            
            if (response.responses && response.responses.length > 0) {
                response.responses.forEach(modelResponse => {
                    const posmList = modelResponse.allSelected ? 
                        'TẤT CẢ' : 
                        modelResponse.posmSelections.map(p => p.posmCode).join(', ');
                    
                    const images = modelResponse.images ? modelResponse.images.join('; ') : '';
                    
                    worksheetData.push([
                        responseDate,
                        response.leader,
                        response.shopName,
                        modelResponse.model,
                        modelResponse.quantity || 1,
                        posmList,
                        modelResponse.allSelected ? 'Có' : 'Không',
                        images
                    ]);
                });
            } else {
                worksheetData.push([
                    responseDate,
                    response.leader,
                    response.shopName,
                    '',
                    '',
                    '',
                    '',
                    ''
                ]);
            }
        });

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Kết quả khảo sát');

        // Generate filename with current date
        const now = new Date();
        const filename = `ket-qua-khao-sat-${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}.xlsx`;

        XLSX.writeFile(workbook, filename);
    }

    // Enhanced confirmation dialog for bulk delete
    showBulkDeleteConfirmation() {
        return new Promise((resolve) => {
            const selectedCount = this.selectedIds.size;
            const selectedResponses = this.responses.filter(r => this.selectedIds.has(r._id));
            
            let detailsHtml = '';
            if (selectedResponses.length > 0) {
                detailsHtml = selectedResponses.slice(0, 5).map(r => 
                    `<li>${r.leader} - ${r.shopName} (${new Date(r.createdAt).toLocaleDateString('vi-VN')})</li>`
                ).join('');
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
                        ${detailsHtml ? `
                            <div style="margin: 15px 0;">
                                <strong>Các khảo sát sẽ bị xóa:</strong>
                                <ul style="max-height: 120px; overflow-y: auto; margin: 5px 0; padding-left: 20px;">
                                    ${detailsHtml}
                                </ul>
                            </div>
                        ` : ''}
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

// Global instance of SurveyResultsApp
let surveyResultsApp;

// Initialize the survey results app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize auth manager first
    if (window.authManager) {
        window.authManager.init();
    }
    surveyResultsApp = new SurveyResultsApp();
});