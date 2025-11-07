import React, { useState, useMemo, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const TEST_PIECE_TYPES = ['2k', '6k', '500m'];

export default function LineupBuilder() {
  const [selectedTestPiece, setSelectedTestPiece] = useState('2k');
  const [boatSize, setBoatSize] = useState(8);
  const [lineup1, setLineup1] = useState(Array(8).fill(null));
  const [lineup2, setLineup2] = useState(Array(8).fill(null));
  const [availableAthletes, setAvailableAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch athletes and their test pieces from Firebase
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

        console.log('Fetching team data for lineup builder...');

        // Force token refresh (same as GroupPerformance)
        await currentUser.getIdToken(true);
        console.log('✅ Token refreshed successfully');

        // STEP 1: Get the user's team(s) - same pattern as GroupPerformance
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
          setError('You are not part of any team yet');
          setAvailableAthletes([]);
          setLoading(false);
          return;
        }

        const athleteIds = Array.from(teamMemberIds);

        // STEP 2: Query each user's testPerformances subcollection directly (same as GroupPerformance)
        const perUserBest = {}; // { [userId]: bestSeconds }

        console.log(`Querying test performances for ${selectedTestPiece} from ${athleteIds.length} athletes`);
        
        // Check if current user is a coach
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const isCoach = userDoc.exists() && userDoc.data().role === 'coach';
        
        for (const userId of athleteIds) {
          try {
            // Query the user's testPerformances subcollection directly
            const userPerformancesRef = collection(db, 'users', userId, 'testPerformances');
            const performancesSnapshot = await getDocs(userPerformancesRef);
            
            console.log(`Found ${performancesSnapshot.size} test performances for user ${userId}`);

            performancesSnapshot.forEach((docSnap) => {
              const d = docSnap.data();
              
              console.log('Test performance doc:', {
                userId: userId,
                testType: d.testType,
                testPiece: d.testPiece,
                time: d.time,
                selectedTestPiece: selectedTestPiece
              });
              
              // Filter by test type (field is called testType, not testPiece)
              if (d.testType !== selectedTestPiece) {
                console.log(`Skipping - testType "${d.testType}" doesn't match "${selectedTestPiece}"`);
                return;
              }
              
              // Filter by isPublic if not coach
              if (!isCoach && !d.isPublic) return;
              
              // Convert time to seconds if it's a string
              let timeInSeconds;
              if (typeof d.time === 'number') {
                timeInSeconds = d.time;
              } else if (typeof d.time === 'string' && d.time !== '--:--.-') {
                // Parse "8:00.0" format to seconds
                const parts = d.time.split(':');
                if (parts.length === 2) {
                  const mins = parseInt(parts[0]) || 0;
                  const secs = parseFloat(parts[1]) || 0;
                  timeInSeconds = mins * 60 + secs;
                } else {
                  return; // Invalid format
                }
              } else {
                return; // No valid time
              }
              
              console.log('Converted time:', d.time, '→', timeInSeconds, 'seconds');
              
              // Track best time for this user
              if (perUserBest[userId] === undefined || timeInSeconds < perUserBest[userId]) {
                perUserBest[userId] = timeInSeconds;
              }
            });
          } catch (userError) {
            console.error(`Error fetching test performances for user ${userId}:`, userError);
            // Continue with other users even if one fails
          }
        }

        console.log('Best times per user:', perUserBest);
        
        const userIdsWithResults = Object.keys(perUserBest);
        if (userIdsWithResults.length === 0) {
          console.log('No test results found');
          setError(`No ${selectedTestPiece} test results found for your team.`);
          setAvailableAthletes([]);
          setLoading(false);
          return;
        }

        // STEP 3: Get names for all users that have a result
        const nameMap = {}; // { [uid]: displayName }
        for (const userId of userIdsWithResults) {
          try {
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const ud = userDocSnap.data();
              nameMap[userId] = ud.displayName || ud.name || 'Unknown Athlete';
            }
          } catch (err) {
            console.error(`Error fetching name for user ${userId}:`, err);
            nameMap[userId] = 'Unknown Athlete';
          }
        }

        console.log('Name map:', nameMap);
        
        // STEP 4: Build and sort athletes list
        const athletesData = userIdsWithResults.map(uid => ({
          id: uid,
          name: nameMap[uid] || 'Unknown Athlete',
          testPieces: { [selectedTestPiece]: perUserBest[uid] }
        })).sort((a, b) => perUserBest[a.id] - perUserBest[b.id]);

        console.log('Athletes data:', athletesData);
        
        setAvailableAthletes(athletesData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching team data:', err);
        setError(`Error loading data: ${err.message}`);
        setAvailableAthletes([]);
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [selectedTestPiece]);

  // Handle boat size change
  const handleBoatSizeChange = (newSize) => {
    setBoatSize(newSize);
    setLineup1(Array(newSize).fill(null));
    setLineup2(Array(newSize).fill(null));
  };

  const formatTime = (seconds) => {
    if (!seconds) return '--:--.-';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const calculateAverage = (lineup) => {
    const times = lineup
      .filter(athlete => athlete !== null)
      .map(athlete => athlete.testPieces[selectedTestPiece])
      .filter(time => time !== undefined);
    
    if (times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  };

  const lineup1Average = useMemo(() => calculateAverage(lineup1), [lineup1, selectedTestPiece]);
  const lineup2Average = useMemo(() => calculateAverage(lineup2), [lineup2, selectedTestPiece]);

  // Calculate team average for all athletes
  const teamAverage = useMemo(() => {
    if (availableAthletes.length === 0) return 0;
    
    const allTimes = availableAthletes
      .map(athlete => athlete.testPieces[selectedTestPiece])
      .filter(time => time !== undefined);
    
    if (allTimes.length === 0) return 0;
    return allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
  }, [availableAthletes, selectedTestPiece]);

  const addToLineup = (athlete, lineupNum, position) => {
    const lineup = lineupNum === 1 ? [...lineup1] : [...lineup2];
    lineup[position] = athlete;
    lineupNum === 1 ? setLineup1(lineup) : setLineup2(lineup);
  };

  const removeFromLineup = (lineupNum, position) => {
    const lineup = lineupNum === 1 ? [...lineup1] : [...lineup2];
    lineup[position] = null;
    lineupNum === 1 ? setLineup1(lineup) : setLineup2(lineup);
  };

  const isAthleteInLineup = (athleteId) => {
    // Allow athletes in multiple lineups - always return false
    return false;
  };

  const LineupColumn = ({ lineupNum, lineup, average }) => (
    <div style={{
      flex: 1,
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{
        margin: '0 0 20px 0',
        fontSize: '20px',
        fontWeight: '600',
        color: '#111827'
      }}>
        Lineup {lineupNum}
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {lineup.map((athlete, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '600',
              flexShrink: 0
            }}>
              {index + 1}
            </div>
            {athlete ? (
              <div style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                    {athlete.name}
                  </span>
                  <span style={{ fontSize: '13px', color: '#6b7280', fontFamily: 'monospace' }}>
                    {formatTime(athlete.testPieces[selectedTestPiece])}
                  </span>
                </div>
                <button
                  onClick={() => removeFromLineup(lineupNum, index)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
                >
                  ×
                </button>
              </div>
            ) : (
              <div style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: '2px dashed #d1d5db',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ color: '#9ca3af', fontSize: '14px', fontStyle: 'italic' }}>
                  Empty
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{
        padding: '16px',
        backgroundColor: '#10b981',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ color: 'white', fontSize: '16px', fontWeight: '600' }}>
          Boat Average:
        </span>
        <span style={{ color: 'white', fontSize: '24px', fontWeight: '700', fontFamily: 'monospace' }}>
          {formatTime(average)}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '24px' }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#111827' }}>
            Lineup Builder
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '16px', fontWeight: '500', color: '#374151' }}>
                Boat Size:
              </label>
              <select
                value={boatSize}
                onChange={(e) => handleBoatSizeChange(Number(e.target.value))}
                style={{
                  padding: '8px 16px',
                  fontSize: '16px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#fff',
                  color: '#111827',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value={8}>8+ (Eight)</option>
                <option value={4}>4+ (Four)</option>
                <option value={2}>2- (Pair)</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '16px', fontWeight: '500', color: '#374151' }}>
                Test Piece:
              </label>
              <select
                value={selectedTestPiece}
                onChange={(e) => setSelectedTestPiece(e.target.value)}
                style={{
                  padding: '8px 16px',
                  fontSize: '16px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#fff',
                  color: '#111827',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {TEST_PIECE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Team Average */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          border: '1px solid #86efac',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#166534' }}>
            Team Average ({selectedTestPiece}):
          </span>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#166534', fontFamily: 'monospace' }}>
            {formatTime(teamAverage)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Lineups */}
        <div style={{ flex: 2, display: 'flex', gap: '24px' }}>
          <LineupColumn lineupNum={1} lineup={lineup1} average={lineup1Average} />
          <LineupColumn lineupNum={2} lineup={lineup2} average={lineup2Average} />
        </div>

        {/* Athlete Pool */}
        <div style={{
          flex: 1,
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          maxHeight: 'calc(100vh - 250px)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{
            margin: '0 0 20px 0',
            fontSize: '20px',
            fontWeight: '600',
            color: '#111827'
          }}>
            Available Athletes
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
            flex: 1,
            paddingRight: '8px'
          }}>
            {loading ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>
                  Loading athletes...
                </p>
              </div>
            ) : error ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                textAlign: 'center',
                color: '#dc2626'
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '500' }}>
                  Error
                </p>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  {error}
                </p>
              </div>
            ) : availableAthletes.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '500' }}>
                  No athletes found
                </p>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Make sure athletes are added to your team
                </p>
              </div>
            ) : (
              availableAthletes.map(athlete => {
                const inLineup = isAthleteInLineup(athlete.id);
                const time = athlete.testPieces[selectedTestPiece];
                
                return (
                  <div
                    key={athlete.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: inLineup ? '#f3f4f6' : '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      opacity: inLineup ? 0.5 : 1,
                      cursor: inLineup ? 'not-allowed' : 'default'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {athlete.name}
                      </span>
                      <span style={{ fontSize: '13px', color: '#6b7280', fontFamily: 'monospace' }}>
                        {time ? formatTime(time) : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          if (!inLineup) {
                            const emptyIndex = lineup1.findIndex(a => a === null);
                            if (emptyIndex !== -1) addToLineup(athlete, 1, emptyIndex);
                          }
                        }}
                        disabled={inLineup}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: 'none',
                          borderRadius: '6px',
                          backgroundColor: inLineup ? '#d1d5db' : '#10b981',
                          color: 'white',
                          cursor: inLineup ? 'not-allowed' : 'pointer'
                        }}
                        onMouseOver={(e) => !inLineup && (e.target.style.backgroundColor = '#059669')}
                        onMouseOut={(e) => !inLineup && (e.target.style.backgroundColor = '#10b981')}
                      >
                        → 1
                      </button>
                      <button
                        onClick={() => {
                          if (!inLineup) {
                            const emptyIndex = lineup2.findIndex(a => a === null);
                            if (emptyIndex !== -1) addToLineup(athlete, 2, emptyIndex);
                          }
                        }}
                        disabled={inLineup}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: 'none',
                          borderRadius: '6px',
                          backgroundColor: inLineup ? '#d1d5db' : '#10b981',
                          color: 'white',
                          cursor: inLineup ? 'not-allowed' : 'pointer'
                        }}
                        onMouseOver={(e) => !inLineup && (e.target.style.backgroundColor = '#059669')}
                        onMouseOut={(e) => !inLineup && (e.target.style.backgroundColor = '#10b981')}
                      >
                        → 2
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}