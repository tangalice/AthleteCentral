// src/components/Dashboard.jsx
import { useLoaderData } from "react-router-dom";

export default function Dashboard({ userRole, user }) {
  // Data comes from the route's dashboardLoader in App.jsx
  const data = useLoaderData(); // { displayName, role, raw } or null
  const displayName = data?.displayName || user?.email || "";

  return (
    <div style={{ padding: '40px 20px' }}>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '300px',
        color: '#333'
      }}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px', fontWeight: 'normal' }}>
          Welcome back, {displayName}!
        </h2>

        <p style={{ color: '#666', fontSize: '18px', marginBottom: '30px' }}>
          {userRole === 'athlete' ? 'Athlete' : userRole === 'coach' ? 'Coach' : 'User'} Dashboard
        </p>

        {/* Quick Stats Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '30px',
          marginTop: '40px',
          width: '100%',
          maxWidth: '800px'
        }}>
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '30px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ color: '#ff4444', marginBottom: '10px' }}>Training Sessions</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>0</p>
            <p style={{ color: '#666' }}>This Week</p>
          </div>

          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '30px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ color: '#ff4444', marginBottom: '10px' }}>Messages</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>0</p>
            <p style={{ color: '#666' }}>Unread</p>
          </div>

          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '30px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ color: '#ff4444', marginBottom: '10px' }}>Profile</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>
              {data?.raw?.profileComplete ? '✓' : '!'}
            </p>
            <p style={{ color: '#666' }}>
              {data?.raw?.profileComplete ? 'Complete' : 'Incomplete'}
            </p>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div style={{ marginTop: '60px', width: '100%', maxWidth: '800px' }}>
          <h3 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>
            Recent Activity
          </h3>
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '30px',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#999'
          }}>
            <p>No recent activity to display</p>
          </div>
        </div>
      </div>
    </div>
  );
}
