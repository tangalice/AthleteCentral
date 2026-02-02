// src/Billa_UI_Pages/EnterResults.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import TestPerformanceService from '../services/TestPerformanceService';

// Rowing piece configurations - removed 30min, 60min, 2x5k, added Custom
const ROWING_PIECES = {
  '2k': { 
    type: 'distance', 
    distance: 2000, 
    splits: [0.5, 1, 1.5, 2],
    label: '2k'
  },
  '5k': { 
    type: 'distance', 
    distance: 5000, 
    splits: [1, 2, 3, 4, 5],
    label: '5k'
  },
  '6k': { 
    type: 'distance', 
    distance: 6000, 
    splits: [1, 2, 3, 4, 5, 6],
    label: '6k'
  },
  "20'@20": {
    type: 'time',
    duration: 20,
    rate: 20,
    label: "20'@20"
  },
  'Custom': {
    type: 'custom',
    label: 'Custom Workout'
  }
};

const calculateWattsFromSplit = (splitSeconds) => {
  if (!splitSeconds || splitSeconds <= 0 || !isFinite(splitSeconds)) return 0;
  const watts = 2.80 / Math.pow(splitSeconds / 500, 3);
  if (!isFinite(watts) || isNaN(watts)) return 0;
  return Math.round(watts);
};

const timeStringToSeconds = (timeStr) => {
  if (!timeStr || timeStr === '--:--.-' || timeStr === '--:--' || timeStr === '') return 0;
  const timeString = typeof timeStr === 'string' ? timeStr : String(timeStr);
  if (!timeString.includes(':')) return 0;
  try {
    const parts = timeString.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } catch (err) {
    return 0;
  }
};

const secondsToTimeString = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `${minutes}:${seconds.padStart(4, '0')}`;
};

const formatSplit = (splitSeconds) => {
  if (!splitSeconds || splitSeconds <= 0) return '';
  const minutes = Math.floor(splitSeconds / 60);
  const seconds = (splitSeconds % 60).toFixed(1);
  return `${minutes}:${seconds.padStart(4, '0')}`;
};

export default function EnterResults({ user }) {
  const [formData, setFormData] = useState({
    athleteId: '',
    athleteName: '',
    athleteSport: '',
    testType: '',
    date: '',
    notes: '',
    completed: true,
    rate: '',
    distance: '',
    avgSplit: '',
    avgSPM: '',
    totalTime: '',
  });

  const [splits, setSplits] = useState([]);
  
  // Custom workout state
  const [customPieceCount, setCustomPieceCount] = useState(1);
  const [customPieceSplits, setCustomPieceSplits] = useState([]);
  
  const [athleteWeight, setAthleteWeight] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const pieceConfig = useMemo(() => {
    return ROWING_PIECES[formData.testType] || null;
  }, [formData.testType]);

  const isDistancePiece = pieceConfig?.type === 'distance';
  const isTimePiece = pieceConfig?.type === 'time';
  const isCustomPiece = pieceConfig?.type === 'custom';
  const isRowingSport = formData.athleteSport?.toLowerCase() === 'rowing';

  // Calculate custom workout metrics
  const customWorkoutMetrics = useMemo(() => {
    const metrics = {
      avgSplit: '',
      avgSplitSeconds: 0,
      avgWatts: 0,
      wattsPerKg: 0,
      pieceWatts: [],
    };

    if (!isCustomPiece || customPieceSplits.length === 0) return metrics;

    const validSplits = customPieceSplits.filter(s => s && timeStringToSeconds(s) > 0);
    if (validSplits.length === 0) return metrics;

    const totalSeconds = validSplits.reduce((sum, s) => sum + timeStringToSeconds(s), 0);
    metrics.avgSplitSeconds = totalSeconds / validSplits.length;
    metrics.avgSplit = formatSplit(metrics.avgSplitSeconds);
    metrics.avgWatts = calculateWattsFromSplit(metrics.avgSplitSeconds);
    
    // Calculate watts for each piece
    metrics.pieceWatts = customPieceSplits.map(s => {
      const seconds = timeStringToSeconds(s);
      return seconds > 0 ? calculateWattsFromSplit(seconds) : 0;
    });

    if (athleteWeight && athleteWeight > 0) {
      metrics.wattsPerKg = (metrics.avgWatts / athleteWeight).toFixed(2);
    }

    return metrics;
  }, [customPieceSplits, athleteWeight, isCustomPiece]);

  const calculatedMetrics = useMemo(() => {
    const metrics = {
      watts: 0,
      wattsPerKg: 0,
      totalTimeSeconds: 0,
      avgSplitSeconds: 0,
    };

    if (!formData.completed) return metrics;

    // For custom pieces, use the custom workout metrics
    if (isCustomPiece) {
      return {
        ...metrics,
        watts: customWorkoutMetrics.avgWatts,
        wattsPerKg: customWorkoutMetrics.wattsPerKg,
        avgSplitSeconds: customWorkoutMetrics.avgSplitSeconds,
      };
    }

    const avgSplitSeconds = timeStringToSeconds(formData.avgSplit);
    
    if (avgSplitSeconds > 0) {
      metrics.avgSplitSeconds = avgSplitSeconds;
      metrics.watts = calculateWattsFromSplit(avgSplitSeconds);
      
      if (athleteWeight && athleteWeight > 0) {
        metrics.wattsPerKg = (metrics.watts / athleteWeight).toFixed(2);
      }

      if (isDistancePiece && pieceConfig) {
        metrics.totalTimeSeconds = (avgSplitSeconds / 500) * pieceConfig.distance;
      }
    }

    if (formData.totalTime) {
      metrics.totalTimeSeconds = timeStringToSeconds(formData.totalTime);
    }

    return metrics;
  }, [formData.completed, formData.avgSplit, formData.totalTime, athleteWeight, isDistancePiece, isCustomPiece, pieceConfig, customWorkoutMetrics]);

  // Initialize custom piece splits when count changes
  useEffect(() => {
    if (isCustomPiece) {
      setCustomPieceSplits(Array(customPieceCount).fill(''));
    }
  }, [customPieceCount, isCustomPiece]);

  useEffect(() => {
    if (isRowingSport && isDistancePiece && pieceConfig?.splits) {
      const initialSplits = pieceConfig.splits.map(marker => ({
        marker: marker,
        split: '',
        spm: '',
      }));
      setSplits(initialSplits);
    } else {
      setSplits([]);
    }
    
    // Reset custom workout data when test type changes
    if (!isCustomPiece) {
      setCustomPieceCount(1);
      setCustomPieceSplits([]);
    }
  }, [isRowingSport, isDistancePiece, isCustomPiece, pieceConfig, formData.testType]);

  // Fetch athlete's weight for the selected date
  useEffect(() => {
    const fetchAthleteWeight = async () => {
      if (!formData.athleteId || !formData.date) {
        setAthleteWeight(null);
        return;
      }

      try {
        const weightQuery = query(
          collection(db, 'users', formData.athleteId, 'weightData'),
          where('date', '==', formData.date)
        );
        const snapshot = await getDocs(weightQuery);
        
        if (!snapshot.empty) {
          const weightData = snapshot.docs[0].data();
          setAthleteWeight(weightData.weight);
        } else {
          setAthleteWeight(null);
        }
      } catch (error) {
        console.error('Error fetching athlete weight:', error);
        setAthleteWeight(null);
      }
    };

    fetchAthleteWeight();
  }, [formData.athleteId, formData.date]);

  // Auto-calculate avg split from total time for distance pieces
  // THIS IS THE ONLY PLACE avgSplit should be calculated for distance pieces
  useEffect(() => {
    if (isDistancePiece && pieceConfig && formData.totalTime) {
      const totalSeconds = timeStringToSeconds(formData.totalTime);
      if (totalSeconds > 0) {
        const splitSeconds = (totalSeconds / pieceConfig.distance) * 500;
        const calculatedSplit = formatSplit(splitSeconds);
        setFormData(prev => ({ ...prev, avgSplit: calculatedSplit }));
      }
    }
  }, [formData.totalTime, isDistancePiece, pieceConfig]);

  const getTestTypes = (sport) => {
    const sportLower = sport?.toLowerCase() || '';
    switch (sportLower) {
      case 'rowing':
        return ["20'@20", '2k', '5k', '6k', 'Custom'];
      case 'running':
      case 'track':
      case 'cross country':
        return ['Mile', '5K', '10K', 'Half Marathon', 'Marathon'];
      case 'swimming':
        return ['50 Free', '100 Free', '200 Free', '500 Free', '100 Fly', '200 IM'];
      default:
        return ['2k', '5k', '6k'];
    }
  };

  useEffect(() => {
    // Only fetch athletes once when component mounts
    let isMounted = true;
    
    const fetchAthletes = async () => {
      // Skip if we already have athletes loaded
      if (athletes.length > 0) return;
      
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'athlete'));
        const snapshot = await getDocs(q);
        if (isMounted) {
          const athletesList = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().displayName || doc.data().email,
            sport: doc.data().sport || 'Unknown',
            ...doc.data()
          }));
          setAthletes(athletesList);
        }
      } catch (error) {
        console.error('Error fetching athletes:', error);
      }
    };
    
    fetchAthletes();
    
    return () => { isMounted = false; };
  }, []); // Empty dependency array - only run once on mount

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
      if (name === 'completed' && !checked) {
        setFormData(prev => ({
          ...prev,
          avgSplit: '',
          avgSPM: '',
          totalTime: '',
          distance: '',
          rate: '',
        }));
        setSplits(splits.map(s => ({ ...s, split: '', spm: '' })));
        setCustomPieceSplits(Array(customPieceCount).fill(''));
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'athleteId') {
      const selectedAthlete = athletes.find(a => a.id === value);
      if (selectedAthlete) {
        setFormData(prev => ({
          ...prev,
          athleteName: selectedAthlete.name,
          athleteSport: selectedAthlete.sport,
          testType: '',
          avgSplit: '',
          avgSPM: '',
          totalTime: '',
          distance: '',
          rate: '',
        }));
      }
    }

    if (name === 'testType') {
      setFormData(prev => ({
        ...prev,
        avgSplit: '',
        avgSPM: '',
        totalTime: '',
        distance: '',
        rate: ROWING_PIECES[value]?.rate?.toString() || '',
      }));
      // Reset custom workout when changing test type
      setCustomPieceCount(1);
      setCustomPieceSplits(['']);
    }
  };

  const handleCustomPieceCountChange = (e) => {
    const count = Math.min(20, Math.max(1, parseInt(e.target.value) || 1));
    setCustomPieceCount(count);
    setCustomPieceSplits(Array(count).fill(''));
  };

  const handleCustomSplitChange = (index, value) => {
    const newSplits = [...customPieceSplits];
    newSplits[index] = value;
    setCustomPieceSplits(newSplits);
  };

  // FIXED: Individual splits are for detail only - they do NOT affect avgSplit
  // avgSplit is ONLY calculated from totalTime (via the useEffect above)
  const handleSplitChange = (index, field, value) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);

    // Only calculate avgSPM from individual splits (this is fine to average)
    const validSpms = newSplits.filter(s => s.spm && parseInt(s.spm) > 0);
    if (validSpms.length > 0) {
      const avgSpm = Math.round(validSpms.reduce((sum, s) => sum + parseInt(s.spm), 0) / validSpms.length);
      setFormData(prev => ({ ...prev, avgSPM: avgSpm.toString() }));
    }

    // DO NOT recalculate avgSplit from individual splits!
    // avgSplit should ONLY come from totalTime (via the useEffect)
    // Individual splits are just for reference/detail, they don't determine the average
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
    if (!formData.date) {
      setErrorMessage('Please select a date');
      return false;
    }

    if (formData.completed && isRowingSport) {
      if (isTimePiece && !formData.distance) {
        setErrorMessage('Please enter distance covered');
        return false;
      }
      if (isCustomPiece) {
        const validSplits = customPieceSplits.filter(s => s && timeStringToSeconds(s) > 0);
        if (validSplits.length === 0) {
          setErrorMessage('Please enter at least one split for the custom workout');
          return false;
        }
      }
      // For distance pieces, require totalTime instead of avgSplit
      if (isDistancePiece && !formData.totalTime) {
        setErrorMessage('Please enter the total time');
        return false;
      }
      if (!isCustomPiece && !isDistancePiece && !formData.avgSplit) {
        setErrorMessage('Please enter average split');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      console.log('Date being saved:', formData.date);
      
      const performanceData = {
        athleteName: formData.athleteName,
        sport: formData.athleteSport,
        testType: formData.testType,
        date: formData.date,
        completed: formData.completed,
        coachId: user.uid,
        coachName: user.displayName || user.email,
      };

      if (formData.notes) {
        performanceData.notes = formData.notes;
      }

      if (!formData.completed) {
        performanceData.time = '--:--.-';
        performanceData.distance = 0;
        performanceData.split = '--:--.-';
        performanceData.watts = 0;
      }
      else if (isRowingSport) {
        if (isCustomPiece) {
          // Custom workout data
          const validSplits = customPieceSplits.filter(s => s && timeStringToSeconds(s) > 0);
          
          performanceData.isCustomWorkout = true;
          performanceData.customPieceCount = customPieceCount;
          performanceData.splits = customPieceSplits;
          performanceData.avgSplit = customWorkoutMetrics.avgSplit;
          performanceData.split = customWorkoutMetrics.avgSplit;
          performanceData.watts = customWorkoutMetrics.avgWatts;
          performanceData.pieceWatts = customWorkoutMetrics.pieceWatts;
          performanceData.time = customWorkoutMetrics.avgSplit;
          
          // FIX: Set distance to prevent undefined error in Firestore
          // For custom workouts, we estimate distance as 500m per piece
          performanceData.distance = customPieceCount * 500;
          
          if (athleteWeight) {
            performanceData.wattsPerKg = parseFloat(customWorkoutMetrics.wattsPerKg);
            performanceData.athleteWeight = athleteWeight;
          }
        }
        else if (isDistancePiece) {
          performanceData.distance = pieceConfig.distance;
          performanceData.avgSplit = formData.avgSplit;
          performanceData.split = formData.avgSplit;
          performanceData.watts = calculatedMetrics.watts;
          performanceData.totalTime = formData.totalTime || secondsToTimeString(calculatedMetrics.totalTimeSeconds);
          performanceData.time = performanceData.totalTime;
          
          if (formData.avgSPM) {
            performanceData.avgSPM = parseInt(formData.avgSPM);
          }
          if (formData.rate) {
            performanceData.rate = parseInt(formData.rate);
          }
          if (athleteWeight) {
            performanceData.wattsPerKg = parseFloat(calculatedMetrics.wattsPerKg);
            performanceData.athleteWeight = athleteWeight;
          }
          
          const validSplits = splits.filter(s => s.split && s.split.trim() !== '');
          
          if (validSplits.length > 0) {
            performanceData.splits = validSplits.map(s => s.split);
            performanceData.splitsDetailed = validSplits.map(s => ({
              marker: s.marker,
              split: s.split,
              spm: s.spm ? parseInt(s.spm) : null,
            }));
          }
        }
        else if (isTimePiece) {
          if (formData.distance) {
            performanceData.distance = parseInt(formData.distance);
          } else {
            performanceData.distance = 0;
          }
          performanceData.avgSplit = formData.avgSplit;
          performanceData.split = formData.avgSplit;
          performanceData.watts = calculatedMetrics.watts;
          performanceData.time = `${pieceConfig.duration}:00.0`;
          
          if (formData.rate) {
            performanceData.rate = parseInt(formData.rate);
          }
          if (athleteWeight) {
            performanceData.wattsPerKg = parseFloat(calculatedMetrics.wattsPerKg);
            performanceData.athleteWeight = athleteWeight;
          }
        }
      }
      else if (formData.completed) {
        performanceData.time = formData.totalTime || '--:--.-';
        performanceData.distance = 0;
      }

      console.log('Saving performance data:', performanceData);

      const result = await TestPerformanceService.addTestPerformance(
        formData.athleteId,
        performanceData
      );

      if (result.success) {
        const status = formData.completed ? 'completed' : 'incomplete';
        setSuccessMessage(`Test performance marked as ${status} for ${formData.athleteName}!`);
        
        // Keep athlete and date selected for faster multiple entries
        const keepAthleteId = formData.athleteId;
        const keepAthleteName = formData.athleteName;
        const keepAthleteSport = formData.athleteSport;
        const keepDate = formData.date;
        
        setFormData({
          athleteId: keepAthleteId,
          athleteName: keepAthleteName,
          athleteSport: keepAthleteSport,
          testType: '',
          date: keepDate,
          notes: '',
          completed: true,
          rate: '',
          distance: '',
          avgSplit: '',
          avgSPM: '',
          totalTime: '',
        });
        setSplits([]);
        setCustomPieceCount(1);
        setCustomPieceSplits([]);
        // Keep athleteWeight since we're keeping the same athlete and date

        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(result.error || 'Failed to add test performance');
      }
    } catch (error) {
      console.error('Error adding test performance:', error);
      setErrorMessage('Failed to add test performance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const availableTestTypes = formData.athleteSport ? getTestTypes(formData.athleteSport) : [];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{
        padding: '32px',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', color: '#111827' }}>
          Enter Test Performance
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
          Record erg test results for athletes
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
          {/* Row 1: Athlete & Test Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
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

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                Test Type *
              </label>
              <select
                name="testType"
                value={formData.testType}
                onChange={handleChange}
                required
                disabled={!formData.athleteId}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: formData.athleteId ? 'white' : '#f9fafb'
                }}
              >
                <option value="">Select test type...</option>
                {availableTestTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Date & Completion */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="completed"
                  checked={formData.completed}
                  onChange={handleChange}
                  style={{ width: '18px', height: '18px', marginRight: '8px' }}
                />
                <span style={{ fontWeight: 500, color: '#374151' }}>Test Completed</span>
              </label>
            </div>
          </div>

          {/* Rowing-specific entry */}
          {isRowingSport && formData.testType && formData.completed && (
            <div style={{
              padding: '24px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '2px solid #10b981',
              marginBottom: '20px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#065f46' }}>
                {pieceConfig?.label || formData.testType} Results
              </h3>

              {/* Custom Workout Entry */}
              {isCustomPiece && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                      Number of Pieces (1-20) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={customPieceCount}
                      onChange={handleCustomPieceCountChange}
                      style={{
                        width: '120px',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                      Enter Split for Each Piece (/500m)
                    </label>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                      gap: '12px' 
                    }}>
                      {customPieceSplits.map((split, index) => (
                        <div key={index}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#6b7280' }}>
                            Piece {index + 1}
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="text"
                              value={split}
                              onChange={(e) => handleCustomSplitChange(index, e.target.value)}
                              placeholder="1:55.0"
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                boxSizing: 'border-box'
                              }}
                            />
                            {split && timeStringToSeconds(split) > 0 && (
                              <span style={{ 
                                fontSize: '11px', 
                                color: '#6b7280',
                                whiteSpace: 'nowrap'
                              }}>
                                {calculateWattsFromSplit(timeStringToSeconds(split))}W
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom workout calculated metrics */}
                  {customWorkoutMetrics.avgWatts > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                      gap: '12px',
                      padding: '16px',
                      backgroundColor: '#ffffff',
                      borderRadius: '6px',
                      border: '1px solid #d1fae5'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Avg Split</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>
                          {customWorkoutMetrics.avgSplit}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Avg Watts</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                          {customWorkoutMetrics.avgWatts}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>W/kg</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: athleteWeight ? '#10b981' : '#9ca3af' }}>
                          {customWorkoutMetrics.wattsPerKg > 0 ? customWorkoutMetrics.wattsPerKg : '-'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Pieces</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#6b7280' }}>
                          {customPieceSplits.filter(s => s && timeStringToSeconds(s) > 0).length}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Time piece fields */}
              {isTimePiece && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                      Rate
                    </label>
                    <input
                      type="number"
                      name="rate"
                      value={formData.rate}
                      onChange={handleChange}
                      placeholder="20"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                      Distance (m) *
                    </label>
                    <input
                      type="number"
                      name="distance"
                      value={formData.distance}
                      onChange={handleChange}
                      placeholder="7500"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                      Avg Split (/500m) *
                    </label>
                    <input
                      type="text"
                      name="avgSplit"
                      value={formData.avgSplit}
                      onChange={handleChange}
                      placeholder="2:00.0"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Distance piece fields */}
              {isDistancePiece && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                        Total Time *
                      </label>
                      <input
                        type="text"
                        name="totalTime"
                        value={formData.totalTime}
                        onChange={handleChange}
                        placeholder="7:00.0"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #10b981',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          boxSizing: 'border-box',
                          backgroundColor: '#f0fdf4'
                        }}
                      />
                      <p style={{ fontSize: '11px', color: '#065f46', marginTop: '4px' }}>
                        Enter total time - split will calculate automatically
                      </p>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                        Avg Split (/500m)
                      </label>
                      <input
                        type="text"
                        name="avgSplit"
                        value={formData.avgSplit}
                        readOnly
                        placeholder="--:--.-"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          boxSizing: 'border-box',
                          backgroundColor: '#f9fafb',
                          color: '#10b981',
                          fontWeight: 600
                        }}
                      />
                      <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        Calculated from total time
                      </p>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                        Avg SPM
                      </label>
                      <input
                        type="number"
                        name="avgSPM"
                        value={formData.avgSPM}
                        onChange={handleChange}
                        placeholder="28"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                        Rate (if capped)
                      </label>
                      <input
                        type="number"
                        name="rate"
                        value={formData.rate}
                        onChange={handleChange}
                        placeholder="20"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Per-kilometer splits table */}
                  {splits.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>
                        Per-Kilometer Splits (optional - for reference only)
                      </h4>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                        These are individual checkpoint splits. They do not affect the calculated average split.
                      </p>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '6px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f9fafb' }}>
                              {splits.map((s, i) => (
                                <th key={i} colSpan="2" style={{
                                  padding: '8px 12px',
                                  textAlign: 'center',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: '#374151',
                                  borderBottom: '2px solid #e5e7eb',
                                  borderRight: i < splits.length - 1 ? '1px solid #e5e7eb' : 'none'
                                }}>
                                  {s.marker >= 1 ? s.marker + 'k' : (s.marker * 1000) + 'm'}
                                </th>
                              ))}
                            </tr>
                            <tr style={{ backgroundColor: '#f9fafb' }}>
                              {splits.map((s, i) => (
                                <React.Fragment key={`header-${i}`}>
                                  <th style={{
                                    padding: '6px 8px',
                                    textAlign: 'center',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    color: '#6b7280',
                                    borderBottom: '1px solid #e5e7eb'
                                  }}>
                                    Split
                                  </th>
                                  <th style={{
                                    padding: '6px 8px',
                                    textAlign: 'center',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    color: '#6b7280',
                                    borderBottom: '1px solid #e5e7eb',
                                    borderRight: i < splits.length - 1 ? '1px solid #e5e7eb' : 'none'
                                  }}>
                                    SPM
                                  </th>
                                </React.Fragment>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {splits.map((s, i) => (
                                <React.Fragment key={`input-${i}`}>
                                  <td style={{ padding: '8px 4px' }}>
                                    <input
                                      type="text"
                                      value={s.split}
                                      onChange={(e) => handleSplitChange(i, 'split', e.target.value)}
                                      placeholder="1:45.0"
                                      style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        fontFamily: 'monospace',
                                        textAlign: 'center',
                                        boxSizing: 'border-box',
                                        minWidth: '70px'
                                      }}
                                    />
                                  </td>
                                  <td style={{ 
                                    padding: '8px 4px',
                                    borderRight: i < splits.length - 1 ? '1px solid #e5e7eb' : 'none'
                                  }}>
                                    <input
                                      type="number"
                                      value={s.spm}
                                      onChange={(e) => handleSplitChange(i, 'spm', e.target.value)}
                                      placeholder="28"
                                      min="10"
                                      max="50"
                                      style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        textAlign: 'center',
                                        boxSizing: 'border-box',
                                        minWidth: '50px'
                                      }}
                                    />
                                  </td>
                                </React.Fragment>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Calculated metrics display (non-custom) */}
              {!isCustomPiece && formData.avgSplit && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                  gap: '12px',
                  marginTop: '20px',
                  padding: '16px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #d1fae5'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Watts</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                      {calculatedMetrics.watts > 0 ? calculatedMetrics.watts : '-'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>W/kg</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: athleteWeight ? '#10b981' : '#9ca3af' }}>
                      {calculatedMetrics.wattsPerKg > 0 ? calculatedMetrics.wattsPerKg : '-'}
                    </div>
                  </div>
                  {athleteWeight && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Weight</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#6b7280' }}>
                        {athleteWeight} kg
                      </div>
                    </div>
                  )}
                  {isDistancePiece && calculatedMetrics.totalTimeSeconds > 0 && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Total Time</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
                        {secondsToTimeString(calculatedMetrics.totalTimeSeconds)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!athleteWeight && (
                <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '12px' }}>
                  No weight recorded for this athlete on this date. Add weight data to calculate W/kg.
                </p>
              )}
            </div>
          )}

          {/* Non-rowing sports */}
          {!isRowingSport && formData.testType && formData.completed && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                Time *
              </label>
              <input
                type="text"
                name="totalTime"
                value={formData.totalTime}
                onChange={handleChange}
                placeholder="e.g., 6:30.5"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
              Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional notes..."
              rows="3"
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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#9ca3af' : formData.completed ? '#10b981' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Saving...' : formData.completed ? 'Save Test Result' : 'Save Incomplete Test'}
          </button>
        </form>
      </div>
    </div>
  );
}