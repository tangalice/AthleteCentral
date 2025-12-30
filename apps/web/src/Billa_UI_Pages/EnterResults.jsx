// src/Billa_UI_Pages/EnterResults.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import TestPerformanceService from '../services/TestPerformanceService';

// Rowing piece configurations
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
  '30min': { 
    type: 'time', 
    duration: 30, 
    label: "30'"
  },
  '60min': { 
    type: 'time', 
    duration: 60, 
    label: "60'"
  },
  "20'@20": {
    type: 'time',
    duration: 20,
    rate: 20,
    label: "20'@20"
  },
  "30'@20": {
    type: 'time',
    duration: 30,
    rate: 20,
    label: "30'@20"
  },
  "2x5k": {
    type: 'multi',
    pieces: 2,
    distancePerPiece: 5000,
    label: '2x5k'
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
  const [multiPieceData, setMultiPieceData] = useState({
    p1AvgSplit: '',
    p2AvgSplit: '',
    deltaWatts: '',
  });
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
  const isMultiPiece = pieceConfig?.type === 'multi';
  const isRowingSport = formData.athleteSport?.toLowerCase() === 'rowing';

  const calculatedMetrics = useMemo(() => {
    const metrics = {
      watts: 0,
      wattsPerKg: 0,
      totalTimeSeconds: 0,
      avgSplitSeconds: 0,
      p1Watts: 0,
      p2Watts: 0,
      avgWatts: 0,
    };

    if (!formData.completed) return metrics;

    if (isMultiPiece) {
      const p1Seconds = timeStringToSeconds(multiPieceData.p1AvgSplit);
      const p2Seconds = timeStringToSeconds(multiPieceData.p2AvgSplit);
      
      if (p1Seconds > 0) {
        metrics.p1Watts = calculateWattsFromSplit(p1Seconds);
      }
      if (p2Seconds > 0) {
        metrics.p2Watts = calculateWattsFromSplit(p2Seconds);
      }
      if (p1Seconds > 0 && p2Seconds > 0) {
        const avgSplitSeconds = (p1Seconds + p2Seconds) / 2;
        metrics.avgSplitSeconds = avgSplitSeconds;
        metrics.avgWatts = calculateWattsFromSplit(avgSplitSeconds);
        metrics.watts = metrics.avgWatts;
        
        if (athleteWeight && athleteWeight > 0) {
          metrics.wattsPerKg = (metrics.avgWatts / athleteWeight).toFixed(2);
        }
      }
      return metrics;
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
  }, [formData.completed, formData.avgSplit, formData.totalTime, multiPieceData, athleteWeight, isDistancePiece, isMultiPiece, pieceConfig]);

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
    
    setMultiPieceData({
      p1AvgSplit: '',
      p2AvgSplit: '',
      deltaWatts: '',
    });
  }, [isRowingSport, isDistancePiece, pieceConfig, formData.testType]);

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
        return ["20'@20", "30'@20", '2x5k', '2k', '5k', '6k', '30min', '60min'];
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
    const fetchAthletes = async () => {
      try {
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
        setMultiPieceData({ p1AvgSplit: '', p2AvgSplit: '', deltaWatts: '' });
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
    }
  };

  const handleMultiPieceChange = (field, value) => {
    setMultiPieceData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'p1AvgSplit' || field === 'p2AvgSplit') {
      const p1 = field === 'p1AvgSplit' ? value : multiPieceData.p1AvgSplit;
      const p2 = field === 'p2AvgSplit' ? value : multiPieceData.p2AvgSplit;
      
      const p1Seconds = timeStringToSeconds(p1);
      const p2Seconds = timeStringToSeconds(p2);
      
      if (p1Seconds > 0 && p2Seconds > 0) {
        const p1Watts = calculateWattsFromSplit(p1Seconds);
        const p2Watts = calculateWattsFromSplit(p2Seconds);
        const delta = p2Watts - p1Watts;
        setMultiPieceData(prev => ({ ...prev, deltaWatts: delta.toString() }));
        
        const avgSeconds = (p1Seconds + p2Seconds) / 2;
        setFormData(prev => ({ ...prev, avgSplit: formatSplit(avgSeconds) }));
      }
    }
  };

  const handleSplitChange = (index, field, value) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);

    const validSplits = newSplits.filter(s => s.split && timeStringToSeconds(s.split) > 0);
    const validSpms = newSplits.filter(s => s.spm && parseInt(s.spm) > 0);

    if (validSplits.length > 0) {
      const totalSplitSeconds = validSplits.reduce((sum, s) => sum + timeStringToSeconds(s.split), 0);
      const avgSplitSeconds = totalSplitSeconds / validSplits.length;
      setFormData(prev => ({ ...prev, avgSplit: formatSplit(avgSplitSeconds) }));
    }

    if (validSpms.length > 0) {
      const avgSpm = Math.round(validSpms.reduce((sum, s) => sum + parseInt(s.spm), 0) / validSpms.length);
      setFormData(prev => ({ ...prev, avgSPM: avgSpm.toString() }));
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
    if (!formData.date) {
      setErrorMessage('Please select a date');
      return false;
    }

    if (formData.completed && isRowingSport) {
      if (isTimePiece && !formData.distance) {
        setErrorMessage('Please enter distance covered');
        return false;
      }
      if (isMultiPiece && (!multiPieceData.p1AvgSplit || !multiPieceData.p2AvgSplit)) {
        setErrorMessage('Please enter average split for both pieces');
        return false;
      }
      if (!isMultiPiece && !formData.avgSplit) {
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
      // Build performance data
      // IMPORTANT: Store date as the exact string from the input (e.g., "2025-12-23")
      // Do NOT convert to Date object as this causes timezone issues
      console.log('Date being saved:', formData.date); // Debug log
      
      const performanceData = {
        athleteName: formData.athleteName,
        sport: formData.athleteSport,
        testType: formData.testType,
        date: formData.date, // Keep as string like "2025-12-23"
        completed: formData.completed,
        coachId: user.uid,
        coachName: user.displayName || user.email,
      };

      if (formData.notes) {
        performanceData.notes = formData.notes;
      }

      if (!formData.completed) {
        performanceData.time = '--:--.-';
        performanceData.distance = '';
        performanceData.split = '--:--.-';
        performanceData.watts = 0;
      }
      else if (isRowingSport) {
        if (isMultiPiece) {
          performanceData.p1AvgSplit = multiPieceData.p1AvgSplit;
          performanceData.p2AvgSplit = multiPieceData.p2AvgSplit;
          performanceData.p1Watts = calculatedMetrics.p1Watts;
          performanceData.p2Watts = calculatedMetrics.p2Watts;
          performanceData.deltaWatts = parseInt(multiPieceData.deltaWatts) || 0;
          performanceData.avgSplit = formData.avgSplit;
          performanceData.split = formData.avgSplit;
          performanceData.watts = calculatedMetrics.avgWatts;
          performanceData.distance = pieceConfig.distancePerPiece * pieceConfig.pieces;
          performanceData.time = formData.avgSplit;
          // Store splits as array of strings for 2x5k
          performanceData.splits = [multiPieceData.p1AvgSplit, multiPieceData.p2AvgSplit];
          
          if (athleteWeight) {
            performanceData.wattsPerKg = parseFloat(calculatedMetrics.wattsPerKg);
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
          
          // FIXED: Store splits as array of STRINGS for GroupPerformance compatibility
          const validSplits = splits.filter(s => s.split && s.split.trim() !== '');
          console.log('Raw splits:', splits); // Debug
          console.log('Valid splits:', validSplits); // Debug
          
          if (validSplits.length > 0) {
            // Store as simple string array: ["1:45.0", "1:46.0", ...]
            performanceData.splits = validSplits.map(s => s.split);
            console.log('Splits being saved:', performanceData.splits); // Debug
            
            // Also store detailed version for future use
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
      }

      console.log('Saving performance data:', performanceData);

      const result = await TestPerformanceService.addTestPerformance(
        formData.athleteId,
        performanceData
      );

      if (result.success) {
        const status = formData.completed ? 'completed' : 'incomplete';
        setSuccessMessage(`Test performance marked as ${status} for ${formData.athleteName}!`);
        
        setFormData({
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
        setSplits([]);
        setMultiPieceData({ p1AvgSplit: '', p2AvgSplit: '', deltaWatts: '' });
        setAthleteWeight(null);

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

              {/* 2x5k Multi-piece entry */}
              {isMultiPiece && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                        P1 Avg Split (/500m) *
                      </label>
                      <input
                        type="text"
                        value={multiPieceData.p1AvgSplit}
                        onChange={(e) => handleMultiPieceChange('p1AvgSplit', e.target.value)}
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
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                        P2 Avg Split (/500m) *
                      </label>
                      <input
                        type="text"
                        value={multiPieceData.p2AvgSplit}
                        onChange={(e) => handleMultiPieceChange('p2AvgSplit', e.target.value)}
                        placeholder="1:57.0"
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
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                        ΔW (P2 - P1)
                      </label>
                      <input
                        type="text"
                        value={multiPieceData.deltaWatts ? `${multiPieceData.deltaWatts}W` : ''}
                        readOnly
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          backgroundColor: '#f9fafb',
                          color: parseInt(multiPieceData.deltaWatts) < 0 ? '#ef4444' : '#10b981',
                          fontWeight: 600,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {(multiPieceData.p1AvgSplit || multiPieceData.p2AvgSplit) && (
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
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>P1 Watts</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                          {calculatedMetrics.p1Watts > 0 ? calculatedMetrics.p1Watts : '-'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>P2 Watts</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                          {calculatedMetrics.p2Watts > 0 ? calculatedMetrics.p2Watts : '-'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Avg Watts</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>
                          {calculatedMetrics.avgWatts > 0 ? calculatedMetrics.avgWatts : '-'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>W/kg</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: athleteWeight ? '#10b981' : '#9ca3af' }}>
                          {calculatedMetrics.wattsPerKg > 0 ? calculatedMetrics.wattsPerKg : '-'}
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
                        Total Time
                      </label>
                      <input
                        type="text"
                        name="totalTime"
                        value={formData.totalTime || (calculatedMetrics.totalTimeSeconds > 0 ? secondsToTimeString(calculatedMetrics.totalTimeSeconds) : '')}
                        onChange={handleChange}
                        placeholder="7:00.0"
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
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                        Avg Split (/500m) *
                      </label>
                      <input
                        type="text"
                        name="avgSplit"
                        value={formData.avgSplit}
                        onChange={handleChange}
                        placeholder="1:45.0"
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
                        Per-Kilometer Splits (optional)
                      </h4>
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

              {/* Calculated metrics display */}
              {!isMultiPiece && formData.avgSplit && (
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
                  ⚠️ No weight recorded for this athlete on this date. Add weight data to calculate W/kg.
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