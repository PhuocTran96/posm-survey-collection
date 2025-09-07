import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import StatusCellRenderer from './StatusCellRenderer';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const POSMDeploymentMatrix = () => {
  const [gridApi, setGridApi] = useState(null);
  const [columnApi, setColumnApi] = useState(null);
  const [rowData, setRowData] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 20
  });
  const [summary, setSummary] = useState(null);

  // API call function
  const fetchMatrixData = useCallback(async (page = 1, limit = 20, search = '') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No authentication token');
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: search
      });

      const response = await fetch(`/api/progress/posm-matrix?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setRowData(result.data.matrix);
        setModels(result.data.models);
        setPagination(result.data.pagination);
        setSummary(result.data.summary);
      } else {
        throw new Error(result.message || 'Failed to fetch matrix data');
      }
    } catch (error) {
      console.error('Error fetching matrix data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchMatrixData();
  }, [fetchMatrixData]);

  // Search handler with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchText !== '') {
        fetchMatrixData(1, pagination.limit, searchText);
      } else {
        fetchMatrixData(1, pagination.limit, '');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchText, pagination.limit, fetchMatrixData]);

  // Column definitions
  const columnDefs = useMemo(() => {
    const fixedColumns = [
      {
        headerName: 'Store',
        field: 'storeName',
        pinned: 'left',
        width: 200,
        cellStyle: { fontWeight: 'bold' },
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        headerName: 'Region',
        field: 'region',
        width: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        headerName: 'Channel',
        field: 'channel',
        width: 100,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        headerName: 'Models',
        field: 'totalModels',
        width: 80,
        type: 'numericColumn',
      },
      {
        headerName: 'Completion',
        field: 'completionRate',
        width: 100,
        type: 'numericColumn',
        valueFormatter: params => `${params.value}%`,
        cellStyle: params => {
          const value = params.value;
          if (value >= 100) return { backgroundColor: '#dcfce7', color: '#166534' };
          if (value >= 50) return { backgroundColor: '#fef3c7', color: '#92400e' };
          if (value > 0) return { backgroundColor: '#fee2e2', color: '#991b1b' };
          return { backgroundColor: '#f1f5f9', color: '#475569' };
        }
      }
    ];

    // Add dynamic model columns
    const modelColumns = models.map(model => ({
      headerName: model,
      field: `posmStatus.${model}`,
      width: 100,
      cellRenderer: StatusCellRenderer,
      sortable: false,
      filter: false,
      cellStyle: { padding: '4px' }
    }));

    return [...fixedColumns, ...modelColumns];
  }, [models]);

  // Grid options
  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true,
  }), []);

  // Grid ready handler
  const onGridReady = useCallback((params) => {
    setGridApi(params.api);
    setColumnApi(params.columnApi);
  }, []);

  // Pagination handlers
  const handlePageChange = (newPage) => {
    fetchMatrixData(newPage, pagination.limit, searchText);
  };

  const handlePageSizeChange = (newLimit) => {
    fetchMatrixData(1, newLimit, searchText);
  };

  // Export handler
  const handleExport = () => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: `posm-matrix-${new Date().toISOString().split('T')[0]}.csv`
      });
    }
  };

  if (loading && !rowData.length) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading matrix data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="text-red-400">⚠️</div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading Matrix</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
            <div className="mt-3">
              <button
                onClick={() => fetchMatrixData()}
                className="bg-red-100 hover:bg-red-200 text-red-800 text-sm px-3 py-1 rounded"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="posm-matrix-container">
      {/* Header Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none flex items-center justify-center">🔍</div>
            <input
              type="text"
              placeholder="Search stores..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
            />
          </div>
          
          <select
            value={pagination.limit}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Export CSV
          </button>
          <button
            onClick={() => fetchMatrixData(pagination.currentPage, pagination.limit, searchText)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-gray-900">{summary.totalStores}</div>
            <div className="text-sm text-gray-600">Total Stores</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-gray-900">{summary.totalModels}</div>
            <div className="text-sm text-gray-600">Total Models</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-blue-600">{Math.round(summary.averageCompletion)}%</div>
            <div className="text-sm text-gray-600">Avg Completion</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-green-600">{summary.statusCounts.complete}</div>
            <div className="text-sm text-gray-600">Complete Stores</div>
          </div>
        </div>
      )}

      {/* AG-Grid */}
      <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
        <AgGridReact
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          suppressPaginationPanel={true}
          suppressScrollOnNewData={true}
          enableCellTextSelection={true}
          animateRows={true}
          loadingOverlayComponent="Loading..."
        />
      </div>

      {/* Custom Pagination */}
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-600">
          Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)} of {pagination.totalCount} stores
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={!pagination.hasPrevPage}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          
          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
            const pageNum = Math.max(1, pagination.currentPage - 2) + i;
            if (pageNum > pagination.totalPages) return null;
            
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 py-1 border text-sm rounded ${
                  pageNum === pagination.currentPage
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={!pagination.hasNextPage}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-700 mb-2">Status Legend:</div>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
            <span>Done - All POSMs completed</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-orange-500 rounded mr-2"></div>
            <span>Partial - Some POSMs completed</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
            <span>None - No POSMs completed</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-300 rounded mr-2"></div>
            <span>N/A - Not applicable</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSMDeploymentMatrix;