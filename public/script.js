class SurveyApp {
    constructor() {
        this.currentStep = 1;
        this.selectedLeader = '';
        this.selectedShop = '';
        this.surveyData = {};
        this.selectedModels = [];
        this.modelImages = {}; // { model: File }
        this.modelSearchValue = '';
        this.modelSearchSelected = '';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadLeaders();
    }

    bindEvents() {
        // Step navigation
        document.getElementById('nextToStep2').addEventListener('click', () => this.goToStep2());
        document.getElementById('nextToStep3').addEventListener('click', () => this.goToStep3());
        document.getElementById('backToStep1').addEventListener('click', () => this.goToStep1());
        document.getElementById('backToStep2').addEventListener('click', () => this.goToStep2());
        document.getElementById('submitSurvey').addEventListener('click', () => this.submitSurvey());
        document.getElementById('startNewSurvey').addEventListener('click', () => this.resetSurvey());

        // Form changes
        document.getElementById('leaderSelect').addEventListener('change', (e) => this.onLeaderChange(e));
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

    async loadLeaders() {
        try {
            this.showLoading();
            const response = await fetch('/api/leaders');
            const leaders = await response.json();
            
            const select = document.getElementById('leaderSelect');
            select.innerHTML = '<option value="">-- Chọn Leader --</option>';
            
            leaders.forEach(leader => {
                const option = document.createElement('option');
                option.value = leader;
                option.textContent = leader;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading leaders:', error);
            alert('Lỗi khi tải danh sách leader. Vui lòng thử lại.');
        } finally {
            this.hideLoading();
        }
    }

    async onLeaderChange(e) {
        const leader = e.target.value;
        this.selectedLeader = leader;
        
        const nextBtn = document.getElementById('nextToStep2');
        if (leader) {
            nextBtn.disabled = false;
        } else {
            nextBtn.disabled = true;
        }
    }

    async loadShops() {
        if (!this.selectedLeader) return;

        try {
            this.showLoading();
            const response = await fetch(`/api/shops/${encodeURIComponent(this.selectedLeader)}`);
            const shops = await response.json();
            
            const select = document.getElementById('shopSelect');
            select.innerHTML = '<option value="">-- Chọn Shop --</option>';
            
            shops.forEach(shop => {
                const option = document.createElement('option');
                option.value = shop;
                option.textContent = shop;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading shops:', error);
            alert('Lỗi khi tải danh sách shop. Vui lòng thử lại.');
        } finally {
            this.hideLoading();
        }
    }

    onShopChange(e) {
        const shop = e.target.value;
        this.selectedShop = shop;
        
        const nextBtn = document.getElementById('nextToStep3');
        if (shop) {
            nextBtn.disabled = false;
        } else {
            nextBtn.disabled = true;
        }
    }

    async loadModelsAndPOSM() {
        if (!this.selectedLeader || !this.selectedShop) return;

        try {
            this.showLoading();
            const response = await fetch(`/api/models/${encodeURIComponent(this.selectedLeader)}/${encodeURIComponent(this.selectedShop)}`);
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
                    <div class="posm-name">Thiếu tất cả POSM của model này</div>
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

        if (isChecked) {
            // Hide individual items and uncheck them
            individualItems.forEach(item => item.classList.add('hidden'));
            individualCheckboxes.forEach(cb => cb.checked = false);
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
            this.handleAllCheckboxChange(model, false);
        }
    }

    sanitizeId(str) {
        return str.replace(/[^a-zA-Z0-9]/g, '_');
    }

    goToStep1() {
        this.showStep(1);
    }

    goToStep2() {
        if (!this.selectedLeader) {
            alert('Vui lòng chọn leader trước.');
            return;
        }
        this.showStep(2);
        this.loadShops();
    }

    goToStep3() {
        if (!this.selectedShop) {
            alert('Vui lòng chọn shop trước.');
            return;
        }
        // Update selected info display
        document.getElementById('selectedLeader').textContent = this.selectedLeader;
        document.getElementById('selectedShop').textContent = this.selectedShop;
        this.showStep(3);
        
        // Clear the models container and selected models list
        document.getElementById('modelsContainer').innerHTML = '';
        const listDiv = document.getElementById('selectedModelsList');
        if (listDiv) {
            listDiv.innerHTML = '<em>Chưa có model nào được chọn.</em>';
        }
        
        // Reset selected models for this survey
        this.selectedModels = [];
        this.modelImages = {};
        
        // Clear model search
        document.getElementById('modelSearchInput').value = '';
        document.getElementById('addModelBtn').disabled = true;
        this.modelSearchSelected = '';
        this.hideModelSuggestions();
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
                    const res = await fetch('/api/upload', {
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
                leader: this.selectedLeader,
                shopName: this.selectedShop,
                responses: responses
            };
            console.log('📤 Sending survey data to server:', surveyData);
            const response = await fetch('/api/submit', {
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
            
            const modelResponse = {
                model: model,
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
        this.selectedLeader = '';
        this.selectedShop = '';
        this.surveyData = {};
        this.selectedModels = [];
        this.modelImages = {};
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
                <label for="file-input-${this.sanitizeId(model)}" style="cursor:pointer;display:flex;align-items:center;gap:10px;font-weight:600;color:#4facfe;font-size:1.15em;padding:10px 0;width:100%;justify-content:center;">
                    <span style="font-size:2em;">📷</span> <span>${hasImage ? 'Đã chọn ảnh' : 'Chụp hoặc chọn ảnh model bị thiếu POSM'}</span>
                </label>
                <input type="file" accept="image/*" id="file-input-${this.sanitizeId(model)}" style="display:none;">
                <div class="image-preview" id="image-preview-${this.sanitizeId(model)}" style="margin-top:12px;width:100%;display:flex;justify-content:center;"></div>
            </div>
        `;
        const fileInput = document.getElementById(`file-input-${this.sanitizeId(model)}`);
        if (!hasImage) {
            fileInput.addEventListener('change', (e) => this.handleImageFiles(e, model));
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
        const res = await fetch(`/api/model-autocomplete?q=${encodeURIComponent(value)}`);
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
                const response = await fetch(`/api/models/${encodeURIComponent(this.selectedLeader)}/${encodeURIComponent(this.selectedShop)}`);
                const allModels = await response.json();
                
                if (allModels[model]) {
                    this.surveyData[model] = allModels[model];
                    console.log('✅ POSM data loaded from shop data for model:', model);
                } else {
                    console.log('🔍 Model not found in shop data, trying general model list');
                    // If model not found in shop data, try to get it from the general model list
                    const modelResponse = await fetch(`/api/model-posm/${encodeURIComponent(model)}`);
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
        console.log('🎨 renderSelectedModels called. selectedModels:', this.selectedModels);
        const container = document.getElementById('modelsContainer');
        container.innerHTML = '';
        // Render visible list of all added models
        const listDiv = document.getElementById('selectedModelsList');
        if (this.selectedModels.length === 0) {
            listDiv.innerHTML = '<em>Chưa có model nào được chọn.</em>';
        } else {
            listDiv.innerHTML = this.selectedModels.map(model => `
                <span class="selected-model-item" style="display:inline-block;margin-right:10px;margin-bottom:5px;padding:5px 10px;background:#f1f3f4;border-radius:5px;">
                    <strong>${model}</strong>
                    <button class="btn btn-sm btn-danger btn-remove-model-list" data-model="${model}" style="margin-left:5px;">X</button>
                </span>
            `).join('');
        }
        // Render POSM selection for each model
        this.selectedModels.forEach(model => {
            console.log('🎨 Rendering model:', model);
            const modelGroup = document.createElement('div');
            modelGroup.className = 'model-group';
            modelGroup.innerHTML = `
                <div class="model-header">
                    Model: ${model}
                    <button class="btn btn-secondary btn-remove-model" data-model="${model}" style="float:right;">X</button>
                </div>
                <div class="posm-list" id="posm-list-${this.sanitizeId(model)}">
                    ${this.renderPOSMItems(model)}
                </div>
                <div class="image-upload-group" id="image-upload-${this.sanitizeId(model)}"></div>
            `;
            container.appendChild(modelGroup);
        });
        // Bind remove model buttons (in POSM area)
        container.querySelectorAll('.btn-remove-model').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const model = e.target.dataset.model;
                console.log('🗑️ Removing model from POSM area:', model);
                this.selectedModels = this.selectedModels.filter(m => m !== model);
                delete this.modelImages[model];
                this.renderSelectedModels();
            });
        });
        // Bind remove model buttons (in list)
        document.querySelectorAll('.btn-remove-model-list').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const model = e.target.dataset.model;
                console.log('🗑️ Removing model from list:', model);
                this.selectedModels = this.selectedModels.filter(m => m !== model);
                delete this.modelImages[model];
                this.renderSelectedModels();
            });
        });
        // Bind POSM checkboxes
        this.bindCheckboxEvents();
        // Render image upload for each model
        this.selectedModels.forEach(model => this.renderImageUpload(model));
        console.log('✅ renderSelectedModels completed. Models rendered:', this.selectedModels.length);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SurveyApp();
});