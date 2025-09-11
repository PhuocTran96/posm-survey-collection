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
    // Store search properties
    this.shopSearchValue = '';
    this.shopSearchSelected = '';
    this.shopSearchDebounceTimer = null;
    // Model search debounce timer
    this.modelSearchDebounceTimer = null;
    this.init();
  }

  async init() {
    // Check authentication first
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      return; // User will be redirected to login
    }

    this.bindEvents();
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
          Authorization: `Bearer ${token}`,
        },
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
    // Update user info in the existing HTML elements
    const userDisplayName = document.getElementById('userDisplayName');
    const userRole = document.getElementById('userRole');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userDisplayName && this.user) {
      userDisplayName.textContent = this.user.username;
    }

    if (userRole && this.user) {
      userRole.textContent = `(${this.user.role})`;
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    // Load and display all assigned stores immediately
    this.loadAndDisplayAllStores();
  }

  async logout() {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        // Call logout endpoint to invalidate token
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

  clearAuthData() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  // Load and display all assigned stores immediately
  async loadAndDisplayAllStores() {
    try {
      console.log('🏪 Loading all assigned stores for user');

      // Show loading state
      const storeListContainer = document.getElementById('storeList');
      if (storeListContainer) {
        storeListContainer.innerHTML =
          '<div style="padding: 20px; text-align: center; color: #666;">Loading stores...</div>';
      }

      // First try to get stores from user data
      if (this.assignedStores && this.assignedStores.length > 0) {
        console.log('✅ Using stores from user data:', this.assignedStores.length);
        this.displayStoreList(this.assignedStores);
        return;
      }

      // Fallback: fetch assigned stores from API
      let response = await this.authenticatedFetch('/api/stores/assigned');
      if (response && response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          this.assignedStores = result.data;
          console.log('✅ Loaded assigned stores from API:', this.assignedStores.length);
          this.displayStoreList(this.assignedStores);
          return;
        }
      }

      // Second fallback: fetch all stores with pagination
      response = await this.authenticatedFetch('/api/stores?limit=1000');
      if (response && response.ok) {
        const result = await response.json();
        this.assignedStores = result.data || [];
        console.log('✅ Loaded all stores from API:', this.assignedStores.length);
        this.displayStoreList(this.assignedStores);
      } else {
        throw new Error('Failed to load stores from any API endpoint');
      }
    } catch (error) {
      console.error('❌ Error loading stores:', error);
      const storeListContainer = document.getElementById('storeList');
      if (storeListContainer) {
        storeListContainer.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #e74c3c;">
            <p>Failed to load stores</p>
            <button onclick="app.loadAndDisplayAllStores()" style="margin-top: 10px; padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Retry
            </button>
          </div>
        `;
      }
    }
  }

  // Display the store list with radio buttons
  displayStoreList(stores) {
    const storeListContainer = document.getElementById('storeList');

    if (!storeListContainer) {
      console.error('❌ storeList element not found');
      return;
    }

    if (!stores || stores.length === 0) {
      storeListContainer.innerHTML =
        '<div style="padding: 20px; text-align: center; color: #666;">No stores assigned</div>';
      return;
    }

    const html = stores
      .map(
        (store) => `
      <div class="store-item" data-store-id="${store._id || store.id}">
        <input type="radio" 
               name="storeSelection" 
               value="${store._id || store.id}" 
               class="store-radio"
>
        <div class="store-info">
          <div class="store-name">${this.escapeHtml(store.store_name)}</div>
          <div class="store-id">${this.escapeHtml(store.store_id)}</div>
        </div>
      </div>
    `
      )
      .join('');

    storeListContainer.innerHTML = html;
    console.log('✅ Displayed', stores.length, 'stores in list');
  }

  // Handle store selection via radio button
  selectStore(storeId) {
    const selectedStore = this.assignedStores.find((store) => (store._id || store.id) === storeId);

    if (selectedStore) {
      console.log('🏪 Selected store:', selectedStore.store_name);
      this.selectedShop = selectedStore;
      this.shopSearchSelected = JSON.stringify(selectedStore);

      // Update search input to show selected store
      const shopInput = document.getElementById('shopSearchInput');
      if (shopInput) {
        shopInput.value = `${selectedStore.store_name} (${selectedStore.store_id})`;
      }

      // Show selected shop info
      this.showSelectedShopInfo(selectedStore);

      // Enable continue button
      const nextBtn = document.getElementById('nextToStep2');
      if (nextBtn) {
        nextBtn.disabled = false;
      }
    }
  }

  // Filter store list based on search input
  filterStoreList(query) {
    const storeItems = document.querySelectorAll('.store-item');

    storeItems.forEach((item) => {
      const storeName = item.querySelector('.store-name').textContent.toLowerCase();
      const storeId = item.querySelector('.store-id').textContent.toLowerCase();

      const matches = storeName.includes(query) || storeId.includes(query);
      item.style.display = matches ? 'flex' : 'none';
    });
  }

  // Handle clicking on store items to select them
  onStoreItemClick(e) {
    const storeItem = e.target.closest('.store-item');
    if (!storeItem) return;

    const storeId = storeItem.dataset.storeId;
    if (!storeId) return;

    // Find and check the radio button
    const radioButton = storeItem.querySelector('.store-radio');
    if (radioButton) {
      radioButton.checked = true;
    }

    // Call the existing selectStore method
    this.selectStore(storeId);
  }

  // Helper method to escape HTML
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper method for authenticated API calls with token refresh
  async authenticatedFetch(url, options = {}, retryCount = 0) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      this.redirectToLogin('No access token');
      return null;
    }

    // Mobile detection and timeout configuration
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const timeoutMs = isMobile ? 15000 : 8000; // Longer timeout for mobile devices
    
    console.log(`🌐 API Request: ${url} (mobile=${isMobile}, timeout=${timeoutMs}ms, retry=${retryCount})`);

    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    };

    // Only set Content-Type to application/json if not uploading files
    // When uploading FormData, browser will set the correct Content-Type with boundary
    if (!(options.body instanceof FormData) && !authOptions.headers['Content-Type']) {
      authOptions.headers['Content-Type'] = 'application/json';
    }

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms (mobile=${isMobile})`)), timeoutMs)
    );

    try {
      const response = await Promise.race([
        fetch(url, authOptions),
        timeoutPromise
      ]);

      // Check for new access token in response headers (for activity updates)
      const newToken = response.headers.get('X-New-Access-Token');
      if (newToken) {
        console.log('🔄 Updating access token due to activity');
        localStorage.setItem('accessToken', newToken);
      }

      // Handle different types of authentication failures
      if (response.status === 401) {
        const errorData = await response
          .clone()
          .json()
          .catch(() => ({}));

        if (errorData.code === 'SESSION_TIMEOUT') {
          // Session timeout - redirect to login immediately
          this.clearAuthData();
          this.redirectToLogin('Session expired due to inactivity. Please login again.');
          return null;
        } else if (retryCount === 0) {
          // Token expired, try to refresh token once
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
        } else {
          // Already retried once, redirect to login
          this.clearAuthData();
          this.redirectToLogin('Authentication failed');
          return null;
        }
      }

      return response;
    } catch (error) {
      const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.error(`❌ API request failed for ${url} (mobile=${isMobile}, retry=${retryCount}):`, {
        errorType: error.name,
        errorMessage: error.message,
        isTimeout: error.message.includes('timeout'),
        isNetworkError: error.message.includes('Failed to fetch'),
        userAgent: navigator.userAgent.substring(0, 100),
        connectionType: navigator.connection?.effectiveType || 'unknown',
        onLine: navigator.onLine
      });
      
      // For mobile timeout errors, provide more specific guidance
      if (isMobile && error.message.includes('timeout')) {
        console.warn(`⚠️ Mobile timeout detected for ${url}. Consider checking network stability.`);
      }
      
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
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
    // Step navigation - add null checks
    const nextBtn = document.getElementById('nextToStep2');
    const backBtn = document.getElementById('backToStep1');
    const submitBtn = document.getElementById('submitSurvey');
    const newSurveyBtn = document.getElementById('startNewSurvey');

    if (nextBtn) nextBtn.addEventListener('click', () => this.goToStep2());
    if (backBtn) backBtn.addEventListener('click', () => this.goToStep1());
    if (submitBtn) submitBtn.addEventListener('click', () => this.submitSurvey());
    if (newSurveyBtn) newSurveyBtn.addEventListener('click', () => this.resetSurvey());

    // Shop input - add null checks (removed old autocomplete references)
    const shopInput = document.getElementById('shopSearchInput');
    if (shopInput) {
      shopInput.addEventListener('input', (e) => this.onShopInput(e));
      // Removed keydown event since we don't need autocomplete navigation anymore
    }

    // Reposition dropdown on window events
    window.addEventListener('resize', () => this.repositionVisibleDropdowns());
    window.addEventListener('scroll', () => this.repositionVisibleDropdowns());

    // Hide dropdowns when clicking outside
    document.addEventListener('click', (e) => this.handleOutsideClick(e));

    // Store item click handling (event delegation)
    const storeListContainer = document.getElementById('storeList');
    if (storeListContainer) {
      storeListContainer.addEventListener('click', (e) => this.onStoreItemClick(e));
    }

    // Model autocomplete events - add null checks
    const modelInput = document.getElementById('modelSearchInput');
    const suggestionsBox = document.getElementById('modelSuggestions');
    const addModelBtn = document.getElementById('addModelBtn');

    if (modelInput) modelInput.addEventListener('input', (e) => this.onModelInput(e));
    if (modelInput) modelInput.addEventListener('keydown', (e) => this.onModelInputKeydown(e));
    if (suggestionsBox)
      suggestionsBox.addEventListener('mousedown', (e) => this.onModelSuggestionClick(e));
    if (addModelBtn) addModelBtn.addEventListener('click', () => this.onAddModel());
  }

  showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('show');
    }
  }

  hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.remove('show');
    }
  }

  // Shop search and filter methods
  async onShopInput(e) {
    const value = e.target.value.trim().toLowerCase();
    this.shopSearchValue = value;

    // If user clears the input, reset selection
    if (!value) {
      this.shopSearchSelected = '';
      const nextBtn = document.getElementById('nextToStep2');
      if (nextBtn) {
        nextBtn.disabled = true;
      }
      this.hideSelectedShopInfo();

      // Clear any radio button selections
      const radioButtons = document.querySelectorAll('input[name="storeSelection"]');
      radioButtons.forEach((radio) => (radio.checked = false));

      // Show all stores
      this.filterStoreList('');
      return;
    }

    // Filter the store list in real-time
    this.filterStoreList(value);
  }

  // This method is no longer used - keeping for compatibility
  showShopSuggestions(stores) {
    console.log('showShopSuggestions called but no longer used with new store list UI');
  }

  // Helper method to position fixed dropdown relative to input
  positionDropdown(inputId, dropdownId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    if (!input || !dropdown) {
      return;
    }

    const inputRect = input.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 400; // max-height from CSS

    // Position dropdown below input by default
    let top = inputRect.bottom + 4;
    let left = inputRect.left;
    const width = inputRect.width;

    // Check if dropdown would be cut off at bottom of viewport
    if (top + dropdownHeight > viewportHeight) {
      // Position above input if there's more space
      const spaceAbove = inputRect.top;
      const spaceBelow = viewportHeight - inputRect.bottom;

      if (spaceAbove > spaceBelow && spaceAbove > 200) {
        top = inputRect.top - Math.min(dropdownHeight, spaceAbove) - 4;
      }
    }

    // Ensure dropdown stays within viewport horizontally
    const maxLeft = window.innerWidth - width - 20;
    left = Math.min(left, maxLeft);
    left = Math.max(left, 20);

    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
    dropdown.style.width = `${width}px`;
  }

  // Reposition any visible dropdowns when window changes
  repositionVisibleDropdowns() {
    const modelDropdown = document.getElementById('modelSuggestions');

    if (modelDropdown && modelDropdown.style.display === 'block') {
      this.positionDropdown('modelSearchInput', 'modelSuggestions');
    }
  }

  // Handle clicks outside dropdowns to close them
  handleOutsideClick(e) {
    const modelInput = document.getElementById('modelSearchInput');
    const modelDropdown = document.getElementById('modelSuggestions');

    // Check if click is outside model autocomplete
    if (
      modelInput &&
      modelDropdown &&
      !modelInput.contains(e.target) &&
      !modelDropdown.contains(e.target)
    ) {
      this.hideModelSuggestions();
    }
  }

  hideShopSuggestions() {
    // No longer used with new store list UI
    console.log('hideShopSuggestions called but no longer used');
  }

  onShopSuggestionClick(e) {
    if (e.target.classList.contains('autocomplete-suggestion')) {
      this.selectShopSuggestion(e.target.dataset.value);
    }
  }

  onShopInputKeydown(e) {
    // Simplified keydown handler for new store list UI
    if (e.key === 'Escape') {
      e.target.value = '';
      this.onShopInput({ target: { value: '' } });
      e.preventDefault();
    }
  }

  // Helper method to scroll selected suggestion into view
  scrollSuggestionIntoView(container, suggestion) {
    const containerRect = container.getBoundingClientRect();
    const suggestionRect = suggestion.getBoundingClientRect();

    if (suggestionRect.bottom > containerRect.bottom) {
      // Scroll down
      container.scrollTop += suggestionRect.bottom - containerRect.bottom + 5;
    } else if (suggestionRect.top < containerRect.top) {
      // Scroll up
      container.scrollTop -= containerRect.top - suggestionRect.top + 5;
    }
  }

  selectShopSuggestion(storeData) {
    const store = JSON.parse(storeData);
    const shopInput = document.getElementById('shopSearchInput');

    if (shopInput) {
      shopInput.value = `${store.store_name} (${store.store_id})`;
    }
    this.shopSearchSelected = store;
    this.selectedShop = store;

    this.showSelectedShopInfo(store);
    this.hideShopSuggestions();

    const nextBtn = document.getElementById('nextToStep2');
    if (nextBtn) {
      nextBtn.disabled = false;
    }
  }

  showSelectedShopInfo(store) {
    const infoDiv = document.getElementById('selectedShopInfo');
    const textSpan = document.getElementById('selectedShopText');
    if (textSpan) {
      textSpan.textContent = `${store.store_name} (${store.store_id})`;
    }
    if (infoDiv) {
      infoDiv.style.display = 'block';
    }
  }

  hideSelectedShopInfo() {
    const infoDiv = document.getElementById('selectedShopInfo');
    if (infoDiv) {
      infoDiv.style.display = 'none';
    }
  }

  // Update scroll indicators based on scroll position
  updateScrollIndicators(listDiv) {
    if (!listDiv) return;

    const canScrollLeft = listDiv.scrollLeft > 0;
    const canScrollRight = listDiv.scrollLeft < listDiv.scrollWidth - listDiv.clientWidth;

    listDiv.classList.toggle('scroll-left', canScrollLeft);
    listDiv.classList.toggle('scroll-right', canScrollRight);
  }

  // Keyboard navigation for selected models list with horizontal scrolling
  addSelectedModelsKeyboardNavigation() {
    const listDiv = document.getElementById('selectedModelsList');
    if (!listDiv) return;

    // Make the container focusable for keyboard navigation
    listDiv.setAttribute('tabindex', '0');
    listDiv.setAttribute('role', 'list');
    listDiv.setAttribute('aria-label', 'Danh sách models đã chọn, sử dụng mũi tên để cuộn ngang');

    // Add scroll event listener for indicators
    listDiv.addEventListener('scroll', () => {
      this.updateScrollIndicators(listDiv);
    });

    // Add keyboard event listener
    listDiv.addEventListener('keydown', (e) => {
      const scrollAmount = 100; // pixels to scroll

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          listDiv.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
          break;
        case 'ArrowRight':
          e.preventDefault();
          listDiv.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          break;
        case 'Home':
          e.preventDefault();
          listDiv.scrollTo({ left: 0, behavior: 'smooth' });
          break;
        case 'End':
          e.preventDefault();
          listDiv.scrollTo({ left: listDiv.scrollWidth, behavior: 'smooth' });
          break;
      }
    });

    // Focus management for delete buttons
    const deleteButtons = listDiv.querySelectorAll('.btn-icon-delete');
    deleteButtons.forEach((btn) => {
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
    });
  }

  async loadModelsAndPOSM() {
    if (!this.selectedShop) {
      return;
    }

    try {
      this.showLoading();
      const response = await this.authenticatedFetch(
        `/api/models/${encodeURIComponent(this.selectedShop.store_id)}`
      );
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

    Object.keys(this.surveyData).forEach((model) => {
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
    checkboxes.forEach((checkbox) => {
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
      individualItems.forEach((item) => item.classList.add('hidden'));
      individualCheckboxes.forEach((cb) => {
        cb.checked = false;
        this.checkboxStates[model][cb.id] = false;
      });
    } else {
      // Show individual items
      individualItems.forEach((item) => item.classList.remove('hidden'));
    }
  }

  handleIndividualCheckboxChange(model) {
    const modelContainer = document.getElementById(`posm-list-${this.sanitizeId(model)}`);
    const allCheckbox = modelContainer.querySelector('input[data-type="all"]');
    const individualCheckboxes = modelContainer.querySelectorAll('input[data-type="individual"]');

    // If any individual checkbox is checked, uncheck the "all" checkbox
    const anyIndividualChecked = Array.from(individualCheckboxes).some((cb) => cb.checked);
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
    this.selectedModels.forEach((model) => {
      const modelContainer = document.getElementById(`posm-list-${this.sanitizeId(model)}`);
      if (modelContainer) {
        const checkboxes = modelContainer.querySelectorAll('input[type="checkbox"]');
        if (!this.checkboxStates[model]) {
          this.checkboxStates[model] = {};
        }

        checkboxes.forEach((checkbox) => {
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

    this.selectedModels.forEach((model) => {
      // Restore checkbox states
      if (this.checkboxStates[model]) {
        Object.keys(this.checkboxStates[model]).forEach((checkboxId) => {
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
    document.getElementById('selectedShop').textContent =
      `${this.selectedShop.store_name} (${this.selectedShop.store_id})`;
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
    document.querySelectorAll('.step').forEach((step) => {
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

      // Validation: must upload image for each model
      const modelsWithoutImages = [];
      for (const model of this.selectedModels) {
        if (!this.modelImages[model]) {
          modelsWithoutImages.push(model);
        }
      }
      if (modelsWithoutImages.length > 0) {
        const errorMessage =
          modelsWithoutImages.length === 1
            ? `Vui lòng upload ảnh cho model: ${modelsWithoutImages[0]}`
            : `Vui lòng upload ảnh cho các model: ${modelsWithoutImages.join(', ')}`;
        alert(errorMessage);
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
          this.showLoadingMsg(
            `Đang upload ảnh cho model ${model} (${++uploadedCount}/${this.selectedModels.length})...`
          );
          const formData = new FormData();
          formData.append('file', file);
          const res = await this.authenticatedFetch('/api/upload', {
            method: 'POST',
            body: formData,
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
      responses.forEach((r) => {
        r.images = modelImageUrls[r.model] ? [modelImageUrls[r.model]] : [];
      });
      const surveyData = {
        leader: this.user ? this.user.leader : 'Unknown',
        shopName: this.selectedShop.store_name,
        storeId: this.selectedShop.store_id,
        responses: responses,
      };
      console.log('📤 Sending survey data to server:', surveyData);
      console.log('👤 User info:', {
        username: this.user?.username,
        leader: this.user?.leader,
        role: this.user?.role,
      });
      const response = await this.authenticatedFetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(surveyData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.message || `HTTP error! status: ${response.status}`;
        console.error('❌ Server error response:', errorData);
        throw new Error(errorMessage);
      }
      const result = await response.json();
      console.log('📥 Server response:', result);
      if (result.success) {
        document.querySelectorAll('.step').forEach((step) => {
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

    this.selectedModels.forEach((model) => {
      console.log('📊 Processing model for collection:', model);
      const modelContainer = document.getElementById(`posm-list-${this.sanitizeId(model)}`);
      if (!modelContainer) {
        console.log('❌ Model container not found for:', model);
        return;
      }

      const allCheckbox = modelContainer.querySelector('input[data-type="all"]');
      const individualCheckboxes = modelContainer.querySelectorAll(
        'input[data-type="individual"]:checked'
      );

      console.log('📊 Checkboxes found for model:', model, {
        allChecked: allCheckbox ? allCheckbox.checked : false,
        individualChecked: individualCheckboxes.length,
      });
      // Get quantity value for this model
      const quantityInput = document.getElementById(`quantity-${this.sanitizeId(model)}`);
      const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;

      const modelResponse = {
        model: model,
        quantity: quantity,
        posmSelections: [],
        allSelected: allCheckbox ? allCheckbox.checked : false,
        images: this.modelImages[model] ? [URL.createObjectURL(this.modelImages[model])] : [],
      };

      if (allCheckbox && allCheckbox.checked) {
        // If "all" is selected, add all POSM items
        this.surveyData[model].forEach((posm) => {
          modelResponse.posmSelections.push({
            posmCode: posm.posmCode,
            posmName: posm.posmName,
            selected: true,
          });
        });
        console.log('✅ Added all POSM items for model:', model);
      } else {
        // Add only selected individual items
        individualCheckboxes.forEach((checkbox) => {
          modelResponse.posmSelections.push({
            posmCode: checkbox.dataset.posmCode,
            posmName: checkbox.dataset.posmName,
            selected: true,
          });
        });
        console.log(
          '✅ Added individual POSM items for model:',
          model,
          modelResponse.posmSelections.length
        );
      }

      // Only add to responses if there are selections
      if (modelResponse.allSelected || modelResponse.posmSelections.length > 0) {
        responses.push(modelResponse);
        console.log('✅ Model response added to final responses:', model);
      } else {
        console.log('❌ Model response not added (no selections):', model);
      }
    });

    console.log(
      '📊 Final responses collected:',
      responses.length,
      responses.map((r) => r.model)
    );
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
    this.shopSearchValue = '';
    this.shopSearchSelected = '';

    // Clear debounce timers
    if (this.shopSearchDebounceTimer) {
      clearTimeout(this.shopSearchDebounceTimer);
      this.shopSearchDebounceTimer = null;
    }
    if (this.modelSearchDebounceTimer) {
      clearTimeout(this.modelSearchDebounceTimer);
      this.modelSearchDebounceTimer = null;
    }

    // Reset form elements
    document.getElementById('shopSearchInput').value = '';
    document.getElementById('nextToStep2').disabled = true;
    document.getElementById('modelSearchInput').value = '';
    document.getElementById('addModelBtn').disabled = true;

    // Clear containers
    document.getElementById('modelsContainer').innerHTML = '';
    document.getElementById('modelSuggestions').innerHTML = '';
    document.getElementById('shopSuggestions').innerHTML = '';

    // Hide info displays
    this.hideSelectedShopInfo();
    this.hideShopSuggestions();

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
    const fileInputGallery = document.getElementById(
      `file-input-gallery-${this.sanitizeId(model)}`
    );
    if (!hasImage) {
      fileInputCamera.addEventListener('change', (e) => this.handleImageFiles(e, model));
      fileInputGallery.addEventListener('change', (e) => this.handleImageFiles(e, model));
    }
    this.updateImagePreview(model);
  }

  async handleImageFiles(e, model) {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
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

    // Clear existing timer to prevent multiple API calls
    if (this.modelSearchDebounceTimer) {
      clearTimeout(this.modelSearchDebounceTimer);
    }

    // Debounce the API call by 300ms to prevent race conditions
    this.modelSearchDebounceTimer = setTimeout(async () => {
      try {
        const res = await this.authenticatedFetch(
          `/api/model-autocomplete?q=${encodeURIComponent(value)}`
        );
        if (res && res.ok) {
          const models = await res.json();
          this.showModelSuggestions(models);
        } else {
          console.error('Model search API call failed:', res?.status);
          this.hideModelSuggestions();
        }
      } catch (error) {
        console.error('Model search error:', error);
        this.hideModelSuggestions();
      }
    }, 300);
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
      if (this.selectedModels.includes(model)) {
        return;
      }
      const div = document.createElement('div');
      div.className = 'autocomplete-suggestion';
      div.textContent = model;
      div.dataset.value = model;
      if (idx === 0) {
        div.classList.add('active');
      }
      suggestionsBox.appendChild(div);
    });

    // Position the dropdown relative to the input field
    this.positionDropdown('modelSearchInput', 'modelSuggestions');

    suggestionsBox.style.display = 'block';
    suggestionsBox.scrollTop = 0;
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
    if (!items.length) {
      return;
    }
    const idx = items.findIndex((item) => item.classList.contains('active'));
    if (e.key === 'ArrowDown') {
      if (idx < items.length - 1) {
        if (idx >= 0) {
          items[idx].classList.remove('active');
        }
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
    if (!model || this.selectedModels.includes(model)) {
      return;
    }

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
        const response = await this.authenticatedFetch(
          `/api/models/${encodeURIComponent(this.selectedShop.store_id)}`
        );
        const allModels = await response.json();

        if (allModels[model]) {
          this.surveyData[model] = allModels[model];
          console.log('✅ POSM data loaded from shop data for model:', model);
        } else {
          console.log('🔍 Model not found in shop data, trying general model list');
          // Enhanced mobile debugging
          const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          console.log(`📱 Client info for model "${model}":`, {
            isMobile: isMobile,
            userAgent: navigator.userAgent.substring(0, 100),
            requestTime: new Date().toISOString()
          });
          
          // If model not found in shop data, try to get it from the general model list
          const modelResponse = await this.authenticatedFetch(
            `/api/model-posm/${encodeURIComponent(model)}`
          );
          
          // Enhanced response debugging
          console.log(`📥 Received response for model "${model}" (mobile=${isMobile}):`, {
            ok: modelResponse?.ok,
            status: modelResponse?.status,
            statusText: modelResponse?.statusText,
            headers: modelResponse ? Object.fromEntries(modelResponse.headers.entries()) : null,
            responseType: typeof modelResponse
          });
          
          if (modelResponse && modelResponse.ok) {
            const modelData = await modelResponse.json();
            
            // Enhanced data debugging
            console.log(`🔍 Parsed response data for model "${model}" (mobile=${isMobile}):`, {
              isArray: Array.isArray(modelData),
              length: modelData?.length,
              dataType: typeof modelData,
              firstItem: modelData?.[0],
              stringified: JSON.stringify(modelData).substring(0, 200)
            });
            
            // Add validation to ensure we have an array
            if (modelData && Array.isArray(modelData) && modelData.length > 0) {
              this.surveyData[model] = modelData;
              console.log('✅ POSM data loaded from general list for model:', model);
            } else {
              console.error('❌ No POSM data found for model:', model, 'Response:', modelData);
              alert(
                `Không tìm thấy POSM cho model "${model}". Vui lòng kiểm tra lại tên model hoặc liên hệ admin. Model sẽ bị loại bỏ khỏi danh sách.`
              );
              // Remove the model from selected list
              this.selectedModels = this.selectedModels.filter((m) => m !== model);
              console.log('❌ Model removed due to no POSM data');
              return;
            }
          } else {
            const statusText = modelResponse ? modelResponse.status : 'Network Error';
            console.error('❌ API request failed for model:', model, 'Status:', statusText);
            alert(`Lỗi kết nối khi tìm POSM cho model "${model}". Status: ${statusText}. Vui lòng thử lại.`);
            // Remove the model from selected list
            this.selectedModels = this.selectedModels.filter((m) => m !== model);
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
      this.selectedModels = this.selectedModels.filter((m) => m !== model);
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

    // Render visible list of all added models with horizontal scrolling
    const listDiv = document.getElementById('selectedModelsList');
    if (this.selectedModels.length === 0) {
      listDiv.innerHTML = '<em>Chưa có model nào được chọn.</em>';
      // Remove scroll indicators when empty
      listDiv.classList.remove('scroll-left', 'scroll-right');
    } else {
      const modelsHtml = this.selectedModels
        .map((model) => {
          // Sanitize model name to prevent XSS
          const sanitizedModel = model.replace(/[<>&"]/g, function (match) {
            switch (match) {
              case '<':
                return '&lt;';
              case '>':
                return '&gt;';
              case '&':
                return '&amp;';
              case '"':
                return '&quot;';
              default:
                return match;
            }
          });

          return `
                <span class="selected-model-item" data-model="${sanitizedModel}" title="Model: ${sanitizedModel}">
                    <strong>${sanitizedModel}</strong>
                    <button class="btn-icon-delete" data-model="${sanitizedModel}" title="Xóa model này" aria-label="Xóa model ${sanitizedModel}">×</button>
                </span>
            `;
        })
        .join('');

      listDiv.innerHTML = modelsHtml;

      // Auto-scroll to the latest added model (rightmost) and setup scroll indicators
      setTimeout(() => {
        if (listDiv.scrollWidth > listDiv.clientWidth) {
          listDiv.scrollLeft = listDiv.scrollWidth - listDiv.clientWidth;
        }
        this.updateScrollIndicators(listDiv);
      }, 50);
    }
    // Render POSM selection for each model
    this.selectedModels.forEach((model) => {
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
    container.querySelectorAll('.btn-icon-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const model = e.target.dataset.model;
        this.selectedModels = this.selectedModels.filter((m) => m !== model);
        delete this.modelImages[model];
        delete this.checkboxStates[model];
        delete this.modelQuantities[model];
        console.log('🗿 Removed model and cleaned up state:', model);
        this.renderSelectedModels();
      });
    });
    // Bind remove model buttons (in list)
    document.querySelectorAll('.selected-model-item .btn-icon-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const model = e.target.dataset.model;
        this.selectedModels = this.selectedModels.filter((m) => m !== model);
        delete this.modelImages[model];
        delete this.checkboxStates[model];
        delete this.modelQuantities[model];
        console.log('🗿 Removed model and cleaned up state:', model);
        this.renderSelectedModels();
      });
    });

    // Add keyboard navigation for selected models list
    this.addSelectedModelsKeyboardNavigation();
    // Bind POSM checkboxes
    this.bindCheckboxEvents();

    // Bind quantity input events to save state
    this.selectedModels.forEach((model) => {
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
    this.selectedModels.forEach((model) => this.renderImageUpload(model));
  }
}

// Sticky behavior implementation
class StickyElements {
  constructor() {
    this.stickyElements = [];
    this.isEnabled = false;
  }

  init() {
    // Initialize sticky behavior when step 2 is active
    this.setupStickyElements();
    this.bindScrollListener();
  }

  setupStickyElements() {
    // Clear existing elements to prevent duplicates
    this.stickyElements = [];

    // Try new combined header first, fallback to legacy elements
    const combinedHeader = document.querySelector('.combined-sticky-header');
    if (combinedHeader) {
      this.stickyElements.push({
        element: combinedHeader,
        originalTop: null,
        isSticky: false,
        className: 'combined-sticky-header',
      });
      console.log('📋 Using combined sticky header');
    } else {
      // Fallback to legacy separate elements
      const selectedInfo = document.querySelector('.selected-info');
      const stickySearch = document.querySelector('.sticky-search-section');

      if (selectedInfo) {
        this.stickyElements.push({
          element: selectedInfo,
          originalTop: null,
          isSticky: false,
          className: 'selected-info',
        });
      }

      if (stickySearch) {
        this.stickyElements.push({
          element: stickySearch,
          originalTop: null,
          isSticky: false,
          className: 'sticky-search-section',
        });
      }
      console.log('📋 Using legacy separate sticky elements');
    }

    console.log('📋 Setup sticky elements:', this.stickyElements.length);
  }

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    console.log('🔧 Enabling sticky behavior for', this.stickyElements.length, 'elements');

    // Reset elements
    this.stickyElements.forEach((item) => {
      item.originalTop = item.element.offsetTop;
      item.isSticky = false;
      console.log(`  📍 Element ${item.className} originalTop:`, item.originalTop);
    });

    this.handleScroll();
  }

  disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;

    // Reset all elements to normal positioning
    this.stickyElements.forEach((item) => {
      if (item.isSticky) {
        item.element.style.position = '';
        item.element.style.top = '';
        item.element.style.left = '';
        item.element.style.right = '';
        item.element.style.width = '';
        item.element.style.marginLeft = '';
        item.element.style.marginRight = '';
        item.element.style.boxShadow = '';
        item.isSticky = false;
      }
    });
  }

  bindScrollListener() {
    let ticking = false;

    const scrollHandler = () => {
      if (!ticking && this.isEnabled) {
        requestAnimationFrame(() => {
          this.handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });
  }

  handleScroll() {
    if (!this.isEnabled) return;

    const scrollY = window.pageYOffset;

    this.stickyElements.forEach((item) => {
      if (item.originalTop === null) {
        item.originalTop = item.element.offsetTop;
      }

      const shouldStick = scrollY >= item.originalTop;

      if (shouldStick && !item.isSticky) {
        // Make sticky
        console.log(`🔗 Making ${item.className} sticky`);
        const rect = item.element.getBoundingClientRect();
        item.element.style.position = 'fixed';
        item.element.style.top = '0px';
        item.element.style.left = rect.left + 'px';
        item.element.style.right = window.innerWidth - rect.right + 'px';
        item.element.style.width = rect.width + 'px';

        // Fix: Remove negative margins that cause alignment shift
        item.element.style.marginLeft = '0';
        item.element.style.marginRight = '0';

        // Set z-index based on element type
        if (item.className === 'combined-sticky-header') {
          item.element.style.zIndex = '200';
        } else if (item.className === 'selected-info') {
          item.element.style.zIndex = '200';
        } else {
          item.element.style.zIndex = '150';
        }
        item.element.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        item.isSticky = true;
      } else if (!shouldStick && item.isSticky) {
        // Remove sticky and restore original state
        console.log(`🔓 Removing sticky from ${item.className}`);
        item.element.style.position = '';
        item.element.style.top = '';
        item.element.style.left = '';
        item.element.style.right = '';
        item.element.style.width = '';
        item.element.style.marginLeft = '';
        item.element.style.marginRight = '';
        item.element.style.boxShadow = '';
        item.isSticky = false;
      }
    });
  }

  refresh() {
    // Recalculate positions
    this.stickyElements.forEach((item) => {
      if (!item.isSticky) {
        item.originalTop = item.element.offsetTop;
      }
    });
    this.handleScroll();
  }
}

// Initialize the app when DOM is loaded
let app;
let stickyManager;

document.addEventListener('DOMContentLoaded', () => {
  app = new SurveyApp();
  stickyManager = new StickyElements();
  window.stickyManager = stickyManager; // Make it globally accessible
  stickyManager.init();

  // Enable sticky behavior when step 2 becomes active
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const step2 = document.getElementById('step2');
        if (step2 && step2.classList.contains('active')) {
          console.log('🔄 Step 2 activated, enabling sticky elements');
          // Wait for content to render then enable sticky
          setTimeout(() => {
            stickyManager.setupStickyElements();
            stickyManager.enable();
            console.log('✅ Sticky elements enabled:', stickyManager.stickyElements.length);
          }, 100);
        } else {
          stickyManager.disable();
        }
      }
    });
  });

  // Observe step changes
  const steps = document.querySelectorAll('.step');
  steps.forEach((step) => {
    observer.observe(step, { attributes: true });
  });
});
