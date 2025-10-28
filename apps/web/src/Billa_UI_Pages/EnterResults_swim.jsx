// src/Billa_UI_Pages/EnterResults_swim.jsx

import { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function EnterResults_swim({ user }) {
  const [formData, setFormData] = useState({
    athleteId: '',
    athleteName: '',
    eventType: '',
    type: 'practice', // 'practice' or 'competition'
    time: '',
    date: '',
    notes: ''
  });

  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch athletes from the coach's team
  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        // TODO: Replace with actual team query once Teams feature is built
        // For now, fetch all athletes (you'll need to filter by team later)
        const q = query(collection(db, 'users'), where('role', '==', 'athlete'));
        const snapshot = await getDocs(q);
        const athletesList = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().displayName || doc.data().email,
          ...doc.data()
        }));
        setAthletes(athletesList);
      } catch (error) {
        console.error('Error fetching athletes:', error);
      }
    };

    fetchAthletes();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Update athlete name when athlete is selected
    if (name === 'athleteId') {
      const selectedAthlete = athletes.find(a => a.id === value);
      setFormData(prev => ({
        ...prev,
        athleteName: selectedAthlete?.name || ''
      }));
    }
  };

  const validateForm = () => {
    if (!formData.athleteId) {
      setErrorMessage('Please select an athlete');
      return false;
    }
    if (!formData.eventType) {
      setErrorMessage('Please enter an event type');
      return false;
    }
    if (!formData.time) {
      setErrorMessage('Please enter a time');
      return false;
    }
    if (!formData.date) {
      setErrorMessage('Please select a date');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, 'users', formData.athleteId, 'performances'), {
        userId: formData.athleteId,
        athleteName: formData.athleteName,
        eventType: formData.eventType,
        type: formData.type,
        time: parseFloat(formData.time),
        date: Timestamp.fromDate(new Date(formData.date)),
        notes: formData.notes,
        coachId: user.uid,
        coachName: user.displayName || user.email,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      setSuccessMessage(`Result added successfully for ${formData.athleteName}!`);
      
      // Reset form
      setFormData({
        athleteId: '',
        athleteName: '',
        eventType: '',
        type: 'practice',
        time: '',
        date: '',
        notes: ''
      });

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error adding result:', error);
      setErrorMessage('Failed to add result. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ 
        padding: '32px', 
        border: '1px solid #e5e7eb', 
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 600, 
          marginBottom: '8px', 
          color: '#111827' 
        }}>
          Enter Performance Result
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
        </p>

        {successMessage && (
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: '#d1fae5',
            border: '1px solid #10b981',
            borderRadius: '8px',
            color: '#065f46'
          }}>
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#991b1b'
          }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Result Type */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontWeight: 600, 
              fontSize: '14px',
              color: '#374151'
            }}>
              Type *
            </label>
            <select 
              name="type"
              value={formData.type}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="practice">Practice/Training</option>
              <option value="competition">Competition/Meet</option>
            </select>
          </div>

          {/* Athlete Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontWeight: 600, 
              fontSize: '14px',
              color: '#374151'
            }}>
              Athlete *
            </label>
            <select 
              name="athleteId"
              value={formData.athleteId}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="">Select a swimmer...</option>
              {athletes.map(athlete => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.name}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontWeight: 600, 
              fontSize: '14px',
              color: '#374151'
            }}>
              Event *
            </label>
            <input 
              type="text"
              name="eventType"
              value={formData.eventType}
              onChange={handleChange}
              placeholder="e.g., 50 FR, 100 Backstroke, 2k Row"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Time/Score */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontWeight: 600, 
              fontSize: '14px',
              color: '#374151'
            }}>
              Time/Score *
            </label>
            <input 
              type="text"
              name="time"
              value={formData.time}
              onChange={handleChange}
              placeholder="e.g., 23.45 (in seconds)"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Enter time in seconds (e.g., 23.45 for 23.45 seconds)
            </p>
          </div>

          {/* Date */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontWeight: 600, 
              fontSize: '14px',
              color: '#374151'
            }}>
              Date *
            </label>
            <input 
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontWeight: 600, 
              fontSize: '14px',
              color: '#374151'
            }}>
              Notes (Optional)
            </label>
            <textarea 
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional notes about this performance..."
              rows="4"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (!loading) e.target.style.backgroundColor = '#059669';
            }}
            onMouseOut={(e) => {
              if (!loading) e.target.style.backgroundColor = '#10b981';
            }}
          >
            {loading ? 'Adding Result...' : 'Add Result'}
          </button>
        </form>
      </div>
    </div>
  );
}