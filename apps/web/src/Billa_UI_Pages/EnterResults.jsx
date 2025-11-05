// src/Billa_UI_Pages/EnterResults.jsx

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import TestPerformanceService from '../services/TestPerformanceService';

export default function EnterResults({ user }) {
  const [formData, setFormData] = useState({
    athleteId: '',
    athleteName: '',
    athleteSport: '',
    testType: '',
    type: 'practice', // 'practice' or 'competition'
    time: '',
    distance: '',
    date: '',
    notes: ''
  });

  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Get test types based on athlete's sport
  const getTestTypes = (sport) => {
    const sportLower = sport?.toLowerCase() || '';
    switch (sportLower) {
      case 'rowing':
        return ['2k', '5k', '6k', '30min', '60min'];
      case 'running':
      case 'track':
      case 'cross country':
        return ['Mile', '5K', '10K', 'Half Marathon', 'Marathon'];
      case 'swimming':
        return ['50 Free', '100 Free', '200 Free', '500 Free', '100 Fly', '200 IM'];
      default:
        return ['2k', '5k', '6k']; // Default to rowing
    }
  };
  
  // Get distance display based on test type
  const getDistanceForTestType = (testType, sport) => {
    const sportLower = sport?.toLowerCase() || '';
    switch (sportLower) {
      case 'rowing':
        return testType === '2k' ? '2000m' :
               testType === '5k' ? '5000m' :
               testType === '6k' ? '6000m' :
               testType === '30min' ? '30 minutes' :
               testType === '60min' ? '60 minutes' : testType;
      case 'running':
      case 'track':
      case 'cross country':
        return testType === 'Mile' ? '1 mile' :
               testType === '5K' ? '5 kilometers' :
               testType === '10K' ? '10 kilometers' :
               testType === 'Half Marathon' ? '13.1 miles' :
               testType === 'Marathon' ? '26.2 miles' : testType;
      case 'swimming':
        return testType === '50 Free' ? '50 meters' :
               testType === '100 Free' ? '100 meters' :
               testType === '200 Free' ? '200 meters' :
               testType === '500 Free' ? '500 meters' :
               testType === '100 Fly' ? '100 meters' :
               testType === '200 IM' ? '200 meters' : testType;
      default:
        return testType;
    }
  };

  // Fetch athletes from the coach's team
  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        // Fetch all athletes
        const q = query(collection(db, 'users'), where('role', '==', 'athlete'));
        const snapshot = await getDocs(q);
        const athletesList = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().displayName || doc.data().email,
          sport: doc.data().sport || 'Unknown',
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

    // Update athlete info when athlete is selected
    if (name === 'athleteId') {
      const selectedAthlete = athletes.find(a => a.id === value);
      if (selectedAthlete) {
        setFormData(prev => ({
          ...prev,
          athleteName: selectedAthlete.name,
          athleteSport: selectedAthlete.sport,
          testType: '', // Reset test type when changing athlete
          distance: ''
        }));
      }
    }
    
    // Auto-fill distance when test type is selected
    if (name === 'testType' && value) {
      const distance = getDistanceForTestType(value, formData.athleteSport);
      setFormData(prev => ({
        ...prev,
        distance
      }));
    }
  };

  const validateForm = () => {
    if (!formData.athleteId) {
      setErrorMessage('Please select an athlete');
      return false;
    }
    if (!formData.testType) {
      setErrorMessage('Please select a test type');
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
    
    // Validate time format (MM:SS.s)
    const timeRegex = /^\d+:[0-5]\d\.\d$/;
    if (!timeRegex.test(formData.time)) {
      setErrorMessage('Time must be in format MM:SS.s (e.g., 6:30.5)');
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
      // Use TestPerformanceService to add the performance
      const result = await TestPerformanceService.addTestPerformance(
        formData.athleteId,
        {
          athleteName: formData.athleteName,
          sport: formData.athleteSport,
          testType: formData.testType,
          distance: formData.distance,
          time: formData.time,
          completed: true,
          date: new Date(formData.date),
          notes: formData.notes,
          coachId: user.uid,
          coachName: user.displayName || user.email
        }
      );

      if (result.success) {
        setSuccessMessage(`Test performance added successfully for ${formData.athleteName}!`);
        
        // Reset form
        setFormData({
          athleteId: '',
          athleteName: '',
          athleteSport: '',
          testType: '',
          type: 'practice',
          time: '',
          distance: '',
          date: '',
          notes: ''
        });

        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(result.error || 'Failed to add test performance');
      }
    } catch (error) {
      console.error('Error adding test performance:', error);
      setErrorMessage('Failed to add test performance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const availableTestTypes = formData.athleteSport ? getTestTypes(formData.athleteSport) : [];

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
          Enter Test Performance
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
          Add a test piece result for an athlete (works for rowing, swimming, and running)
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
              <option value="">Select an athlete...</option>
              {athletes.map(athlete => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.name} ({athlete.sport})
                </option>
              ))}
            </select>
          </div>

          {/* Test Type - only show if athlete selected */}
          {formData.athleteId && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: 600, 
                fontSize: '14px',
                color: '#374151'
              }}>
                Test Type * ({formData.athleteSport})
              </label>
              <select 
                name="testType"
                value={formData.testType}
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
                <option value="">Select test type...</option>
                {availableTestTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Distance - auto-filled, read-only */}
          {formData.distance && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: 600, 
                fontSize: '14px',
                color: '#374151'
              }}>
                Distance
              </label>
              <input 
                type="text"
                name="distance"
                value={formData.distance}
                readOnly
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#f9fafb',
                  color: '#6b7280'
                }}
              />
            </div>
          )}

          {/* Time/Score */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontWeight: 600, 
              fontSize: '14px',
              color: '#374151'
            }}>
              Time *
            </label>
            <input 
              type="text"
              name="time"
              value={formData.time}
              onChange={handleChange}
              placeholder="e.g., 6:30.5 (MM:SS.s format)"
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
              Enter time in MM:SS.s format (e.g., 6:30.5 for 6 minutes 30.5 seconds)
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
            {loading ? 'Adding Test Performance...' : 'Add Test Performance'}
          </button>
        </form>
      </div>
    </div>
  );
}