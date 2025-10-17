// src/Billa_UI_Pages/ViewResults.jsx

import { useState } from 'react';

export default function ViewResults({ user }) {
  const [filter, setFilter] = useState('all');

  return (
    <div>
      <div style={{ 
        padding: '32px', 
        border: '2px dashed #d1d5db', 
        borderRadius: '12px',
        textAlign: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 600, 
          marginBottom: '16px', 
          color: '#111827' 
        }}>
          View My Results
        </h2>
        <p style={{ color: '#6b7280', fontSize: '16px', marginBottom: '24px' }}>
        </p>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>
          Logged in as: {user?.email}
        </p>
        
        {/* Filter buttons preview */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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
            All Results
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
            Practice
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
            Competition
          </button>
        </div>

        <p style={{ marginTop: '24px', color: '#9ca3af', fontSize: '14px' }}>
          Current filter: <strong>{filter}</strong>
        </p>
      </div>
    </div>
  );
}