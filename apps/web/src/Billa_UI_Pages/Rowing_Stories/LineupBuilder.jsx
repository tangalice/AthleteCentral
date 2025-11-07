import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../firebase'; // Going up to apps/web level
import { collection, collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const TEST_PIECE_TYPES = ['2k', '6k', '500m'];

export default function LineupBuilder({ user }) {
  const [selectedTestPiece, setSelectedTestPiece] = useState('2k');
  const [boatSize, setBoatSize] = useState(8);
  const [lineup1, setLineup1] = useState(Array(8).fill(null));
  const [lineup2, setLineup2] = useState(Array(8).fill(null));
  const [availableAthletes, setAvailableAthletes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch athletes and their test pieces from Firebase
  useEffect(() => {
    const fetchTeamData = async () => {
      if (!user?.teamId) {
        console.log('No teamId found for user');
        setAvailableAthletes([]);
        setLoading(false);
        return;
      }
  
      try {
        setLoading(true);
  
        // 1) Team members
        const teamRef = doc(db, 'teams', user.teamId);
        const teamDoc = await getDoc(teamRef);
        if (!teamDoc.exists()) {
          console.log('Team not found');
          setAvailableAthletes([]);
          setLoading(false);
          return;
        }
        const teamData = teamDoc.data();
        const athleteIds = [...new Set([...(teamData.athletes || []), ...(teamData.members || [])])];
        if (athleteIds.length === 0) {
          setAvailableAthletes([]);
          setLoading(false);
          return;
        }
  
        // 2) Query all testPerformances for this piece in batches
        // You need userId on each testPerformances doc.
        const perUserBest = {}; // { [userId]: bestSeconds }
        const batches = chunk(athleteIds, 10);
  
        for (const batch of batches) {
          // collectionGroup requires import: getDocs, query, where, collectionGroup from 'firebase/firestore'
          // If you don't have collectionGroup imported yet, add it to your imports.
          const isCoach = user?.role === 'coach';
  
          // Build the base constraints
          const constraints = [
            where('userId', 'in', batch),
            where('testPiece', '==', selectedTestPiece),
          ];
          if (!isCoach) constraints.push(where('isPublic', '==', true));
  
          const cg = query(collectionGroup(db, 'testPerformances'), ...constraints);
          const snap = await getDocs(cg);
  
          snap.forEach(docSnap => {
            const d = docSnap.data();
            if (typeof d.time !== 'number') return;
            const uid = d.userId;
            if (perUserBest[uid] === undefined || d.time < perUserBest[uid]) {
              perUserBest[uid] = d.time;
            }
          });
        }
  
        const userIdsWithResults = Object.keys(perUserBest);
        if (userIdsWithResults.length === 0) {
          setAvailableAthletes([]);
          setLoading(false);
          return;
        }
  
        // 3) Get names for all users that have a result (batch by documentId 'in')
        const nameMap = {}; // { [uid]: displayName }
        for (const batch of chunk(userIdsWithResults, 10)) {
          const usersCol = collection(db, 'users');
          const qUsers = query(usersCol, where('__name__', 'in', batch)); // FieldPath.documentId() alias
          const uSnap = await getDocs(qUsers);
          uSnap.forEach(u => {
            const ud = u.data();
            nameMap[u.id] = ud.displayName || ud.name || 'Unknown Athlete';
          });
        }
  
        // 4) Build and sort athletes list
        const athletesData = userIdsWithResults.map(uid => ({
          id: uid,
          name: nameMap[uid] || 'Unknown Athlete',
          testPieces: { [selectedTestPiece]: perUserBest[uid] }
        })).sort((a, b) => perUserBest[a.id] - perUserBest[b.id]);
  
        setAvailableAthletes(athletesData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching team data:', err);
        setAvailableAthletes([]);
        setLoading(false);
      }
    };
  
    fetchTeamData();
  }, [user?.teamId, user?.role, selectedTestPiece]);

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
    return lineup1.some(a => a?.id === athleteId) || lineup2.some(a => a?.id === athleteId);
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