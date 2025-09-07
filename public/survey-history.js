class SurveyHistoryApp {
  constructor() {
    this.surveys = [];
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 0;
    this.filters = {
      startDate: '',
      endDate: '',
      storeName: '',
    };
    this.pagination = null;
    this.user = null;
    this.expandedSurveys = new Set(); // Track expanded survey cards
    this.surveyDetails = new Map(); // Cache loaded survey details
    this.debugMode = true; // Set to false to disable debug logging
    this.storeNames = []; // Cache of store names for autocomplete
    this.autocompleteVisible = false;
    this.selectedSuggestionIndex = -1;

    this.init();
  }

  debug(...args) {
    if (this.debugMode) {
      console.log('[Survey History Debug]', ...args);
    }
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
    await this.loadStoreNames();
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
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    return fetch(url, { ...options, ...defaultOptions });
  }

  setupEventListeners() {
    // Filter inputs - new search input
    this.setupStoreSearchAutocomplete();
    this.setupDateFilter();

    // Logout button

    // Modal close on outside click
    document.getElementById('surveyDetailModal').addEventListener('click', (e) => {
      if (e.target.id === 'surveyDetailModal') {
        this.closeSurveyDetailModal();
      }
    });

    // Lightbox click outside to close
    document.getElementById('imageLightbox').addEventListener('click', (e) => {
      if (e.target.classList.contains('lightbox-overlay')) {
        this.closeLightbox();
      }
    });

    // Keyboard support for lightbox (ESC key)
    document.addEventListener('keydown', (e) => {
      const lightbox = document.getElementById('imageLightbox');
      if (lightbox && lightbox.style.display === 'flex' && e.key === 'Escape') {
        this.closeLightbox();
      }
    });

    // Handle window resize for responsive layout
    window.addEventListener('resize', () => {
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = setTimeout(() => {
        this.renderSurveyTable();
      }, 250);
    });
  }

  setupStoreSearchAutocomplete() {
    const storeSearchInput = document.getElementById('storeSearch');

    // Input event for typing
    storeSearchInput.addEventListener('input', (e) => {
      this.handleStoreSearchInput(e);
    });

    // Keydown for navigation
    storeSearchInput.addEventListener('keydown', (e) => {
      this.handleStoreSearchKeydown(e);
    });

    // Focus event
    storeSearchInput.addEventListener('focus', (e) => {
      if (e.target.value.trim().length >= 2) {
        this.showStoreSearchSuggestions(e.target.value.trim());
      }
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-input-wrapper')) {
        this.hideSearchAutocomplete();
      }
    });
  }

  setupDateFilter() {
    // Apply default 7-day filter
    this.applyDateFilter(7);

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.date-filter-container')) {
        this.hideDateFilter();
      }
    });
  }

  async loadStoreNames() {
    try {
      const response = await this.makeAuthenticatedRequest('/api/stores?limit=2000');
      if (response.ok) {
        const result = await response.json();
        this.storeNames = result.data.map((store) => store.store_name).sort();
        this.debug('Loaded store names:', this.storeNames.length);
      }
    } catch (error) {
      console.error('Failed to load store names:', error);
      this.storeNames = [];
    }
  }

  handleStoreSearchInput(e) {
    const query = e.target.value.trim();

    if (query.length >= 2) {
      this.showStoreSearchSuggestions(query);
    } else {
      this.hideSearchAutocomplete();
    }

    // Reset selection index
    this.selectedSuggestionIndex = -1;

    // Existing debounced filter update
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.updateFilters(), 500);
  }

  showStoreSearchSuggestions(query) {
    const dropdown = document.getElementById('storeSearchSuggestions');
    if (!dropdown) {
      return;
    }

    // Filter matching store names
    const suggestions = this.storeNames
      .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8); // Limit to 8 suggestions for performance

    if (suggestions.length > 0) {
      dropdown.innerHTML = suggestions
        .map(
          (name, index) => `
                <div class="autocomplete-item" 
                     data-index="${index}" 
                     onclick="app.selectStoreSearch('${this.escapeHtml(name)}')">
                    ${this.highlightMatch(name, query)}
                </div>
            `
        )
        .join('');
      dropdown.style.display = 'block';
      this.autocompleteVisible = true;
    } else {
      dropdown.innerHTML = '<div class="autocomplete-no-results">No matching stores found</div>';
      dropdown.style.display = 'block';
      this.autocompleteVisible = true;
    }
  }

  handleStoreSearchKeydown(e) {
    if (!this.autocompleteVisible) {
      return;
    }

    const items = document.querySelectorAll('.autocomplete-item:not(.autocomplete-no-results)');

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedSuggestionIndex = Math.min(this.selectedSuggestionIndex + 1, items.length - 1);
        this.highlightSuggestion();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, -1);
        this.highlightSuggestion();
        break;
      case 'Enter':
        e.preventDefault();
        if (this.selectedSuggestionIndex >= 0 && items[this.selectedSuggestionIndex]) {
          const selectedText = items[this.selectedSuggestionIndex].textContent;
          this.selectStoreSearch(selectedText);
        }
        break;
      case 'Escape':
        this.hideSearchAutocomplete();
        break;
    }
  }

  highlightSuggestion() {
    const items = document.querySelectorAll('.autocomplete-item:not(.autocomplete-no-results)');
    items.forEach((item, index) => {
      if (index === this.selectedSuggestionIndex) {
        item.classList.add('highlighted');
      } else {
        item.classList.remove('highlighted');
      }
    });
  }

  selectStoreSearch(storeName) {
    const storeSearchInput = document.getElementById('storeSearch');
    storeSearchInput.value = storeName;
    this.hideSearchAutocomplete();

    // Trigger filter update
    clearTimeout(this.searchTimeout);
    this.updateFilters();
    this.loadSurveyHistory(true);
  }

  hideSearchAutocomplete() {
    const dropdown = document.getElementById('storeSearchSuggestions');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
    this.autocompleteVisible = false;
    this.selectedSuggestionIndex = -1;
  }

  highlightMatch(text, query) {
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<span class="match-highlight">$1</span>');
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  initializePagination() {
    this.pagination = new PaginationComponent('paginationContainer', {
      defaultPageSize: this.pageSize,
      pageSizeOptions: [10, 20, 50],
      showPageInfo: true,
      showPageSizeSelector: true,
      maxVisiblePages: 5,
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
    // Get values from new inputs
    const storeSearchInput = document.getElementById('storeSearch');
    if (storeSearchInput) {
      this.filters.storeName = storeSearchInput.value.trim();
    }
    // startDate and endDate are managed by date filter functions
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
        ...this.filters,
      });

      // Remove empty filters
      Object.keys(this.filters).forEach((key) => {
        if (!this.filters[key]) {
          params.delete(key);
        }
      });

      const response = await this.makeAuthenticatedRequest(`/api/survey-history?${params}`);

      if (response.ok) {
        const result = await response.json();

        // Store current expanded surveys before updating
        const currentSurveyIds = new Set(result.data.map((s) => s.id));

        // Remove expanded states for surveys no longer in current page
        for (const surveyId of this.expandedSurveys) {
          if (!currentSurveyIds.has(surveyId)) {
            this.expandedSurveys.delete(surveyId);
          }
        }

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

  isMobileDevice() {
    return window.innerWidth <= 768;
  }

  renderSurveyTable() {
    if (this.isMobileDevice()) {
      this.renderMobileCards();
    } else {
      this.renderDesktopTable();
    }
  }

  renderDesktopTable() {
    const tableBody = document.getElementById('surveyTableBody');
    const table = document.getElementById('surveyTable');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.querySelector('.survey-table-container');

    // Ensure desktop view classes
    tableContainer.classList.add('desktop-view');
    tableContainer.classList.remove('mobile-view');

    if (this.surveys.length === 0) {
      table.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    tableBody.innerHTML = this.surveys
      .map((survey) => {
        const surveyId = survey.id || survey._id || survey.surveyId;
        console.log('Rendering survey with ID:', surveyId, 'Full survey:', survey);

        const isExpanded = this.expandedSurveys.has(surveyId);
        const totalImages = this.calculateTotalImages(survey);
        const modelCount = this.calculateModelCount(survey);

        return `
                <tr data-survey-id="${surveyId}" class="survey-row ${isExpanded ? 'expanded' : ''}">
                    <td data-label="Date & Time">${this.formatDateTime(survey.date || survey.createdAt)}</td>
                    <td data-label="Store Name">${this.escapeHtml(survey.storeName || survey.shopName || 'Unknown Store')}</td>
                    <td data-label="Store ID">${this.escapeHtml(survey.storeId || survey.shopId || survey.store_id || 'N/A')}</td>
                    <td data-label="Status">
                        <span class="status-badge status-${(survey.status || 'unknown').toLowerCase()}">
                            ${survey.status || 'UNKNOWN'}
                        </span>
                    </td>
                    <td data-label="Models">${modelCount}</td>
                    <td data-label="Images">${totalImages}</td>
                    <td data-label="Actions">
                        <button class="toggle-details-btn" 
                                onclick="app.toggleSurveyDetail('${surveyId}')"
                                title="${isExpanded ? 'Collapse' : 'Expand'} details"
                                style="background: none; border: none; cursor: pointer; color: var(--secondary); font-size: 16px; padding: 8px; transition: all 0.2s ease; border-radius: 4px;"
                                onmouseover="this.style.backgroundColor='var(--neutral)'; this.style.color='var(--primary)'"
                                onmouseout="this.style.backgroundColor='transparent'; this.style.color='var(--secondary)'">
                            ${isExpanded ? '▲' : '▼'}
                        </button>
                    </td>
                    ${
                      isExpanded
                        ? `
                        <td colspan="6" class="survey-detail-panel expanded">
                            <div id="detail-${surveyId}">
                                ${
                                  this.surveyDetails.has(surveyId)
                                    ? this.renderSurveyDetailContent(
                                        this.surveyDetails.get(surveyId)
                                      )
                                    : this.renderDetailSkeleton()
                                }
                            </div>
                        </td>
                    `
                        : ''
                    }
                </tr>
            `;
      })
      .join('');
  }

  renderMobileCards() {
    const tableContainer = document.querySelector('.survey-table-container');
    const emptyState = document.getElementById('emptyState');

    // Ensure mobile view classes
    tableContainer.classList.add('mobile-view');
    tableContainer.classList.remove('desktop-view');

    if (this.surveys.length === 0) {
      tableContainer.innerHTML = `
                <div id="loadingOverlay" class="loading-overlay" style="display: none;">
                    <div class="spinner"></div>
                    <div class="loading-text">Loading surveys...</div>
                </div>
                <div id="emptyState" class="empty-state">
                    <div style="font-size: 4em; color: #ddd; margin-bottom: 20px;">📋</div>
                    <h3>No Surveys Found</h3>
                    <p>You haven't submitted any surveys yet, or no surveys match your current filters.</p>
                </div>
            `;
      return;
    }

    const cardsHtml = this.surveys
      .map((survey) => {
        const surveyId = survey.id || survey._id || survey.surveyId;
        const isExpanded = this.expandedSurveys.has(surveyId);
        const totalImages = this.calculateTotalImages(survey);
        const modelCount = this.calculateModelCount(survey);

        return `
                <div class="mobile-survey-card ${isExpanded ? 'expanded' : ''}" 
                     data-survey-id="${surveyId}">
                    <div class="mobile-card-header">
                        <div class="mobile-store-name">${this.escapeHtml(survey.storeName || survey.shopName || 'Unknown Store')}</div>
                        <div class="mobile-store-id">ID: ${this.escapeHtml(survey.storeId || survey.shopId || survey.store_id || 'N/A')}</div>
                        <div class="mobile-date-time">${this.formatDateTime(survey.date || survey.createdAt)}</div>
                        <div class="mobile-card-footer">
                            <span class="mobile-status-badge status-badge status-${(survey.status || 'unknown').toLowerCase()}">
                                ${survey.status || 'UNKNOWN'}
                            </span>
                            <span class="mobile-count-chip mobile-models-chip">📦 ${modelCount}</span>
                            <span class="mobile-count-chip mobile-images-chip">📸 ${totalImages}</span>
                        </div>
                        <div class="mobile-expand-icon" 
                             onclick="app.toggleSurveyDetail('${surveyId}')"
                             style="cursor: pointer;"
                             title="${isExpanded ? 'Collapse' : 'Expand'} details">
                            ${isExpanded ? '▲' : '▼'}
                        </div>
                    </div>
                    ${
                      isExpanded
                        ? `
                        <div class="mobile-detail-overlay expanded">
                            <div class="mobile-detail-content" id="detail-${surveyId}">
                                ${
                                  this.surveyDetails.has(surveyId)
                                    ? this.renderMobileSurveyDetailContent(
                                        this.surveyDetails.get(surveyId)
                                      )
                                    : this.renderDetailSkeleton()
                                }
                            </div>
                        </div>
                    `
                        : ''
                    }
                </div>
            `;
      })
      .join('');

    tableContainer.innerHTML = `
            <div id="loadingOverlay" class="loading-overlay" style="display: none;">
                <div class="spinner"></div>
                <div class="loading-text">Loading surveys...</div>
            </div>
            <div class="mobile-survey-cards">
                ${cardsHtml}
            </div>
        `;
  }

  renderSkeletonRows(count = 8) {
    if (this.isMobileDevice()) {
      this.renderMobileSkeletonCards(count);
    } else {
      this.renderDesktopSkeletonRows(count);
    }
  }

  renderDesktopSkeletonRows(count = 8) {
    const tableBody = document.getElementById('surveyTableBody');
    const table = document.getElementById('surveyTable');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.querySelector('.survey-table-container');

    tableContainer.classList.add('desktop-view');
    tableContainer.classList.remove('mobile-view');
    table.style.display = 'table';
    emptyState.style.display = 'none';

    const skeletonRows = Array.from(
      { length: count },
      (_, i) => `
            <tr class="skeleton-row">
                <td><div class="skeleton-cell medium"></div></td>
                <td><div class="skeleton-cell long"></div></td>
                <td><div class="skeleton-cell short"></div></td>
                <td><div class="skeleton-cell tiny"></div></td>
                <td><div class="skeleton-cell tiny"></div></td>
                <td><div class="skeleton-cell tiny"></div></td>
                <td><div class="skeleton-cell tiny"></div></td>
            </tr>
        `
    ).join('');

    tableBody.innerHTML = skeletonRows;
  }

  renderMobileSkeletonCards(count = 8) {
    const tableContainer = document.querySelector('.survey-table-container');

    tableContainer.classList.add('mobile-view');
    tableContainer.classList.remove('desktop-view');

    const skeletonCards = Array.from(
      { length: count },
      (_, i) => `
            <div class="mobile-survey-card">
                <div class="mobile-card-header">
                    <div class="skeleton-cell long" style="height: 18px; margin-bottom: 8px;"></div>
                    <div class="skeleton-cell short" style="height: 14px; margin-bottom: 8px;"></div>
                    <div class="skeleton-cell medium" style="height: 12px; margin-bottom: 10px;"></div>
                    <div class="mobile-card-footer" style="gap: 8px;">
                        <div class="skeleton-cell tiny" style="height: 20px; width: 60px;"></div>
                        <div class="skeleton-cell tiny" style="height: 20px; width: 40px;"></div>
                        <div class="skeleton-cell tiny" style="height: 20px; width: 40px;"></div>
                    </div>
                </div>
            </div>
        `
    ).join('');

    tableContainer.innerHTML = `
            <div class="mobile-survey-cards">
                ${skeletonCards}
            </div>
        `;
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

    return responses
      .map(
        (response, index) => `
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
        `
      )
      .join('');
  }

  renderPosmSelections(posmSelections) {
    if (!posmSelections || posmSelections.length === 0) {
      return '<p><strong>POSM Selections:</strong> None specified</p>';
    }

    const selectedPosm = posmSelections.filter((p) => p.selected);

    if (selectedPosm.length === 0) {
      return '<p><strong>POSM Selections:</strong> None selected</p>';
    }

    return `
            <div style="margin-bottom: 15px;">
                <strong>Selected POSM:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    ${selectedPosm
                      .map(
                        (posm) => `
                        <li>${this.escapeHtml(posm.posmName)} (${this.escapeHtml(posm.posmCode)})</li>
                    `
                      )
                      .join('')}
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
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px; margin-top: 10px;">
                    ${images
                      .map(
                        (imageUrl, index) => `
                        <div style="position: relative;">
                            <img src="${imageUrl}" 
                                 alt="Survey Image ${index + 1}"
                                 style="width: 100%; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid #ddd;"
                                 onclick="app.openLightbox('${imageUrl}')"
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE2IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2U8L3RleHQ+PC9zdmc+'">
                            <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">
                                ${index + 1}
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
        `;
  }

  openLightbox(imageUrl) {
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxOverlay = document.getElementById('imageLightbox');

    if (lightboxImage && lightboxOverlay) {
      lightboxImage.src = imageUrl;
      lightboxOverlay.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // Prevent background scrolling

      // Focus on close button for accessibility
      setTimeout(() => {
        const closeButton = lightboxOverlay.querySelector('.lightbox-close');
        if (closeButton) {
          closeButton.focus();
        }
      }, 100);
    }
  }

  closeLightbox() {
    const lightboxOverlay = document.getElementById('imageLightbox');
    if (lightboxOverlay) {
      lightboxOverlay.style.display = 'none';
      document.body.style.overflow = ''; // Restore scrolling
    }
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
        if (overlay) {
          overlay.style.display = 'flex';
        } else {
          // Create mobile loading state if overlay doesn't exist
          this.showMobileFilterLoading(true);
        }
      } else {
        // Show skeleton for initial/page load
        this.renderSkeletonRows();
      }
    } else {
      // Hide all loading states
      if (overlay) {
        overlay.style.display = 'none';
      }
      this.showMobileFilterLoading(false);
    }
  }

  showMobileFilterLoading(show) {
    const tableContainer = document.querySelector('.survey-table-container');
    if (!tableContainer) {
      return;
    }

    const existingMobileLoader = tableContainer.querySelector('.mobile-filter-loader');

    if (show) {
      // Create mobile loading overlay if it doesn't exist
      if (!existingMobileLoader) {
        const mobileLoader = document.createElement('div');
        mobileLoader.className = 'mobile-filter-loader';
        mobileLoader.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.9);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    z-index: 20;
                    border-radius: 8px;
                `;
        mobileLoader.innerHTML = `
                    <div class="spinner"></div>
                    <div class="loading-text">Filtering surveys...</div>
                `;
        tableContainer.style.position = 'relative';
        tableContainer.appendChild(mobileLoader);
      } else {
        existingMobileLoader.style.display = 'flex';
      }
    } else {
      // Hide mobile loading overlay
      if (existingMobileLoader) {
        existingMobileLoader.style.display = 'none';
      }
    }
  }

  showButtonLoading(buttonId, loading) {
    const button = document.getElementById(buttonId);
    if (!button) {
      return;
    }

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
      minute: '2-digit',
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  calculateModelCount(survey) {
    // Priority 1: Use responseCount from API if available
    if (survey.responseCount !== undefined && survey.responseCount !== null) {
      return survey.responseCount;
    }

    // Priority 2: Use modelsCount if available
    if (survey.modelsCount !== undefined && survey.modelsCount !== null) {
      return survey.modelsCount;
    }

    // Priority 3: Count from arrays
    if (survey.responses && Array.isArray(survey.responses)) {
      return survey.responses.length;
    }

    if (survey.models && Array.isArray(survey.models)) {
      return survey.models.length;
    }

    if (survey.answers && Array.isArray(survey.answers)) {
      return survey.answers.length;
    }

    return 0;
  }

  calculateTotalImages(survey) {
    // Debug: log the actual survey structure to understand the data
    console.log('Survey structure for image counting:', {
      id: survey.id || survey._id,
      storeName: survey.storeName || survey.shopName,
      totalImages: survey.totalImages,
      imageCount: survey.imageCount,
      hasImages: survey.hasImages,
      responses: survey.responses ? `Array[${survey.responses.length}]` : 'undefined',
      models: survey.models ? `Array[${survey.models.length}]` : 'undefined',
      answers: survey.answers ? `Array[${survey.answers.length}]` : 'undefined',
      keys: Object.keys(survey),
    });

    // Priority 1: Use totalImages from summary API if available
    if (survey.totalImages !== undefined && survey.totalImages !== null && survey.totalImages > 0) {
      console.log('Using totalImages from API:', survey.totalImages);
      return survey.totalImages;
    }

    // Priority 2: Use imageCount if available (alternative API field)
    if (survey.imageCount !== undefined && survey.imageCount !== null && survey.imageCount > 0) {
      console.log('Using imageCount from API:', survey.imageCount);
      return survey.imageCount;
    }

    // Priority 2.5: Check other potential image count fields
    if (
      survey.totalImageCount !== undefined &&
      survey.totalImageCount !== null &&
      survey.totalImageCount > 0
    ) {
      console.log('Using totalImageCount from API:', survey.totalImageCount);
      return survey.totalImageCount;
    }

    if (
      survey.images_count !== undefined &&
      survey.images_count !== null &&
      survey.images_count > 0
    ) {
      console.log('Using images_count from API:', survey.images_count);
      return survey.images_count;
    }

    // Priority 3: Calculate from responses/models arrays
    let totalImages = 0;
    const imageUrls = new Set(); // Use Set to deduplicate

    // Check responses array
    if (survey.responses && Array.isArray(survey.responses)) {
      survey.responses.forEach((response) => {
        // Check images array
        if (response.images && Array.isArray(response.images)) {
          response.images.forEach((img) => {
            if (img && typeof img === 'string' && img.trim()) {
              imageUrls.add(img.trim());
            }
          });
        }
        // Check photos array (alternative field name)
        if (response.photos && Array.isArray(response.photos)) {
          response.photos.forEach((photo) => {
            if (photo && typeof photo === 'string' && photo.trim()) {
              imageUrls.add(photo.trim());
            }
          });
        }
      });
    }

    // Check models array (alternative structure)
    if (survey.models && Array.isArray(survey.models)) {
      survey.models.forEach((model) => {
        if (model.images && Array.isArray(model.images)) {
          model.images.forEach((img) => {
            if (img && typeof img === 'string' && img.trim()) {
              imageUrls.add(img.trim());
            }
          });
        }
        // Also check for photos in models
        if (model.photos && Array.isArray(model.photos)) {
          model.photos.forEach((photo) => {
            if (photo && typeof photo === 'string' && photo.trim()) {
              imageUrls.add(photo.trim());
            }
          });
        }
      });
    }

    // Check answers array (another potential structure)
    if (survey.answers && Array.isArray(survey.answers)) {
      survey.answers.forEach((answer) => {
        if (answer.photos && Array.isArray(answer.photos)) {
          answer.photos.forEach((photo) => {
            if (photo && typeof photo === 'string' && photo.trim()) {
              imageUrls.add(photo.trim());
            }
          });
        }
        if (answer.images && Array.isArray(answer.images)) {
          answer.images.forEach((img) => {
            if (img && typeof img === 'string' && img.trim()) {
              imageUrls.add(img.trim());
            }
          });
        }
      });
    }

    totalImages = imageUrls.size;
    console.log('Calculated image count:', totalImages, 'from URLs:', Array.from(imageUrls));

    // Fallback: if we still have 0 but hasImages is true, show indication of images
    if (totalImages === 0 && survey.hasImages === true) {
      console.log('No images calculated but hasImages=true, using responseCount as estimate');
      // Use responseCount as estimate since each response likely has images
      return survey.responseCount || 1;
    }

    return totalImages;
  }

  // Date filter functionality
  toggleDateFilter() {
    const dropdown = document.getElementById('dateFilterDropdown');
    const button = document.getElementById('dateFilterBtn');
    const filtersContent = document.getElementById('filtersContent');

    if (dropdown.style.display === 'none' || !dropdown.style.display) {
      // Temporarily remove overflow constraints when opening dropdown
      if (filtersContent) {
        filtersContent.style.overflowY = 'visible';
      }
      dropdown.style.display = 'block';
      button.classList.add('active');
    } else {
      // Restore overflow constraints when closing dropdown
      if (filtersContent && filtersContent.classList.contains('expanded')) {
        filtersContent.style.overflowY = 'visible';
      }
      dropdown.style.display = 'none';
      button.classList.remove('active');
      this.hideCustomDateInputs();
    }
  }

  hideDateFilter() {
    const dropdown = document.getElementById('dateFilterDropdown');
    const button = document.getElementById('dateFilterBtn');
    const filtersContent = document.getElementById('filtersContent');

    if (dropdown && button) {
      dropdown.style.display = 'none';
      button.classList.remove('active');
      this.hideCustomDateInputs();

      // Restore overflow constraints when hiding dropdown
      if (filtersContent && filtersContent.classList.contains('expanded')) {
        filtersContent.style.overflowY = 'visible';
      }
    }
  }

  applyDateFilter(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    this.filters.startDate = startDate.toISOString().split('T')[0];
    this.filters.endDate = endDate.toISOString().split('T')[0];

    // Update button text
    const dateFilterText = document.getElementById('dateFilterText');
    if (dateFilterText) {
      dateFilterText.textContent = `Last ${days} days`;
    }

    this.hideDateFilter();
    this.loadSurveyHistory(true);
  }

  showCustomDateInputs() {
    const customInputs = document.getElementById('customDateInputs');
    if (customInputs) {
      customInputs.style.display = 'flex';
    }
  }

  hideCustomDateInputs() {
    const customInputs = document.getElementById('customDateInputs');
    if (customInputs) {
      customInputs.style.display = 'none';
    }
  }

  applyCustomDateRange() {
    const startDateInput = document.getElementById('customStartDate');
    const endDateInput = document.getElementById('customEndDate');

    if (startDateInput.value && endDateInput.value) {
      this.filters.startDate = startDateInput.value;
      this.filters.endDate = endDateInput.value;

      // Update button text
      const dateFilterText = document.getElementById('dateFilterText');
      if (dateFilterText) {
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);
        dateFilterText.textContent = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
      }

      this.hideDateFilter();
      this.loadSurveyHistory(true);
    } else {
      alert('Please select both start and end dates.');
    }
  }

  async toggleSurveyDetail(surveyId) {
    console.log('Toggling survey detail for ID:', surveyId);

    // Debounce rapid taps
    if (this.tapTimeout) {
      clearTimeout(this.tapTimeout);
    }

    this.tapTimeout = setTimeout(async () => {
      const isExpanded = this.expandedSurveys.has(surveyId);
      console.log('Currently expanded:', isExpanded);

      if (isExpanded) {
        // Collapse
        this.expandedSurveys.delete(surveyId);
        console.log('Collapsed survey:', surveyId);
      } else {
        // Expand
        this.expandedSurveys.add(surveyId);
        console.log('Expanding survey:', surveyId);

        // Load survey details if not cached
        if (!this.surveyDetails.has(surveyId)) {
          console.log('Loading details for survey:', surveyId);
          await this.loadSurveyDetailData(surveyId);
        } else {
          console.log('Using cached details for survey:', surveyId);
        }
      }

      // Re-render to show/hide detail panel
      console.log('Re-rendering survey table...');
      this.renderSurveyTable();

      // Preserve scroll position
      this.preserveScrollPosition(surveyId, !isExpanded);
    }, 150);
  }

  async loadSurveyDetailData(surveyId) {
    try {
      console.log('Loading survey detail for ID:', surveyId);

      // Try the correct survey detail endpoint
      console.log('Trying endpoint: /api/surveys/' + surveyId);
      let response = await this.makeAuthenticatedRequest(`/api/surveys/${surveyId}`);
      console.log('Primary endpoint response status:', response.status);

      // Fallback to survey-history endpoint if the first one fails
      if (!response.ok) {
        console.log('Primary endpoint failed, trying fallback: /api/survey-history/' + surveyId);
        response = await this.makeAuthenticatedRequest(`/api/survey-history/${surveyId}`);
        console.log('Fallback endpoint response status:', response.status);
      }

      if (response.ok) {
        const result = await response.json();
        console.log('Survey detail API response:', result);

        // Handle different response formats
        const surveyData = result.data || result;
        this.surveyDetails.set(surveyId, surveyData);

        // Update the detail panel if currently expanded
        if (this.expandedSurveys.has(surveyId)) {
          const detailElement = document.getElementById(`detail-${surveyId}`);
          if (detailElement) {
            const detailContent = this.isMobileDevice()
              ? this.renderMobileSurveyDetailContent(surveyData)
              : this.renderSurveyDetailContent(surveyData);
            detailElement.innerHTML = detailContent;
          }
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading survey detail:', error);
      const detailElement = document.getElementById(`detail-${surveyId}`);
      if (detailElement) {
        detailElement.innerHTML = `
                    <div style="color: var(--error); padding: 20px; text-align: center; border: 1px solid var(--error-light); border-radius: 8px; background: var(--error-light);">
                        <p><strong>Failed to load survey details</strong></p>
                        <p style="font-size: 0.9rem; margin-top: 8px;">Error: ${error.message}</p>
                        <button onclick="app.loadSurveyDetailData('${surveyId}')" style="margin-top: 12px; padding: 6px 12px; background: var(--error); color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Retry
                        </button>
                    </div>
                `;
      }
    }
  }

  renderDetailSkeleton() {
    return `
            <div class="detail-skeleton" style="padding: 16px;">
                <div style="margin-bottom: 20px;">
                    <div class="skeleton-item" style="width: 140px; height: 18px; margin-bottom: 12px; border-radius: 4px;"></div>
                    <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid var(--neutral-border);">
                        <div class="skeleton-item" style="width: 80%; height: 16px; margin-bottom: 8px; border-radius: 3px;"></div>
                        <div class="skeleton-item" style="width: 60%; height: 16px; margin-bottom: 8px; border-radius: 3px;"></div>
                        <div class="skeleton-item" style="width: 70%; height: 16px; margin-bottom: 8px; border-radius: 3px;"></div>
                        <div class="skeleton-item" style="width: 50%; height: 16px; border-radius: 3px;"></div>
                    </div>
                </div>
                
                <div>
                    <div class="skeleton-item" style="width: 160px; height: 18px; margin-bottom: 12px; border-radius: 4px;"></div>
                    
                    <!-- Model response skeletons -->
                    <div style="border: 1px solid #ddd; border-radius: 8px; margin-bottom: 16px; overflow: hidden;">
                        <div style="background: #f0f0f0; padding: 12px;">
                            <div class="skeleton-item" style="width: 180px; height: 16px; margin-bottom: 8px; border-radius: 3px;"></div>
                            <div class="skeleton-item" style="width: 120px; height: 14px; border-radius: 3px;"></div>
                        </div>
                        <div style="padding: 12px;">
                            <div class="skeleton-item" style="width: 100px; height: 14px; margin-bottom: 12px; border-radius: 3px;"></div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); gap: 4px;">
                                <div class="skeleton-item" style="height: 60px; border-radius: 4px;"></div>
                                <div class="skeleton-item" style="height: 60px; border-radius: 4px;"></div>
                                <div class="skeleton-item" style="height: 60px; border-radius: 4px;"></div>
                                <div class="skeleton-item" style="height: 60px; border-radius: 4px;"></div>
                                <div class="skeleton-item" style="height: 60px; border-radius: 4px;"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                        <div style="background: #f0f0f0; padding: 12px;">
                            <div class="skeleton-item" style="width: 160px; height: 16px; margin-bottom: 8px; border-radius: 3px;"></div>
                            <div class="skeleton-item" style="width: 140px; height: 14px; border-radius: 3px;"></div>
                        </div>
                        <div style="padding: 12px;">
                            <div class="skeleton-item" style="width: 80px; height: 14px; margin-bottom: 12px; border-radius: 3px;"></div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); gap: 4px;">
                                <div class="skeleton-item" style="height: 60px; border-radius: 4px;"></div>
                                <div class="skeleton-item" style="height: 60px; border-radius: 4px;"></div>
                                <div class="skeleton-item" style="height: 60px; border-radius: 4px;"></div>
                                <div class="skeleton-item" style="height: 60px; border-radius: 4px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  renderSurveyDetailContent(survey) {
    if (!survey) {
      return '<p>No survey data available.</p>';
    }

    // Handle different survey data structures
    const storeName = survey.storeName || survey.shopName || 'Unknown Store';
    const storeId = survey.storeId || survey.shopId || 'N/A';
    const submittedAt = survey.submittedAt || survey.createdAt || survey.date;
    const submittedBy = survey.submittedBy || survey.leader || 'N/A';
    const status = survey.status || 'UNKNOWN';

    let storeInfo = `<strong>Store:</strong> ${this.escapeHtml(storeName)} (ID: ${this.escapeHtml(storeId)})`;
    if (survey.storeDetails) {
      if (survey.storeDetails.channel) {
        storeInfo += `<br><strong>Channel:</strong> ${this.escapeHtml(survey.storeDetails.channel)}`;
      }
      if (survey.storeDetails.region) {
        storeInfo += `<br><strong>Region:</strong> ${this.escapeHtml(survey.storeDetails.region)}`;
      }
      if (survey.storeDetails.province) {
        storeInfo += `<br><strong>Province:</strong> ${this.escapeHtml(survey.storeDetails.province)}`;
      }
    }

    const totalImages = this.calculateTotalImages(survey);
    const responseCount =
      (survey.responses && survey.responses.length) || survey.responseCount || 0;
    const surveyId = survey.id || survey._id || 'unknown';

    return `
            <div class="survey-detail-content" style="padding: 16px;">
                ${this.renderSimpleSurveyResponses(survey, surveyId)}
            </div>
        `;
  }

  renderMobileSurveyDetailContent(survey) {
    if (!survey) {
      return '<p>No survey data available.</p>';
    }

    const storeName = survey.storeName || survey.shopName || 'Unknown Store';
    const storeId = survey.storeId || survey.shopId || 'N/A';
    const submittedAt = survey.submittedAt || survey.createdAt || survey.date;
    const submittedBy = survey.submittedBy || survey.leader || 'N/A';
    const status = survey.status || 'UNKNOWN';

    let storeInfo = `<strong>Store:</strong> ${this.escapeHtml(storeName)} (ID: ${this.escapeHtml(storeId)})`;
    if (survey.storeDetails) {
      if (survey.storeDetails.channel) {
        storeInfo += `<br><strong>Channel:</strong> ${this.escapeHtml(survey.storeDetails.channel)}`;
      }
      if (survey.storeDetails.region) {
        storeInfo += `<br><strong>Region:</strong> ${this.escapeHtml(survey.storeDetails.region)}`;
      }
      if (survey.storeDetails.province) {
        storeInfo += `<br><strong>Province:</strong> ${this.escapeHtml(survey.storeDetails.province)}`;
      }
    }

    const totalImages = this.calculateTotalImages(survey);
    const responseCount =
      (survey.responses && survey.responses.length) || survey.responseCount || 0;
    const surveyId = survey.id || survey._id || 'unknown';

    return `
            <div class="mobile-detail-content" style="padding: 12px;">
                ${this.renderSimpleSurveyResponses(survey, surveyId)}
            </div>
        `;
  }

  renderSimpleSurveyResponses(survey, surveyId) {
    const responses = survey.responses || survey.models || survey.answers || [];

    if (!responses || responses.length === 0) {
      return '<div class="no-responses">No responses recorded for this survey.</div>';
    }

    return `
            <div class="survey-responses-list">
                ${responses
                  .map((response, index) => {
                    const modelName =
                      response.model ||
                      response.modelName ||
                      response.question ||
                      `Model ${index + 1}`;
                    const posmInfo = this.formatPosmInfo(
                      response.posmSelections || response.selections || [],
                      response.allSelected || false
                    );
                    const images = response.images || response.photos || [];
                    const imageCount = images.length;

                    return `
                        <div class="response-row">
                            <span class="model-name">${this.escapeHtml(modelName)}</span>
                            <span class="posm-info">${posmInfo}</span>
                            ${
                              imageCount > 0
                                ? `<a class="images-link" onclick="app.openModelImagesLightbox('${surveyId}', ${index})" href="javascript:void(0)">Images (${imageCount})</a>`
                                : '<span class="no-images">No images</span>'
                            }
                        </div>
                    `;
                  })
                  .join('')}
            </div>
        `;
  }

  formatPosmInfo(posmSelections, allSelected) {
    if (allSelected) {
      return 'POSM: All Selected';
    }

    if (!posmSelections || posmSelections.length === 0) {
      return 'POSM: None';
    }

    const selectedPosm = posmSelections.filter((p) => p.selected || p.isSelected !== false);
    if (selectedPosm.length === 0) {
      return 'POSM: None';
    }

    const names = selectedPosm.map((p) => p.posmName || p.name || p.posmCode || p.code).slice(0, 3);
    const display = names.join(', ');
    const remaining = selectedPosm.length - names.length;

    return `POSM: ${display}${remaining > 0 ? ` +${remaining} more` : ''}`;
  }

  openModelImagesLightbox(surveyId, modelIndex) {
    const survey = this.surveyDetails.get(surveyId);
    if (!survey) {
      return;
    }

    const responses = survey.responses || survey.models || survey.answers || [];
    const response = responses[modelIndex];
    if (!response) {
      return;
    }

    const images = response.images || response.photos || [];
    if (images.length === 0) {
      return;
    }

    // Open first image in existing lightbox (can be enhanced to show all model images)
    this.openImageLightbox(images[0], `${response.model || `Model ${modelIndex + 1}`} - Image 1`);
  }

  openImageLightbox(imageUrl, altText = '') {
    // Use the existing lightbox modal
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxModal = document.getElementById('imageLightbox');

    if (lightboxImage && lightboxModal) {
      lightboxImage.src = imageUrl;
      lightboxImage.alt = altText;
      lightboxModal.style.display = 'flex';
    } else {
      // Fallback: open in new window
      window.open(imageUrl, '_blank');
    }
  }

  preserveScrollPosition(surveyId, isExpanding) {
    if (isExpanding) {
      // When expanding, scroll the expanded card into view
      setTimeout(() => {
        const cardElement = document.querySelector(`[data-survey-id="${surveyId}"]`);
        if (cardElement) {
          cardElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }
      }, 100);
    }
  }

  toggleDetailSection(sectionId) {
    const sectionContent = document.getElementById(sectionId);
    const sectionIcon = document.getElementById(sectionId + '-icon');

    if (!sectionContent || !sectionIcon) {
      return;
    }

    if (sectionContent.classList.contains('expanded')) {
      // Collapse section
      sectionContent.classList.remove('expanded');
      sectionContent.style.maxHeight = '0';
      sectionIcon.style.transform = 'rotate(-90deg)';
    } else {
      // Expand section
      sectionContent.classList.add('expanded');
      // Set appropriate max-height based on content
      if (sectionId.includes('info-')) {
        sectionContent.style.maxHeight = '200px';
      } else if (sectionId.includes('responses-')) {
        sectionContent.style.maxHeight = '1000px';
      }
      sectionIcon.style.transform = 'rotate(0deg)';
    }
  }
}

// Global functions for HTML onclick handlers
function toggleFilters() {
  const filtersContent = document.getElementById('filtersContent');
  const toggleIcon = document.getElementById('filterToggleIcon');

  if (filtersContent.classList.contains('expanded')) {
    filtersContent.classList.remove('expanded');
    toggleIcon.classList.remove('expanded');
  } else {
    filtersContent.classList.add('expanded');
    toggleIcon.classList.add('expanded');
  }
}

function clearFilters() {
  // Clear search input
  const storeSearchInput = document.getElementById('storeSearch');
  if (storeSearchInput) {
    storeSearchInput.value = '';
  }

  // Reset date filter to default (Last 7 days)
  const dateFilterText = document.getElementById('dateFilterText');
  if (dateFilterText) {
    dateFilterText.textContent = 'Last 7 days';
  }

  // Clear custom date inputs
  const customStartDate = document.getElementById('customStartDate');
  const customEndDate = document.getElementById('customEndDate');
  if (customStartDate) {
    customStartDate.value = '';
  }
  if (customEndDate) {
    customEndDate.value = '';
  }

  // Apply default 7-day filter
  app.applyDateFilter(7);

  // Clear search filter
  app.filters.storeName = '';
  app.currentPage = 1;
  app.loadSurveyHistory(true);
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
