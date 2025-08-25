class SurveyApp {
    constructor() {
        this.currentStep = 1;
        this.selectedShop = '';
        this.surveyData = {};
        this.selectedModels = [];
        this.modelImages = {}; // { model: File }
        this.modelSearchValue = '';
        this.modelSearchSelected = '';
        this.checkboxStates = {}; // { model: { checkboxId: boolean } }
        this.modelQuantities = {}; // { model: number }
        this.user = null;
        this.assignedStores = [];
        this.init();
    }

    async init() {
        // Check authentication first
        const isAuthenticated = await this.checkAuthentication();
        if (!isAuthenticated) {
            return; // User will be redirected to login
        }
        
        this.bindEvents();
        this.loadAssignedStores();
        this.setupAuthUI();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('accessToken');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
            this.redirectToLogin('No access token or user data found');
            return false;
        }

        try {
            const userData = JSON.parse(user);
            console.log('Survey page: Checking auth for user:', userData.username, userData.role);
            
            // If admin user accidentally ends up here, redirect to admin panel
            if (userData.role === 'admin') {
                console.log('Admin user redirecting to admin panel');
                window.location.replace('/survey-results.html');
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
                this.assignedStores = userData.assignedStores || [];
                return true;
            } else {
                // Token invalid, clear storage
                localStorage.clear();
                this.redirectToLogin('Session expired or invalid');
                return false;
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            localStorage.clear();
            this.redirectToLogin('Session expired or invalid');
            return false;
        }
    }

    clearAuthData() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
    }

    redirectToLogin(reason) {
        console.log('Redirecting to login:', reason);
        // Prevent redirect loops by checking current location
        if (!window.location.pathname.includes('login.html')) {
            window.location.replace('/login.html');
        }
    }

    setupAuthUI() {
        // Add user info to the UI
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.innerHTML = `
            <div class="user-details">
                <span class="user-name">${this.user.username}</span>
                <span class="user-role">${this.user.role}</span>
            </div>
            <button onclick="surveyApp.logout()" class="logout-btn">Đăng xuất</button>
        `;

        // Add to header
        const header = document.querySelector('.header');
        if (header) {
            header.appendChild(userInfo);
        }
    }

    async logout() {
        try {
            const token = localStorage.getItem('accessToken');
            if (token) {
                // Call logout endpoint to invalidate token
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
            // Clear all local storage and redirect
            this.clearAuthData();
            window.location.href = '/login.html';
        }
    }

    // Helper method for authenticated API calls with token refresh
    async authenticatedFetch(url, options = {}, retryCount = 0) {
        let token = localStorage.getItem('accessToken');
        if (!token) {
            this.redirectToLogin('No access token');
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
        if (!(options.body instanceof FormData) && !authOptions.headers['Content-Type']) {
            authOptions.headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, authOptions);
            
            // If unauthorized, try to refresh token once
            if (response.status === 401 && retryCount === 0) {
                console.log('Token expired, attempting refresh...');
                
                const refreshSuccess = await this.refreshToken();
                if (refreshSuccess) {
                    // Retry the original request with new token
                    return await this.authenticatedFetch(url, options, 1);
                } else {
                    // Refresh failed, redirect to login
                    this.clearAuthData();
                    this.redirectToLogin('Session expired, please login again');
                    return null;
                }
            } else if (response.status === 401) {
                // Already retried once, redirect to login
                this.clearAuthData();
                this.redirectToLogin('Authentication failed');
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Token refresh method
    async refreshToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            console.log('No refresh token available');
            return false;
        }

        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Update tokens in localStorage
                    localStorage.setItem('accessToken', result.data.accessToken);
                    localStorage.setItem('refreshToken', result.data.refreshToken);
                    localStorage.setItem('user', JSON.stringify(result.data.user));
                    console.log('Token refreshed successfully');
                    return true;
                }
            }
            
            console.log('Token refresh failed:', response.status);
            return false;
        } catch (error) {
            console.error('Token refresh error:', error);
            return false;
        }
    }


    bindEvents() {
        // Step navigation
        document.getElementById('nextToStep2').addEventListener('click', () => this.goToStep2());
        document.getElementById('backToStep1').addEventListener('click', () => this.goToStep1());
        document.getElementById('submitSurvey').addEventListener('click', () => this.submitSurvey());
        document.getElementById('startNewSurvey').addEventListener('click', () => this.resetSurvey());

        // Form changes
        document.getElementById('shopSelect').addEventListener('change', (e) => this.onShopChange(e));

        // Model autocomplete events
        const modelInput = document.getElementById('modelSearchInput');
        const suggestionsBox = document.getElementById('modelSuggestions');
        const addModelBtn = document.getElementById('addModelBtn');
        modelInput.addEventListener('input', (e) => this.onModelInput(e));
        modelInput.addEventListener('keydown', (e) => this.onModelInputKeydown(e));
        suggestionsBox.addEventListener('mousedown', (e) => this.onModelSuggestionClick(e));
        addModelBtn.addEventListener('click', () => this.onAddModel());
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('show');
    }

    async loadAssignedStores() {
        try {
            this.showLoading();
            
            const select = document.getElementById('shopSelect');
            select.innerHTML = '<option value="">-- Chọn Shop --</option>';
            
            if (this.assignedStores && this.assignedStores.length > 0) {
                this.assignedStores.forEach(store => {
                    const option = document.createElement('option');
                    option.value = JSON.stringify(store);
                    option.textContent = `${store.store_name} (${store.store_id})`;
                    select.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Không có shop nào được phân quyền';
                option.disabled = true;
                select.appendChild(option);
            }
        } catch (error) {
            console.error('Error loading assigned stores:', error);
            alert('Lỗi khi tải danh sách shop. Vui lòng thử lại.');
        } finally {
            this.hideLoading();
        }
    }

    async onShopChange(e) {
        const shopData = e.target.value;
        
        const nextBtn = document.getElementById('nextToStep2');
        if (shopData) {
            this.selectedShop = JSON.parse(shopData);
            nextBtn.disabled = false;
        } else {
            this.selectedShop = '';
            nextBtn.disabled = true;
        }
    }

    async loadModelsAndPOSM() {
        if (!this.selectedShop) return;

        try {
            this.showLoading();
            const response = await this.authenticatedFetch(`/api/models/${encodeURIComponent(this.selectedShop.store_id)}`);
            this.surveyData = await response.json();
            
            this.renderModelsAndPOSM();
        } catch (error) {
            console.error('Error loading models and POSM:', error);
            alert('Lỗi khi tải dữ liệu model và POSM. Vui lòng thử lại.');
        } finally {
            this.hideLoading();
        }
    }

    renderModelsAndPOSM() {
        const container = document.getElementById('modelsContainer');
        container.innerHTML = '';

        Object.keys(this.surveyData).forEach(model => {
            const modelGroup = document.createElement('div');
            modelGroup.className = 'model-group';
            modelGroup.innerHTML = `
                <div class="model-header">
                    Model: ${model}
                </div>
                <div class="posm-list" id="posm-list-${this.sanitizeId(model)}">
                    ${this.renderPOSMItems(model)}
                </div>
            `;
            container.appendChild(modelGroup);
        });

        // Bind checkbox events
        this.bindCheckboxEvents();
    }

    renderPOSMItems(model) {
        const posmItems = this.surveyData[model];
        let html = '';

        // Add "All" option
        html += `
            <div class="posm-item all-option">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="all-${this.sanitizeId(model)}" data-model="${model}" data-type="all">
                </div>
                <div class="posm-info">
                    <div class="posm-code">TẤT CẢ</div>
                    <div class="posm-name">Đã dán tất cả POSM</div>
                </div>
            </div>
        `;

        // Add individual POSM items
        posmItems.forEach((posm, index) => {
            html += `
                <div class="posm-item" data-model="${model}">
                    <div class="checkbox-wrapper">
                        <input type="checkbox" 
                               id="posm-${this.sanitizeId(model)}-${index}" 
                               data-model="${model}" 
                               data-posm-code="${posm.posmCode}"
                               data-posm-name="${posm.posmName}"
                               data-type="individual">
                    </div>
                    <div class="posm-info">
                        <div class="posm-code">${posm.posmCode}</div>
                        <div class="posm-name">${posm.posmName}</div>
                    </div>
                </div>
            `;
        });

        return html;
    }

    bindCheckboxEvents() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.onCheckboxChange(e));
        });
    }

    onCheckboxChange(e) {
        const checkbox = e.target;
        const model = checkbox.dataset.model;
        const type = checkbox.dataset.type;
        const checkboxId = checkbox.id;

        // Save checkbox state
        if (!this.checkboxStates[model]) {
            this.checkboxStates[model] = {};
        }
        this.checkboxStates[model][checkboxId] = checkbox.checked;

        if (type === 'all') {
            this.handleAllCheckboxChange(model, checkbox.checked);
        } else {
            this.handleIndividualCheckboxChange(model);
        }
    }

    handleAllCheckboxChange(model, isChecked) {
        const modelContainer = document.getElementById(`posm-list-${this.sanitizeId(model)}`);
        const individualItems = modelContainer.querySelectorAll('.posm-item:not(.all-option)');
        const individualCheckboxes = modelContainer.querySelectorAll('input[data-type="individual"]');

        // Initialize checkbox states for model if not exists
        if (!this.checkboxStates[model]) {
            this.checkboxStates[model] = {};
        }

        if (isChecked) {
            // Hide individual items and uncheck them
            individualItems.forEach(item => item.classList.add('hidden'));
            individualCheckboxes.forEach(cb => {
                cb.checked = false;
                this.checkboxStates[model][cb.id] = false;
            });
        } else {
            // Show individual items
            individualItems.forEach(item => item.classList.remove('hidden'));
        }
    }

    handleIndividualCheckboxChange(model) {
        const modelContainer = document.getElementById(`posm-list-${this.sanitizeId(model)}`);
        const allCheckbox = modelContainer.querySelector('input[data-type="all"]');
        const individualCheckboxes = modelContainer.querySelectorAll('input[data-type="individual"]');
        
        // If any individual checkbox is checked, uncheck the "all" checkbox
        const anyIndividualChecked = Array.from(individualCheckboxes).some(cb => cb.checked);
        if (anyIndividualChecked && allCheckbox.checked) {
            allCheckbox.checked = false;
            // Save the all checkbox state
            if (!this.checkboxStates[model]) {
                this.checkboxStates[model] = {};
            }
            this.checkboxStates[model][allCheckbox.id] = false;
            this.handleAllCheckboxChange(model, false);
        }
    }

    sanitizeId(str) {
        return str.replace(/[^a-zA-Z0-9]/g, '_');
    }

    // Save current checkbox states and quantities before re-rendering
    saveCurrentStates() {
        console.log('💾 Saving current checkbox states and quantities');
        
        // Save checkbox states
        this.selectedModels.forEach(model => {
            const modelContainer = document.getElementById(`posm-list-${this.sanitizeId(model)}`);
            if (modelContainer) {
                const checkboxes = modelContainer.querySelectorAll('input[type="checkbox"]');
                if (!this.checkboxStates[model]) {
                    this.checkboxStates[model] = {};
                }
                
                checkboxes.forEach(checkbox => {
                    this.checkboxStates[model][checkbox.id] = checkbox.checked;
                });
                
                console.log('💾 Saved states for model', model, this.checkboxStates[model]);
            }
            
            // Save quantity values
            const quantityInput = document.getElementById(`quantity-${this.sanitizeId(model)}`);
            if (quantityInput) {
                this.modelQuantities[model] = parseInt(quantityInput.value) || 1;
                console.log('💾 Saved quantity for model', model, this.modelQuantities[model]);
            }
        });
    }

    // Restore checkbox states and quantities after re-rendering
    restoreStates() {
        console.log('🔄 Restoring checkbox states and quantities');
        
        this.selectedModels.forEach(model => {
            // Restore checkbox states
            if (this.checkboxStates[model]) {
                Object.keys(this.checkboxStates[model]).forEach(checkboxId => {
                    const checkbox = document.getElementById(checkboxId);
                    if (checkbox) {
                        checkbox.checked = this.checkboxStates[model][checkboxId];
                        console.log('🔄 Restored checkbox', checkboxId, checkbox.checked);
                        
                        // Handle visual state for "all" checkboxes
                        if (checkbox.dataset.type === 'all' && checkbox.checked) {
                            this.handleAllCheckboxChange(model, true);
                        }
                    }
                });
            }
            
            // Restore quantity values
            if (this.modelQuantities[model]) {
                const quantityInput = document.getElementById(`quantity-${this.sanitizeId(model)}`);
                if (quantityInput) {
                    quantityInput.value = this.modelQuantities[model];
                    console.log('🔄 Restored quantity for model', model, this.modelQuantities[model]);
                }
            }
        });
    }

    goToStep1() {
        this.showStep(1);
    }

    goToStep2() {
        if (!this.selectedShop) {
            alert('Vui lòng chọn shop trước.');
            return;
        }
        
        // Update selected info display  
        document.getElementById('selectedShop').textContent = `${this.selectedShop.store_name} (${this.selectedShop.store_id})`;
        this.showStep(2);
        
        // Only reset if this is the first time visiting step 2 or if shop changed
        const shouldReset = this.selectedModels.length === 0;
        
        if (shouldReset) {
            // Clear the models container and selected models list
            document.getElementById('modelsContainer').innerHTML = '';
            const listDiv = document.getElementById('selectedModelsList');
            if (listDiv) {
                listDiv.innerHTML = '<em>Chưa có model nào được chọn.</em>';
            }
            
            // Reset selected models for this survey
            this.selectedModels = [];
            this.modelImages = {};
            this.checkboxStates = {};
            this.modelQuantities = {};
            
            // Clear model search
            document.getElementById('modelSearchInput').value = '';
            document.getElementById('addModelBtn').disabled = true;
            this.modelSearchSelected = '';
            this.hideModelSuggestions();
        } else {
            // Preserve existing state - just re-render to show current models
            console.log('🔄 Preserving existing models on step 2 navigation:', this.selectedModels);
            if (this.selectedModels.length > 0) {
                this.renderSelectedModels();
            }
        }
    }

    showStep(stepNumber) {
        // Hide all steps
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Show target step
        document.getElementById(`step${stepNumber}`).classList.add('active');
        this.currentStep = stepNumber;
    }

    async submitSurvey() {
        try {
            console.log('🚀 submitSurvey called. selectedModels:', this.selectedModels);
            this.showLoading();
            const responses = this.collectResponses();
            console.log('📊 Responses collected:', responses);
            
            // Validation: must add at least one model
            if (this.selectedModels.length === 0) {
                alert('Vui lòng thêm ít nhất một model trước khi gửi khảo sát.');
                this.hideLoading();
                return;
            }
            // Validation: must select at least one POSM for each model
            if (responses.length < this.selectedModels.length) {
                alert('Vui lòng chọn ít nhất một POSM cho mỗi model đã thêm.');
                this.hideLoading();
                return;
            }
            if (responses.length === 0) {
                alert('Vui lòng chọn ít nhất một model và POSM.');
                this.hideLoading();
                return;
            }
            // Batch upload images for each model
            const modelImageUrls = {};
            let uploadedCount = 0;
            for (const model of this.selectedModels) {
                const file = this.modelImages[model];
                if (file) {
                    // Show progress
                    this.showLoadingMsg(`Đang upload ảnh cho model ${model} (${++uploadedCount}/${this.selectedModels.length})...`);
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await this.authenticatedFetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();
                    if (!data.success) {
                        alert(`Không thể upload ảnh cho model ${model}: ${data.message}`);
                        this.hideLoading();
                        return;
                    }
                    modelImageUrls[model] = data.url;
                }
            }
            // Attach image URLs to responses
            responses.forEach(r => {
                r.images = modelImageUrls[r.model] ? [modelImageUrls[r.model]] : [];
            });
            const surveyData = {
                shopName: this.selectedShop.store_name,
                storeId: this.selectedShop.store_id,
                responses: responses
            };
            console.log('📤 Sending survey data to server:', surveyData);
            const response = await this.authenticatedFetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(surveyData)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('📥 Server response:', result);
            if (result.success) {
                document.querySelectorAll('.step').forEach(step => {
                    step.classList.remove('active');
                });
                document.getElementById('successMessage').classList.add('active');
                // Clear temp images
                this.modelImages = {};
            } else {
                alert('Lỗi khi gửi khảo sát: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ Error submitting survey:', error);
            alert('Lỗi khi gửi khảo sát: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    collectResponses() {
        console.log('📊 collectResponses called. selectedModels:', this.selectedModels);
        const responses = [];
        
        this.selectedModels.forEach(model => {
            console.log('📊 Processing model for collection:', model);
            const modelContainer = document.getElementById(`posm-list-${this.sanitizeId(model)}`);
            if (!modelContainer) {
                console.log('❌ Model container not found for:', model);
                return;
            }
            
            const allCheckbox = modelContainer.querySelector('input[data-type="all"]');
            const individualCheckboxes = modelContainer.querySelectorAll('input[data-type="individual"]:checked');
            
            console.log('📊 Checkboxes found for model:', model, {
                allChecked: allCheckbox ? allCheckbox.checked : false,
                individualChecked: individualCheckboxes.length
            });
              // Get quantity value for this model
            const quantityInput = document.getElementById(`quantity-${this.sanitizeId(model)}`);
            const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;

            const modelResponse = {
                model: model,
                quantity: quantity,
                posmSelections: [],
                allSelected: allCheckbox ? allCheckbox.checked : false,
                images: this.modelImages[model] ? [URL.createObjectURL(this.modelImages[model])] : []
            };

            if (allCheckbox && allCheckbox.checked) {
                // If "all" is selected, add all POSM items
                this.surveyData[model].forEach(posm => {
                    modelResponse.posmSelections.push({
                        posmCode: posm.posmCode,
                        posmName: posm.posmName,
                        selected: true
                    });
                });
                console.log('✅ Added all POSM items for model:', model);
            } else {
                // Add only selected individual items
                individualCheckboxes.forEach(checkbox => {
                    modelResponse.posmSelections.push({
                        posmCode: checkbox.dataset.posmCode,
                        posmName: checkbox.dataset.posmName,
                        selected: true
                    });
                });
                console.log('✅ Added individual POSM items for model:', model, modelResponse.posmSelections.length);
            }

            // Only add to responses if there are selections
            if (modelResponse.allSelected || modelResponse.posmSelections.length > 0) {
                responses.push(modelResponse);
                console.log('✅ Model response added to final responses:', model);
            } else {
                console.log('❌ Model response not added (no selections):', model);
            }
        });

        console.log('📊 Final responses collected:', responses.length, responses.map(r => r.model));
        return responses;
    }

    resetSurvey() {
        this.currentStep = 1;
        this.selectedShop = '';
        this.surveyData = {};
        this.selectedModels = [];
        this.modelImages = {};
        this.checkboxStates = {};
        this.modelQuantities = {};
        this.modelSearchValue = '';
        this.modelSearchSelected = '';
        
        // Reset form elements
        document.getElementById('leaderSelect').value = '';
        document.getElementById('shopSelect').value = '';
        document.getElementById('nextToStep2').disabled = true;
        document.getElementById('nextToStep3').disabled = true;
        document.getElementById('modelSearchInput').value = '';
        document.getElementById('addModelBtn').disabled = true;
        
        // Clear containers
        document.getElementById('modelsContainer').innerHTML = '';
        document.getElementById('modelSuggestions').innerHTML = '';
        
        // Hide success message and show step 1
        document.getElementById('successMessage').classList.remove('active');
        this.showStep(1);
    }

    renderImageUpload(model) {
        const container = document.getElementById(`image-upload-${this.sanitizeId(model)}`);
        const hasImage = !!this.modelImages[model];
        container.innerHTML = `
            <div class="image-upload-attractive" style="border:2px dashed #4facfe;padding:18px 8px;border-radius:14px;background:#f8fafd;display:flex;flex-direction:column;align-items:center;max-width:400px;margin:0 auto;box-shadow:0 2px 8px rgba(79,172,254,0.08);">
                <div style="display:flex;gap:12px;width:100%;justify-content:center;">
                    <label for="file-input-camera-${this.sanitizeId(model)}" style="flex:1;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;color:#fff;background:#4facfe;border-radius:8px;padding:10px 0;font-size:1em;box-shadow:0 2px 8px rgba(79,172,254,0.10);">
                        <span style="font-size:1.3em;">📷</span> <span>Chụp ảnh</span>
                    </label>
                    <label for="file-input-gallery-${this.sanitizeId(model)}" style="flex:1;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;color:#4facfe;background:#e3f0fc;border-radius:8px;padding:10px 0;font-size:1em;box-shadow:0 2px 8px rgba(79,172,254,0.06);">
                        <span style="font-size:1.3em;">🖼️</span> <span>Chọn từ thư viện</span>
                    </label>
                </div>
                <input type="file" accept="image/*" capture="environment" id="file-input-camera-${this.sanitizeId(model)}" style="display:none;" ${hasImage ? 'disabled' : ''}>
                <input type="file" accept="image/*" id="file-input-gallery-${this.sanitizeId(model)}" style="display:none;" ${hasImage ? 'disabled' : ''}>
                <div class="image-preview" id="image-preview-${this.sanitizeId(model)}" style="margin-top:12px;width:100%;display:flex;justify-content:center;"></div>
            </div>
        `;
        const fileInputCamera = document.getElementById(`file-input-camera-${this.sanitizeId(model)}`);
        const fileInputGallery = document.getElementById(`file-input-gallery-${this.sanitizeId(model)}`);
        if (!hasImage) {
            fileInputCamera.addEventListener('change', (e) => this.handleImageFiles(e, model));
            fileInputGallery.addEventListener('change', (e) => this.handleImageFiles(e, model));
        }
        this.updateImagePreview(model);
    }

    async handleImageFiles(e, model) {
        const file = e.target.files[0];
        if (!file) return;
        this.modelImages[model] = file;
        this.renderImageUpload(model);
    }

    updateImagePreview(model) {
        const preview = document.getElementById(`image-preview-${this.sanitizeId(model)}`);
        preview.innerHTML = '';
        const file = this.modelImages[model];
        if (file) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.style.maxWidth = '160px';
            img.style.maxHeight = '130px';
            img.style.border = '2px solid #4facfe';
            img.style.borderRadius = '12px';
            img.style.marginRight = '10px';
            img.style.marginBottom = '10px';
            img.style.boxShadow = '0 2px 8px rgba(79,172,254,0.12)';
            preview.appendChild(img);
            // Delete button
            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑️ Xóa ảnh';
            delBtn.className = 'btn btn-secondary';
            delBtn.style.marginLeft = '10px';
            delBtn.style.fontSize = '1.1em';
            delBtn.style.padding = '8px 16px';
            delBtn.onclick = () => {
                delete this.modelImages[model];
                this.renderImageUpload(model);
            };
            preview.appendChild(delBtn);
        }
    }

    showLoadingMsg(msg) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.add('show');
        overlay.querySelector('p').textContent = msg;
    }

    async onModelInput(e) {
        const value = e.target.value.trim();
        this.modelSearchValue = value;
        this.modelSearchSelected = '';
        document.getElementById('addModelBtn').disabled = true;
        if (!value) {
            this.hideModelSuggestions();
            return;
        }
        const res = await this.authenticatedFetch(`/api/model-autocomplete?q=${encodeURIComponent(value)}`);
        const models = await res.json();
        this.showModelSuggestions(models);
    }

    showModelSuggestions(models) {
        const suggestionsBox = document.getElementById('modelSuggestions');
        suggestionsBox.innerHTML = '';
        if (!models.length) {
            suggestionsBox.style.display = 'none';
            return;
        }
        models.forEach((model, idx) => {
            // Prevent duplicates
            if (this.selectedModels.includes(model)) return;
            const div = document.createElement('div');
            div.className = 'autocomplete-suggestion';
            div.textContent = model;
            div.dataset.value = model;
            if (idx === 0) div.classList.add('active');
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    }

    hideModelSuggestions() {
        const suggestionsBox = document.getElementById('modelSuggestions');
        suggestionsBox.innerHTML = '';
        suggestionsBox.style.display = 'none';
    }

    onModelSuggestionClick(e) {
        if (e.target.classList.contains('autocomplete-suggestion')) {
            this.selectModelSuggestion(e.target.dataset.value);
        }
    }

    onModelInputKeydown(e) {
        const suggestionsBox = document.getElementById('modelSuggestions');
        const items = Array.from(suggestionsBox.querySelectorAll('.autocomplete-suggestion'));
        if (!items.length) return;
        let idx = items.findIndex(item => item.classList.contains('active'));
        if (e.key === 'ArrowDown') {
            if (idx < items.length - 1) {
                if (idx >= 0) items[idx].classList.remove('active');
                items[idx + 1].classList.add('active');
            }
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            if (idx > 0) {
                items[idx].classList.remove('active');
                items[idx - 1].classList.add('active');
            }
            e.preventDefault();
        } else if (e.key === 'Enter') {
            if (idx >= 0) {
                this.selectModelSuggestion(items[idx].dataset.value);
                e.preventDefault();
            }
        }
    }

    selectModelSuggestion(model) {
        document.getElementById('modelSearchInput').value = model;
        this.modelSearchSelected = model;
        document.getElementById('addModelBtn').disabled = false;
        this.hideModelSuggestions();
    }

    async onAddModel() {
        const model = this.modelSearchSelected;
        if (!model || this.selectedModels.includes(model)) return;
        
        console.log('🔄 Adding model:', model);
        console.log('📋 Current selectedModels before adding:', this.selectedModels);
        
        try {
            this.showLoading();
            
            // Add model to selected list
            this.selectedModels.unshift(model); // Add to top
            console.log('✅ Model added. Current selectedModels:', this.selectedModels);
            
            // Load POSM for this model if not already loaded
            if (!this.surveyData[model]) {
                console.log('🔍 Loading POSM data for model:', model);
                // Fetch POSM for this specific model
                const response = await this.authenticatedFetch(`/api/models/${encodeURIComponent(this.selectedShop.store_id)}`);
                const allModels = await response.json();
                
                if (allModels[model]) {
                    this.surveyData[model] = allModels[model];
                    console.log('✅ POSM data loaded from shop data for model:', model);
                } else {
                    console.log('🔍 Model not found in shop data, trying general model list');
                    // If model not found in shop data, try to get it from the general model list
                    const modelResponse = await this.authenticatedFetch(`/api/model-posm/${encodeURIComponent(model)}`);
                    if (modelResponse.ok) {
                        const modelData = await modelResponse.json();
                        if (modelData && modelData.length > 0) {
                            this.surveyData[model] = modelData;
                            console.log('✅ POSM data loaded from general list for model:', model);
                        } else {
                            alert('Không tìm thấy POSM cho model này.');
                            // Remove the model from selected list
                            this.selectedModels = this.selectedModels.filter(m => m !== model);
                            console.log('❌ Model removed due to no POSM data');
                            return;
                        }
                    } else {
                        alert('Không tìm thấy POSM cho model này.');
                        // Remove the model from selected list
                        this.selectedModels = this.selectedModels.filter(m => m !== model);
                        console.log('❌ Model removed due to API error');
                        return;
                    }
                }
            } else {
                console.log('✅ POSM data already available for model:', model);
            }
            
            console.log('🎨 Rendering selected models. Count:', this.selectedModels.length);
            // Render the updated models list
            this.renderSelectedModels();
            
            // Clear the search input
            document.getElementById('modelSearchInput').value = '';
            document.getElementById('addModelBtn').disabled = true;
            this.modelSearchSelected = '';
            this.hideModelSuggestions();
            
        } catch (error) {
            console.error('❌ Error adding model:', error);
            alert('Lỗi khi thêm model. Vui lòng thử lại.');
            // Remove the model from selected list if there was an error
            this.selectedModels = this.selectedModels.filter(m => m !== model);
        } finally {
            this.hideLoading();
        }
    }

    renderSelectedModels() {
        console.log('🎨 Starting renderSelectedModels. Current models:', this.selectedModels);
        
        // Save current states before re-rendering (except for the first model being added)
        if (document.getElementById('modelsContainer').children.length > 0) {
            this.saveCurrentStates();
        }
        
        const container = document.getElementById('modelsContainer');
        container.innerHTML = '';
        
        // Render visible list of all added models
        const listDiv = document.getElementById('selectedModelsList');
        if (this.selectedModels.length === 0) {
            listDiv.innerHTML = '<em>Chưa có model nào được chọn.</em>';
        } else {
            listDiv.innerHTML = this.selectedModels.map(model => `
                <span class="selected-model-item" style="display:inline-block;position:relative;margin-right:10px;margin-bottom:5px;padding:5px 10px;background:#f1f3f4;border-radius:5px;">
                    <strong>${model}</strong>
                    <button class="btn-icon-delete" data-model="${model}" title="Xóa model này">×</button>
                </span>
            `).join('');
        }
        // Render POSM selection for each model
        this.selectedModels.forEach(model => {
            const modelGroup = document.createElement('div');
            modelGroup.className = 'model-group';
            
            // Get saved quantity or default to 1
            const savedQuantity = this.modelQuantities[model] || 1;
            
            modelGroup.innerHTML = `
                <div class="model-header">
                    <div class="model-header-content">
                        <span class="model-name">Model: ${model}</span>
                        <div class="quantity-group">
                            <label for="quantity-${this.sanitizeId(model)}">Số lượng:</label>
                            <input type="number" 
                                   id="quantity-${this.sanitizeId(model)}" 
                                   class="quantity-input" 
                                   value="${savedQuantity}" 
                                   min="1" 
                                   max="999"
                                   data-model="${model}">
                        </div>
                        <button class="btn-icon-delete" data-model="${model}" title="Xóa model này">×</button>
                    </div>
                </div>
                <div class="posm-list" id="posm-list-${this.sanitizeId(model)}">
                    ${this.renderPOSMItems(model)}
                </div>
                <div class="image-upload-group" id="image-upload-${this.sanitizeId(model)}"></div>
            `;
            container.appendChild(modelGroup);
        });
        // Bind remove model buttons (in POSM area)
        container.querySelectorAll('.btn-icon-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const model = e.target.dataset.model;
                this.selectedModels = this.selectedModels.filter(m => m !== model);
                delete this.modelImages[model];
                delete this.checkboxStates[model];
                delete this.modelQuantities[model];
                console.log('🗿 Removed model and cleaned up state:', model);
                this.renderSelectedModels();
            });
        });
        // Bind remove model buttons (in list)
        document.querySelectorAll('.selected-model-item .btn-icon-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const model = e.target.dataset.model;
                this.selectedModels = this.selectedModels.filter(m => m !== model);
                delete this.modelImages[model];
                delete this.checkboxStates[model];
                delete this.modelQuantities[model];
                console.log('🗿 Removed model and cleaned up state:', model);
                this.renderSelectedModels();
            });
        });
        // Bind POSM checkboxes
        this.bindCheckboxEvents();
        
        // Bind quantity input events to save state
        this.selectedModels.forEach(model => {
            const quantityInput = document.getElementById(`quantity-${this.sanitizeId(model)}`);
            if (quantityInput) {
                quantityInput.addEventListener('input', (e) => {
                    this.modelQuantities[model] = parseInt(e.target.value) || 1;
                });
            }
        });
        
        // Restore checkbox states and quantities after rendering
        setTimeout(() => {
            this.restoreStates();
            console.log('🎨 Completed renderSelectedModels with state restoration');
        }, 0);
        
        // Render image upload for each model
        this.selectedModels.forEach(model => this.renderImageUpload(model));
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SurveyApp();
});