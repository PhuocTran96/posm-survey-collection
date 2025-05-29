class SurveyApp {
    constructor() {
        this.currentStep = 1;
        this.selectedLeader = '';
        this.selectedShop = '';
        this.surveyData = {};
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
        this.loadModelsAndPOSM();
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
                alert('Vui lòng chọn ít nhất một POSM hoặc tùy chọn "Tất cả" cho một model.');
                this.hideLoading();
                return;
            }

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

            const result = await response.json();
            
            if (result.success) {
                this.showStep('success');
                document.getElementById('successMessage').classList.add('active');
            } else {
                alert('Lỗi khi gửi khảo sát: ' + result.message);
            }
        } catch (error) {
            console.error('Error submitting survey:', error);
            alert('Lỗi khi gửi khảo sát. Vui lòng thử lại.');
        } finally {
            this.hideLoading();
        }
    }

    collectResponses() {
        const responses = [];
        
        Object.keys(this.surveyData).forEach(model => {
            const modelContainer = document.getElementById(`posm-list-${this.sanitizeId(model)}`);
            const allCheckbox = modelContainer.querySelector('input[data-type="all"]');
            const individualCheckboxes = modelContainer.querySelectorAll('input[data-type="individual"]:checked');
            
            const modelResponse = {
                model: model,
                posmSelections: [],
                allSelected: allCheckbox.checked
            };

            if (allCheckbox.checked) {
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
        
        // Reset form elements
        document.getElementById('leaderSelect').value = '';
        document.getElementById('shopSelect').value = '';
        document.getElementById('nextToStep2').disabled = true;
        document.getElementById('nextToStep3').disabled = true;
        
        // Clear containers
        document.getElementById('modelsContainer').innerHTML = '';
        
        // Hide success message and show step 1
        document.getElementById('successMessage').classList.remove('active');
        this.showStep(1);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SurveyApp();
});