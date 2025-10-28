// src/Billa_UI_Pages/Results.jsx

import EnterResults from './EnterResults';
import ViewResults from './ViewResults';
import EnterResults_swim from './EnterResults_swim';
import ViewResults_swim from './ViewResults_swim';

export default function Results({ user, userRole , userSport }) {
  console.log('Results component - user:', user);
  console.log('Results component - userRole:', userRole);
  console.log('Results component - user.role:', user?.role);
  console.log('Results component - userSport:', userSport);

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
      userSport.localeCompare('swimming') === 0 ? (
        <EnterResults_swim user={user} />
      ) : (
        <EnterResults user={user} />
      )
    ) : (userRole === 'athlete') ? (
      userSport.localeCompare('swimming') === 0 ? (
        <ViewResults_swim user={user} />
      ) : (
        <ViewResults user={user} />
      )
    ) : (
      <div>
        <p>Loading... (userRole is: {userRole || 'null/undefined'})</p>
      </div>
    )}
    </div>
  );
}