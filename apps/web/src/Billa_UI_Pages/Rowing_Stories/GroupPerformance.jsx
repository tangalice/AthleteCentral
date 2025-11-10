import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';

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

// Calculate split time from total time and distance
const calculateSplit = (timeStr, testType, sport) => {
  if (!timeStr || timeStr === '--:--.-' || timeStr === '--:--') return null;
  
  const sportLower = sport?.toLowerCase() || '';
  
  // Get distance in meters based on test type
  const getDistanceMeters = (testType) => {
    const testLower = testType?.toLowerCase() || '';
    if (testLower.includes('2k') || testLower === '2k') return 2000;
    if (testLower.includes('5k') || testLower === '5k') return 5000;
    if (testLower.includes('6k') || testLower === '6k') return 6000;
    // For time-based tests, we can't calculate split
    if (testLower.includes('min')) return null;
    return null;
  };
  
  const distanceMeters = getDistanceMeters(testType);
  if (!distanceMeters) return null;
  
  try {
    // Convert time to total seconds
    const timeString = typeof timeStr === 'string' ? timeStr : String(timeStr);
    if (!timeString.includes(':')) return null;
    
    const parts = timeString.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    const totalSeconds = minutes * 60 + seconds;
    
    // Calculate split per 500m (for rowing)
    if (sportLower === 'rowing') {
      const splitSeconds = (totalSeconds / distanceMeters) * 500;
      const splitMinutes = Math.floor(splitSeconds / 60);
      const splitSecs = (splitSeconds % 60).toFixed(1);
      return `${splitMinutes}:${splitSecs.padStart(4, '0')}`;
    }
    
    return null;
  } catch (err) {
    console.error('Error calculating split:', err);
    return null;
  }
};

// Calculate watts from split time (for rowing)
const calculateWatts = (splitStr) => {
  // FIXED: Check for invalid split formats
  if (!splitStr || splitStr === '-' || splitStr === '--:--.-' || splitStr === '--:--') return 0;
  
  try {
    // Convert split time to seconds
    const parts = splitStr.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    const splitSeconds = minutes * 60 + seconds;
    
    // FIXED: Check if splitSeconds is valid (not 0 or NaN)
    if (!splitSeconds || splitSeconds <= 0 || isNaN(splitSeconds)) return 0;
    
    // Watts formula: 2.80 / (pace/500)^3
    const watts = 2.80 / Math.pow(splitSeconds / 500, 3);
    
    // FIXED: Check if result is valid
    if (!isFinite(watts) || isNaN(watts)) return 0;
    
    return Math.round(watts);
  } catch (err) {
    console.error('Error calculating watts:', err);
    return 0;
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
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        setLoading(false);
        setError('No user logged in');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('Fetching team data...', { userSport });

        // Force token refresh
        await currentUser.getIdToken(true);
        console.log('✅ Token refreshed successfully');

        // STEP 1: Get the user's team(s)
        const teamsRef = collection(db, 'teams');
        const teamsQuery = query(teamsRef);
        const teamsSnapshot = await getDocs(teamsQuery);
        
        console.log('Found teams:', teamsSnapshot.size);

        // Find teams where current user is a member
        const userTeams = [];
        const teamMemberIds = new Set();

        teamsSnapshot.forEach((teamDoc) => {
          const teamData = teamDoc.data();
          const members = teamData.members || [];
          const athletes = teamData.athletes || [];
          const coaches = teamData.coaches || [];
          
          // Check if current user is in this team
          if (members.includes(currentUser.uid) || 
              athletes.includes(currentUser.uid) || 
              coaches.includes(currentUser.uid)) {
            
            userTeams.push({
              id: teamDoc.id,
              ...teamData
            });
            
            // Collect all member IDs from this team
            [...members, ...athletes, ...coaches].forEach(id => teamMemberIds.add(id));
          }
        });

        console.log('User teams:', userTeams.length);
        console.log('Team member IDs:', Array.from(teamMemberIds));

        if (teamMemberIds.size === 0) {
          setTeamData([]);
          setLoading(false);
          setError('You are not part of any team yet');
          return;
        }

        // STEP 2: Fetch performances from each user's subcollection
        const performances = [];
        
        // Query each user's testPerformances subcollection
        for (const userId of Array.from(teamMemberIds)) {
          try {
            console.log(`Fetching test performances for user: ${userId}`);
            
            // Get user's name first
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);
            const userName = userDoc.exists() ? 
              (userDoc.data().displayName || userDoc.data().name || 'Unknown Athlete') : 
              'Unknown Athlete';
            
            // Query the user's testPerformances subcollection
            const userPerformancesRef = collection(db, 'users', userId, 'testPerformances');
            const performancesSnapshot = await getDocs(userPerformancesRef);
            
            console.log(`Found ${performancesSnapshot.size} test performances for ${userName}`);

            performancesSnapshot.forEach((doc) => {
              const data = doc.data();
              console.log('Test performance data:', doc.id, data);
              
              // Calculate split from time and test type
              const calculatedSplit = calculateSplit(data.time, data.testType, data.sport || userSport);
              
              // FIXED: Check for ALL invalid split formats
              const isInvalidSplit = !data.split || 
                                     data.split === '--:--.-' || 
                                     data.split === '--:--' ||
                                     data.split === '-' ||
                                     data.split === '';
              
              // Only use stored split if it's valid, otherwise use calculated split
              let split = calculatedSplit;
              if (!isInvalidSplit) {
                split = data.split;
              }
              
              // Calculate watts from split (or use stored watts if valid)
              const calculatedWatts = split ? calculateWatts(split) : 0;
              let watts = calculatedWatts;
              if (data.watts && isFinite(data.watts) && data.watts > 0) {
                watts = data.watts;
              }
              
              // FIXED: Determine if completed - a test is incomplete if time is '--:--.-', '--:--' or missing
              const isIncomplete = !data.time || 
                                   data.time === '--:--.-' || 
                                   data.time === '--:--' || 
                                   data.completed === false;
              const isCompleted = !isIncomplete;
              
              console.log('Test completion check:', {
                id: doc.id,
                time: data.time,
                split: split,
                watts: watts,
                completed: data.completed,
                isCompleted
              });
              
              performances.push({
                id: doc.id,
                athleteId: userId,
                athleteName: userName, // FIXED: Always use the fetched userName
                testType: data.testType || data.eventType || 'Unknown',
                time: data.time || '--:--.-',
                split: split || '-',
                watts: watts,
                date: data.date?.toDate?.() || data.date || new Date(),
                sport: data.sport || userSport,
                completed: isCompleted,
              });
            });
          } catch (userError) {
            console.error(`Error fetching test performances for user ${userId}:`, userError);
            // Continue with other users even if one fails
          }
        }

        console.log('Total processed performances:', performances.length);
        setTeamData(performances);
      } catch (err) {
        console.error('Error fetching team data:', err);
        setError(`Failed to load team performance data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [userSport]);

  // Filter data by test type and completion status
  const filteredData = useMemo(() => {
    console.log('Filtering data:', {
      totalRecords: teamData.length,
      selectedTestType,
      completionStatus
    });
    
    const filtered = teamData.filter((entry) => {
      const matchesTestType = selectedTestType === 'All' || entry.testType === selectedTestType;
      
      let matchesCompletion = true;
      if (completionStatus === 'Complete') {
        matchesCompletion = entry.completed === true;
      } else if (completionStatus === 'Incomplete') {
        matchesCompletion = entry.completed === false;
      }
      // If 'All', matchesCompletion stays true
      
      return matchesTestType && matchesCompletion;
    });
    
    console.log('Filtered results:', filtered.length);
    return filtered;
  }, [teamData, selectedTestType, completionStatus]);

  // Sort data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = a.athleteName.localeCompare(b.athleteName);
      } else if (sortBy === 'time') {
        const timeToSeconds = (timeStr) => {
          // Handle null, undefined, or '--:--.-' or '--:--'
          if (!timeStr || timeStr === '--:--.-' || timeStr === '--:--') return Infinity;
          
          // Convert to string if it's not already
          const timeString = typeof timeStr === 'string' ? timeStr : String(timeStr);
          
          // Check if it contains a colon (mm:ss.s format)
          if (!timeString.includes(':')) return Infinity;
          
          try {
            const parts = timeString.split(':');
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseFloat(parts[1]) || 0;
            return minutes * 60 + seconds;
          } catch (err) {
            console.error('Error parsing time:', timeString, err);
            return Infinity;
          }
        };
        comparison = timeToSeconds(a.time) - timeToSeconds(b.time);
      } else if (sortBy === 'watts') {
        comparison = (a.watts || 0) - (b.watts || 0);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortBy, sortOrder]);

  // Calculate rankings
  const rankings = useMemo(() => {
    const rankingsMap = {};
    filteredData.forEach((entry) => {
      if (entry.completed) {
        if (!rankingsMap[entry.testType]) {
          rankingsMap[entry.testType] = [];
        }
        rankingsMap[entry.testType].push(entry);
      }
    });

    Object.keys(rankingsMap).forEach((testType) => {
      rankingsMap[testType].sort((a, b) => {
        const timeToSeconds = (timeStr) => {
          if (!timeStr || timeStr === '--:--.-' || timeStr === '--:--') return Infinity;
          const timeString = typeof timeStr === 'string' ? timeStr : String(timeStr);
          if (!timeString.includes(':')) return Infinity;
          try {
            const parts = timeString.split(':');
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseFloat(parts[1]) || 0;
            return minutes * 60 + seconds;
          } catch (err) {
            return Infinity;
          }
        };
        return timeToSeconds(a.time) - timeToSeconds(b.time);
      });
    });
    
    return rankingsMap;
  }, [filteredData]);

  const getRank = (entry) => {
    if (!entry.completed) return '-';
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
  const completedTests = teamData.filter(entry => entry.completed).length;
  const incompleteTests = teamData.filter(entry => !entry.completed).length;

  // Handler for completion status with logging
  const handleCompletionStatusChange = (status) => {
    console.log('Completion status changed to:', status);
    setCompletionStatus(status);
  };

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
                onClick={() => handleCompletionStatusChange(status)}
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
                  const isIncomplete = !entry.completed;
                  
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
                          {entry.split !== '-' ? entry.split : '-'}
                        </td>
                      )}
                      {columns.showWatts && (
                        <td style={{ padding: '16px 24px', fontSize: '14px' }}>
                          {entry.watts > 0 ? (
                            <span style={{ 
                              fontWeight: 600,
                              color: '#111827'
                            }}>
                              {entry.watts}W
                            </span>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>-</span>
                          )}
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