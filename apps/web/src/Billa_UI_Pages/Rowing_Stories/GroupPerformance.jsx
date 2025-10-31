import React, { useState } from 'react';

const testTypes = ['All', '2k', '20 min', '30 min', '6k'];

export default function GroupPerformance({ teamData = [] }) {
  const [selectedTestType, setSelectedTestType] = useState('All');
  const [sortBy, setSortBy] = useState('time'); // 'time', 'name', 'watts'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'

  // Filter data by test type
  const filteredData = teamData.filter((entry) => {
    if (selectedTestType === 'All') return true;
    return entry.testType === selectedTestType;
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'name') {
      comparison = a.athleteName.localeCompare(b.athleteName);
    } else if (sortBy === 'time') {
      // Convert time string to seconds for comparison
      const timeToSeconds = (timeStr) => {
        if (timeStr === '--:--.-' || !timeStr) return Infinity;
        const parts = timeStr.split(':');
        const minutes = parseInt(parts[0]);
        const seconds = parseFloat(parts[1]);
        return minutes * 60 + seconds;
      };
      comparison = timeToSeconds(a.time) - timeToSeconds(b.time);
    } else if (sortBy === 'watts') {
      comparison = a.watts - b.watts;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Calculate rankings based on time for current test type
  const rankings = {};
  filteredData.forEach((entry) => {
    if (entry.time !== '--:--.-') {
      if (!rankings[entry.testType]) {
        rankings[entry.testType] = [];
      }
      rankings[entry.testType].push(entry);
    }
  });

  // Sort each test type by time
  Object.keys(rankings).forEach((testType) => {
    rankings[testType].sort((a, b) => {
      const timeToSeconds = (timeStr) => {
        const parts = timeStr.split(':');
        const minutes = parseInt(parts[0]);
        const seconds = parseFloat(parts[1]);
        return minutes * 60 + seconds;
      };
      return timeToSeconds(a.time) - timeToSeconds(b.time);
    });
  });

  // Get rank for an entry
  const getRank = (entry) => {
    if (entry.time === '--:--.-') return '-';
    const typeRankings = rankings[entry.testType];
    if (!typeRankings) return '-';
    const index = typeRankings.findIndex((e) => e.id === entry.id);
    return index !== -1 ? index + 1 : '-';
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ^' : ' V';
  };

  // Calculate stats
  const totalAthletes = new Set(teamData.map(entry => entry.athleteId)).size;
  const completedTests = teamData.filter(entry => entry.time !== '--:--.-').length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', padding: '32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Team Performance
        </h1>
        <p style={{ color: '#6b7280', fontSize: '15px' }}>
          View and compare team member test piece results
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
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
            Test Type
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {testTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedTestType(type)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  border: selectedTestType === type ? '2px solid #10b981' : '2px solid #e5e7eb',
                  backgroundColor: selectedTestType === type ? '#10b981' : '#ffffff',
                  color: selectedTestType === type ? '#ffffff' : '#111827',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (selectedTestType !== type) {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedTestType !== type) {
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
                  Rank
                </th>
                <th 
                  onClick={() => handleSort('name')}
                  style={{ 
                    padding: '16px 24px', 
                    textAlign: 'left', 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    color: '#6b7280',
                    borderBottom: '2px solid #e5e7eb',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  Athlete {getSortIcon('name')}
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
                <th 
                  onClick={() => handleSort('time')}
                  style={{ 
                    padding: '16px 24px', 
                    textAlign: 'left', 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    color: '#6b7280',
                    borderBottom: '2px solid #e5e7eb',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  Time {getSortIcon('time')}
                </th>
                <th style={{ 
                  padding: '16px 24px', 
                  textAlign: 'left', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: '#6b7280',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  Split (/500m)
                </th>
                <th 
                  onClick={() => handleSort('watts')}
                  style={{ 
                    padding: '16px 24px', 
                    textAlign: 'left', 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    color: '#6b7280',
                    borderBottom: '2px solid #e5e7eb',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  Watts {getSortIcon('watts')}
                </th>
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
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ 
                    padding: '40px 24px', 
                    textAlign: 'center', 
                    color: '#9ca3af',
                    fontSize: '15px'
                  }}>
                    No team results found
                  </td>
                </tr>
              ) : (
                sortedData.map((entry, index) => {
                  const rank = getRank(entry);
                  const isTopThree = rank !== '-' && rank <= 3;
                  
                  return (
                    <tr
                      key={entry.id}
                      style={{ 
                        borderBottom: '1px solid #f3f4f6',
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa'
                      }}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '32px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 700,
                            backgroundColor: isTopThree 
                              ? rank === 1 ? '#fef3c7' 
                              : rank === 2 ? '#e5e7eb' 
                              : '#fed7aa' 
                              : 'transparent',
                            color: isTopThree 
                              ? rank === 1 ? '#92400e' 
                              : rank === 2 ? '#374151' 
                              : '#9a3412' 
                              : '#6b7280'
                          }}
                        >
                          {rank}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#111827', fontWeight: 600, fontSize: '15px' }}>
                        {entry.athleteName}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            backgroundColor: '#dbeafe',
                            color: '#1e40af'
                          }}
                        >
                          {entry.testType}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#111827', fontFamily: 'monospace', fontSize: '15px', fontWeight: 600 }}>
                        {entry.time}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#6b7280', fontFamily: 'monospace', fontSize: '14px' }}>
                        {entry.split}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#6b7280', fontSize: '14px' }}>
                        {entry.watts > 0 ? `${entry.watts}W` : '-'}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#9ca3af', fontSize: '13px' }}>
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
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
            Team Members
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#111827' }}>
            {totalAthletes}
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
            Total Tests
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#111827' }}>
            {teamData.length}
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
            Completed Tests
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#10b981' }}>
            {completedTests}
          </div>
        </div>
      </div>
    </div>
  );
}