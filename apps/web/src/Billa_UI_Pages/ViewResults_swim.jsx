// src/Billa_UI_Pages/ViewResults_swim.jsx

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export default function ViewResults_swim({ user }) {
  const [filter, setFilter] = useState('all');
  const [practiceResults, setPracticeResults] = useState([]);
  const [competitionResults, setCompetitionResults] = useState([]);
  const [scmResults, setScmResults] = useState([]);
  const [scyResults, setScyResults] = useState([]);
  const [lcmResults, setLcmResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const fetchResults = async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', user.uid, 'performances'),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const allResults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || null
      }));

      const practiceData = allResults.filter(r => r.type === 'practice');
      const competitionData = allResults.filter(r => r.type === 'competition');
      const scmData = allResults.filter(r => r.courseType === 'scm');
      const scyData = allResults.filter(r => r.courseType === 'scy');
      const lcmData = allResults.filter(r => r.courseType === 'lcm');

      setPracticeResults(practiceData);
      setCompetitionResults(competitionData);
      setScmResults(scmData);
      setScyResults(scyData);
      setLcmResults(lcmData);
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
    else if (filter === 'scy') {
      results = scyResults;
    }
    else if (filter === 'scm') {
      results = scmResults;
    }
    else if (filter === 'lcm') {
      results = lcmResults;
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

      <div>
      {/* Filter Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '24px',
        justifyContent: 'center'
      }}>
        <button 
          onClick={() => setFilter('scy')}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'scy' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'scy' ? '#10b981' : 'white',
            color: filter === 'scy' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Short Course Yards (SCY) ({scyResults.length})
        </button>
        <button 
          onClick={() => setFilter('scm')}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'scm' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'scm' ? '#10b981' : 'white',
            color: filter === 'scm' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Short Course Meters (SCM) ({scmResults.length})
        </button>
        <button 
          onClick={() => setFilter('lcm')}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'lcm' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'lcm' ? '#10b981' : 'white',
            color: filter === 'lcm' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Long Course Meters (LCM) ({lcmResults.length})
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

      {/* Type badge */}
      <td style={{ padding: '12px 16px' }}>
        <span
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor:
              result.type === 'competition' ? '#dbeafe' : '#f3e8ff',
            color: result.type === 'competition' ? '#1e40af' : '#6b21a8'
          }}
        >
          {result.type === 'competition' ? 'Competition' : 'Practice'}
        </span>
      </td>

      {/* Event Type */}
      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
        {result.eventType || '—'}
      </td>

      {/* Time / Score */}
      <td
        style={{
          padding: '12px 16px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#10b981'
        }}
      >
        {result.time != null ? `${result.time}s` : '—'}
      </td>

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
    </div>
  );
}