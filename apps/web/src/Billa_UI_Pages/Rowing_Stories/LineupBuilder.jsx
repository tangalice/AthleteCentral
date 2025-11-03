import React, { useState, useMemo } from 'react';

const TEST_PIECE_TYPES = ['2k', '6k', '500m'];

export default function LineupBuilder() {
  const [selectedTestPiece, setSelectedTestPiece] = useState('2k');
  const [boatSize, setBoatSize] = useState(8);
  const [lineup1, setLineup1] = useState(Array(8).fill(null));
  const [lineup2, setLineup2] = useState(Array(8).fill(null));
  const [availableAthletes] = useState([]);

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
            {availableAthletes.length === 0 ? (
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
                  No athletes loaded
                </p>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Connect to Firebase to load your team's athletes
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