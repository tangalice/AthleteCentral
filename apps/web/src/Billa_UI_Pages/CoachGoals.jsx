// src/Billa_UI_Pages/CoachGoals.jsx

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export default function CoachGoals({ user }) {
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athleteGoals, setAthleteGoals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [goalCounts, setGoalCounts] = useState({});

  // Fetch all athletes and their goal counts
  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        const athletesQuery = query(
          collection(db, 'users'),
          where('role', '==', 'athlete')
        );
        const snapshot = await getDocs(athletesQuery);
        const athletesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAthletes(athletesList);

        // Get goal counts for each athlete
        const counts = {};
        for (const athlete of athletesList) {
          const goalsSnapshot = await getDocs(
            collection(db, 'users', athlete.id, 'goalsList')
          );
          counts[athlete.id] = goalsSnapshot.size;
        }
        setGoalCounts(counts);
      } catch (error) {
        console.error('Error fetching athletes:', error);
      }
    };

    fetchAthletes();
  }, []);

  // Fetch selected athlete's goals
  useEffect(() => {
    const fetchAthleteGoals = async () => {
      if (!selectedAthlete) {
        setAthleteGoals([]);
        return;
      }

      setLoading(true);
      try {
        const goalsSnapshot = await getDocs(
          collection(db, 'users', selectedAthlete.id, 'goalsList')
        );
        const goalsData = goalsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          targetDate: doc.data().targetDate?.toDate(),
          createdAt: doc.data().createdAt?.toDate(),
          completedAt: doc.data().completedAt?.toDate()
        }));
        setAthleteGoals(goalsData);
      } catch (error) {
        console.error('Error fetching athlete goals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAthleteGoals();
  }, [selectedAthlete]);

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      await deleteDoc(doc(db, 'users', selectedAthlete.id, 'goalsList', goalId));
      setAthleteGoals(athleteGoals.filter(g => g.id !== goalId));
      setGoalCounts({
        ...goalCounts,
        [selectedAthlete.id]: goalCounts[selectedAthlete.id] - 1
      });
      alert('Goal deleted successfully!');
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Failed to delete goal');
    }
  };

  const filteredGoals = athleteGoals;

  return (
    <div style={{ display: 'flex', gap: '24px', minHeight: '600px' }}>
      {/* Left Sidebar - Athlete List */}
      <div style={{ 
        width: '300px', 
        borderRight: '2px solid #e5e7eb',
        paddingRight: '24px'
      }}>
        <h2 style={{ 
          fontSize: '20px', 
          fontWeight: 600, 
          marginBottom: '16px',
          color: '#111827'
        }}>
          Athletes ({athletes.length})
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {athletes.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '14px' }}>No athletes found</p>
          ) : (
            athletes.map(athlete => (
              <button
                key={athlete.id}
                onClick={() => setSelectedAthlete(athlete)}
                style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  color: '#111827',
                  border: `${selectedAthlete?.id === athlete.id ? '3px' : '2px'} solid ${selectedAthlete?.id === athlete.id ? '#10b981' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: selectedAthlete?.id === athlete.id ? 600 : 400
                }}
                onMouseOver={(e) => {
                  if (selectedAthlete?.id !== athlete.id) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#10b981';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedAthlete?.id !== athlete.id) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      {athlete.displayName || 'Unknown'}
                    </div>
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#6b7280',
                      marginTop: '4px'
                    }}>
                      {athlete.sport || 'No sport'}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {goalCounts[athlete.id] || 0} goals
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Goals Display */}
      <div style={{ flex: 1 }}>
        {!selectedAthlete ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #d1d5db'
          }}>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👈</div>
              <p style={{ color: '#6b7280', fontSize: '18px', fontWeight: 500 }}>
                Select an athlete to view their goals
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Athlete Information Header */}
            <div style={{
              padding: '24px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              marginBottom: '24px',
              border: '2px solid #e5e7eb'
            }}>
              <h1 style={{ 
                fontSize: '28px', 
                fontWeight: 700, 
                marginBottom: '16px',
                color: '#111827'
              }}>
                {selectedAthlete.displayName}'s Goals
              </h1>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                gap: '16px' 
              }}>
                <div>
                  <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
                    Email:
                  </p>
                  <p style={{ fontSize: '14px', color: '#111827' }}>
                    {selectedAthlete.email}
                  </p>
                </div>
                {selectedAthlete.sport && (
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
                      Sport:
                    </p>
                    <p style={{ fontSize: '14px', color: '#111827' }}>
                      {selectedAthlete.sport}
                    </p>
                  </div>
                )}
                {selectedAthlete.school && (
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
                      School:
                    </p>
                    <p style={{ fontSize: '14px', color: '#111827' }}>
                      {selectedAthlete.school}
                    </p>
                  </div>
                )}
                {selectedAthlete.grade && (
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
                      Grade:
                    </p>
                    <p style={{ fontSize: '14px', color: '#111827' }}>
                      {selectedAthlete.grade}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Goals List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <p style={{ color: '#6b7280', fontSize: '18px' }}>Loading goals...</p>
              </div>
            ) : filteredGoals.length === 0 ? (
              <div style={{
                padding: '60px 40px',
                textAlign: 'center',
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                border: '2px solid #e5e7eb'
              }}>
                <p style={{ color: '#6b7280', fontSize: '18px', fontWeight: 500 }}>
                  No goals yet
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {filteredGoals.map(goal => (
                  <div
                    key={goal.id}
                    style={{
                      padding: '24px',
                      backgroundColor: 'white',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: 0 }}>
                            {goal.title}
                          </h3>
                          {goal.category && (
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 600,
                              backgroundColor: '#dbeafe',
                              color: '#1e40af'
                            }}>
                              {goal.category}
                            </span>
                          )}
                          {goal.type === 'suggested' && (
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 600,
                              backgroundColor: '#fef3c7',
                              color: '#92400e'
                            }}>
                              Coach Suggested
                            </span>
                          )}
                          {goal.status === 'completed' && (
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 600,
                              backgroundColor: '#d1fae5',
                              color: '#065f46'
                            }}>
                              Completed
                            </span>
                          )}
                        </div>
                        {goal.description && (
                          <p style={{ color: '#6b7280', fontSize: '15px', marginBottom: '12px', lineHeight: '1.5' }}>
                            {goal.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#9ca3af', flexWrap: 'wrap' }}>
                          {goal.targetDate && (
                            <span>Target: {goal.targetDate.toLocaleDateString()}</span>
                          )}
                          {goal.createdAt && (
                            <span>Created: {goal.createdAt.toLocaleDateString()}</span>
                          )}
                          {goal.completedAt && (
                            <span>Completed: {goal.completedAt.toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}