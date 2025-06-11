class AdminApp {
    constructor() {
        this.responses = [];
        this.filteredResponses = [];
        this.deleteID = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadResponses();
    }

    bindEvents() {
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
        
        // Handle leader filter change
        document.getElementById('leaderFilter').addEventListener('change', () => {
            // Clear shop selection when leader changes
            document.getElementById('shopFilter').value = '';
            // Repopulate the shop filter based on selected leader
            this.populateFilters();
            // Then apply filters
            this.applyFilters();
        });

        // Handle other filter changes
        document.getElementById('shopFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateFromFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateToFilter').addEventListener('change', () => this.applyFilters());

        // Handle delete confirmation
        document.getElementById('btnConfirmDelete').addEventListener('click', () => this.confirmDelete());
        document.getElementById('btnCancelDelete').addEventListener('click', () => this.cancelDelete());
    }

    // Add loading overlay methods
    async deleteResponse(id, shopName, leader) {
        this.deleteID = id;
        document.querySelector('#confirmDeleteDialog p').textContent = 
            `Bạn có chắc chắn muốn xóa khảo sát của shop "${shopName}" do leader "${leader}" thực hiện không?`;
        document.getElementById('confirmDeleteDialog').style.display = 'flex';
    }

    // Confirm delete action
    async confirmDelete() {
        if (!this.deleteID) return;

        try {
            this.showLoading();
            const response = await fetch(`/api/responses/${this.deleteID}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            
            if (result.success) {
                alert('Xóa khảo sát thành công.');
                await this.loadResponses();
            } else {
                alert('Lỗi khi xóa khảo sát: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting response:', error);
            alert('Lỗi khi xóa khảo sát. Vui lòng thử lại.');
        } finally {
            this.hideLoading();
            this.cancelDelete();
        }
    }

    cancelDelete() {
        this.deleteID = null;
        document.getElementById('confirmDeleteDialog').style.display = 'none';
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('show');
    }

    async loadResponses() {
        try {
            this.showLoading();
            const response = await fetch('/api/responses');
            this.responses = await response.json();
            this.filteredResponses = [...this.responses];
            
            this.populateFilters();
            this.renderStats();
            this.renderResponses();
        } catch (error) {
            console.error('Error loading responses:', error);
            alert('Lỗi khi tải dữ liệu. Vui lòng thử lại.');
        } finally {
            this.hideLoading();
        }
    }

    populateFilters() {
        const leaderFilter = document.getElementById('leaderFilter').value;
        const leaderSelect = document.getElementById('leaderFilter');
        
        // Populate leader filter
        const leaders = [...new Set(this.responses.map(r => r.leader))];
        const currentSelectedLeader = leaderSelect.value; // Store current selection
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
        if (leaderFilter) {
            // If leader is selected, only show shops for that leader
            filteredShops = [...new Set(this.responses
                .filter(r => r.leader === leaderFilter)
                .map(r => r.shopName))];
        } else {
            // If no leader selected, show all shops
            filteredShops = [...new Set(this.responses.map(r => r.shopName))];
        }

        const shopSelect = document.getElementById('shopFilter');
        shopSelect.innerHTML = '<option value="">Tất cả Shop</option>';
        filteredShops.forEach(shop => {
            const option = document.createElement('option');
            option.value = shop;
            option.textContent = shop;
            shopSelect.appendChild(option);
        });
    }

    applyFilters() {
        const leaderFilter = document.getElementById('leaderFilter').value;
        const shopFilter = document.getElementById('shopFilter').value;
        const dateFromFilter = document.getElementById('dateFromFilter').value;
        const dateToFilter = document.getElementById('dateToFilter').value;

        this.filteredResponses = this.responses.filter(response => {
            // Leader filter
            if (leaderFilter && response.leader !== leaderFilter) {
                return false;
            }

            // Shop filter
            if (shopFilter && response.shopName !== shopFilter) {
                return false;
            }

            // Date filters
            const responseDate = new Date(response.submittedAt);
            
            if (dateFromFilter) {
                const fromDate = new Date(dateFromFilter);
                fromDate.setHours(0, 0, 0, 0); // Set to start of day
                if (responseDate < fromDate) {
                    return false;
                }
            }
            
            if (dateToFilter) {
                const toDate = new Date(dateToFilter);
                toDate.setHours(23, 59, 59, 999); // Set to end of day
                if (responseDate > toDate) {
                    return false;
                }
            }

            return true;
        });

        this.renderStats();
        this.renderResponses();
    }

    renderStats() {
        const container = document.getElementById('statsContainer');
        
        const totalResponses = this.filteredResponses.length;
        const totalLeaders = new Set(this.filteredResponses.map(r => r.leader)).size;
        const totalShops = new Set(this.filteredResponses.map(r => r.shopName)).size;
        
        // Calculate total POSM issues
        let totalPOSMIssues = 0;
        this.filteredResponses.forEach(response => {
            response.responses.forEach(modelResponse => {
                totalPOSMIssues += modelResponse.posmSelections.length;
            });
        });

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${totalResponses}</div>
                <div class="stat-label">Tổng số khảo sát</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalLeaders}</div>
                <div class="stat-label">Số Leader</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalShops}</div>
                <div class="stat-label">Số Shop</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalPOSMIssues}</div>
                <div class="stat-label">Tổng POSM cần thay thế</div>
            </div>
        `;
    }

    renderResponses() {
        const container = document.getElementById('responsesContainer');
        
        if (this.filteredResponses.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <h3>Không có dữ liệu</h3>
                    <p>Không tìm thấy kết quả khảo sát nào phù hợp với bộ lọc hiện tại.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredResponses.map(response => `
            <div class="response-item">
                <div class="response-header">
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
        `).join('');
    }

    renderModelResponses(responses) {
        return responses.map(modelResponse => `
            <div class="model-response">
                <div class="model-title">Model: ${modelResponse.model}</div>
                <div class="posm-selections">
                    ${modelResponse.allSelected ? 
                        '<span class="posm-tag all-selected">TẤT CẢ POSM</span>' :
                        modelResponse.posmSelections.map(posm => 
                            `<span class="posm-tag">${posm.posmCode}</span>`
                        ).join('')
                    }
                </div>
            </div>
        `).join('');
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }    exportData() {
        if (this.filteredResponses.length === 0) {
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
            'POSM Code',
            'POSM Name',
            'All Selected',
            'Submitted At'
        ]);
        
        // Add data rows
        this.filteredResponses.forEach(response => {
            response.responses.forEach(modelResponse => {
                if (modelResponse.allSelected) {
                    excelData.push([
                        response.leader,
                        response.shopName,
                        modelResponse.model,
                        'ALL',
                        'TẤT CẢ POSM',
                        'Yes',
                        this.formatDate(response.submittedAt)
                    ]);
                } else {
                    modelResponse.posmSelections.forEach(posm => {
                        excelData.push([
                            response.leader,
                            response.shopName,
                            modelResponse.model,
                            posm.posmCode,
                            posm.posmName,
                            'No',
                            this.formatDate(response.submittedAt)
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
        excelData.forEach(row => {
            row.forEach((cell, colIndex) => {
                const cellLength = cell ? cell.toString().length : 0;
                maxWidths[colIndex] = Math.max(maxWidths[colIndex] || 0, cellLength + 2);
            });
        });
        
        worksheet['!cols'] = maxWidths.map(width => ({ width: Math.min(width, 50) }));
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'POSM Survey Results');
        
        // Generate filename with current date
        const filename = `posm_survey_results_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Save the file
        XLSX.writeFile(workbook, filename);
    }
}

// Global instance of AdminApp
let adminApp;

// Initialize the admin app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    adminApp = new AdminApp();
});