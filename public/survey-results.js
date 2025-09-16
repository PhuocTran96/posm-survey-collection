// AutocompleteFilter class for search-enabled multi-select filters
class AutocompleteFilter {
  constructor(containerId, options, parentApp) {
    this.container = document.getElementById(containerId);
    this.apiEndpoint = options.apiEndpoint;
    this.placeholder = options.placeholder;
    this.parentApp = parentApp;
    this.selectedItems = new Map(); // id -> {id, name, ...}
    this.debounceTimer = null;
    this.minChars = 2;
    this.maxResults = 20;
    this.isOpen = false;
    this.highlightedIndex = -1;
    this.currentResults = [];

    if (this.container) {
      this.render();
      this.bindEvents();
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="autocomplete-input-container">
        <input
          type="text"
          class="autocomplete-input"
          placeholder="${this.placeholder}"
          autocomplete="off"
        />
        <div class="autocomplete-loading" style="display: none;">
          <div class="spinner"></div>
        </div>
      </div>
      <div class="autocomplete-dropdown" style="display: none;"></div>
      <div class="selected-tags-container"></div>
    `;
  }

  bindEvents() {
    const input = this.container.querySelector('.autocomplete-input');
    const dropdown = this.container.querySelector('.autocomplete-dropdown');

    // Input events
    input.addEventListener('input', (e) => this.handleInput(e));
    input.addEventListener('focus', () => this.handleFocus());
    input.addEventListener('blur', (e) => this.handleBlur(e));
    input.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }

  handleInput(e) {
    const query = e.target.value.trim();

    if (query.length >= this.minChars) {
      this.debouncedSearch(query);
    } else {
      this.closeDropdown();
    }
  }

  handleFocus() {
    const input = this.container.querySelector('.autocomplete-input');
    const query = input.value.trim();
    if (query.length >= this.minChars) {
      this.debouncedSearch(query);
    }
  }

  handleBlur(e) {
    // Delay to allow clicking on dropdown items
    setTimeout(() => {
      if (!this.container.contains(document.activeElement)) {
        this.closeDropdown();
      }
    }, 150);
  }

  handleKeydown(e) {
    if (!this.isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.highlightNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.highlightPrevious();
        break;
      case 'Enter':
        e.preventDefault();
        this.selectHighlighted();
        break;
      case 'Escape':
        e.preventDefault();
        this.closeDropdown();
        break;
    }
  }

  debouncedSearch(query) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.search(query);
    }, 300);
  }

  async search(query) {
    try {
      this.showLoading();

      const searchUrl = `${this.apiEndpoint}?q=${encodeURIComponent(query)}&limit=${this.maxResults}`;

      console.group(`🔍 Autocomplete Search: ${this.apiEndpoint.split('/').pop()}`);
      console.log('Query:', query);
      console.log('Search URL:', searchUrl);

      const response = await this.parentApp.makeAuthenticatedRequest(searchUrl);

      console.log('📡 API Response:', response);
      console.log('Response Type:', typeof response);

      // Handle different response formats
      let results = [];
      if (response && response.results) {
        results = response.results;
        console.log('✅ Found results in response.results');
      } else if (Array.isArray(response)) {
        results = response;
        console.log('✅ Response is direct array');
      } else if (response && response.data && Array.isArray(response.data)) {
        results = response.data;
        console.log('✅ Found results in response.data');
      } else if (response && typeof response === 'object') {
        // Try to find array in response object
        const possibleArrays = Object.values(response).filter(val => Array.isArray(val));
        if (possibleArrays.length > 0) {
          results = possibleArrays[0];
          console.log('✅ Found array in response object');
        } else {
          console.log('⚠️ No arrays found in response object');
        }
      } else {
        console.log('❌ Unexpected response format');
      }

      console.log('📋 Final Results:', results);
      console.log('Results Count:', results.length);
      console.groupEnd();

      this.currentResults = results;
      this.renderDropdown(results);
      this.openDropdown();

    } catch (error) {
      console.error('❌ Search error:', error);
      console.error('Error details:', error.message, error.stack);

      // Show error in dropdown
      const dropdown = this.container.querySelector('.autocomplete-dropdown');
      if (dropdown) {
        dropdown.innerHTML = `<div class="autocomplete-error">Lỗi tìm kiếm: ${error.message}</div>`;
        this.openDropdown();
      }
    } finally {
      this.hideLoading();
    }
  }

  renderDropdown(results) {
    const dropdown = this.container.querySelector('.autocomplete-dropdown');

    if (results.length === 0) {
      dropdown.innerHTML = '<div class="autocomplete-empty">Không tìm thấy kết quả</div>';
      return;
    }

    dropdown.innerHTML = results.map((item, index) => `
      <div class="autocomplete-option" data-index="${index}" data-id="${item.id}">
        <div class="autocomplete-option-title">${item.name}</div>
        ${item.leader ? `<div class="autocomplete-option-subtitle">Leader: ${item.leader}</div>` : ''}
        ${item.surveyCount ? `<div class="autocomplete-option-subtitle">${item.surveyCount} surveys</div>` : ''}
        ${item.usageCount ? `<div class="autocomplete-option-subtitle">${item.usageCount} times used</div>` : ''}
      </div>
    `).join('');

    // Add click events
    dropdown.querySelectorAll('.autocomplete-option').forEach(option => {
      option.addEventListener('click', () => {
        const index = parseInt(option.dataset.index);
        this.selectItem(this.currentResults[index]);
      });
    });
  }

  selectItem(item) {
    if (!this.selectedItems.has(item.id)) {
      this.selectedItems.set(item.id, item);
      this.renderSelectedTags();
      this.parentApp.updateSelectedFilters();

      // Automatically apply filters when item is selected
      this.parentApp.applyFiltersAutomatically();
    }

    // Clear input and close dropdown
    const input = this.container.querySelector('.autocomplete-input');
    input.value = '';
    this.closeDropdown();
  }

  selectHighlighted() {
    if (this.highlightedIndex >= 0 && this.currentResults[this.highlightedIndex]) {
      this.selectItem(this.currentResults[this.highlightedIndex]);
    }
  }

  highlightNext() {
    this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.currentResults.length - 1);
    this.updateHighlight();
  }

  highlightPrevious() {
    this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
    this.updateHighlight();
  }

  updateHighlight() {
    const options = this.container.querySelectorAll('.autocomplete-option');
    options.forEach((option, index) => {
      option.classList.toggle('highlighted', index === this.highlightedIndex);
    });
  }

  renderSelectedTags() {
    const container = this.container.querySelector('.selected-tags-container');

    container.innerHTML = Array.from(this.selectedItems.values()).map(item => `
      <div class="selected-tag">
        <span>${item.name}</span>
        <button class="selected-tag-remove" data-id="${item.id}" type="button">×</button>
      </div>
    `).join('');

    // Add remove events
    container.querySelectorAll('.selected-tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.selectedItems.delete(id);
        this.renderSelectedTags();
        this.parentApp.updateSelectedFilters();

        // Automatically apply filters when item is removed
        this.parentApp.applyFiltersAutomatically();
      });
    });
  }

  clearAll() {
    this.selectedItems.clear();
    this.renderSelectedTags();
    this.parentApp.updateSelectedFilters();

    // Automatically apply filters when all items are cleared
    this.parentApp.applyFiltersAutomatically();
  }

  getSelectedValues() {
    return Array.from(this.selectedItems.values()).map(item => item.name);
  }

  openDropdown() {
    const dropdown = this.container.querySelector('.autocomplete-dropdown');
    dropdown.style.display = 'block';
    this.isOpen = true;
    this.highlightedIndex = -1;
  }

  closeDropdown() {
    const dropdown = this.container.querySelector('.autocomplete-dropdown');
    dropdown.style.display = 'none';
    this.isOpen = false;
    this.highlightedIndex = -1;
  }

  showLoading() {
    const loading = this.container.querySelector('.autocomplete-loading');
    loading.style.display = 'block';
  }

  hideLoading() {
    const loading = this.container.querySelector('.autocomplete-loading');
    loading.style.display = 'none';
  }
}

class SurveyResultsApp {
  constructor() {
    this.responses = [];
    this.filteredResponses = [];
    this.deleteID = null;
    this.selectedIds = new Set();
    this.expandedSurveys = new Set(); // Track which surveys are expanded
    this.allShops = []; // Store all shop names for autocomplete
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.totalPages = 1;
    this.totalCount = 0;
    this.pagination = null;
    this.selectionMode = 'survey'; // 'survey' or 'model'
    this.selectedModels = new Set(); // Track selected individual models (format: "surveyId:modelIndex")

    // Filter-related properties (sidebar removed)
    this.filterOptions = {
      shops: [],
      users: [],
      categories: [],
      models: []
    };
    this.selectedFilters = {
      shops: [],
      users: [],
      categories: [],
      models: []
    };

    // Autocomplete filters
    this.autocompleteFilters = {};

    this.init();
  }

  async init() {
    // Check authentication first
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      return; // User will be redirected to login
    }

    this.bindEvents();
    this.initializeAdvancedFilters();
    this.loadFilterOptions();
    this.loadResponses();
    this.initNavigation();
  }

  async checkAuthentication() {
    const token = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');

    if (!token || !user) {
      this.redirectToAdminLogin('No access token or user data found');
      return false;
    }

    try {
      const userData = JSON.parse(user);
      console.log('Admin page: Checking auth for user:', userData.username, userData.role);

      // Check if user is admin
      if (userData.role !== 'admin') {
        alert('Access denied: Admin privileges required');
        localStorage.clear();
        window.location.replace('/login.html');
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
        return true;
      } else {
        // Token invalid, clear storage
        localStorage.clear();
        this.redirectToAdminLogin('Session expired or invalid');
        return false;
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      localStorage.clear();
      this.redirectToAdminLogin('Session expired or invalid');
      return false;
    }
  }

  redirectToAdminLogin(reason) {
    console.log('Redirecting to admin login:', reason);
    if (!window.location.pathname.includes('admin-login.html')) {
      window.location.replace('/admin-login.html');
    }
  }

  // Helper method to make authenticated API requests
  async makeAuthenticatedRequest(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      this.redirectToAdminLogin('No access token');
      return null;
    }

    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    };

    // Only set Content-Type to application/json if not uploading files
    // When uploading FormData, browser will set the correct Content-Type with boundary
    if (!(options.body instanceof FormData)) {
      authOptions.headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, authOptions);

      // If unauthorized, clear tokens and redirect
      if (response.status === 401) {
        localStorage.clear();
        this.redirectToAdminLogin('Session expired');
        return null;
      }

      // Auto-parse JSON for autocomplete endpoints, keep raw Response for others
      const contentType = response.headers.get('content-type');
      const isJsonResponse = contentType && contentType.includes('application/json');
      const isAutocompleteEndpoint = url.includes('-autocomplete');

      // Parse JSON automatically for autocomplete endpoints
      if (response.ok && isJsonResponse && isAutocompleteEndpoint) {
        try {
          const data = await response.json();
          console.log(`📋 Auto-parsed JSON response from ${url}:`, data);
          return data;
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          console.log('Response was:', response);
          return response; // Fallback to raw response
        }
      }

      // For all other endpoints, return raw response (existing behavior)
      console.log(`📡 Raw response from ${url}:`, response);
      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
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
    // ESC key to close modals
    document.addEventListener('keydown', (e) => this.handleEscapeKey(e));

    const exportDataBtn = document.getElementById('exportData');
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', () => this.exportData());
    }

    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }

    // Global search setup
    this.setupGlobalSearch();

    // Date filter event listeners - these work alongside global search
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

    // Selection mode toggle
    const selectionModeToggle = document.getElementById('selectionModeToggle');
    if (selectionModeToggle) {
      selectionModeToggle.addEventListener('change', () => this.toggleSelectionMode());
    }

    // Advanced filters event listeners
    this.bindAdvancedFiltersEvents();
  }

  // Advanced filters methods
  initializeAdvancedFilters() {
    console.log('🔧 Initializing advanced filters...');

    // No sidebar state needed - filters are always visible
    console.log('✅ Advanced filters initialized');
  }

  bindAdvancedFiltersEvents() {
    // No global buttons needed - filters apply automatically
    console.log('✅ Advanced filters events bound (automatic filtering)');

    // Select all checkboxes
    ['shops', 'users', 'categories', 'models'].forEach(type => {
      const selectAllBtn = document.getElementById(`selectAll${type.charAt(0).toUpperCase() + type.slice(1)}`);
      if (selectAllBtn) {
        selectAllBtn.addEventListener('change', (e) => this.handleSelectAll(type, e.target.checked));
      }
    });

    // Window resize handler
    window.addEventListener('resize', () => this.handleWindowResize());
  }

  async loadFilterOptions() {
    try {
      console.log('📊 Initializing autocomplete filters...');

      // Test API endpoints first
      await this.testApiEndpoints();

      // Initialize autocomplete filters
      this.autocompleteFilters = {
        shops: new AutocompleteFilter('shopAutocomplete', {
          apiEndpoint: '/api/stores-autocomplete',
          placeholder: '🔍 Tìm kiếm cửa hàng...'
        }, this),

        users: new AutocompleteFilter('userAutocomplete', {
          apiEndpoint: '/api/users-autocomplete',
          placeholder: '🔍 Tìm kiếm người dùng...'
        }, this),

        categories: new AutocompleteFilter('categoryAutocomplete', {
          apiEndpoint: '/api/categories-autocomplete',
          placeholder: '🔍 Tìm kiếm danh mục...'
        }, this),

        models: new AutocompleteFilter('modelAutocomplete', {
          apiEndpoint: '/api/models-autocomplete',
          placeholder: '🔍 Tìm kiếm model...'
        }, this)
      };

      console.log('✅ Autocomplete filters initialized');
    } catch (error) {
      console.error('❌ Error initializing autocomplete filters:', error);
    }
  }

  // Test API endpoints to debug connection issues
  async testApiEndpoints() {
    console.group('🧪 API Endpoints Testing');

    const endpoints = [
      '/api/stores-autocomplete?q=cao&limit=5',
      '/api/users-autocomplete?q=test&limit=5',
      '/api/categories-autocomplete?q=test&limit=5',
      '/api/models-autocomplete?q=test&limit=5'
    ];

    for (const endpoint of endpoints) {
      console.group(`🔍 Testing: ${endpoint}`);
      try {
        // Test raw fetch first to see actual response
        const token = localStorage.getItem('accessToken');
        console.log('Using token:', token ? 'Present' : 'Missing');

        const rawResponse = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('Raw Response Status:', rawResponse.status);
        console.log('Raw Response OK:', rawResponse.ok);
        console.log('Raw Response Headers:', [...rawResponse.headers.entries()]);

        if (rawResponse.ok) {
          const textContent = await rawResponse.text();
          console.log('Raw Response Text:', textContent.substring(0, 200) + '...');

          try {
            const jsonData = JSON.parse(textContent);
            console.log('Parsed JSON:', jsonData);
          } catch (parseError) {
            console.log('JSON Parse Error:', parseError.message);
          }
        }

        // Now test through our authenticated request
        console.log('--- Testing via makeAuthenticatedRequest ---');
        const authResponse = await this.makeAuthenticatedRequest(endpoint);
        console.log('Auth Response Type:', typeof authResponse);
        console.log('Auth Response:', authResponse);

        console.log('✅ Test completed for', endpoint);
      } catch (error) {
        console.error('❌ Test failed for', endpoint, ':', error.message);
      }
      console.groupEnd();
    }
    console.groupEnd();
  }

  // Update selected filters from autocomplete components
  updateSelectedFilters() {
    console.group('🔄 Updating Selected Filters');

    // Update selected filters based on autocomplete selections
    Object.keys(this.autocompleteFilters).forEach(filterType => {
      const autocomplete = this.autocompleteFilters[filterType];
      if (autocomplete) {
        const selectedValues = autocomplete.getSelectedValues();
        const selectedCount = autocomplete.selectedItems.size;

        console.log(`📊 ${filterType}:`, {
          values: selectedValues,
          count: selectedCount,
          selectedItems: Array.from(autocomplete.selectedItems.values())
        });

        this.selectedFilters[filterType] = selectedValues;
      } else {
        console.log(`❌ No autocomplete filter found for: ${filterType}`);
        this.selectedFilters[filterType] = [];
      }
    });

    console.log('📊 Final selectedFilters:', this.selectedFilters);
    console.groupEnd();
  }

  // Sidebar methods removed - filters are now always visible

  handleWindowResize() {
    // No sidebar visibility updates needed - filters are always visible
  }


  clearFilterSection(type) {
    // Clear autocomplete filter
    if (this.autocompleteFilters[type]) {
      this.autocompleteFilters[type].clearAll();
    }
    this.selectedFilters[type] = [];
  }

  applyFiltersAutomatically() {
    console.group('🔄 Auto-applying Filters');

    // Update selected filters and reload data automatically
    this.updateSelectedFilters();

    const filterCount = Object.values(this.selectedFilters)
      .reduce((total, arr) => total + arr.length, 0);

    console.log('📊 Selected Filters:', this.selectedFilters);
    console.log('📊 Filter Summary:', this.getFilterSummary());
    console.log('📊 Total Active Filters:', filterCount);

    // Test filter value formats before applying
    if (filterCount > 0) {
      this.testFilterValueFormats();
      this.showNotification(`🔍 Applying ${filterCount} filter(s)...`, 'info', 2000);
    }

    console.log('🔄 Triggering loadResponses...');

    this.currentPage = 1;

    // Add promise handling for better error tracking
    this.loadResponses().then(() => {
      console.log('✅ Filter application completed successfully');
      console.groupEnd();
    }).catch((error) => {
      console.error('❌ Filter application failed:', error);
      this.showNotification('❌ Lỗi khi áp dụng bộ lọc', 'error', 3000);
      console.groupEnd();
    });
  }

  // Helper method to summarize active filters
  getFilterSummary() {
    const summary = {};
    Object.keys(this.selectedFilters).forEach(key => {
      if (this.selectedFilters[key].length > 0) {
        summary[key] = this.selectedFilters[key];
      }
    });
    return summary;
  }

  // Test and debug filter value formats
  testFilterValueFormats() {
    console.group('🧪 Testing Filter Value Formats');
    console.log('📋 Current selectedFilters:', this.selectedFilters);

    // Test what values are being sent vs what backend expects
    Object.keys(this.selectedFilters).forEach(filterType => {
      if (this.selectedFilters[filterType].length > 0) {
        console.log(`🔍 ${filterType} values:`, this.selectedFilters[filterType]);
        console.log(`   Expected by backend: ${this.getBackendFieldMapping(filterType)}`);

        // Check for common issues
        const values = this.selectedFilters[filterType];
        const hasEmptyValues = values.some(val => !val || val.trim() === '');
        const hasUndefinedValues = values.some(val => val === 'undefined' || val === undefined);

        if (hasEmptyValues || hasUndefinedValues) {
          console.warn(`⚠️ Problematic values in ${filterType}:`, {
            emptyValues: hasEmptyValues,
            undefinedValues: hasUndefinedValues,
            values: values
          });
        }
      }
    });
    console.groupEnd();
  }

  // Get backend field mapping for debugging
  getBackendFieldMapping(filterType) {
    const mapping = {
      'shops': 'shopName (string match)',
      'users': 'submittedBy (exact match)',
      'models': 'responses.model (string match)',
      'categories': 'responses.posm.category (exact match in array)'
    };
    return mapping[filterType] || 'Unknown field';
  }

  // Validate response data structure and content
  validateResponseData(responseData) {
    console.group('📊 Response Data Validation');
    console.log('📈 Response summary:', {
      totalResponses: responseData.data?.length || responseData.responses?.length || 0,
      totalPages: responseData.pagination?.totalPages || responseData.totalPages || 0,
      currentPage: responseData.pagination?.currentPage || responseData.currentPage || 0,
      hasFilters: Object.values(this.selectedFilters).some(arr => arr.length > 0),
      responseStructure: {
        hasData: !!responseData.data,
        hasPagination: !!responseData.pagination,
        hasResponses: !!responseData.responses,
        hasTotal: !!responseData.total
      }
    });

    // If filters are applied but we get all results, that's suspicious
    const hasActiveFilters = Object.values(this.selectedFilters).some(arr => arr.length > 0);
    const resultCount = responseData.data?.length || responseData.responses?.length || 0;
    const totalCount = responseData.pagination?.total || responseData.total || resultCount;

    if (hasActiveFilters && resultCount > 0) {
      console.log('🔍 Filter effectiveness check:');
      console.log(`   Results returned: ${resultCount}`);
      console.log(`   Total available: ${totalCount}`);

      if (resultCount === totalCount) {
        console.warn('⚠️ POTENTIAL ISSUE: Filters applied but got all results');
        console.log('🔍 This suggests filters may not be working correctly');
      } else {
        console.log('✅ Filters appear to be working - result count reduced');
      }
    }

    // Verify filter application success
    this.verifyFilterApplication(responseData);

    console.groupEnd();
  }

  // Verify that returned data matches filter criteria
  verifyFilterApplication(responseData) {
    const hasActiveFilters = Object.values(this.selectedFilters).some(arr => arr.length > 0);

    if (!hasActiveFilters) {
      console.log('✅ No filters active - showing all results');
      return true;
    }

    console.group('🔍 Filter Application Verification');

    // Get the actual response data
    const responses = responseData.data || responseData.responses || [];
    const sampleResponses = responses.slice(0, 3);

    console.log('📋 Sample responses to verify:', sampleResponses.map(r => ({
      shopName: r.shopName,
      submittedBy: r.submittedBy,
      models: r.responses?.map(resp => resp.model) || []
    })));

    // Log what we expect vs what we got
    console.log('🎯 Expected criteria:', this.selectedFilters);

    // Check each active filter type
    Object.keys(this.selectedFilters).forEach(filterType => {
      if (this.selectedFilters[filterType].length > 0) {
        console.log(`🔎 Verifying ${filterType} filter:`, this.selectedFilters[filterType]);

        const expectedValues = this.selectedFilters[filterType];
        let matchCount = 0;

        sampleResponses.forEach((response, index) => {
          let fieldValue = null;

          switch (filterType) {
            case 'shops':
              fieldValue = response.shopName;
              break;
            case 'users':
              fieldValue = response.submittedBy;
              break;
            case 'models':
              fieldValue = response.responses?.map(r => r.model).join(', ');
              break;
            case 'categories':
              fieldValue = response.responses?.map(r => r.posm?.category).filter(Boolean).join(', ');
              break;
          }

          const hasMatch = expectedValues.some(expected =>
            fieldValue && fieldValue.toLowerCase().includes(expected.toLowerCase())
          );

          if (hasMatch) matchCount++;

          console.log(`   Sample ${index + 1}: ${fieldValue} - ${hasMatch ? '✅ Match' : '❌ No match'}`);
        });

        if (matchCount === 0 && sampleResponses.length > 0) {
          console.warn(`⚠️ No matches found for ${filterType} filter in sample data!`);
        }
      }
    });

    console.groupEnd();
    return true;
  }

  // Legacy method maintained for compatibility
  applyAdvancedFilters() {
    this.applyFiltersAutomatically();
  }

  clearAdvancedFilters() {
    console.log('🗑️ Clearing all advanced filters');

    // Clear all selected filters
    Object.keys(this.selectedFilters).forEach(type => {
      this.clearFilterSection(type);
    });

    // Reload responses
    this.currentPage = 1;
    this.loadResponses();
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

  showExportProgress(message) {
    // Remove existing progress if any
    const existingProgress = document.getElementById('exportProgress');
    if (existingProgress) {
      existingProgress.remove();
    }

    const progressHtml = `
      <div id="exportProgress" class="export-progress" style="
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10001; text-align: center; min-width: 300px;
      ">
        <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
        <div style="font-size: 16px; color: #333;">${message}</div>
        <div style="font-size: 12px; color: #666; margin-top: 10px;">
          Quá trình này có thể mất vài phút...
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', progressHtml);
  }

  hideExportProgress() {
    const progress = document.getElementById('exportProgress');
    if (progress) {
      progress.remove();
    }
  }

  generateExportMetadata(responses, appliedFilters) {
    const totalSurveys = responses.length;
    const totalModels = responses.reduce((sum, r) => sum + (r.responses?.length || 0), 0);
    const totalImages = responses.reduce((sum, r) => {
      return (
        sum + (r.responses?.reduce((imgSum, model) => imgSum + (model.images?.length || 0), 0) || 0)
      );
    }, 0);

    const dateRange = this.getDateRange(responses);

    return [
      ['THÔNG TIN XUẤT DỮ LIỆU'],
      ['Thời gian xuất:', new Date().toLocaleString('vi-VN')],
      ['Tổng số khảo sát:', totalSurveys],
      ['Tổng số model:', totalModels],
      ['Tổng số ảnh:', totalImages],
      ['Khoảng thời gian:', `${dateRange.from} - ${dateRange.to}`],
      [''],
      ['BỘ LỌC ÁP DỤNG:'],
      ...Object.entries(appliedFilters).map(([key, value]) => [key + ':', value || 'Tất cả']),
    ];
  }

  getDateRange(responses) {
    if (responses.length === 0) return { from: 'N/A', to: 'N/A' };

    const dates = responses
      .map((r) => new Date(r.createdAt || r.submittedAt))
      .sort((a, b) => a - b);
    return {
      from: dates[0].toLocaleDateString('vi-VN'),
      to: dates[dates.length - 1].toLocaleDateString('vi-VN'),
    };
  }

  getCurrentFilters() {
    // Since we're exporting ALL records, return appropriate filter labels
    return {
      'Loại xuất': 'TOÀN BỘ DỮ LIỆU',
      'Người thực hiện': 'Tất cả',
      'Tên shop': 'Tất cả',
      'Từ ngày': 'Tất cả thời gian',
      'Đến ngày': 'Tất cả thời gian',
    };
  }

  getFilterSummaryForFilename() {
    // Since we're now exporting ALL records without any filters
    return '_ALL-RECORDS';
  }

  validateDateFilters() {
    const dateFrom = document.getElementById('dateFromFilter')?.value;
    const dateTo = document.getElementById('dateToFilter')?.value;

    if (dateFrom && dateTo) {
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);

      if (fromDate > toDate) {
        this.showNotification('Ngày bắt đầu không thể lớn hơn ngày kết thúc', 'error');
        return false;
      }

      // Check if date range is too large (more than 1 year)
      const daysDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        this.showNotification('Khoảng thời gian không được vượt quá 1 năm', 'warning');
      }
    }

    console.log('📅 Date Filter Validation:', {
      dateFrom: dateFrom,
      dateTo: dateTo,
      fromParsed: dateFrom ? new Date(dateFrom).toISOString() : null,
      toParsed: dateTo ? new Date(dateTo).toISOString() : null,
      isValid: !(dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)),
    });

    return true;
  }

  async loadResponses(page = 1) {
    try {
      this.showLoading();

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: this.itemsPerPage.toString(),
      });

      // Global search - simplified since most old filters are removed
      const globalSearchInput = document.getElementById('globalSearchInput');
      if (globalSearchInput && globalSearchInput.value.trim()) {
        params.append('search', globalSearchInput.value.trim());
      }

      // Date filters - these are still useful alongside global search
      const dateFromFilter = document.getElementById('dateFromFilter');
      if (dateFromFilter && dateFromFilter.value) {
        params.append('dateFrom', dateFromFilter.value);
      }

      const dateToFilter = document.getElementById('dateToFilter');
      if (dateToFilter && dateToFilter.value) {
        params.append('dateTo', dateToFilter.value);
      }

      // Add sidebar filter parameters
      console.group('🔗 Building Filter Parameters');
      console.log('📋 Raw selectedFilters:', this.selectedFilters);

      // Validate filter values before sending
      Object.keys(this.selectedFilters).forEach(filterType => {
        if (this.selectedFilters[filterType].length > 0) {
          console.log(`📎 Processing ${filterType}:`, this.selectedFilters[filterType]);

          // Check if values look correct (not empty, not undefined)
          const invalidValues = this.selectedFilters[filterType].filter(val =>
            !val || val.trim() === '' || val === 'undefined'
          );

          if (invalidValues.length > 0) {
            console.warn(`⚠️ Invalid values detected in ${filterType}:`, invalidValues);
          }

          console.log(`📎 Adding ${filterType} filters:`, this.selectedFilters[filterType]);

          this.selectedFilters[filterType].forEach(value => {
            params.append(filterType, value);
            console.log(`   ➡️ ${filterType}=${value}`);
          });
        } else {
          console.log(`⚪ No filters for ${filterType}`);
        }
      });

      console.log('📋 Final URL params:', params.toString());
      console.log('🌐 Full request URL:', `/api/responses?${params}`);
      console.groupEnd();

      console.log('Loading responses with params:', params.toString());
      console.log('Active sidebar filters:', this.selectedFilters);

      console.log('🌐 Making API request to:', `/api/responses?${params}`);
      const response = await this.makeAuthenticatedRequest(`/api/responses?${params}`);

      console.log('📡 Received response:', response);
      console.log('Response type:', typeof response);

      let responseData;

      // Handle both parsed JSON and raw Response objects
      if (response && response.ok !== undefined) {
        // It's a raw Response object
        console.log('📄 Processing raw Response object');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        responseData = await response.json();
        console.log('📋 Parsed response data:', responseData);
      } else if (response && typeof response === 'object') {
        // It's already parsed JSON data
        console.log('📋 Using pre-parsed JSON data');
        responseData = response;
      } else {
        console.error('❌ Invalid response format:', response);
        throw new Error('Invalid response format received');
      }

      // Validate response data
      this.validateResponseData(responseData);

      // Handle new paginated response format
      if (responseData.data && responseData.pagination) {
        this.responses = responseData.data;
        this.filteredResponses = [...this.responses];
        this.pagination = responseData.pagination;
        this.currentPage = responseData.pagination.currentPage;
        this.totalPages = responseData.pagination.totalPages;
        this.totalCount = responseData.pagination.totalCount;

        this.renderStats();
        this.renderResponses();
        this.renderPagination();
      } else if (Array.isArray(responseData)) {
        // Fallback for old response format
        this.responses = responseData;
        this.filteredResponses = [...this.responses];

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

  // Old filter population functions removed since filters are no longer used

  renderStats() {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) {
      return;
    }

    const totalResponses = this.totalCount || this.responses.length;
    const uniqueSubmitters = [...new Set(this.responses.map((r) => r.submittedBy).filter(Boolean))]
      .length;
    const uniqueShops = [...new Set(this.responses.map((r) => r.shopName))].length;

    let totalModels = 0;
    this.responses.forEach((response) => {
      totalModels += response.responses?.length || 0;
    });

    statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${totalResponses}</div>
                <div class="stat-label">Tổng khảo sát</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${uniqueSubmitters}</div>
                <div class="stat-label">Người dùng</div>
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
    this.responses.forEach((response) => {
      const responseDate = new Date(response.createdAt).toLocaleString('vi-VN');
      const isSelected = this.selectedIds.has(response._id);
      const isExpanded = this.expandedSurveys.has(response._id);
      const totalModels = response.responses ? response.responses.length : 0;
      const totalImages = response.responses
        ? response.responses.reduce((sum, r) => sum + (r.images ? r.images.length : 0), 0)
        : 0;

      html += `
                <div class="accordion-survey-item ${isExpanded ? 'expanded' : ''}">
                    <div class="accordion-header" onclick="surveyResultsApp.toggleSurveyExpansion('${response._id}')">
                        <div class="accordion-left">
                            <input type="checkbox" ${isSelected ? 'checked' : ''} 
                                   onchange="surveyResultsApp.toggleSelection('${response._id}')"
                                   onclick="event.stopPropagation()"
                                   class="survey-checkbox">
                            <div class="survey-summary">
                                <div class="survey-title">
                                    <span class="survey-date">${responseDate}</span>
                                    <span class="survey-info">${response.submittedBy || 'Unknown User'} - ${response.shopName}</span>
                                </div>
                                <div class="survey-stats">
                                    <span class="stat-badge models">📋 ${totalModels} models</span>
                                    <span class="stat-badge images">📷 ${totalImages} images</span>
                                </div>
                            </div>
                        </div>
                        <div class="accordion-right">
                            <button class="expand-btn" title="${isExpanded ? 'Thu gọn' : 'Mở rộng'} chi tiết">
                                <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6,9 12,15 18,9"></polyline>
                                </svg>
                            </button>
                            <button class="edit-btn" onclick="event.stopPropagation(); surveyResultsApp.openEditDialog('${response._id}')" title="Chỉnh sửa khảo sát">
                                ✏️
                            </button>
                            <button class="delete-btn" onclick="event.stopPropagation(); surveyResultsApp.showDeleteDialog('${response._id}')" title="Xóa khảo sát">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <div class="accordion-content">
                        <div class="accordion-details">
                            ${this.renderModelResponses(response.responses, response._id)}
                        </div>
                    </div>
                </div>
            `;
    });

    container.innerHTML = html;
  }

  renderModelResponses(responses, surveyId) {
    if (!responses || responses.length === 0) {
      return '<p class="no-data">Không có dữ liệu model</p>';
    }

    // Initialize pagination state for this survey if needed
    if (!this.modelPagination) {
      this.modelPagination = {};
    }
    if (!this.modelPagination[surveyId]) {
      this.modelPagination[surveyId] = {
        currentPage: 1,
        itemsPerPage: 12,
        viewMode: 'grid'
      };
    }

    const pagination = this.modelPagination[surveyId];
    const totalModels = responses.length;
    const totalPages = Math.ceil(totalModels / pagination.itemsPerPage);
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = Math.min(startIndex + pagination.itemsPerPage, totalModels);
    const currentPageModels = responses.slice(startIndex, endIndex);

    // Generate the grid header with controls
    const gridHeader = `
      <div class="models-grid-header">
        <div class="models-count">
          ${totalModels} model${totalModels !== 1 ? 's' : ''}
          ${totalModels > pagination.itemsPerPage ?
            `(trang ${pagination.currentPage}/${totalPages})` : ''}
        </div>
        <div class="grid-controls">
          <div class="view-toggle">
            <button class="${pagination.viewMode === 'grid' ? 'active' : ''}"
                    onclick="surveyResultsApp.setModelViewMode('${surveyId}', 'grid')">
              📱 Grid
            </button>
            <button class="${pagination.viewMode === 'list' ? 'active' : ''}"
                    onclick="surveyResultsApp.setModelViewMode('${surveyId}', 'list')">
              📋 List
            </button>
          </div>
          ${totalModels > 12 ? `
          <div class="pagination-controls">
            <select onchange="surveyResultsApp.setModelPageSize('${surveyId}', this.value)">
              <option value="12" ${pagination.itemsPerPage === 12 ? 'selected' : ''}>12/trang</option>
              <option value="24" ${pagination.itemsPerPage === 24 ? 'selected' : ''}>24/trang</option>
              <option value="48" ${pagination.itemsPerPage === 48 ? 'selected' : ''}>48/trang</option>
            </select>
            <div class="pagination-nav">
              <button onclick="surveyResultsApp.setModelPage('${surveyId}', ${pagination.currentPage - 1})"
                      ${pagination.currentPage === 1 ? 'disabled' : ''}>‹</button>
              <span class="pagination-info">${pagination.currentPage}/${totalPages}</span>
              <button onclick="surveyResultsApp.setModelPage('${surveyId}', ${pagination.currentPage + 1})"
                      ${pagination.currentPage === totalPages ? 'disabled' : ''}>›</button>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;

    // Generate models HTML
    const modelsHtml = currentPageModels
      .map((modelResponse, modelIndex) => {
        const actualIndex = startIndex + modelIndex;
        const posmTags = this.renderPosmTags(modelResponse);
        const images = this.renderModelImages(modelResponse, pagination.viewMode);
        const modelKey = `${surveyId}:${actualIndex}`;
        const isModelSelected = this.selectedModels.has(modelKey);

        if (pagination.viewMode === 'grid') {
          return this.renderModelCard(modelResponse, surveyId, actualIndex, posmTags, images, isModelSelected);
        } else {
          return this.renderModelListItem(modelResponse, surveyId, actualIndex, posmTags, images, isModelSelected);
        }
      })
      .join('');

    // Wrap in appropriate container
    const containerClass = pagination.viewMode === 'grid' ? 'models-grid' : 'models-list';

    return `
      <div class="models-grid-container">
        ${gridHeader}
        <div class="${containerClass}">
          ${modelsHtml}
        </div>
      </div>
    `;
  }

  renderPosmTags(modelResponse) {
    return modelResponse.allSelected
      ? '<span class="posm-tag all-selected">TẤT CẢ POSM</span>'
      : modelResponse.posmSelections
          .map((posm) => `<span class="posm-tag">${posm.posmCode}</span>`)
          .join('');
  }

  renderModelImages(modelResponse, viewMode) {
    if (!modelResponse.images || modelResponse.images.length === 0) {
      return viewMode === 'grid'
        ? '<div class="no-images-placeholder">📷 Không có hình ảnh</div>'
        : '';
    }

    if (viewMode === 'grid') {
      return this.renderGridImages(modelResponse.images);
    } else {
      return modelResponse.images
        .map((img) =>
          `<img src="${img}" alt="POSM Image" style="max-width:100px;max-height:80px;margin:5px;border-radius:5px;cursor:pointer;" onclick="openImageLightbox('${img}')">`
        )
        .join('');
    }
  }

  renderGridImages(images) {
    const maxDisplay = 4;
    const displayImages = images.slice(0, maxDisplay);
    const remainingCount = images.length - maxDisplay;

    let gridClass = 'model-card-images';
    if (images.length === 1) gridClass += ' single-image';
    else if (images.length === 3) gridClass += ' three-images';

    const imageElements = displayImages.map((img, index) => {
      if (index === maxDisplay - 1 && remainingCount > 0) {
        return `
          <div class="image-thumb-overlay" data-count="${remainingCount}">
            <img src="${img}" alt="POSM Image" class="image-thumb" onclick="openImageLightbox('${img}')">
          </div>
        `;
      } else {
        return `<img src="${img}" alt="POSM Image" class="image-thumb" onclick="openImageLightbox('${img}')">`;
      }
    }).join('');

    return `<div class="${gridClass}">${imageElements}</div>`;
  }

  renderModelCard(modelResponse, surveyId, modelIndex, posmTags, images, isModelSelected) {
    const modelControls = this.selectionMode === 'model'
      ? `
        <div class="model-card-controls">
          <input type="checkbox" ${isModelSelected ? 'checked' : ''}
                 onchange="surveyResultsApp.toggleModelSelection('${surveyId}', ${modelIndex})"
                 onclick="event.stopPropagation()"
                 class="model-checkbox">
          <button class="model-edit-btn"
                  onclick="event.stopPropagation(); surveyResultsApp.editModel('${surveyId}', ${modelIndex})"
                  title="Chỉnh sửa model">
            ✏️
          </button>
          <button class="model-delete-btn"
                  onclick="event.stopPropagation(); surveyResultsApp.showDeleteModelDialog('${surveyId}', ${modelIndex}, '${this.escapeHtml(modelResponse.model)}')"
                  title="Xóa model này">
            🗑️
          </button>
        </div>
      `
      : '';

    return `
      <div class="model-card ${isModelSelected ? 'selected' : ''}">
        <div class="model-card-header">
          <div>
            <div class="model-card-title">${modelResponse.model}</div>
            ${modelControls}
          </div>
          <div class="model-quantity-badge">${modelResponse.quantity || 1}</div>
        </div>
        <div class="model-card-posm">${posmTags}</div>
        ${images}
      </div>
    `;
  }

  renderModelListItem(modelResponse, surveyId, modelIndex, posmTags, images, isModelSelected) {
    const modelControls = this.selectionMode === 'model'
      ? `
        <div class="model-controls">
          <input type="checkbox" ${isModelSelected ? 'checked' : ''}
                 onchange="surveyResultsApp.toggleModelSelection('${surveyId}', ${modelIndex})"
                 onclick="event.stopPropagation()"
                 class="model-checkbox">
          <button class="model-delete-btn"
                  onclick="event.stopPropagation(); surveyResultsApp.showDeleteModelDialog('${surveyId}', ${modelIndex}, '${this.escapeHtml(modelResponse.model)}')"
                  title="Xóa model này">
            🗑️
          </button>
        </div>
      `
      : '';

    return `
      <div class="model-response ${isModelSelected ? 'selected' : ''}">
        <div class="model-header">
          <div class="model-title">
            ${modelResponse.model} (Số lượng: ${modelResponse.quantity || 1})
          </div>
          ${modelControls}
        </div>
        <div class="posm-selections">${posmTags}</div>
        ${images ? `<div class="response-images" style="margin-top:10px;">${images}</div>` : ''}
      </div>
    `;
  }

  renderPagination() {
    const paginationHtml = `
            <div class="pagination-container">
                <div class="pagination-info">
                    Hiển thị ${(this.currentPage - 1) * this.itemsPerPage + 1}-${Math.min(this.currentPage * this.itemsPerPage, this.totalCount)} 
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
      responsesContainer.parentNode.insertBefore(
        paginationContainer,
        responsesContainer.nextSibling
      );
    }

    paginationContainer.outerHTML = paginationHtml;
  }

  generatePageNumbers() {
    let pageNumbers = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

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

    if (this.selectionMode === 'survey') {
      if (isSelectingAll) {
        // Select all current page responses
        this.responses.forEach((response) => {
          this.selectedIds.add(response._id);
        });
        selectAllBtn.innerHTML = '❌ Bỏ chọn tất cả trang này';
        selectAllBtn.title = `Đã chọn tất cả ${this.responses.length} khảo sát trên trang này`;
      } else {
        // Deselect all
        this.selectedIds.clear();
        selectAllBtn.innerHTML = '☑️ Chọn tất cả trang này';
        selectAllBtn.title = 'Chọn tất cả khảo sát trên trang hiện tại';
      }
    } else {
      // Model selection mode
      if (isSelectingAll) {
        // Select all models on current page
        this.responses.forEach((survey) => {
          if (survey.responses) {
            survey.responses.forEach((model, index) => {
              this.selectedModels.add(`${survey._id}:${index}`);
            });
          }
        });
        selectAllBtn.innerHTML = '❌ Bỏ chọn tất cả trang này';
        const totalModels = this.responses.reduce(
          (sum, survey) => sum + (survey.responses?.length || 0),
          0
        );
        selectAllBtn.title = `Đã chọn tất cả ${totalModels} model trên trang này`;
      } else {
        // Deselect all models
        this.selectedModels.clear();
        selectAllBtn.innerHTML = '☑️ Chọn tất cả trang này';
        selectAllBtn.title = 'Chọn tất cả model trên trang hiện tại';
      }
    }

    this.renderResponses();
    this.updateBulkDeleteButton();
  }

  updateBulkDeleteButton() {
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
      if (this.selectionMode === 'survey') {
        const count = this.selectedIds.size;
        bulkDeleteBtn.disabled = count === 0;
        if (count === 0) {
          bulkDeleteBtn.innerHTML = '🗑️ Xóa các khảo sát đã chọn';
          bulkDeleteBtn.title = 'Chọn ít nhất một khảo sát để xóa';
        } else {
          bulkDeleteBtn.innerHTML = `🗑️ Xóa ${count} khảo sát đã chọn`;
          bulkDeleteBtn.title = `Xóa ${count} khảo sát đã chọn (hành động không thể hoàn tác)`;
        }
      } else {
        const count = this.selectedModels.size;
        bulkDeleteBtn.disabled = count === 0;
        if (count === 0) {
          bulkDeleteBtn.innerHTML = '🗑️ Xóa các model đã chọn';
          bulkDeleteBtn.title = 'Chọn ít nhất một model để xóa';
        } else {
          bulkDeleteBtn.innerHTML = `🗑️ Xóa ${count} model đã chọn`;
          bulkDeleteBtn.title = `Xóa ${count} model đã chọn (hành động không thể hoàn tác)`;
        }
      }
    }
  }

  // Handle ESC key to close modals
  handleEscapeKey(event) {
    if (event.key === 'Escape') {
      // Check which modal is currently open and close it
      const confirmDeleteDialog = document.getElementById('confirmDeleteDialog');

      if (confirmDeleteDialog && confirmDeleteDialog.style.display === 'flex') {
        this.cancelDelete();
      }
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
    if (!this.deleteID) {
      return;
    }

    try {
      this.showLoading();
      const response = await this.makeAuthenticatedRequest(`/api/responses/${this.deleteID}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        this.cancelDelete();

        // If we deleted the only item on current page and it's not page 1, go to previous page
        if (this.responses.length === 1 && this.currentPage > 1) {
          this.currentPage--;
        }

        await this.loadResponses(this.currentPage);
        this.showNotification('✅ Xóa khảo sát thành công!', 'success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Lỗi khi xóa');
      }
    } catch (error) {
      console.error('Error deleting response:', error);
      this.showNotification(`❌ Lỗi khi xóa khảo sát: ${error.message}`, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async handleBulkDelete() {
    if (this.selectionMode === 'survey') {
      if (this.selectedIds.size === 0) {
        return;
      }
      await this.handleBulkDeleteSurveys();
    } else {
      if (this.selectedModels.size === 0) {
        return;
      }
      await this.handleBulkDeleteModels();
    }
  }

  async handleBulkDeleteSurveys() {
    // Show enhanced confirmation dialog
    if (!(await this.showBulkDeleteConfirmation())) {
      return;
    }

    try {
      this.showLoading();
      console.log(`🗑️ Starting bulk delete of ${this.selectedIds.size} survey responses`);

      const response = await this.makeAuthenticatedRequest('/api/responses/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({
          ids: Array.from(this.selectedIds),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Clear selections and reload current page
        this.selectedIds.clear();
        this.updateBulkDeleteButton();

        // If we deleted all items on current page and it's not page 1, go to previous page
        if (this.responses.length === result.deletedCount && this.currentPage > 1) {
          this.currentPage--;
        }

        await this.loadResponses(this.currentPage);

        // Show detailed success message
        let message = `✅ ${result.message}`;
        if (result.warnings && result.warnings.length > 0) {
          message += '\n\n⚠️ Cảnh báo:\n' + result.warnings.join('\n');
        }

        this.showNotification(message, 'success');
      } else {
        throw new Error(result.message || 'Lỗi không xác định khi xóa khảo sát');
      }
    } catch (error) {
      console.error('Error bulk deleting responses:', error);
      this.showNotification(`❌ Lỗi khi xóa khảo sát: ${error.message}`, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async handleBulkDeleteModels() {
    // Show enhanced confirmation dialog for models
    if (!(await this.showBulkDeleteModelsConfirmation())) {
      return;
    }

    try {
      this.showLoading();
      console.log(`🗑️ Starting bulk delete of ${this.selectedModels.size} models`);

      // Convert selected models to deletion format
      const deletions = Array.from(this.selectedModels).map((modelKey) => {
        const [surveyId, modelIndex] = modelKey.split(':');
        return {
          surveyId,
          modelIndex: parseInt(modelIndex),
        };
      });

      const response = await this.makeAuthenticatedRequest('/api/responses/models/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ deletions }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update local data by removing deleted models
        const successfulDeletions = result.results?.successful || [];

        // Group deletions by survey and sort by modelIndex descending for safe removal
        const deletionsBySurvey = {};
        successfulDeletions.forEach((deletion) => {
          if (!deletionsBySurvey[deletion.surveyId]) {
            deletionsBySurvey[deletion.surveyId] = [];
          }
          deletionsBySurvey[deletion.surveyId].push(deletion.modelIndex);
        });

        // Remove models from local data (sort descending to avoid index issues)
        Object.entries(deletionsBySurvey).forEach(([surveyId, indices]) => {
          const survey = this.responses.find((r) => r._id === surveyId);
          if (survey && survey.responses) {
            indices.sort((a, b) => b - a); // Descending order
            indices.forEach((index) => {
              if (index < survey.responses.length) {
                survey.responses.splice(index, 1);
              }
            });
          }
        });

        // Clear model selections
        this.selectedModels.clear();
        this.updateBulkDeleteButton();
        this.renderResponses();

        // Show detailed success message
        const successful = result.results?.successful?.length || 0;
        const failed = result.results?.failed?.length || 0;
        let message = `✅ Đã xóa ${successful} model thành công`;

        if (failed > 0) {
          message += `\n❌ ${failed} model không thể xóa`;
        }

        if (result.warnings && result.warnings.length > 0) {
          message += '\n\n⚠️ Cảnh báo:\n' + result.warnings.join('\n');
        }

        this.showNotification(message, failed > 0 ? 'warning' : 'success');
      } else {
        throw new Error(result.message || 'Lỗi không xác định khi xóa model');
      }
    } catch (error) {
      console.error('Error bulk deleting models:', error);
      this.showNotification(`❌ Lỗi khi xóa model: ${error.message}`, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async exportData() {
    try {
      // EXPORT ALL RECORDS - Bypass all filtering completely
      console.log('🌍 EXPORTING ALL RECORDS - No filters applied');
      console.log('📊 This will export every record in the database');

      // Get estimated total record count for confirmation
      const totalRecords = this.totalCount || 148;

      // Confirm exporting all records
      const confirmExportAll = confirm(
        `Bạn có chắc chắn muốn xuất TẤT CẢ dữ liệu khảo sát?\n\n` +
          `Điều này sẽ xuất toàn bộ khoảng ${totalRecords} khảo sát trong cơ sở dữ liệu.\n\n` +
          `Nhấn OK để tiếp tục hoặc Cancel để hủy.`
      );

      if (!confirmExportAll) {
        console.log('❌ User cancelled complete export');
        return;
      }

      this.showExportProgress('Đang chuẩn bị xuất TẤT CẢ dữ liệu...');

      // Build empty parameters - NO FILTERING AT ALL
      const params = new URLSearchParams();

      // Explicitly log that we're not using any filters
      console.log('📤 Export Parameters Being Sent:', {
        allParams: 'NO FILTERS - EXPORTING ALL RECORDS',
        fullUrl: `/api/responses?limit=999999`,
        note: 'No date, user, or shop filters applied',
      });

      // Get ALL data without any filtering
      this.showExportProgress('Đang tải TOÀN BỘ dữ liệu từ server...');

      const response = await this.makeAuthenticatedRequest(`/api/responses?limit=999999`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lỗi server: ${response.status} - ${errorText}`);
      }

      this.showExportProgress('Đang xử lý tất cả dữ liệu...');
      const data = await response.json();
      const responses = data.data || data;

      if (!responses || responses.length === 0) {
        this.hideExportProgress();
        this.showNotification('Không có dữ liệu trong cơ sở dữ liệu', 'warning');
        return;
      }

      this.showExportProgress(`Đang tạo file Excel cho TẤT CẢ ${responses.length} khảo sát...`);
      this.generateExcel(responses);

      this.showNotification(
        `✅ Đã xuất TẤT CẢ ${responses.length} khảo sát từ cơ sở dữ liệu thành công!`,
        'success'
      );
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showNotification('❌ Lỗi khi xuất dữ liệu: ' + error.message, 'error');
    } finally {
      this.hideExportProgress();
    }
  }

  generateExcel(responses) {
    const workbook = XLSX.utils.book_new();

    // Create metadata worksheet
    const metadataData = this.generateExportMetadata(responses, this.getCurrentFilters());
    const metadataWorksheet = XLSX.utils.aoa_to_sheet(metadataData);
    XLSX.utils.book_append_sheet(workbook, metadataWorksheet, 'Thông tin xuất');

    // Create main data worksheet
    const worksheetData = [];

    // Enhanced headers with Vietnamese labels
    const vietnameseHeaders = [
      'Ngày khảo sát',
      'TDL',
      'Tên Shop',
      'Tên Model',
      'Số lượng',
      'POSM',
      'Chọn tất cả POSM',
      'Số ảnh',
      'Link ảnh',
      'User ID',
      'Username',
      'ID Khảo sát',
      'Thời gian gửi',
    ];

    worksheetData.push(vietnameseHeaders);

    // Data rows
    responses.forEach((response) => {
      const responseDate = new Date(response.createdAt).toLocaleDateString('vi-VN');

      if (response.responses && response.responses.length > 0) {
        response.responses.forEach((modelResponse) => {
          const posmList = modelResponse.allSelected
            ? 'TẤT CẢ'
            : modelResponse.posmSelections.map((p) => p.posmCode).join(', ');

          const images = modelResponse.images ? modelResponse.images.join('; ') : '';

          worksheetData.push([
            responseDate,
            response.leader || 'N/A',
            response.shopName || 'N/A',
            modelResponse.model || 'N/A',
            modelResponse.quantity || 0,
            posmList,
            modelResponse.allSelected ? 'Có' : 'Không',
            modelResponse.images ? modelResponse.images.length : 0,
            images,
            response.submittedById || 'N/A',
            response.submittedBy || 'N/A',
            response._id || 'N/A',
            new Date(response.submittedAt || response.createdAt).toLocaleString('vi-VN'),
          ]);
        });
      } else {
        worksheetData.push([
          responseDate,
          response.leader || 'N/A',
          response.shopName || 'N/A',
          'N/A',
          0,
          'N/A',
          'N/A',
          0,
          'N/A',
          response.submittedById || 'N/A',
          response.submittedBy || 'N/A',
          response._id || 'N/A',
          new Date(response.submittedAt || response.createdAt).toLocaleString('vi-VN'),
        ]);
      }
    });

    // Create main data worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kết quả khảo sát');

    // Generate enhanced filename with filter info
    const filterInfo = this.getFilterSummaryForFilename();
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const filename = `survey-results-${dateStr}${filterInfo}.xlsx`;

    XLSX.writeFile(workbook, filename);
  }

  clearFilters() {
    // Clear global search input
    const globalSearchInput = document.getElementById('globalSearchInput');
    if (globalSearchInput) {
      globalSearchInput.value = '';
    }

    // Clear date filters
    const dateFromFilter = document.getElementById('dateFromFilter');
    if (dateFromFilter) {
      dateFromFilter.value = '';
    }

    const dateToFilter = document.getElementById('dateToFilter');
    if (dateToFilter) {
      dateToFilter.value = '';
    }

    // Reset page size to default if needed (optional)
    const pageSizeSelector = document.getElementById('pageSizeSelector');
    if (pageSizeSelector && pageSizeSelector.value !== '20') {
      pageSizeSelector.value = '20';
      this.itemsPerPage = 20;
    }

    // Hide search suggestions if open
    const searchSuggestions = document.getElementById('searchSuggestions');
    if (searchSuggestions) {
      searchSuggestions.classList.remove('show');
      searchSuggestions.innerHTML = '';
    }

    // Clear sidebar autocomplete filters
    this.clearAdvancedFilters();

    // Reset to first page and reload data
    this.currentPage = 1;
    this.loadResponses(1);

    // Show notification
    this.showNotification('✅ Đã xóa tất cả bộ lọc', 'success', 3000);
  }

  // Enhanced confirmation dialog for bulk delete
  showBulkDeleteConfirmation() {
    return new Promise((resolve) => {
      const selectedCount = this.selectedIds.size;
      const selectedResponses = this.responses.filter((r) => this.selectedIds.has(r._id));

      let detailsHtml = '';
      if (selectedResponses.length > 0) {
        detailsHtml = selectedResponses
          .slice(0, 5)
          .map(
            (r) =>
              `<li>${r.submittedBy || 'Unknown User'} - ${r.shopName} (${new Date(r.createdAt).toLocaleDateString('vi-VN')})</li>`
          )
          .join('');
        if (selectedCount > 5) {
          detailsHtml += `<li style="font-style: italic;">... và ${selectedCount - 5} khảo sát khác</li>`;
        }
      }

      // Create enhanced confirmation dialog
      const dialogHtml = `
                <div id="bulkDeleteDialog" class="confirm-dialog" style="display: flex;">
                    <div class="confirm-content" style="max-width: 500px;">
                        <h3>🗑️ Xác nhận xóa hàng loạt</h3>
                        <p>Bạn có chắc chắn muốn xóa <strong>${selectedCount} khảo sát</strong> đã chọn?</p>
                        ${
                          detailsHtml
                            ? `
                            <div style="margin: 15px 0;">
                                <strong>Các khảo sát sẽ bị xóa:</strong>
                                <ul style="max-height: 120px; overflow-y: auto; margin: 5px 0; padding-left: 20px;">
                                    ${detailsHtml}
                                </ul>
                            </div>
                        `
                            : ''
                        }
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 10px 0;">
                            <strong>⚠️ Cảnh báo:</strong> Hành động này không thể hoàn tác. Tất cả dữ liệu và hình ảnh liên quan sẽ bị xóa vĩnh viễn.
                        </div>
                        <div class="confirm-buttons">
                            <button id="btnConfirmBulkDelete" class="btn-confirm" style="background: #dc3545;">Xóa ${selectedCount} khảo sát</button>
                            <button id="btnCancelBulkDelete" class="btn-cancel">Hủy</button>
                        </div>
                    </div>
                </div>
            `;

      // Remove existing dialog if any
      const existingDialog = document.getElementById('bulkDeleteDialog');
      if (existingDialog) {
        existingDialog.remove();
      }

      // Add dialog to body
      document.body.insertAdjacentHTML('beforeend', dialogHtml);

      // Add event listeners
      document.getElementById('btnConfirmBulkDelete').addEventListener('click', () => {
        document.getElementById('bulkDeleteDialog').remove();
        resolve(true);
      });

      document.getElementById('btnCancelBulkDelete').addEventListener('click', () => {
        document.getElementById('bulkDeleteDialog').remove();
        resolve(false);
      });

      // Close on background click
      document.getElementById('bulkDeleteDialog').addEventListener('click', (e) => {
        if (e.target.id === 'bulkDeleteDialog') {
          document.getElementById('bulkDeleteDialog').remove();
          resolve(false);
        }
      });
    });
  }

  // Enhanced confirmation dialog for bulk model delete
  showBulkDeleteModelsConfirmation() {
    return new Promise((resolve) => {
      const selectedCount = this.selectedModels.size;

      // Get details of selected models
      const selectedModelDetails = [];
      this.selectedModels.forEach((modelKey) => {
        const [surveyId, modelIndex] = modelKey.split(':');
        const survey = this.responses.find((r) => r._id === surveyId);
        if (survey && survey.responses && survey.responses[modelIndex]) {
          const model = survey.responses[modelIndex];
          selectedModelDetails.push({
            surveyId,
            modelIndex: parseInt(modelIndex),
            modelName: model.model,
            shopName: survey.shopName,
            submittedBy: survey.submittedBy,
          });
        }
      });

      let detailsHtml = '';
      if (selectedModelDetails.length > 0) {
        detailsHtml = selectedModelDetails
          .slice(0, 5)
          .map(
            (detail) =>
              `<li><strong>${detail.modelName}</strong> từ ${detail.submittedBy || 'Unknown User'} - ${detail.shopName}</li>`
          )
          .join('');
        if (selectedCount > 5) {
          detailsHtml += `<li style="font-style: italic;">... và ${selectedCount - 5} model khác</li>`;
        }
      }

      // Create enhanced confirmation dialog for model deletion
      const dialogHtml = `
        <div id="bulkDeleteModelsDialog" class="confirm-dialog" style="display: flex;">
          <div class="confirm-content" style="max-width: 500px;">
            <h3>🗑️ Xác nhận xóa model hàng loạt</h3>
            <p>Bạn có chắc chắn muốn xóa <strong>${selectedCount} model</strong> đã chọn?</p>
            ${
              detailsHtml
                ? `
                <div style="margin: 15px 0;">
                  <strong>Các model sẽ bị xóa:</strong>
                  <ul style="max-height: 120px; overflow-y: auto; margin: 5px 0; padding-left: 20px;">
                    ${detailsHtml}
                  </ul>
                </div>
              `
                : ''
            }
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 10px 0;">
              <strong>⚠️ Cảnh báo:</strong> Hành động này không thể hoàn tác. Tất cả model và hình ảnh liên quan sẽ bị xóa vĩnh viễn.
            </div>
            <div class="confirm-buttons">
              <button id="btnConfirmBulkDeleteModels" class="btn-confirm" style="background: #dc3545;">Xóa ${selectedCount} model</button>
              <button id="btnCancelBulkDeleteModels" class="btn-cancel">Hủy</button>
            </div>
          </div>
        </div>
      `;

      // Remove existing dialog if any
      const existingDialog = document.getElementById('bulkDeleteModelsDialog');
      if (existingDialog) {
        existingDialog.remove();
      }

      // Add dialog to body
      document.body.insertAdjacentHTML('beforeend', dialogHtml);

      // Add event listeners
      document.getElementById('btnConfirmBulkDeleteModels').addEventListener('click', () => {
        document.getElementById('bulkDeleteModelsDialog').remove();
        resolve(true);
      });

      document.getElementById('btnCancelBulkDeleteModels').addEventListener('click', () => {
        document.getElementById('bulkDeleteModelsDialog').remove();
        resolve(false);
      });

      // Close on background click
      document.getElementById('bulkDeleteModelsDialog').addEventListener('click', (e) => {
        if (e.target.id === 'bulkDeleteModelsDialog') {
          document.getElementById('bulkDeleteModelsDialog').remove();
          resolve(false);
        }
      });
    });
  }

  // Enhanced notification system
  showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach((n) => n.remove());

    const typeStyles = {
      success: 'background: #d4edda; border-color: #c3e6cb; color: #155724;',
      error: 'background: #f8d7da; border-color: #f5c6cb; color: #721c24;',
      warning: 'background: #fff3cd; border-color: #ffeaa7; color: #856404;',
      info: 'background: #d1ecf1; border-color: #bee5eb; color: #0c5460;',
    };

    const notificationHtml = `
            <div class="notification" style="
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                padding: 15px 20px;
                border: 1px solid;
                border-radius: 4px;
                max-width: 400px;
                white-space: pre-line;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                ${typeStyles[type]}
            ">
                <button onclick="this.parentElement.remove()" style="
                    position: absolute;
                    top: 5px;
                    right: 10px;
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: inherit;
                ">×</button>
                <div style="margin-right: 20px;">${message}</div>
            </div>
        `;

    document.body.insertAdjacentHTML('beforeend', notificationHtml);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        const notification = document.querySelector('.notification');
        if (notification) {
          notification.remove();
        }
      }, duration);
    }
  }

  // Selection mode management
  toggleSelectionMode() {
    const modeToggle = document.getElementById('selectionModeToggle');
    if (modeToggle) {
      this.selectionMode = modeToggle.value;

      // Clear selections when switching modes
      this.selectedIds.clear();
      this.selectedModels.clear();

      // Update UI
      this.renderResponses();
      this.updateBulkDeleteButton();

      console.log(`Selection mode changed to: ${this.selectionMode}`);
    }
  }

  // Model selection management
  toggleModelSelection(surveyId, modelIndex) {
    const modelKey = `${surveyId}:${modelIndex}`;
    if (this.selectedModels.has(modelKey)) {
      this.selectedModels.delete(modelKey);
    } else {
      this.selectedModels.add(modelKey);
    }
    this.updateBulkDeleteButton();
    // Re-render only this model to update selection state
    this.renderResponses();
  }

  // Grid view mode controls
  setModelViewMode(surveyId, viewMode) {
    if (!this.modelPagination) {
      this.modelPagination = {};
    }
    if (!this.modelPagination[surveyId]) {
      this.modelPagination[surveyId] = {
        currentPage: 1,
        itemsPerPage: 12,
        viewMode: 'grid'
      };
    }
    this.modelPagination[surveyId].viewMode = viewMode;
    this.renderResponses();
  }

  setModelPageSize(surveyId, pageSize) {
    if (!this.modelPagination) {
      this.modelPagination = {};
    }
    if (!this.modelPagination[surveyId]) {
      this.modelPagination[surveyId] = {
        currentPage: 1,
        itemsPerPage: 12,
        viewMode: 'grid'
      };
    }

    const pagination = this.modelPagination[surveyId];
    pagination.itemsPerPage = parseInt(pageSize);

    // Adjust current page if needed
    const survey = this.responses.find(r => r._id === surveyId);
    if (survey && survey.responses) {
      const totalModels = survey.responses.length;
      const totalPages = Math.ceil(totalModels / pagination.itemsPerPage);
      if (pagination.currentPage > totalPages) {
        pagination.currentPage = Math.max(1, totalPages);
      }
    }

    this.renderResponses();
  }

  setModelPage(surveyId, page) {
    if (!this.modelPagination) {
      this.modelPagination = {};
    }
    if (!this.modelPagination[surveyId]) {
      this.modelPagination[surveyId] = {
        currentPage: 1,
        itemsPerPage: 12,
        viewMode: 'grid'
      };
    }

    const survey = this.responses.find(r => r._id === surveyId);
    if (survey && survey.responses) {
      const totalModels = survey.responses.length;
      const totalPages = Math.ceil(totalModels / this.modelPagination[surveyId].itemsPerPage);

      if (page >= 1 && page <= totalPages) {
        this.modelPagination[surveyId].currentPage = page;
        this.renderResponses();
      }
    }
  }

  // Edit model method (placeholder)
  editModel(surveyId, modelIndex) {
    // This could open a modal or navigate to an edit page
    console.log(`Edit model ${modelIndex} in survey ${surveyId}`);
    // For now, just show a notification
    this.showNotification('Model editing feature coming soon!', 'info');
  }

  // Delete individual model dialog
  showDeleteModelDialog(surveyId, modelIndex, modelName) {
    const survey = this.responses.find((r) => r._id === surveyId);
    if (!survey) {
      this.showNotification('Survey not found', 'error');
      return;
    }

    if (survey.responses.length <= 1) {
      this.showNotification(
        'Cannot delete the last model from a survey. Delete the entire survey instead.',
        'warning'
      );
      return;
    }

    this.showModelDeleteConfirmDialog(surveyId, modelIndex, modelName);
  }

  async showModelDeleteConfirmDialog(surveyId, modelIndex, modelName) {
    return new Promise((resolve) => {
      // Create enhanced confirmation dialog for model deletion
      const dialogHtml = `
        <div id="modelDeleteDialog" class="confirm-dialog" style="display: flex;">
          <div class="confirm-content" style="max-width: 500px;">
            <h3>🗑️ Xác nhận xóa model</h3>
            <p>Bạn có chắc chắn muốn xóa model <strong>${this.escapeHtml(modelName)}</strong>?</p>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 10px 0;">
              <strong>⚠️ Cảnh báo:</strong> Hành động này không thể hoàn tác. Model và tất cả hình ảnh liên quan sẽ bị xóa vĩnh viễn.
            </div>
            <div class="confirm-buttons">
              <button id="btnConfirmModelDelete" class="btn-confirm" style="background: #dc3545;">Xóa model</button>
              <button id="btnCancelModelDelete" class="btn-cancel">Hủy</button>
            </div>
          </div>
        </div>
      `;

      // Remove existing dialog if any
      const existingDialog = document.getElementById('modelDeleteDialog');
      if (existingDialog) {
        existingDialog.remove();
      }

      // Add dialog to body
      document.body.insertAdjacentHTML('beforeend', dialogHtml);

      // Add event listeners
      document.getElementById('btnConfirmModelDelete').addEventListener('click', () => {
        document.getElementById('modelDeleteDialog').remove();
        this.confirmDeleteModel(surveyId, modelIndex);
        resolve(true);
      });

      document.getElementById('btnCancelModelDelete').addEventListener('click', () => {
        document.getElementById('modelDeleteDialog').remove();
        resolve(false);
      });

      // Close on background click
      document.getElementById('modelDeleteDialog').addEventListener('click', (e) => {
        if (e.target.id === 'modelDeleteDialog') {
          document.getElementById('modelDeleteDialog').remove();
          resolve(false);
        }
      });
    });
  }

  async confirmDeleteModel(surveyId, modelIndex) {
    try {
      this.showLoading();
      const response = await this.makeAuthenticatedRequest(
        `/api/responses/${surveyId}/models/${modelIndex}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        const result = await response.json();

        // Remove model from local data
        const survey = this.responses.find((r) => r._id === surveyId);
        if (survey && survey.responses && survey.responses.length > modelIndex) {
          survey.responses.splice(modelIndex, 1);
        }

        // Clear any model selections for this survey that might be affected
        const affectedKeys = Array.from(this.selectedModels).filter((key) =>
          key.startsWith(surveyId + ':')
        );
        affectedKeys.forEach((key) => {
          const keyIndex = parseInt(key.split(':')[1]);
          if (keyIndex >= modelIndex) {
            this.selectedModels.delete(key);
            // If there are models after the deleted one, adjust their keys
            if (keyIndex > modelIndex) {
              const newKey = `${surveyId}:${keyIndex - 1}`;
              if (!this.selectedModels.has(newKey)) {
                this.selectedModels.add(newKey);
              }
            }
          }
        });

        this.renderResponses();
        this.updateBulkDeleteButton();

        let message = `Model "${result.data?.deletedModel || 'Unknown'}" deleted successfully`;
        if (result.warnings && result.warnings.length > 0) {
          message += '\n⚠️ ' + result.warnings.join('\n⚠️ ');
        }
        this.showNotification(message, result.warnings ? 'warning' : 'success');
      } else {
        const errorResult = await response.json();
        this.showNotification(
          'Error: ' + (errorResult.message || 'Failed to delete model'),
          'error'
        );
      }
    } catch (error) {
      console.error('Error deleting model:', error);
      this.showNotification('Error deleting model: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  toggleSurveyExpansion(surveyId) {
    if (this.expandedSurveys.has(surveyId)) {
      this.expandedSurveys.delete(surveyId);
    } else {
      this.expandedSurveys.add(surveyId);
    }
    this.renderResponses();
  }

  // Old shop autocomplete function removed since filters are no longer used

  // Utility function for debouncing
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Setup global search functionality
  setupGlobalSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    const searchSuggestions = document.getElementById('searchSuggestions');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (!searchInput || !searchSuggestions) {
      return;
    }

    let currentSearchTerm = '';
    let highlightedIndex = -1;

    // Clear search button
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchSuggestions.classList.remove('show');
        searchSuggestions.innerHTML = '';
        this.currentPage = 1;
        this.loadResponses(1);
      });
    }

    // Show/hide clear button based on input
    const toggleClearButton = () => {
      if (clearSearchBtn) {
        clearSearchBtn.style.display = searchInput.value.trim() ? 'block' : 'none';
      }
    };

    // Debounced search function
    const debouncedSearch = this.debounce(async () => {
      const searchTerm = searchInput.value.trim();
      
      if (searchTerm !== currentSearchTerm) {
        currentSearchTerm = searchTerm;
        
        if (searchTerm.length > 0) {
          // Reload data with search
          this.currentPage = 1;
          this.loadResponses(1);
          
          // Get search suggestions
          if (searchTerm.length >= 2) {
            await this.loadSearchSuggestions(searchTerm);
          }
        } else {
          // Clear search
          searchSuggestions.classList.remove('show');
          this.currentPage = 1;
          this.loadResponses(1);
        }
      }
    }, 500);

    // Input event handler
    searchInput.addEventListener('input', () => {
      toggleClearButton();
      highlightedIndex = -1;
      debouncedSearch();
    });

    // Keyboard navigation for suggestions
    searchInput.addEventListener('keydown', (e) => {
      const suggestionItems = searchSuggestions.querySelectorAll('.suggestion-item');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, suggestionItems.length - 1);
        this.updateSearchSuggestionHighlight(suggestionItems, highlightedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, -1);
        this.updateSearchSuggestionHighlight(suggestionItems, highlightedIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && suggestionItems[highlightedIndex]) {
          suggestionItems[highlightedIndex].click();
        } else {
          // Perform search with current input
          searchSuggestions.classList.remove('show');
          this.currentPage = 1;
          this.loadResponses(1);
        }
      } else if (e.key === 'Escape') {
        searchSuggestions.classList.remove('show');
        highlightedIndex = -1;
      }
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
        searchSuggestions.classList.remove('show');
        highlightedIndex = -1;
      }
    });

    // Initial state
    toggleClearButton();
  }

  updateSearchSuggestionHighlight(items, index) {
    items.forEach((item, i) => {
      item.classList.toggle('highlighted', i === index);
    });
    
    if (index >= 0 && items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  async loadSearchSuggestions(query) {
    if (!query || query.length < 2) {
      return;
    }

    try {
      const response = await this.makeAuthenticatedRequest(`/api/search-suggestions?q=${encodeURIComponent(query)}`);
      
      if (response.ok) {
        const suggestions = await response.json();
        this.renderSearchSuggestions(suggestions, query);
      }
    } catch (error) {
      console.error('Error loading search suggestions:', error);
    }
  }

  renderSearchSuggestions(suggestions, query) {
    const searchSuggestions = document.getElementById('searchSuggestions');
    if (!searchSuggestions) return;

    const hasResults = suggestions.shops?.length > 0 || 
                      suggestions.models?.length > 0 || 
                      suggestions.submitters?.length > 0;

    if (!hasResults) {
      searchSuggestions.classList.remove('show');
      return;
    }

    let html = '';

    // Shop suggestions
    if (suggestions.shops && suggestions.shops.length > 0) {
      html += '<div class="suggestion-group">';
      html += '<div class="suggestion-group-title">🏪 Shops</div>';
      suggestions.shops.forEach(shop => {
        html += `<div class="suggestion-item" data-type="shop" data-value="${this.escapeHtml(shop)}">
          ${this.highlightSearchTerm(shop, query)}
        </div>`;
      });
      html += '</div>';
    }

    // Model suggestions
    if (suggestions.models && suggestions.models.length > 0) {
      html += '<div class="suggestion-group">';
      html += '<div class="suggestion-group-title">📦 Models</div>';
      suggestions.models.forEach(model => {
        html += `<div class="suggestion-item" data-type="model" data-value="${this.escapeHtml(model)}">
          ${this.highlightSearchTerm(model, query)}
        </div>`;
      });
      html += '</div>';
    }

    // Submitter suggestions
    if (suggestions.submitters && suggestions.submitters.length > 0) {
      html += '<div class="suggestion-group">';
      html += '<div class="suggestion-group-title">👤 Người thực hiện</div>';
      suggestions.submitters.forEach(submitter => {
        html += `<div class="suggestion-item" data-type="submitter" data-value="${this.escapeHtml(submitter)}">
          ${this.highlightSearchTerm(submitter, query)}
        </div>`;
      });
      html += '</div>';
    }

    searchSuggestions.innerHTML = html;
    searchSuggestions.classList.add('show');

    // Add click handlers
    searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const searchInput = document.getElementById('globalSearchInput');
        searchInput.value = item.dataset.value;
        searchSuggestions.classList.remove('show');
        this.currentPage = 1;
        this.loadResponses(1);
      });
    });
  }

  highlightSearchTerm(text, searchTerm) {
    if (!searchTerm || !text) return this.escapeHtml(text);
    
    const escaped = this.escapeHtml(text);
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  // Edit functionality
  async openEditDialog(surveyId) {
    try {
      // Fetch full survey data
      const surveyData = await this.fetchSurveyForEdit(surveyId);
      if (!surveyData) {
        return;
      }

      // Generate edit form
      const editForm = this.generateEditForm(surveyData);

      // Show modal
      document.getElementById('editModalBody').innerHTML = editForm;
      document.getElementById('editSurveyDialog').style.display = 'flex';

      // Bind save event
      document.getElementById('btnSaveEdit').onclick = () => this.saveSurveyEdit(surveyId);
    } catch (error) {
      console.error('Error opening edit dialog:', error);
      this.showNotification('Lỗi khi mở dialog chỉnh sửa: ' + error.message, 'error');
    }
  }

  async fetchSurveyForEdit(surveyId) {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/responses/${surveyId}`, {
        method: 'GET',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return result.data;
        } else {
          throw new Error(result.message || 'Invalid response format');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching survey for edit:', error);
      this.showNotification('Lỗi khi tải dữ liệu khảo sát: ' + error.message, 'error');
      return null;
    }
  }

  generateEditForm(surveyData) {
    return `
            <form id="editSurveyForm" class="edit-form">
                <!-- Store Information Section -->
                <div class="form-section">
                    <h4>📍 Thông tin cửa hàng (Chỉ xem)</h4>
                    <div class="form-group">
                        <label>Tên cửa hàng:</label>
                        <input type="text" value="${this.escapeHtml(surveyData.shopName || '')}" readonly class="readonly-field">
                        <input type="hidden" name="shopName" value="${this.escapeHtml(surveyData.shopName || '')}">
                    </div>
                    <div class="form-group">
                        <label>Mã cửa hàng:</label>
                        <input type="text" value="${this.escapeHtml(surveyData.leader || '')}" readonly class="readonly-field">
                        <input type="hidden" name="shopId" value="${this.escapeHtml(surveyData.leader || '')}">
                    </div>
                    <div class="form-group">
                        <label>Người thực hiện:</label>
                        <input type="text" value="${this.escapeHtml(surveyData.submittedBy || '')}" readonly class="readonly-field">
                        <input type="hidden" name="submittedBy" value="${this.escapeHtml(surveyData.submittedBy || '')}">
                    </div>
                </div>
                
                <!-- Survey Responses Section -->
                <div class="form-section">
                    <h4>📋 Phản hồi khảo sát</h4>
                    <div id="editableResponses">
                        ${this.generateEditableResponses(surveyData.responses || [])}
                    </div>
                    <button type="button" onclick="surveyResultsApp.addNewResponse()" class="btn-add-response">
                        ➕ Thêm model mới
                    </button>
                </div>
            </form>
        `;
  }

  generateEditableResponses(responses) {
    return responses
      .map(
        (response, index) => `
        <div class="editable-response" data-index="${index}" data-response-index="${index}">
            <div class="model-header">
                <h5>📦 Model ${index + 1}:</h5>
                <button type="button" onclick="surveyResultsApp.removeResponse(${index})" class="btn-remove-inline">
                    🗑️ Xóa
                </button>
            </div>
            <div class="form-group">
                <label>Tên model:</label>
                <input type="text" 
                       name="responses[${index}][model]" 
                       value="${this.escapeHtml(response.model || '')}" 
                       onchange="surveyResultsApp.handleModelChange(${index}, this.value)"
                       required>
            </div>
            <div class="form-group">
                <label>Số lượng:</label>
                <input type="number" 
                       name="responses[${index}][quantity]" 
                       value="${response.quantity || 0}" 
                       min="0" 
                       required>
            </div>
            <div class="form-group">
                <label>POSM có thể chọn:</label>
                <div class="posm-container" data-response-index="${index}">
                    ${this.generatePosmCheckboxesForModel(response.model, response.posmSelections || [], index)}
                </div>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" 
                           name="responses[${index}][allSelected]" 
                           ${response.allSelected ? 'checked' : ''}>
                    Chọn tất cả POSM
                </label>
            </div>
            <div class="form-group">
                <label>Ghi chú:</label>
                <textarea name="responses[${index}][notes]" 
                          rows="3">${this.escapeHtml(response.notes || '')}</textarea>
            </div>
        </div>
      `
      )
      .join('');
  }

  generatePosmCheckboxes(posmSelections, responseIndex) {
    // Define common POSM items
    const commonPosmItems = [
      { code: 'DISPLAY', name: 'Display' },
      { code: 'SHELF_TALKER', name: 'Shelf Talker' },
      { code: 'BANNER', name: 'Banner' },
      { code: 'POSTER', name: 'Poster' },
      { code: 'STANDEE', name: 'Standee' },
      { code: 'FLYER', name: 'Flyer' },
      { code: 'BROCHURE', name: 'Brochure' },
      { code: 'WOBBLER', name: 'Wobbler' },
    ];

    return `
            <div class="posm-checkboxes">
                ${commonPosmItems
                  .map((item) => {
                    const isSelected = posmSelections.some(
                      (p) =>
                        (p.posmCode === item.code || p.code === item.code) &&
                        (p.selected || p.isSelected !== false)
                    );
                    return `
                        <div class="posm-checkbox">
                            <input type="checkbox" 
                                   name="responses[${responseIndex}][posmSelections]" 
                                   value="${item.code}" 
                                   ${isSelected ? 'checked' : ''}>
                            <span>${item.name}</span>
                        </div>
                    `;
                  })
                  .join('')}
            </div>
        `;
  }

  // Dynamic POSM Loading Methods
  async loadPosmForModel(modelName, responseIndex) {
    try {
      if (!modelName || modelName.trim() === '') {
        return this.generateDefaultPosmCheckboxes([], responseIndex);
      }

      const response = await this.makeAuthenticatedRequest(
        `/api/model-posm/${encodeURIComponent(modelName)}`,
        {
          method: 'GET',
        }
      );

      if (response.ok) {
        const result = await response.json();
        const posmData = result.success ? result.data : result; // Handle both formats
        return this.generateDynamicPosmCheckboxes(posmData, [], responseIndex);
      } else {
        console.warn(`No POSM data found for model: ${modelName}, using default`);
        return this.generateDefaultPosmCheckboxes([], responseIndex);
      }
    } catch (error) {
      console.error('Error loading POSM for model:', error);
      return this.generateDefaultPosmCheckboxes([], responseIndex);
    }
  }

  generateDynamicPosmCheckboxes(availablePosmItems, selectedPosmItems, responseIndex) {
    if (!availablePosmItems || availablePosmItems.length === 0) {
      return `<div class="no-posm-message">Không có POSM nào cho model này</div>`;
    }

    return `
      <div class="posm-checkboxes">
          ${availablePosmItems
            .map((item) => {
              const isSelected = selectedPosmItems.some(
                (p) =>
                  (p.posmCode === item.posmCode || p.code === item.posmCode) &&
                  (p.selected || p.isSelected !== false)
              );
              return `
              <div class="posm-checkbox">
                  <input type="checkbox" 
                         name="responses[${responseIndex}][posmSelections]" 
                         value="${item.posmCode}" 
                         ${isSelected ? 'checked' : ''}>
                  <span>${item.posmName}</span>
              </div>
            `;
            })
            .join('')}
      </div>
    `;
  }

  generateDefaultPosmCheckboxes(selectedPosmItems, responseIndex) {
    const defaultItems = [
      { posmCode: 'DISPLAY', posmName: 'Display' },
      { posmCode: 'SHELF_TALKER', posmName: 'Shelf Talker' },
      { posmCode: 'BANNER', posmName: 'Banner' },
      { posmCode: 'POSTER', posmName: 'Poster' },
    ];

    return this.generateDynamicPosmCheckboxes(defaultItems, selectedPosmItems, responseIndex);
  }

  async handleModelChange(responseIndex, modelName) {
    const posmContainer = document.querySelector(
      `[data-response-index="${responseIndex}"] .posm-container`
    );
    if (posmContainer) {
      posmContainer.innerHTML = '<div class="loading">Đang tải POSM...</div>';
      const posmHtml = await this.loadPosmForModel(modelName, responseIndex);
      posmContainer.innerHTML = posmHtml;
    }
  }

  generatePosmCheckboxesForModel(modelName, selectedPosmItems, responseIndex) {
    // For initial load, we'll load POSM asynchronously after the form is rendered
    // This is a placeholder that will be replaced by dynamic loading
    setTimeout(() => {
      this.loadAndUpdatePosmForResponse(modelName, selectedPosmItems, responseIndex);
    }, 100);

    return '<div class="loading">Đang tải POSM...</div>';
  }

  async loadAndUpdatePosmForResponse(modelName, selectedPosmItems, responseIndex) {
    try {
      const posmHtml = await this.loadPosmForModel(modelName, responseIndex);
      const container = document.querySelector(
        `[data-response-index="${responseIndex}"] .posm-container`
      );
      if (container) {
        container.innerHTML = posmHtml;

        // Restore selected items
        selectedPosmItems.forEach((selected) => {
          const checkbox = container.querySelector(
            `input[value="${selected.posmCode || selected.code}"]`
          );
          if (checkbox) {
            checkbox.checked = true;
          }
        });
      }
    } catch (error) {
      console.error('Error loading POSM for response:', error);
    }
  }

  async saveSurveyEdit(surveyId) {
    try {
      const formData = new FormData(document.getElementById('editSurveyForm'));
      const editData = this.serializeEditForm(formData);

      // Show loading
      this.showSaveLoading();

      const response = await this.makeAuthenticatedRequest(`/api/responses/${surveyId}`, {
        method: 'PUT',
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        const result = await response.json();

        // Log the changes
        await this.logSurveyChanges(surveyId, editData);

        // Success
        this.showNotification('Khảo sát đã được cập nhật thành công', 'success');
        this.closeEditDialog();
        this.loadResponses(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error saving survey edit:', error);
      this.showNotification('Lỗi khi lưu thay đổi: ' + error.message, 'error');
    } finally {
      this.hideSaveLoading();
    }
  }

  async logSurveyChanges(surveyId, editData) {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const changeLog = {
        surveyId,
        changedBy: user ? user.username : 'unknown',
        changedAt: new Date().toISOString(),
        changes: editData,
        action: 'SURVEY_EDITED',
      };

      await this.makeAuthenticatedRequest('/api/audit/log', {
        method: 'POST',
        body: JSON.stringify(changeLog),
      });
    } catch (error) {
      console.warn('Could not log survey changes:', error);
      // Don't fail the edit operation if logging fails
    }
  }

  serializeEditForm(formData) {
    const data = {
      shopName: formData.get('shopName'),
      shopId: formData.get('shopId'),
      submittedBy: formData.get('submittedBy'),
      responses: [],
    };

    // Process responses
    const responses = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('responses[')) {
        const matches = key.match(/responses\[(\d+)\]\[([^\]]+)\]/);
        if (matches) {
          const [, index, field] = matches;
          if (!responses[index]) {
            responses[index] = {
              posmSelections: [],
            };
          }

          if (field === 'posmSelections') {
            responses[index].posmSelections.push({
              posmCode: value,
              code: value,
              selected: true,
              isSelected: true,
            });
          } else if (field === 'allSelected') {
            responses[index][field] = value === 'on';
          } else {
            responses[index][field] = value;
          }
        }
      }
    }

    data.responses = Object.values(responses);
    return data;
  }

  closeEditDialog() {
    document.getElementById('editSurveyDialog').style.display = 'none';
    document.getElementById('editModalBody').innerHTML = '';
  }

  showSaveLoading() {
    const saveBtn = document.getElementById('btnSaveEdit');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Đang lưu...';
  }

  hideSaveLoading() {
    const saveBtn = document.getElementById('btnSaveEdit');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '💾 Lưu thay đổi';
  }

  addNewResponse() {
    const responsesContainer = document.getElementById('editableResponses');
    const currentResponses = responsesContainer.querySelectorAll('.editable-response');
    const newIndex = currentResponses.length;

    const newResponseHtml = `
      <div class="editable-response" data-index="${newIndex}" data-response-index="${newIndex}">
          <div class="model-header">
              <h5>📦 Model ${newIndex + 1}:</h5>
              <button type="button" onclick="surveyResultsApp.removeResponse(${newIndex})" class="btn-remove-inline">
                  🗑️ Xóa
              </button>
          </div>
          <div class="form-group">
              <label>Tên model:</label>
              <input type="text" 
                     name="responses[${newIndex}][model]" 
                     value="" 
                     onchange="surveyResultsApp.handleModelChange(${newIndex}, this.value)"
                     required>
          </div>
          <div class="form-group">
              <label>Số lượng:</label>
              <input type="number" 
                     name="responses[${newIndex}][quantity]" 
                     value="0" 
                     min="0" 
                     required>
          </div>
          <div class="form-group">
              <label>POSM có thể chọn:</label>
              <div class="posm-container" data-response-index="${newIndex}">
                  <div class="no-posm-message">Nhập tên model để xem POSM có thể chọn</div>
              </div>
          </div>
          <div class="form-group">
              <label>
                  <input type="checkbox" name="responses[${newIndex}][allSelected]">
                  Chọn tất cả POSM
              </label>
          </div>
          <div class="form-group">
              <label>Ghi chú:</label>
              <textarea name="responses[${newIndex}][notes]" rows="3"></textarea>
          </div>
      </div>
    `;

    responsesContainer.insertAdjacentHTML('beforeend', newResponseHtml);
  }

  removeResponse(index) {
    const responseElement = document.querySelector(`.editable-response[data-index="${index}"]`);
    if (responseElement && confirm('Bạn có chắc chắn muốn xóa model này?')) {
      responseElement.remove();
    }
  }

  // Utility function to escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global function to open external dashboard
function openExternalDashboard() {
  // Replace this URL with your actual dashboard link
  const dashboardUrl = 'https://posm-dashboard-production.up.railway.app/';
  window.open(dashboardUrl, '_blank');
}

// Image Lightbox Functions
function openImageLightbox(imageSrc) {
  const lightbox = document.getElementById('imageLightbox');
  const lightboxImage = document.getElementById('lightboxImage');

  lightboxImage.src = imageSrc;
  lightbox.style.display = 'flex';

  // Prevent body scrolling when lightbox is open
  document.body.style.overflow = 'hidden';
}

function closeImageLightbox() {
  const lightbox = document.getElementById('imageLightbox');
  lightbox.style.display = 'none';

  // Restore body scrolling
  document.body.style.overflow = '';
}

// Global instance of SurveyResultsApp
let surveyResultsApp;

// Initialize the survey results app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  surveyResultsApp = new SurveyResultsApp();

  // Initialize lightbox event listeners
  const lightbox = document.getElementById('imageLightbox');
  const lightboxClose = document.querySelector('.lightbox-close');

  if (lightbox && lightboxClose) {
    // Close lightbox when clicking on overlay
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        closeImageLightbox();
      }
    });

    // Close lightbox when clicking close button
    lightboxClose.addEventListener('click', closeImageLightbox);

    // Close lightbox when pressing Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.style.display === 'flex') {
        closeImageLightbox();
      }
    });
  }
});
