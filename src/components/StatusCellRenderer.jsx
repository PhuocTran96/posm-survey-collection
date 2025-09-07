import React from 'react';

const StatusCellRenderer = ({ value, data, colDef }) => {
  if (!value || !data) return <span>–</span>;

  const { completed, required, status, percentage } = value;
  
  // Color classes for different statuses
  const getStatusColor = (status) => {
    switch (status) {
      case 'complete':
        return 'bg-green-500 text-white';
      case 'partial':
        return 'bg-orange-500 text-white';
      case 'none':
        return 'bg-red-500 text-white';
      case 'not_applicable':
      default:
        return 'bg-gray-300 text-gray-600';
    }
  };

  // Display text based on status
  const getDisplayText = () => {
    if (status === 'not_applicable') return '–';
    if (status === 'complete') return 'Done';
    return `${completed}/${required}`;
  };

  const statusColor = getStatusColor(status);
  const displayText = getDisplayText();

  return (
    <div className="flex items-center justify-center h-full">
      <div className={`px-2 py-1 rounded text-xs font-medium ${statusColor} min-w-16 text-center relative`}>
        {status === 'partial' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-20 rounded-b">
            <div 
              className="h-full bg-white bg-opacity-50 rounded-b transition-all duration-300"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        )}
        {displayText}
      </div>
    </div>
  );
};

export default StatusCellRenderer;