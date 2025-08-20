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

    init() {
        this.bindEvents();
        this.loadResponses();
        this.initNavigation();
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

            const response = await fetch(`/api/responses?${params}`);
            
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
            const response = await fetch('/api/responses?limit=10000');
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
            selectAllBtn.innerHTML = '❌ Bỏ chọn tất cả';
        } else {
            // Deselect all
            this.selectedIds.clear();
            selectAllBtn.innerHTML = '☑️ Chọn tất cả';
        }
        
        this.renderResponses();
        this.updateBulkDeleteButton();
    }

    updateBulkDeleteButton() {
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = this.selectedIds.size === 0;
            bulkDeleteBtn.innerHTML = `🗑️ Xóa các khảo sát đã chọn (${this.selectedIds.size})`;
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
            const response = await fetch(`/api/responses/${this.deleteID}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.cancelDelete();
                this.loadResponses(this.currentPage);
                alert('Xóa khảo sát thành công!');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Lỗi khi xóa');
            }
        } catch (error) {
            console.error('Error deleting response:', error);
            alert('Lỗi khi xóa khảo sát: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async handleBulkDelete() {
        if (this.selectedIds.size === 0) return;

        if (!confirm(`Bạn có chắc chắn muốn xóa ${this.selectedIds.size} khảo sát đã chọn?`)) {
            return;
        }

        try {
            this.showLoading();
            const response = await fetch('/api/responses/bulk-delete', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ids: Array.from(this.selectedIds)
                })
            });

            if (response.ok) {
                this.selectedIds.clear();
                this.loadResponses(this.currentPage);
                this.updateBulkDeleteButton();
                alert('Xóa các khảo sát thành công!');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Lỗi khi xóa');
            }
        } catch (error) {
            console.error('Error bulk deleting responses:', error);
            alert('Lỗi khi xóa khảo sát: ' + error.message);
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

            const response = await fetch(`/api/responses?${params}`);
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
            'POSM thiếu',
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
}

// Global instance of SurveyResultsApp
let surveyResultsApp;

// Initialize the survey results app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    surveyResultsApp = new SurveyResultsApp();
});