// src/components/Resources.jsx

import Resources_athlete from "./Resources_athlete";
import Resources_coach from "./Resources_coach";

export default function Resources({ user, userRole }) {
  console.log('Results component - user:', user);
  console.log('Results component - userRole:', userRole);
  
  return (
    <div style={{ padding: '24px 0' }}>
      <h1 style={{ 
        fontSize: '32px', 
        fontWeight: 700, 
        marginBottom: '24px', 
        color: '#111827' 
      }}>
        Team Resources
      </h1>
      
      {userRole === 'coach' ? (
        <Resources_coach user={user} />
      ) : userRole === 'athlete' ? (
        <Resources_athlete user={user} />
      ) : (
        <div>
          <p>Loading... (userRole is: {userRole || 'null/undefined'})</p>
        </div>
      )}
    </div>
  );
}