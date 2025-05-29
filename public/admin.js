class AdminApp {
    constructor() {
        this.responses = [];
        this.filteredResponses = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadResponses();
    }

    bindEvents() {
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
        
        // Auto-apply filters when filter values change
        document.getElementById('leaderFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('shopFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateFromFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateToFilter').addEventListener('change', () => this.applyFilters());
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
        // Populate leader filter
        const leaders = [...new Set(this.responses.map(r => r.leader))];
        const leaderSelect = document.getElementById('leaderFilter');
        leaderSelect.innerHTML = '<option value="">Tất cả Leader</option>';
        leaders.forEach(leader => {
            const option = document.createElement('option');
            option.value = leader;
            option.textContent = leader;
            leaderSelect.appendChild(option);
        });

        // Populate shop filter
        const shops = [...new Set(this.responses.map(r => r.shopName))];
        const shopSelect = document.getElementById('shopFilter');
        shopSelect.innerHTML = '<option value="">Tất cả Shop</option>';
        shops.forEach(shop => {
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
            const responseDate = new Date(response.submittedAt).toDateString();
            if (dateFromFilter) {
                const fromDate = new Date(dateFromFilter).toDateString();
                if (responseDate < fromDate) {
                    return false;
                }
            }
            if (dateToFilter) {
                const toDate = new Date(dateToFilter).toDateString();
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
                    <div class="response-date">
                        ${this.formatDate(response.submittedAt)}
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
    }

    exportData() {
        if (this.filteredResponses.length === 0) {
            alert('Không có dữ liệu để xuất.');
            return;
        }

        // Create CSV content
        let csvContent = 'Leader,Shop Name,Model,POSM Code,POSM Name,All Selected,Submitted At\n';
        
        this.filteredResponses.forEach(response => {
            response.responses.forEach(modelResponse => {
                if (modelResponse.allSelected) {
                    csvContent += `"${response.leader}","${response.shopName}","${modelResponse.model}","ALL","TẤT CẢ POSM","Yes","${response.submittedAt}"\n`;
                } else {
                    modelResponse.posmSelections.forEach(posm => {
                        csvContent += `"${response.leader}","${response.shopName}","${modelResponse.model}","${posm.posmCode}","${posm.posmName}","No","${response.submittedAt}"\n`;
                    });
                }
            });
        });

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `posm_survey_results_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize the admin app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdminApp();
});