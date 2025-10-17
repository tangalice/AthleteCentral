// src/Billa_UI_Pages/Results.jsx

import EnterResults from './EnterResults';
import ViewResults from './ViewResults';

export default function Results({ user, userRole }) {
  return (
    <div style={{ padding: '24px 0' }}>
      <h1 style={{ 
        fontSize: '32px', 
        fontWeight: 700, 
        marginBottom: '24px', 
        color: '#111827' 
      }}>
        Performance Results
      </h1>
      
      {userRole === 'coach' ? (
        <EnterResults user={user} />
      ) : userRole === 'athlete' ? (
        <ViewResults user={user} />
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}