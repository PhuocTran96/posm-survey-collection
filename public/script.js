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
        // Clear modelsContainer and selectedModels at entry
        this.selectedModels = [];
        document.getElementById('modelsContainer').innerHTML = '';
        // Do NOT call this.loadModelsAndPOSM();
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
            this.showLoading();
            const responses = this.collectResponses();
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
            console.error('Error submitting survey:', error);
            alert('Lỗi khi gửi khảo sát: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    collectResponses() {
        const responses = [];
        
        this.selectedModels.forEach(model => {
            const modelContainer = document.getElementById(`posm-list-${this.sanitizeId(model)}`);
            if (!modelContainer) return;
            
            const allCheckbox = modelContainer.querySelector('input[data-type="all"]');
            const individualCheckboxes = modelContainer.querySelectorAll('input[data-type="individual"]:checked');
            
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
            } else {
                // Add only selected individual items
                individualCheckboxes.forEach(checkbox => {
                    modelResponse.posmSelections.push({
                        posmCode: checkbox.dataset.posmCode,
                        posmName: checkbox.dataset.posmName,
                        selected: true
                    });
                });
            }

            // Only add to responses if there are selections
            if (modelResponse.allSelected || modelResponse.posmSelections.length > 0) {
                responses.push(modelResponse);
            }
        });

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
            <label>Ảnh hiện trường (chỉ 1 ảnh):</label>
            <input type="file" accept="image/*" capture="environment" id="file-input-${this.sanitizeId(model)}" style="display:block;margin-bottom:10px;" ${hasImage ? 'disabled' : ''}>
            <div class="image-preview" id="image-preview-${this.sanitizeId(model)}"></div>
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
            img.style.maxWidth = '120px';
            img.style.marginRight = '10px';
            img.style.marginBottom = '10px';
            preview.appendChild(img);
            // Delete button
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Xóa ảnh';
            delBtn.className = 'btn btn-secondary';
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
        this.selectedModels.unshift(model); // Add to top
        // Load POSM for this model
        if (!this.surveyData[model]) {
            // Fetch POSM for this model (simulate as if from all models)
            // Use the same endpoint as before, but filter for this model
            const response = await fetch(`/api/models/${encodeURIComponent(this.selectedLeader)}/${encodeURIComponent(this.selectedShop)}`);
            const allModels = await response.json();
            if (allModels[model]) {
                this.surveyData[model] = allModels[model];
            } else {
                alert('Không tìm thấy POSM cho model này.');
                return;
            }
        }
        this.renderSelectedModels();
        document.getElementById('modelSearchInput').value = '';
        document.getElementById('addModelBtn').disabled = true;
        this.modelSearchSelected = '';
    }

    renderSelectedModels() {
        const container = document.getElementById('modelsContainer');
        container.innerHTML = '';
        this.selectedModels.forEach(model => {
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
        // Bind remove model buttons
        container.querySelectorAll('.btn-remove-model').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const model = e.target.dataset.model;
                this.selectedModels = this.selectedModels.filter(m => m !== model);
                this.renderSelectedModels();
            });
        });
        // Bind POSM checkboxes
        this.bindCheckboxEvents();
        // Render image upload for each model
        this.selectedModels.forEach(model => this.renderImageUpload(model));
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SurveyApp();
});