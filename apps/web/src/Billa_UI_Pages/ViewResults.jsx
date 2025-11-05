// src/Billa_UI_Pages/ViewResults.jsx

import { useState, useEffect } from 'react';
import TestPerformanceService from '../services/TestPerformanceService';

export default function ViewResults({ user }) {
  const [filter, setFilter] = useState('All');
  const [testPerformances, setTestPerformances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      if (!user?.uid) return;

      setLoading(true);
      try {
        const result = await TestPerformanceService.getUserTestPerformances(user.uid);
        
        if (result.success && result.data) {
          setTestPerformances(result.data);
        }
      } catch (error) {
        console.error('Error fetching test performances:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [user]);

  // Get unique test types from data
  const allTestTypes = ['All', ...new Set(testPerformances.map(p => p.testType))];

  // Filter results
  const filteredResults = filter === 'All' 
    ? testPerformances 
    : testPerformances.filter(p => p.testType === filter);

  // Sort by date descending
  const sortedResults = [...filteredResults].sort((a, b) => {
    const dateA = a.date || new Date(0);
    const dateB = b.date || new Date(0);
    return dateB - dateA;
  });

  // Determine if we should show watts column (only for rowing)
  const userSport = testPerformances[0]?.sport?.toLowerCase() || '';
  const showWatts = userSport === 'rowing';

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: '#6b7280' }}>Loading your test results...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {allTestTypes.map(type => (
          <button 
            key={type}
            onClick={() => setFilter(type)}
            style={{ 
              padding: '10px 20px', 
              border: `2px solid ${filter === type ? '#10b981' : '#d1d5db'}`, 
              borderRadius: '6px',
              backgroundColor: filter === type ? '#10b981' : 'white',
              color: filter === type ? 'white' : '#6b7280',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              if (filter !== type) {
                e.target.style.borderColor = '#10b981';
                e.target.style.backgroundColor = '#f9fafb';
              }
            }}
            onMouseOut={(e) => {
              if (filter !== type) {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.backgroundColor = 'white';
              }
            }}
          >
            {type} ({type === 'All' ? testPerformances.length : testPerformances.filter(p => p.testType === type).length})
          </button>
        ))}
      </div>

      {/* Results Display */}
      {sortedResults.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>
            No {filter === 'All' ? '' : filter} test results yet.
          </p>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>
            Your coach will add test results here.
          </p>
        </div>
      ) : (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'white'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Date
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Test Type
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Distance
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Time
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Split/Pace
                </th>
                {showWatts && (
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                    Watts
                  </th>
                )}
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result, index) => (
                <tr
                  key={result.id}
                  style={{
                    borderBottom: index < sortedResults.length - 1 ? '1px solid #e5e7eb' : 'none',
                    backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                  }}
                >
                  {/* Date */}
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                    {result.date
                      ? result.date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      : 'N/A'}
                  </td>

                  {/* Test Type badge */}
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: '#dbeafe',
                        color: '#1e40af'
                      }}
                    >
                      {result.testType}
                    </span>
                  </td>

                  {/* Distance */}
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                    {result.distance || '—'}
                  </td>

                  {/* Time */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#10b981',
                      fontFamily: 'monospace'
                    }}
                  >
                    {result.time || '—'}
                  </td>

                  {/* Split/Pace */}
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280', fontFamily: 'monospace' }}>
                    {result.split || '—'}
                  </td>

                  {/* Watts (rowing only) */}
                  {showWatts && (
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                      {result.watts > 0 ? `${result.watts}W` : '—'}
                    </td>
                  )}

                  {/* Notes */}
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                    {result.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}