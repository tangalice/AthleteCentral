// src/Billa_UI_Pages/ViewResults.jsx

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export default function ViewResults({ user }) {
  const [filter, setFilter] = useState('all');
  const [practiceResults, setPracticeResults] = useState([]);
  const [competitionResults, setCompetitionResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      if (!user?.uid) return;

      setLoading(true);
      try {
        // Fetch practice results
        const practiceQuery = query(
          collection(db, 'users', user.uid, 'practiceResults'),
          orderBy('date', 'desc')
        );
        const practiceSnapshot = await getDocs(practiceQuery);
        const practiceData = practiceSnapshot.docs.map(doc => ({
          id: doc.id,
          type: 'practice',
          ...doc.data(),
          date: doc.data().date?.toDate() // Convert Firestore Timestamp to Date
        }));

        // Fetch competition results
        const competitionQuery = query(
          collection(db, 'users', user.uid, 'competitionResults'),
          orderBy('date', 'desc')
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        const competitionData = competitionSnapshot.docs.map(doc => ({
          id: doc.id,
          type: 'competition',
          ...doc.data(),
          date: doc.data().date?.toDate()
        }));

        setPracticeResults(practiceData);
        setCompetitionResults(competitionData);
      } catch (error) {
        console.error('Error fetching results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [user]);

  // Combine and filter results
  const getFilteredResults = () => {
    let results = [];
    
    if (filter === 'all') {
      results = [...practiceResults, ...competitionResults];
    } else if (filter === 'practice') {
      results = practiceResults;
    } else if (filter === 'competition') {
      results = competitionResults;
    }

    // Sort by date descending
    return results.sort((a, b) => b.date - a.date);
  };

  const filteredResults = getFilteredResults();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: '#6b7280' }}>Loading your results...</p>
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
        justifyContent: 'center'
      }}>
        <button 
          onClick={() => setFilter('all')}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'all' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'all' ? '#10b981' : 'white',
            color: filter === 'all' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          All Results ({practiceResults.length + competitionResults.length})
        </button>
        <button 
          onClick={() => setFilter('practice')}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'practice' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'practice' ? '#10b981' : 'white',
            color: filter === 'practice' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Practice ({practiceResults.length})
        </button>
        <button 
          onClick={() => setFilter('competition')}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'competition' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'competition' ? '#10b981' : 'white',
            color: filter === 'competition' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Competition ({competitionResults.length})
        </button>
      </div>

      {/* Results Display */}
      {filteredResults.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>
            No {filter === 'all' ? '' : filter} results yet.
          </p>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>
            Your coach will add results here.
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
                  Type
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  {filter === 'practice' ? 'Workout' : 'Event'}
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Result
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result, index) => (
                <tr 
                  key={result.id}
                  style={{ 
                    borderBottom: index < filteredResults.length - 1 ? '1px solid #e5e7eb' : 'none',
                    backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                  }}
                >
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                    {result.date?.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    }) || 'N/A'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: result.type === 'competition' ? '#dbeafe' : '#f3e8ff',
                      color: result.type === 'competition' ? '#1e40af' : '#6b21a8'
                    }}>
                      {result.type === 'competition' ? 'Competition' : 'Practice'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                    {result.type === 'competition' 
                      ? result.eventName || result.competitionName 
                      : result.workoutType || 'N/A'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#10b981' }}>
                    {result.result}
                  </td>
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