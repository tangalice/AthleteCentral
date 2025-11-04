import React, { useState, useMemo } from 'react';

// Sport-specific test types
const getTestTypesBySport = (sport) => {
  const sportLower = sport?.toLowerCase() || '';
  
  switch (sportLower) {
    case 'rowing':
      return ['All', '2k', '5k', '6k', '30min', '60min'];
    case 'running':
    case 'track':
    case 'cross country':
      return ['All', 'Mile', '5K', '10K', 'Half Marathon', 'Marathon'];
    case 'swimming':
      return ['All', '50 Free', '100 Free', '200 Free', '500 Free', '100 Fly', '200 IM'];
    default:
      return ['All', '2k', '5k', '6k', '30min', '60min']; // default to rowing
  }
};

// Get column configuration by sport
const getColumnsBySport = (sport) => {
  const sportLower = sport?.toLowerCase() || '';
  
  switch (sportLower) {
    case 'rowing':
      return {
        splitLabel: 'Split (/500m)',
        showWatts: true,
        showSplit: true,
      };
    case 'running':
    case 'track':
    case 'cross country':
      return {
        splitLabel: 'Pace (/mile)',
        showWatts: false,
        showSplit: true,
      };
    case 'swimming':
      return {
        splitLabel: 'Pace (/100m)',
        showWatts: false,
        showSplit: true,
      };
    default:
      return {
        splitLabel: 'Split (/500m)',
        showWatts: true,
        showSplit: true,
      };
  }
};

export default function IndividualPerformance({ testData = [], userSport = 'rowing' }) {
  const testTypes = useMemo(() => getTestTypesBySport(userSport), [userSport]);
  const columns = useMemo(() => getColumnsBySport(userSport), [userSport]);
  
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showCompleted, setShowCompleted] = useState(true);
  const [showIncomplete, setShowIncomplete] = useState(true);

  const filteredData = testData.filter((test) => {
    const matchesType = selectedFilter === 'All' || test.testType === selectedFilter;
    const matchesCompletion = 
      (showCompleted && test.completed) || 
      (showIncomplete && !test.completed);
    return matchesType && matchesCompletion;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', padding: '32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Individual Performance
        </h1>
        <p style={{ color: '#6b7280', fontSize: '15px' }}>
          View your test piece results and progress
          {userSport && <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 600 }}>({userSport})</span>}
        </p>
      </div>

      {/* Filters */}
      <div style={{ 
        marginBottom: '24px', 
        backgroundColor: '#f9fafb', 
        padding: '24px', 
        borderRadius: '12px',
        border: '2px solid #e5e7eb'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
          Filters
        </h2>
        
        {/* Test Type Filter */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
            Test Type
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {testTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedFilter(type)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  border: selectedFilter === type ? '2px solid #10b981' : '2px solid #e5e7eb',
                  backgroundColor: selectedFilter === type ? '#10b981' : '#ffffff',
                  color: selectedFilter === type ? '#ffffff' : '#111827',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (selectedFilter !== type) {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedFilter !== type) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Completion Status Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
            Status
          </label>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                style={{ marginRight: '8px', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ color: '#374151', fontSize: '14px' }}>Show Completed</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showIncomplete}
                onChange={(e) => setShowIncomplete(e.target.checked)}
                style={{ marginRight: '8px', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ color: '#374151', fontSize: '14px' }}>Show Incomplete</span>
            </label>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: '12px', 
        overflow: 'hidden',
        border: '2px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#f9fafb' }}>
              <tr>
                <th style={{ 
                  padding: '16px 24px', 
                  textAlign: 'left', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: '#6b7280',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  Status
                </th>
                <th style={{ 
                  padding: '16px 24px', 
                  textAlign: 'left', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: '#6b7280',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  Test Type
                </th>
                <th style={{ 
                  padding: '16px 24px', 
                  textAlign: 'left', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: '#6b7280',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  Distance
                </th>
                <th style={{ 
                  padding: '16px 24px', 
                  textAlign: 'left', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: '#6b7280',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  Time
                </th>
                {columns.showSplit && (
                  <th style={{ 
                    padding: '16px 24px', 
                    textAlign: 'left', 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    color: '#6b7280',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    {columns.splitLabel}
                  </th>
                )}
                {columns.showWatts && (
                  <th style={{ 
                    padding: '16px 24px', 
                    textAlign: 'left', 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    color: '#6b7280',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    Watts
                  </th>
                )}
                <th style={{ 
                  padding: '16px 24px', 
                  textAlign: 'left', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: '#6b7280',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={columns.showWatts && columns.showSplit ? 7 : columns.showSplit ? 6 : 5} style={{ 
                    padding: '40px 24px', 
                    textAlign: 'center', 
                    color: '#9ca3af',
                    fontSize: '15px'
                  }}>
                    No test pieces found matching your filters
                  </td>
                </tr>
              ) : (
                filteredData.map((test) => (
                  <tr
                    key={test.id}
                    style={{ borderBottom: '1px solid #f3f4f6' }}
                  >
                    <td style={{ padding: '16px 24px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: test.completed ? '#d1fae5' : '#fef3c7',
                          color: test.completed ? '#065f46' : '#92400e'
                        }}
                      >
                        {test.completed ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#111827', fontWeight: 600, fontSize: '15px' }}>
                      {test.testType}
                    </td>
                    <td style={{ padding: '16px 24px', color: '#6b7280', fontSize: '14px' }}>
                      {test.distance}
                    </td>
                    <td style={{ padding: '16px 24px', color: '#6b7280', fontFamily: 'monospace', fontSize: '14px' }}>
                      {test.time}
                    </td>
                    {columns.showSplit && (
                      <td style={{ padding: '16px 24px', color: '#6b7280', fontFamily: 'monospace', fontSize: '14px' }}>
                        {test.split || '-'}
                      </td>
                    )}
                    {columns.showWatts && (
                      <td style={{ padding: '16px 24px', color: '#6b7280', fontSize: '14px' }}>
                        {test.watts > 0 ? `${test.watts}W` : '-'}
                      </td>
                    )}
                    <td style={{ padding: '16px 24px', color: '#9ca3af', fontSize: '13px' }}>
                      {new Date(test.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ 
        marginTop: '24px', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px' 
      }}>
        <div style={{ 
          backgroundColor: '#ffffff', 
          padding: '24px', 
          borderRadius: '12px',
          border: '2px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>
            Total Tests
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#111827' }}>
            {testData.length}
          </div>
        </div>
        <div style={{ 
          backgroundColor: '#ffffff', 
          padding: '24px', 
          borderRadius: '12px',
          border: '2px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>
            Completed
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#10b981' }}>
            {testData.filter((t) => t.completed).length}
          </div>
        </div>
        <div style={{ 
          backgroundColor: '#ffffff', 
          padding: '24px', 
          borderRadius: '12px',
          border: '2px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>
            Pending
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#f59e0b' }}>
            {testData.filter((t) => !t.completed).length}
          </div>
        </div>
      </div>
    </div>
  );
}