import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

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
      return ['All', '2k', '5k', '6k', '30min', '60min'];
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

export default function GroupPerformance({ user, userRole, userSport = 'rowing' }) {
  const testTypes = useMemo(() => getTestTypesBySport(userSport), [userSport]);
  const columns = useMemo(() => getColumnsBySport(userSport), [userSport]);
  
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTestType, setSelectedTestType] = useState('All');
  const [completionStatus, setCompletionStatus] = useState('All');
  const [sortBy, setSortBy] = useState('time');
  const [sortOrder, setSortOrder] = useState('asc');

  // Fetch team performance data from Firestore
  useEffect(() => {
    const fetchTeamData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('Fetching team data...', { userSport });

        // Query the performances collection
        const performancesRef = collection(db, 'performances');
        
        // Fetch all performances (no filter)
        const querySnapshot = await getDocs(performancesRef);
        
        console.log('Found documents:', querySnapshot.size);

        const performances = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Document data:', doc.id, data);
          
          // Show all performances regardless of sport
          performances.push({
            id: doc.id,
            athleteId: data.userId || data.athleteId,
            athleteName: data.athleteName || 'Unknown Athlete',
            testType: data.testType || data.eventType || 'Unknown',
            time: data.time || '--:--.-',
            split: data.split || '',
            watts: data.watts || 0,
            date: data.date?.toDate?.() || data.date || new Date(),
            sport: data.sport || userSport,
            completed: data.completed !== false && data.time !== '--:--.-',
          });
        });

        console.log('Processed performances:', performances.length);
        setTeamData(performances);
      } catch (err) {
        console.error('Error fetching team data:', err);
        setError(`Failed to load team performance data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [user, userSport]);

  // Filter data by test type and completion status
  const filteredData = teamData.filter((entry) => {
    const matchesTestType = selectedTestType === 'All' || entry.testType === selectedTestType;
    
    let matchesCompletion = true;
    if (completionStatus === 'Complete') {
      matchesCompletion = entry.time !== '--:--.-' && entry.time;
    } else if (completionStatus === 'Incomplete') {
      matchesCompletion = entry.time === '--:--.-' || !entry.time;
    }
    
    return matchesTestType && matchesCompletion;
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'name') {
      comparison = a.athleteName.localeCompare(b.athleteName);
    } else if (sortBy === 'time') {
      const timeToSeconds = (timeStr) => {
        if (timeStr === '--:--.-' || !timeStr) return Infinity;
        const parts = timeStr.split(':');
        const minutes = parseInt(parts[0]);
        const seconds = parseFloat(parts[1]);
        return minutes * 60 + seconds;
      };
      comparison = timeToSeconds(a.time) - timeToSeconds(b.time);
    } else if (sortBy === 'watts') {
      comparison = (a.watts || 0) - (b.watts || 0);
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Calculate rankings
  const rankings = {};
  filteredData.forEach((entry) => {
    if (entry.time !== '--:--.-' && entry.time) {
      if (!rankings[entry.testType]) {
        rankings[entry.testType] = [];
      }
      rankings[entry.testType].push(entry);
    }
  });

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

  const getRank = (entry) => {
    if (entry.time === '--:--.-' || !entry.time) return '-';
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
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  // Calculate stats
  const totalAthletes = new Set(teamData.map(entry => entry.athleteId)).size;
  const completedTests = teamData.filter(entry => entry.time !== '--:--.-' && entry.time).length;
  const incompleteTests = teamData.filter(entry => entry.time === '--:--.-' || !entry.time).length;

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', padding: '32px' }}>
        <div style={{ textAlign: 'center', paddingTop: '100px' }}>
          <p style={{ fontSize: '18px', color: '#6b7280' }}>Loading team performance data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', padding: '32px' }}>
        <div style={{ textAlign: 'center', paddingTop: '100px' }}>
          <p style={{ fontSize: '18px', color: '#ef4444', marginBottom: '10px' }}>{error}</p>
          <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
            Check the browser console for more details
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (teamData.length === 0) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', padding: '32px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
            Team Performance
          </h1>
          <p style={{ color: '#6b7280', fontSize: '15px' }}>
            View and compare team member test piece results
            {userSport && <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 600 }}>({userSport})</span>}
          </p>
        </div>
        <div style={{ 
          textAlign: 'center', 
          paddingTop: '100px',
          backgroundColor: '#f9fafb',
          padding: '60px',
          borderRadius: '12px',
          border: '2px solid #e5e7eb'
        }}>
          <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '10px' }}>
            No performance data found
          </p>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>
            Coaches can add results from the "Enter Results" page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', padding: '32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Team Performance
        </h1>
        <p style={{ color: '#6b7280', fontSize: '15px' }}>
          View and compare team member test piece results
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
        <div style={{ marginBottom: '20px' }}>
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

        {/* Completion Status Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
            Completion Status
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['All', 'Complete', 'Incomplete'].map((status) => (
              <button
                key={status}
                onClick={() => setCompletionStatus(status)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  border: completionStatus === status ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                  backgroundColor: completionStatus === status ? '#3b82f6' : '#ffffff',
                  color: completionStatus === status ? '#ffffff' : '#111827',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (completionStatus !== status) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseOut={(e) => {
                  if (completionStatus !== status) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }
                }}
              >
                {status}
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
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.showWatts && columns.showSplit ? 7 : columns.showSplit ? 6 : 5} style={{ 
                    padding: '40px 24px', 
                    textAlign: 'center', 
                    color: '#9ca3af',
                    fontSize: '15px'
                  }}>
                    No team results found for the selected filters
                  </td>
                </tr>
              ) : (
                sortedData.map((entry, index) => {
                  const rank = getRank(entry);
                  const isTopThree = rank !== '-' && rank <= 3;
                  const isIncomplete = entry.time === '--:--.-' || !entry.time;
                  
                  return (
                    <tr
                      key={entry.id}
                      style={{ 
                        borderBottom: '1px solid #f3f4f6',
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa',
                        opacity: isIncomplete ? 0.6 : 1
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
                      <td style={{ padding: '16px 24px', color: isIncomplete ? '#ef4444' : '#111827', fontFamily: 'monospace', fontSize: '15px', fontWeight: 600 }}>
                        {entry.time || '--:--.-'}
                      </td>
                      {columns.showSplit && (
                        <td style={{ padding: '16px 24px', color: '#6b7280', fontFamily: 'monospace', fontSize: '14px' }}>
                          {entry.split || '-'}
                        </td>
                      )}
                      {columns.showWatts && (
                        <td style={{ padding: '16px 24px', color: '#6b7280', fontSize: '14px' }}>
                          {entry.watts > 0 ? `${entry.watts}W` : '-'}
                        </td>
                      )}
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
        <div style={{ 
          backgroundColor: '#ffffff', 
          padding: '24px', 
          borderRadius: '12px',
          border: '2px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>
            Incomplete Tests
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#ef4444' }}>
            {incompleteTests}
          </div>
        </div>
      </div>
    </div>
  );
}