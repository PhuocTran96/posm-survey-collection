/**
 * Reusable Pagination Component for Admin Tables
 * Provides consistent pagination UI and functionality across User and Store Management pages
 */
class PaginationComponent {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      defaultPageSize: 25,
      pageSizeOptions: [10, 25, 50, 100],
      showPageInfo: true,
      showPageSizeSelector: true,
      maxVisiblePages: 7,
      ...options,
    };

    this.currentPage = 1;
    this.totalPages = 1;
    this.totalCount = 0;
    this.pageSize = this.options.defaultPageSize;
    this.onPageChange = null;
    this.onPageSizeChange = null;

    this.init();
  }

  init() {
    if (!this.container) {
      console.warn('Pagination container not found');
      return;
    }
    this.render();
  }

  setData(paginationData) {
    this.currentPage = paginationData.currentPage || 1;
    this.totalPages = paginationData.totalPages || 1;
    this.totalCount = paginationData.totalCount || 0;
    this.pageSize = paginationData.limit || this.pageSize;
    this.render();
  }

  setCallbacks(onPageChange, onPageSizeChange) {
    this.onPageChange = onPageChange;
    this.onPageSizeChange = onPageSizeChange;
  }

  render() {
    if (this.totalPages <= 1 && !this.options.showPageSizeSelector) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'flex';

    const startItem = Math.max(1, (this.currentPage - 1) * this.pageSize + 1);
    const endItem = Math.min(this.totalCount, this.currentPage * this.pageSize);

    this.container.innerHTML = `
            <div class="pagination-wrapper">
                ${
                  this.options.showPageInfo
                    ? `
                    <div class="pagination-info">
                        <span class="pagination-text">
                            Hiển thị <strong>${startItem}</strong> - <strong>${endItem}</strong> 
                            trong tổng số <strong>${this.totalCount}</strong> mục
                        </span>
                    </div>
                `
                    : ''
                }
                
                <div class="pagination-controls">
                    ${
                      this.options.showPageSizeSelector
                        ? `
                        <div class="page-size-selector">
                            <label for="pageSize">Hiển thị:</label>
                            <select id="pageSize" class="page-size-select">
                                ${this.options.pageSizeOptions
                                  .map(
                                    (size) =>
                                      `<option value="${size}" ${size === this.pageSize ? 'selected' : ''}>${size}</option>`
                                  )
                                  .join('')}
                            </select>
                            <span class="page-size-label">mục/trang</span>
                        </div>
                    `
                        : ''
                    }
                    
                    ${
                      this.totalPages > 1
                        ? `
                        <div class="pagination-nav">
                            <button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
                                    data-page="1" title="Trang đầu">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="11,17 6,12 11,7"></polyline>
                                    <polyline points="18,17 13,12 18,7"></polyline>
                                </svg>
                            </button>
                            
                            <button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
                                    data-page="${this.currentPage - 1}" title="Trang trước">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="15,18 9,12 15,6"></polyline>
                                </svg>
                            </button>
                            
                            ${this.generatePageNumbers()}
                            
                            <button class="pagination-btn ${this.currentPage === this.totalPages ? 'disabled' : ''}" 
                                    data-page="${this.currentPage + 1}" title="Trang sau">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="9,18 15,12 9,6"></polyline>
                                </svg>
                            </button>
                            
                            <button class="pagination-btn ${this.currentPage === this.totalPages ? 'disabled' : ''}" 
                                    data-page="${this.totalPages}" title="Trang cuối">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="13,17 18,12 13,7"></polyline>
                                    <polyline points="6,17 11,12 6,7"></polyline>
                                </svg>
                            </button>
                        </div>
                        
                        <div class="page-jump">
                            <span>Trang:</span>
                            <input type="number" 
                                   class="page-input" 
                                   min="1" 
                                   max="${this.totalPages}" 
                                   value="${this.currentPage}"
                                   title="Nhập số trang và nhấn Enter">
                            <span class="page-total">/ ${this.totalPages}</span>
                        </div>
                    `
                        : ''
                    }
                </div>
            </div>
        `;

    this.bindEvents();
  }

  generatePageNumbers() {
    const { maxVisiblePages } = this.options;
    const { currentPage, totalPages } = this;

    if (totalPages <= maxVisiblePages) {
      // Show all pages
      return Array.from({ length: totalPages }, (_, i) => i + 1)
        .map(
          (page) => `
                    <button class="pagination-btn page-number ${page === currentPage ? 'active' : ''}" 
                            data-page="${page}">${page}</button>
                `
        )
        .join('');
    }

    // Calculate visible pages with ellipsis
    let pages = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);

    if (currentPage <= halfVisible + 1) {
      // Show pages from start with ellipsis at end
      pages = Array.from({ length: maxVisiblePages - 1 }, (_, i) => i + 1);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - halfVisible) {
      // Show pages at end with ellipsis at start
      pages = [1, '...'];
      pages.push(
        ...Array.from(
          { length: maxVisiblePages - 2 },
          (_, i) => totalPages - (maxVisiblePages - 3) + i
        )
      );
    } else {
      // Show pages around current with ellipsis on both sides
      pages = [1, '...'];
      pages.push(
        ...Array.from(
          { length: maxVisiblePages - 4 },
          (_, i) => currentPage - Math.floor((maxVisiblePages - 4) / 2) + i
        )
      );
      pages.push('...', totalPages);
    }

    return pages
      .map((page) => {
        if (page === '...') {
          return '<span class="pagination-ellipsis">...</span>';
        }
        return `
                <button class="pagination-btn page-number ${page === currentPage ? 'active' : ''}" 
                        data-page="${page}">${page}</button>
            `;
      })
      .join('');
  }

  bindEvents() {
    // Page navigation buttons
    this.container.querySelectorAll('.pagination-btn:not(.disabled)').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.currentTarget.dataset.page);
        if (page && page !== this.currentPage && this.onPageChange) {
          this.onPageChange(page);
        }
      });
    });

    // Page size selector
    const pageSizeSelect = this.container.querySelector('.page-size-select');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        const newPageSize = parseInt(e.target.value);
        if (newPageSize !== this.pageSize && this.onPageSizeChange) {
          this.onPageSizeChange(newPageSize);
        }
      });
    }

    // Page jump input
    const pageInput = this.container.querySelector('.page-input');
    if (pageInput) {
      pageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const page = parseInt(e.target.value);
          if (
            page >= 1 &&
            page <= this.totalPages &&
            page !== this.currentPage &&
            this.onPageChange
          ) {
            this.onPageChange(page);
          } else {
            e.target.value = this.currentPage; // Reset to current page if invalid
          }
        }
      });

      pageInput.addEventListener('blur', (e) => {
        const page = parseInt(e.target.value);
        if (isNaN(page) || page < 1 || page > this.totalPages) {
          e.target.value = this.currentPage; // Reset to current page if invalid
        }
      });
    }
  }

  getCurrentPage() {
    return this.currentPage;
  }

  getPageSize() {
    return this.pageSize;
  }

  getTotalPages() {
    return this.totalPages;
  }

  getTotalCount() {
    return this.totalCount;
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaginationComponent;
}
