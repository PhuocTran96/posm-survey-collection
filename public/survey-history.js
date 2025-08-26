class SurveyHistoryApp {
    constructor() {
        this.surveys = [];
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalPages = 0;
        this.filters = {
            startDate: '',
            endDate: '',
            storeName: ''
        };
        this.pagination = null;
        this.user = null;
        
        this.init();
    }

    async init() {
        // Check authentication
        const isAuthenticated = await this.checkAuthentication();
        if (!isAuthenticated) {
            return;
        }

        this.setupEventListeners();
        this.initializePagination();
        await this.loadSurveyStats();
        await this.loadSurveyHistory();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('accessToken');
        const userStr = localStorage.getItem('user');
        
        if (!token || !userStr) {
            this.redirectToLogin('Please login to view survey history');
            return false;
        }

        try {
            this.user = JSON.parse(userStr);
            document.getElementById('userDisplayName').textContent = this.user.username;
            document.getElementById('userRole').textContent = `(${this.user.role})`;
            
            // Verify token
            const response = await this.makeAuthenticatedRequest('/api/auth/verify');
            if (!response.ok) {
                throw new Error('Invalid token');
            }
            
            return true;
        } catch (error) {
            console.error('Authentication failed:', error);
            this.redirectToLogin('Session expired. Please login again.');
            return false;
        }
    }

    redirectToLogin(message) {
        localStorage.clear();
        alert(message);
        window.location.href = '/login.html';
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const token = localStorage.getItem('accessToken');
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        return fetch(url, { ...options, ...defaultOptions });
    }

    setupEventListeners() {
        // Filter inputs
        document.getElementById('startDate').addEventListener('change', () => this.updateFilters());
        document.getElementById('endDate').addEventListener('change', () => this.updateFilters());
        document.getElementById('storeName').addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.updateFilters(), 500);
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', logout);

        // Modal close on outside click
        document.getElementById('surveyDetailModal').addEventListener('click', (e) => {
            if (e.target.id === 'surveyDetailModal') {
                this.closeSurveyDetailModal();
            }
        });

        document.getElementById('imageLightbox').addEventListener('click', (e) => {
            if (e.target.id === 'imageLightbox') {
                this.closeLightbox();
            }
        });
    }

    initializePagination() {
        this.pagination = new PaginationComponent('paginationContainer', {
            defaultPageSize: this.pageSize,
            pageSizeOptions: [10, 20, 50],
            showPageInfo: true,
            showPageSizeSelector: true,
            maxVisiblePages: 5
        });

        this.pagination.setCallbacks(
            (page) => this.handlePageChange(page),
            (pageSize) => this.handlePageSizeChange(pageSize)
        );
    }

    handlePageChange(page) {
        this.currentPage = page;
        this.loadSurveyHistory();
    }

    handlePageSizeChange(pageSize) {
        this.pageSize = pageSize;
        this.currentPage = 1;
        this.loadSurveyHistory();
    }

    updateFilters() {
        this.filters.startDate = document.getElementById('startDate').value;
        this.filters.endDate = document.getElementById('endDate').value;
        this.filters.storeName = document.getElementById('storeName').value.trim();
    }

    async loadSurveyStats() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/survey-history/stats');
            if (response.ok) {
                const result = await response.json();
                const stats = result.data;

                document.getElementById('totalSurveys').textContent = stats.totalSurveys || 0;
                document.getElementById('totalStores').textContent = stats.totalStores || 0;
                document.getElementById('totalModels').textContent = stats.totalModels || 0;
                document.getElementById('totalImages').textContent = stats.totalImages || 0;
            }
        } catch (error) {
            console.error('Failed to load survey stats:', error);
        }
    }

    async loadSurveyHistory(fromFilter = false) {
        this.showLoading(true, fromFilter);

        try {
            const params = new URLSearchParams({
                page: this.currentPage.toString(),
                limit: this.pageSize.toString(),
                ...this.filters
            });

            // Remove empty filters
            Object.keys(this.filters).forEach(key => {
                if (!this.filters[key]) {
                    params.delete(key);
                }
            });

            const response = await this.makeAuthenticatedRequest(`/api/survey-history?${params}`);
            
            if (response.ok) {
                const result = await response.json();
                this.surveys = result.data;
                this.renderSurveyTable();
                
                // Update pagination
                if (result.pagination) {
                    this.pagination.setData(result.pagination);
                }
            } else {
                throw new Error('Failed to load survey history');
            }
        } catch (error) {
            console.error('Error loading survey history:', error);
            this.showError('Failed to load survey history. Please try again.');
        } finally {
            this.showLoading(false, fromFilter);
        }
    }

    renderSurveyTable() {
        const tableBody = document.getElementById('surveyTableBody');
        const table = document.getElementById('surveyTable');
        const emptyState = document.getElementById('emptyState');

        if (this.surveys.length === 0) {
            table.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        table.style.display = 'table';
        emptyState.style.display = 'none';

        tableBody.innerHTML = this.surveys.map(survey => `
            <tr>
                <td data-label="Date & Time">${this.formatDateTime(survey.date)}</td>
                <td data-label="Store Name">${this.escapeHtml(survey.storeName)}</td>
                <td data-label="Store ID">${this.escapeHtml(survey.storeId)}</td>
                <td data-label="Status">
                    <span class="status-badge status-${survey.status.toLowerCase()}">
                        ${survey.status}
                    </span>
                </td>
                <td data-label="Models">${survey.responseCount || 0}</td>
                <td data-label="Images">
                    ${survey.hasImages ? '✓' : '-'}
                </td>
                <td data-label="Action">
                    <button class="action-btn" onclick="app.viewSurveyDetail('${survey.id}')">
                        View Details
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderSkeletonRows(count = 8) {
        const tableBody = document.getElementById('surveyTableBody');
        const table = document.getElementById('surveyTable');
        const emptyState = document.getElementById('emptyState');

        table.style.display = 'table';
        emptyState.style.display = 'none';

        const skeletonRows = Array.from({ length: count }, (_, i) => `
            <tr class="skeleton-row">
                <td><div class="skeleton-cell medium"></div></td>
                <td><div class="skeleton-cell long"></div></td>
                <td><div class="skeleton-cell short"></div></td>
                <td><div class="skeleton-cell tiny"></div></td>
                <td><div class="skeleton-cell tiny"></div></td>
                <td><div class="skeleton-cell tiny"></div></td>
                <td><div class="skeleton-cell medium"></div></td>
            </tr>
        `).join('');

        tableBody.innerHTML = skeletonRows;
    }

    async viewSurveyDetail(surveyId) {
        try {
            this.showModalLoading(true);
            
            const response = await this.makeAuthenticatedRequest(`/api/survey-history/${surveyId}`);
            if (response.ok) {
                const result = await response.json();
                this.renderSurveyDetail(result.data);
            } else {
                throw new Error('Failed to load survey details');
            }
        } catch (error) {
            console.error('Error loading survey detail:', error);
            this.showError('Failed to load survey details. Please try again.');
        } finally {
            this.showModalLoading(false);
        }
    }

    renderSurveyDetail(survey) {
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = `Survey Details - ${survey.storeName}`;

        let storeInfo = `<strong>Store:</strong> ${this.escapeHtml(survey.storeName)} (ID: ${this.escapeHtml(survey.storeId)})`;
        if (survey.storeDetails) {
            storeInfo += `<br><strong>Channel:</strong> ${this.escapeHtml(survey.storeDetails.channel || 'N/A')}`;
            storeInfo += `<br><strong>Region:</strong> ${this.escapeHtml(survey.storeDetails.region || 'N/A')}`;
            storeInfo += `<br><strong>Province:</strong> ${this.escapeHtml(survey.storeDetails.province || 'N/A')}`;
        }

        modalBody.innerHTML = `
            <div style="margin-bottom: 30px;">
                <h3>Survey Information</h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                    ${storeInfo}<br>
                    <strong>Submitted:</strong> ${this.formatDateTime(survey.submittedAt)}<br>
                    <strong>Submitted by:</strong> ${this.escapeHtml(survey.submittedBy)} (${this.escapeHtml(survey.submittedByRole)})<br>
                    <strong>Status:</strong> <span class="status-badge status-${survey.status.toLowerCase()}">${survey.status}</span><br>
                    <strong>Total Models:</strong> ${survey.totalModels}<br>
                    <strong>Total Images:</strong> ${survey.totalImages}
                </div>
            </div>

            <div>
                <h3>Survey Responses</h3>
                ${this.renderSurveyResponses(survey.responses)}
            </div>
        `;

        document.getElementById('surveyDetailModal').style.display = 'flex';
    }

    renderSurveyResponses(responses) {
        if (!responses || responses.length === 0) {
            return '<p>No responses recorded.</p>';
        }

        return responses.map((response, index) => `
            <div style="border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; overflow: hidden;">
                <div style="background: #f0f0f0; padding: 15px; border-bottom: 1px solid #ddd;">
                    <h4 style="margin: 0;">Model ${index + 1}: ${this.escapeHtml(response.model)}</h4>
                    <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                        <strong>Quantity:</strong> ${response.quantity} | 
                        <strong>All POSM Selected:</strong> ${response.allSelected ? 'Yes' : 'No'} |
                        <strong>Images:</strong> ${response.imageCount}
                    </div>
                </div>
                
                <div style="padding: 15px;">
                    ${this.renderPosmSelections(response.posmSelections)}
                    ${this.renderImages(response.images)}
                </div>
            </div>
        `).join('');
    }

    renderPosmSelections(posmSelections) {
        if (!posmSelections || posmSelections.length === 0) {
            return '<p><strong>POSM Selections:</strong> None specified</p>';
        }

        const selectedPosm = posmSelections.filter(p => p.selected);
        
        if (selectedPosm.length === 0) {
            return '<p><strong>POSM Selections:</strong> None selected</p>';
        }

        return `
            <div style="margin-bottom: 15px;">
                <strong>Selected POSM:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    ${selectedPosm.map(posm => `
                        <li>${this.escapeHtml(posm.posmName)} (${this.escapeHtml(posm.posmCode)})</li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    renderImages(images) {
        if (!images || images.length === 0) {
            return '<p><strong>Images:</strong> No images uploaded</p>';
        }

        return `
            <div>
                <strong>Images (${images.length}):</strong>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                    ${images.map((imageUrl, index) => `
                        <div style="position: relative;">
                            <img src="${imageUrl}" 
                                 alt="Survey Image ${index + 1}"
                                 style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid #ddd;"
                                 onclick="app.openLightbox('${imageUrl}')"
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE2IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2U8L3RleHQ+PC9zdmc+'">
                            <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">
                                ${index + 1}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    openLightbox(imageUrl) {
        document.getElementById('lightboxImage').src = imageUrl;
        document.getElementById('imageLightbox').style.display = 'flex';
    }

    closeLightbox() {
        document.getElementById('imageLightbox').style.display = 'none';
    }

    closeSurveyDetailModal() {
        document.getElementById('surveyDetailModal').style.display = 'none';
    }

    showModalLoading(show) {
        const modalBody = document.getElementById('modalBody');
        if (show) {
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 15px;">
                    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #2196F3; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <div style="color: #666; font-size: 0.9em;">Loading survey details...</div>
                </div>
            `;
            document.getElementById('surveyDetailModal').style.display = 'flex';
        }
    }

    showLoading(show, fromFilter = false) {
        const overlay = document.getElementById('loadingOverlay');
        
        if (show) {
            if (fromFilter) {
                // Show overlay for filter operations
                overlay.style.display = 'flex';
            } else {
                // Show skeleton for initial/page load
                this.renderSkeletonRows();
            }
        } else {
            // Hide all loading states
            overlay.style.display = 'none';
        }
    }

    showButtonLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        if (loading) {
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    }

    showError(message) {
        alert(message); // Simple error display - could be enhanced with a proper notification system
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for HTML onclick handlers
async function applyFilters() {
    app.showButtonLoading('applyFiltersBtn', true);
    app.updateFilters();
    app.currentPage = 1;
    await app.loadSurveyHistory(true);
    app.showButtonLoading('applyFiltersBtn', false);
}

function clearFilters() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('storeName').value = '';
    app.filters = { startDate: '', endDate: '', storeName: '' };
    app.currentPage = 1;
    app.loadSurveyHistory(true);
}

function logout() {
    localStorage.clear();
    window.location.href = '/login.html';
}

function closeSurveyDetailModal() {
    app.closeSurveyDetailModal();
}

function closeLightbox() {
    app.closeLightbox();
}

// Initialize the app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SurveyHistoryApp();
});