class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.accessToken = null;
        this.activeTab = 'dashboard';
        this.userManagement = null;
        this.displayManagement = null;
        this.auditLogs = null;
        this.init();
    }

    async init() {
        // Check authentication
        await this.checkAuth();
        
        // Load user info
        this.loadUserInfo();
        
        // Load dashboard data
        await this.loadDashboardStats();
        
        // Initialize components
        this.initUserManagement();
        
    }

    async checkAuth() {
        this.accessToken = localStorage.getItem('accessToken');
        const userStr = localStorage.getItem('user');
        
        if (!this.accessToken || !userStr) {
            this.redirectToLogin();
            return;
        }

        try {
            this.currentUser = JSON.parse(userStr);
            
            // Verify token is still valid
            const response = await this.apiCall('/api/auth/verify', 'GET');
            
            if (!response.ok) {
                throw new Error('Token invalid');
            }

            // Check if user is admin
            if (this.currentUser.role !== 'admin') {
                this.showNotification('Bạn không có quyền truy cập trang admin', 'error');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
                return;
            }

        } catch (error) {
            console.error('Auth check failed:', error);
            this.redirectToLogin();
        }
    }

    redirectToLogin() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/admin-login.html';
    }

    loadUserInfo() {
        if (this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.username;
            document.getElementById('userRole').textContent = this.currentUser.isSuperAdmin ? 'Super Admin' : 'Administrator';
            
            // Set avatar initial
            const avatar = document.getElementById('userAvatar');
            avatar.textContent = this.currentUser.username.charAt(0).toUpperCase();
        }
    }

    async apiCall(url, method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        
        // Handle token refresh if needed
        if (response.status === 401) {
            const refreshSuccess = await this.refreshToken();
            if (refreshSuccess) {
                // Retry the request with new token
                options.headers['Authorization'] = `Bearer ${this.accessToken}`;
                return await fetch(url, options);
            } else {
                this.redirectToLogin();
                return;
            }
        }

        return response;
    }

    async refreshToken() {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) return false;

            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const result = await response.json();
                this.accessToken = result.data.accessToken;
                localStorage.setItem('accessToken', result.data.accessToken);
                localStorage.setItem('refreshToken', result.data.refreshToken);
                return true;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
        }
        return false;
    }

    async loadDashboardStats() {
        try {
            this.showLoading();

            // Load user stats
            const userStatsResponse = await this.apiCall('/api/users/stats');
            const userStats = userStatsResponse.ok ? await userStatsResponse.json() : null;

            // Load survey stats (from existing endpoint)
            const surveyStatsResponse = await this.apiCall('/api/responses?limit=1');
            const surveyStats = surveyStatsResponse.ok ? await surveyStatsResponse.json() : null;

            // Load audit stats
            const auditStatsResponse = await this.apiCall('/api/audit/stats');
            const auditStats = auditStatsResponse.ok ? await auditStatsResponse.json() : null;

            this.renderDashboardStats(userStats, surveyStats, auditStats);

        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            this.showNotification('Lỗi khi tải thống kê', 'error');
        } finally {
            this.hideLoading();
        }
    }

    renderDashboardStats(userStats, surveyStats, auditStats) {
        const statsGrid = document.getElementById('statsGrid');
        
        let html = '';

        // User stats
        if (userStats && userStats.success) {
            const data = userStats.data.overview;
            html += `
                <div class="stat-card">
                    <div class="stat-number">${data.totalUsers || 0}</div>
                    <div class="stat-label">Tổng số người dùng</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.activeUsers || 0}</div>
                    <div class="stat-label">Người dùng hoạt động</div>
                </div>
            `;
        }

        // Survey stats
        if (surveyStats && surveyStats.pagination) {
            html += `
                <div class="stat-card">
                    <div class="stat-number">${surveyStats.pagination.totalCount || 0}</div>
                    <div class="stat-label">Tổng số khảo sát</div>
                </div>
            `;
        }

        // Audit stats
        if (auditStats && auditStats.success) {
            html += `
                <div class="stat-card">
                    <div class="stat-number">${auditStats.data.totalActions || 0}</div>
                    <div class="stat-label">Tổng hoạt động</div>
                </div>
            `;
        }

        // Default stats if no data
        if (!html) {
            html = `
                <div class="stat-card">
                    <div class="stat-number">0</div>
                    <div class="stat-label">Người dùng</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">0</div>
                    <div class="stat-label">Khảo sát</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">0</div>
                    <div class="stat-label">Hoạt động</div>
                </div>
            `;
        }

        statsGrid.innerHTML = html;
    }

    switchTab(tabName) {
        // Update active tab
        this.activeTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Load content for specific tabs
        if (tabName === 'users' && !this.userManagement) {
            this.loadUserManagement();
        } else if (tabName === 'displays' && !this.displayManagement) {
            this.loadDisplayManagement();
        } else if (tabName === 'audit' && !this.auditLogs) {
            
        } else if (tabName === 'survey-results') {
            window.location.href = 'survey-results.html';
        } else if (tabName === 'data-upload') {
            window.location.href = 'data-upload.html';
        }
    }

    initUserManagement() {
        // User management will be initialized when tab is first accessed
    }

    async loadUserManagement() {
        try {
            const container = document.getElementById('userManagementContainer');
            
            // Load user management interface (simplified version for now)
            container.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h3>👥 Quản lý người dùng</h3>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button onclick="adminDashboard.createUser()" class="quick-action-btn" style="padding: 10px 20px;">
                            ➕ Thêm người dùng
                        </button>
                        <button onclick="adminDashboard.importUsers()" class="quick-action-btn" style="padding: 10px 20px;">
                            📥 Import CSV
                        </button>
                        <button onclick="adminDashboard.exportUsers()" class="quick-action-btn" style="padding: 10px 20px;">
                            📤 Export Excel
                        </button>
                    </div>
                </div>
                <div id="usersList">
                    <div style="text-align: center; padding: 40px;">
                        <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
                        <p>Đang tải danh sách người dùng...</p>
                    </div>
                </div>
            `;

            // Load users list
            await this.loadUsersList();
            
        } catch (error) {
            console.error('Error loading user management:', error);
            this.showNotification('Lỗi khi tải quản lý người dùng', 'error');
        }
    }

    async loadUsersList() {
        try {
            const response = await this.apiCall('/api/users?limit=50');
            
            if (response.ok) {
                const result = await response.json();
                this.renderUsersList(result.data);
            } else {
                throw new Error('Failed to load users');
            }
        } catch (error) {
            console.error('Error loading users list:', error);
            document.getElementById('usersList').innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    ❌ Lỗi khi tải danh sách người dùng
                </div>
            `;
        }
    }

    renderUsersList(users) {
        const container = document.getElementById('usersList');
        
        if (!users || users.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    📝 Chưa có người dùng nào
                </div>
            `;
            return;
        }

        let html = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">User ID</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Tên người dùng</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Login ID</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Vai trò</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Trạng thái</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        users.forEach(user => {
            const statusBadge = user.isActive 
                ? '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">Hoạt động</span>'
                : '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">Vô hiệu</span>';
                
            const superAdminBadge = user.isSuperAdmin 
                ? '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 5px;">Super Admin</span>'
                : '';

            html += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px;">${user.userid}</td>
                    <td style="padding: 12px;">${user.username}${superAdminBadge}</td>
                    <td style="padding: 12px;">${user.loginid}</td>
                    <td style="padding: 12px;">${user.role}</td>
                    <td style="padding: 12px;">${statusBadge}</td>
                    <td style="padding: 12px;">
                        <button onclick="adminDashboard.editUser('${user._id}')" style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-right: 5px; cursor: pointer;">✏️</button>
                        ${!user.isSuperAdmin ? `<button onclick="adminDashboard.deleteUser('${user._id}', '${user.username}')" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">🗑️</button>` : ''}
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

     catch (error) {
            console.error('Error loading audit logs:', error);
            this.showNotification('Lỗi khi tải nhật ký hoạt động', 'error');
        }
    }

     catch (error) {
            console.error('Error deleting user:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    importUsers() {
        const fileInput = document.getElementById('csvFileInput');
        fileInput.click();
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.uploadUserCSV(file);
            }
        };
    }

    async uploadUserCSV(file) {
        try {
            this.showLoading();
            
            const formData = new FormData();
            formData.append('csvFile', file);
            
            const response = await fetch('/api/users/import/csv', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showNotification(`Import thành công: ${result.data.stats.created} tạo mới, ${result.data.stats.updated} cập nhật`, 'success');
                
                // Reload users list if on users tab
                if (this.activeTab === 'users') {
                    await this.loadUsersList();
                }
            } else {
                const result = await response.json();
                throw new Error(result.message || 'Lỗi khi import CSV');
            }
        } catch (error) {
            console.error('Error importing CSV:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Display Management Functions
    async loadDisplayManagement() {
        try {
            const container = document.getElementById('displayManagementContainer');
            
            // Load the display management HTML content
            const response = await fetch('display-management.html');
            const html = await response.text();
            container.innerHTML = html;
            
            // Load and initialize the display management JavaScript
            if (!window.displayManagement) {
                await this.loadScript('display-management.js');
                // Initialize display management
                setTimeout(() => {
                    window.displayManagement = new DisplayManagement();
                }, 100);
            }
            
            // Load pagination component if not already loaded
            if (!window.PaginationComponent) {
                await this.loadScript('pagination-component.js');
            }
            
            this.displayManagement = true;
            
        } catch (error) {
            console.error('Error loading display management:', error);
            document.getElementById('displayManagementContainer').innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    ❌ Lỗi khi tải quản lý display: ${error.message}
                </div>
            `;
        }
    }

    // Helper function to load scripts dynamically
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if script already exists
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async exportUsers() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/users/export/csv', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `users-export-${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showNotification('Export thành công', 'success');
            } else {
                throw new Error('Lỗi khi export dữ liệu');
            }
        } catch (error) {
            console.error('Error exporting users:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async logout() {
        try {
            // Call logout API
            await this.apiCall('/api/auth/logout', 'POST');
        } catch (error) {
            console.error('Logout API error:', error);
        } finally {
            // Clear local storage and redirect regardless of API call result
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            window.location.href = '/admin-login.html';
        }
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showNotification(message, type = 'success') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Global functions for onclick handlers
function switchTab(tabName) {
    adminDashboard.switchTab(tabName);
}

function logout() {
    adminDashboard.logout();
}

function importUsers() {
    adminDashboard.importUsers();
}

function exportUsers() {
    adminDashboard.exportUsers();
}

// Initialize the dashboard
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
});