// src/Billa_UI_Pages/Results.jsx

import EnterResults from './EnterResults';
import ViewResults from './ViewResults';

export default function Results({ user, userRole }) {
  console.log('Results component - user:', user);
  console.log('Results component - userRole:', userRole);
  console.log('Results component - user.role:', user?.role);

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
        <div>
          <p>Loading... (userRole is: {userRole || 'null/undefined'})</p>
        </div>
      )}
    </div>
  );
}