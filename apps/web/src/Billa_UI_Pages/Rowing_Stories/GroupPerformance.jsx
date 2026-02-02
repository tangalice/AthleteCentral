import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';

const getTestTypesBySport = (sport) => {
  const sportLower = sport?.toLowerCase() || '';
  switch (sportLower) {
    case 'rowing':
      return ['All', '2k', '5k', '6k', "20'@20", 'Custom'];
    case 'running':
    case 'track':
    case 'cross country':
      return ['All', 'Mile', '5K', '10K', 'Half Marathon', 'Marathon'];
    case 'swimming':
      return ['All', '50 Free', '100 Free', '200 Free', '500 Free', '100 Fly', '200 IM'];
    default:
      return ['All', '2k', '5k', '6k', "20'@20", 'Custom'];
  }
};

const getColumnsBySport = (sport) => {
  const sportLower = sport?.toLowerCase() || '';
  switch (sportLower) {
    case 'rowing':
      return { splitLabel: 'Split (/500m)', showWatts: true, showSplit: true, showWeightAdjusted: true };
    case 'running':
    case 'track':
    case 'cross country':
      return { splitLabel: 'Pace (/mile)', showWatts: false, showSplit: true, showWeightAdjusted: false };
    case 'swimming':
      return { splitLabel: 'Pace (/100m)', showWatts: false, showSplit: true, showWeightAdjusted: false };
    default:
      return { splitLabel: 'Split (/500m)', showWatts: true, showSplit: true, showWeightAdjusted: true };
  }
};

const splitToSeconds = (splitStr) => {
  if (!splitStr || splitStr === '-' || splitStr === '--:--.-' || splitStr === '--:--') return Infinity;
  try {
    const parts = splitStr.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } catch (err) {
    return Infinity;
  }
};

const calculateWatts = (splitStr) => {
  if (!splitStr || splitStr === '-' || splitStr === '--:--.-' || splitStr === '--:--') return 0;
  try {
    const parts = splitStr.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    const splitSeconds = minutes * 60 + seconds;
    if (!splitSeconds || splitSeconds <= 0 || isNaN(splitSeconds)) return 0;
    const watts = 2.80 / Math.pow(splitSeconds / 500, 3);
    if (!isFinite(watts) || isNaN(watts)) return 0;
    return Math.round(watts);
  } catch (err) {
    return 0;
  }
};

// Concept2 Weight Adjustment Formula
// Wf = (weight in lbs / 270) ^ 0.222
// Corrected Time = Wf × Actual Time
// Final Adjusted = Average of Corrected and Actual
// Note: Weight must be converted to lbs if stored in kg
const calculateWeightAdjustedSplit = (splitStr, weightKg) => {
  if (!splitStr || splitStr === '-' || splitStr === '--:--.-' || splitStr === '--:--') return null;
  if (!weightKg || weightKg <= 0) return null;
  
  try {
    const parts = splitStr.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    const splitSeconds = minutes * 60 + seconds;
    if (!splitSeconds || splitSeconds <= 0 || isNaN(splitSeconds)) return null;
    
    // Convert kg to lbs (1 kg = 2.20462 lbs)
    const weightLbs = weightKg * 2.20462;
    
    // Concept2 formula: Wf = (weight_lbs / 270) ^ 0.222
    const weightFactor = Math.pow(weightLbs / 270, 0.222);
    
    // Corrected split = Wf × actual split
    const correctedSeconds = weightFactor * splitSeconds;
    
    // Final adjusted = average of corrected and actual
    const adjustedSeconds = (correctedSeconds + splitSeconds) / 2;
    
    const mins = Math.floor(adjustedSeconds / 60);
    const secs = adjustedSeconds % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
  } catch (err) {
    return null;
  }
};

const calculateWeightAdjustedWatts = (splitStr, weightKg) => {
  const adjustedSplit = calculateWeightAdjustedSplit(splitStr, weightKg);
  if (!adjustedSplit) return null;
  const watts = calculateWatts(adjustedSplit);
  return watts > 0 ? watts : null;
};

const formatDateDisplay = (dateVal, options = { month: 'numeric', day: 'numeric' }) => {
  if (!dateVal) return '-';
  try {
    if (typeof dateVal === 'string') {
      return new Date(dateVal + 'T12:00:00').toLocaleDateString('en-US', options);
    } else if (dateVal instanceof Date) {
      return dateVal.toLocaleDateString('en-US', options);
    } else if (dateVal.toDate) {
      return dateVal.toDate().toLocaleDateString('en-US', options);
    }
    return '-';
  } catch (err) {
    return '-';
  }
};

const getDateString = (dateVal) => {
  if (!dateVal) return '';
  try {
    if (typeof dateVal === 'string') return dateVal;
    if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];
    if (dateVal.toDate) return dateVal.toDate().toISOString().split('T')[0];
    return '';
  } catch (err) {
    return '';
  }
};

const formatDateForInput = (date) => getDateString(date);

// Get unique dates for a specific test type
const getUniqueDatesByTestType = (data, testType) => {
  const dates = new Set();
  data.forEach(entry => {
    if (entry.date) {
      // If testType is 'All', get all dates; otherwise filter by test type
      if (testType === 'All' || entry.testType === testType) {
        const formatted = formatDateForInput(entry.date);
        if (formatted) dates.add(formatted);
      }
    }
  });
  return Array.from(dates).sort((a, b) => new Date(b) - new Date(a));
};

const getCustomWorkoutDates = (data) => {
  const dates = new Set();
  data.forEach(entry => {
    if (entry.testType === 'Custom' && entry.date) {
      const formatted = formatDateForInput(entry.date);
      if (formatted) dates.add(formatted);
    }
  });
  return Array.from(dates).sort((a, b) => new Date(b) - new Date(a));
};

const EditModal = ({ entry, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    time: entry.time || '',
    split: entry.split || '',
    date: getDateString(entry.date) || '',
  });
  const [saving, setSaving] = useState(false);
  const [weight, setWeight] = useState(null);
  const [loadingWeight, setLoadingWeight] = useState(false);

  const calculatedWatts = useMemo(() => calculateWatts(formData.split), [formData.split]);
  const wattsPerKg = useMemo(() => {
    if (weight && calculatedWatts > 0) return (calculatedWatts / weight).toFixed(2);
    return null;
  }, [calculatedWatts, weight]);

  const weightAdjustedSplit = useMemo(() => calculateWeightAdjustedSplit(formData.split, weight), [formData.split, weight]);
  const weightAdjustedWatts = useMemo(() => calculateWeightAdjustedWatts(formData.split, weight), [formData.split, weight]);

  useEffect(() => {
    const fetchWeight = async () => {
      if (!entry.athleteId || !formData.date) { setWeight(null); return; }
      setLoadingWeight(true);
      try {
        const weightQuery = query(collection(db, 'users', entry.athleteId, 'weightData'), where('date', '==', formData.date));
        const snapshot = await getDocs(weightQuery);
        setWeight(!snapshot.empty ? snapshot.docs[0].data().weight : null);
      } catch (error) { setWeight(null); }
      setLoadingWeight(false);
    };
    fetchWeight();
  }, [entry.athleteId, formData.date]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = { time: formData.time, split: formData.split, avgSplit: formData.split, date: formData.date, watts: calculatedWatts };
      if (weight && calculatedWatts > 0) {
        updateData.wattsPerKg = parseFloat(wattsPerKg);
        updateData.athleteWeight = weight;
        updateData.weightAdjustedSplit = weightAdjustedSplit;
        updateData.weightAdjustedWatts = weightAdjustedWatts;
      } else {
        updateData.wattsPerKg = null;
        updateData.athleteWeight = null;
        updateData.weightAdjustedSplit = null;
        updateData.weightAdjustedWatts = null;
      }
      await onSave(entry.athleteId, entry.id, updateData);
      onClose();
    } catch (error) { alert('Error saving: ' + error.message); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>Edit Result</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>
        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{entry.athleteName}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>{entry.testType}</div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Date</label>
          <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Time</label>
          <input type="text" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} placeholder="7:00.0" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Split (/500m)</label>
          <input type="text" value={formData.split} onChange={(e) => setFormData({ ...formData, split: e.target.value })} placeholder="1:45.0" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #10b981' }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Watts</div><div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>{calculatedWatts > 0 ? calculatedWatts : '-'}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Weight</div><div style={{ fontSize: '18px', fontWeight: 700, color: weight ? '#111827' : '#9ca3af' }}>{loadingWeight ? '...' : weight ? `${weight} kg` : '-'}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>W/kg</div><div style={{ fontSize: '18px', fontWeight: 700, color: wattsPerKg ? '#10b981' : '#9ca3af' }}>{wattsPerKg || '-'}</div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #f59e0b' }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px' }}>Wt-Adj Split</div><div style={{ fontSize: '18px', fontWeight: 700, color: weightAdjustedSplit ? '#92400e' : '#9ca3af', fontFamily: 'monospace' }}>{weightAdjustedSplit || '-'}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px' }}>Wt-Adj Watts</div><div style={{ fontSize: '18px', fontWeight: 700, color: weightAdjustedWatts ? '#92400e' : '#9ca3af' }}>{weightAdjustedWatts || '-'}</div></div>
        </div>
        {!weight && formData.date && <p style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '16px' }}>⚠️ No weight recorded for this date.</p>}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '12px', backgroundColor: saving ? '#9ca3af' : '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
};

const DeleteModal = ({ entry, onClose, onConfirm }) => {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try { await onConfirm(entry.athleteId, entry.id); onClose(); } 
    catch (error) { alert('Error deleting: ' + error.message); }
    setDeleting(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><span style={{ fontSize: '24px' }}>🗑️</span></div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Delete Result?</h2>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>Delete result for <strong>{entry.athleteName}</strong>?</p>
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{entry.testType}</div>
            <div style={{ fontSize: '13px', color: '#6b7280', fontFamily: 'monospace' }}>{entry.time} • {entry.split}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '12px', backgroundColor: deleting ? '#9ca3af' : '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer' }}>{deleting ? 'Deleting...' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
};

// UPDATED: Editable Split Breakdown Modal - allows filling in blank splits
const SplitBreakdownModal = ({ entry, onClose, onSave, isCoach }) => {
  if (!entry) return null;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedSplits, setEditedSplits] = useState([]);
  const [saving, setSaving] = useState(false);
  
  const testType = entry.testType?.toLowerCase() || '';
  const isCustom = entry.isCustomWorkout || entry.testType === 'Custom';
  
  // Determine expected number of splits based on test type
  const getExpectedSplitCount = () => {
    if (isCustom) return entry.customPieceCount || entry.splits?.length || 1;
    if (testType === '2k') return 4;
    if (testType === '5k') return 5;
    if (testType === '6k') return 6;
    return entry.splits?.length || 0;
  };
  
  const expectedSplitCount = getExpectedSplitCount();
  
  // Get existing splits, padded with empty strings if needed
  const getDisplaySplits = () => {
    const existingSplits = entry.splits || [];
    const result = [];
    for (let i = 0; i < expectedSplitCount; i++) {
      const split = existingSplits[i];
      result.push(typeof split === 'string' ? split : split?.split || '');
    }
    return result;
  };
  
  const displaySplits = getDisplaySplits();
  
  // Check if any splits are missing/blank
  const hasMissingSplits = displaySplits.some(s => !s || s === '' || s === '-' || s === '--:--.-');
  
  // Initialize edited splits when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditedSplits([...displaySplits]);
    }
  }, [isEditing]);
  
  const getSplitLabels = () => {
    if (isCustom) return Array.from({ length: expectedSplitCount }, (_, i) => `Piece ${i + 1}`);
    if (testType === '2k') return ['500m', '1000m', '1500m', '2000m'];
    if (testType === '5k') return ['1k', '2k', '3k', '4k', '5k'];
    if (testType === '6k') return ['1k', '2k', '3k', '4k', '5k', '6k'];
    return Array.from({ length: expectedSplitCount }, (_, i) => `Split ${i + 1}`);
  };
  const splitLabels = getSplitLabels();

  // Calculate average split from total time (not from averaging individual splits)
  // For distance pieces: avg split = total time / (distance / 500)
  // For custom pieces: average the individual piece splits
  const calculateNewAverage = () => {
    if (isCustom) {
      // For custom workouts, average the individual splits
      const validSplits = editedSplits.filter(s => s && s !== '' && s !== '-' && splitToSeconds(s) !== Infinity);
      if (validSplits.length === 0) return null;
      
      const totalSeconds = validSplits.reduce((sum, s) => sum + splitToSeconds(s), 0);
      const avgSeconds = totalSeconds / validSplits.length;
      
      const mins = Math.floor(avgSeconds / 60);
      const secs = avgSeconds % 60;
      return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
    }
    
    // For distance pieces (2k, 5k, 6k), use the original time-based calculation
    // Don't recalculate from splits - keep the original avg split from total time
    return entry.split || entry.avgSplit || null;
  };

  const handleSplitChange = (index, value) => {
    const newSplits = [...editedSplits];
    newSplits[index] = value;
    setEditedSplits(newSplits);
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      const pieceWatts = editedSplits.map(s => calculateWatts(s));
      
      const updateData = {
        splits: editedSplits,
        pieceWatts: pieceWatts,
      };
      
      // For custom workouts, recalculate the average from splits
      // For distance pieces (2k, 5k, 6k), keep the original avg split (based on total time)
      if (isCustom) {
        const newAvgSplit = calculateNewAverage();
        const newWatts = calculateWatts(newAvgSplit);
        updateData.split = newAvgSplit;
        updateData.avgSplit = newAvgSplit;
        updateData.watts = newWatts;
        
        // Recalculate weight-adjusted values if weight is available
        if (entry.athleteWeight && newWatts > 0) {
          updateData.weightAdjustedSplit = calculateWeightAdjustedSplit(newAvgSplit, entry.athleteWeight);
          updateData.weightAdjustedWatts = calculateWeightAdjustedWatts(newAvgSplit, entry.athleteWeight);
          updateData.wattsPerKg = newWatts / entry.athleteWeight;
        }
      }
      // For distance pieces, don't update split/avgSplit/watts - they're based on total time
      
      await onSave(entry.athleteId, entry.id, updateData);
      setIsEditing(false);
    } catch (error) {
      alert('Error saving splits: ' + error.message);
    }
    setSaving(false);
  };

  // For distance pieces (2k, 5k, 6k), ALWAYS use the original split from total time
  // Only for custom workouts do we calculate from individual splits
  const previewAvgSplit = isCustom && isEditing ? calculateNewAverage() : (entry.split || entry.avgSplit);
  const previewWatts = isCustom && isEditing ? calculateWatts(previewAvgSplit) : entry.watts;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{entry.athleteName}</h2>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                {entry.testType} 
                {isCustom && entry.customPieceCount && ` (${entry.customPieceCount} pieces)`}
                {' • '}
                {formatDateDisplay(entry.date, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9ca3af' }}>×</button>
          </div>
        </div>
        
        {/* Summary metrics - update in real-time when editing */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>{isCustom ? 'PIECES' : 'TIME'}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{isCustom ? (entry.customPieceCount || splits.length) : entry.time}</div>
          </div>
          <div style={{ backgroundColor: isEditing ? '#dbeafe' : '#d1fae5', padding: '12px', borderRadius: '8px', textAlign: 'center', border: isEditing ? '2px solid #3b82f6' : 'none' }}>
            <div style={{ fontSize: '11px', color: isEditing ? '#1e40af' : '#065f46', fontWeight: 600, marginBottom: '4px' }}>AVG SPLIT {isEditing && '(PREVIEW)'}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: isEditing ? '#1e40af' : '#065f46', fontFamily: 'monospace' }}>{previewAvgSplit || '-'}</div>
          </div>
          <div style={{ backgroundColor: isEditing ? '#dbeafe' : '#dbeafe', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600, marginBottom: '4px' }}>WATTS {isEditing && '(PREVIEW)'}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e40af', fontFamily: 'monospace' }}>{previewWatts || '-'}</div>
          </div>
          <div style={{ backgroundColor: entry.wattsPerKg ? '#fef3c7' : '#f3f4f6', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: entry.wattsPerKg ? '#92400e' : '#6b7280', fontWeight: 600, marginBottom: '4px' }}>W/KG</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: entry.wattsPerKg ? '#92400e' : '#9ca3af', fontFamily: 'monospace' }}>{entry.wattsPerKg ? entry.wattsPerKg.toFixed(2) : '-'}</div>
          </div>
        </div>
        
        {entry.weightAdjustedSplit && !isEditing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #f59e0b' }}>
              <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600, marginBottom: '4px' }}>WT-ADJ SPLIT</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#92400e', fontFamily: 'monospace' }}>{entry.weightAdjustedSplit}</div>
            </div>
            <div style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #f59e0b' }}>
              <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600, marginBottom: '4px' }}>WT-ADJ WATTS</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#92400e', fontFamily: 'monospace' }}>{entry.weightAdjustedWatts || '-'}</div>
            </div>
          </div>
        )}
        
        {/* Split breakdown table - editable when in edit mode */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
              {isCustom ? 'Piece Breakdown' : 'Split Breakdown'}
              {hasMissingSplits && !isEditing && (
                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#f59e0b', fontWeight: 500 }}>
                  (some splits missing)
                </span>
              )}
            </h3>
            {isCoach && expectedSplitCount > 0 && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                style={{ 
                  padding: '6px 12px', 
                  backgroundColor: hasMissingSplits ? '#f59e0b' : '#3b82f6', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {hasMissingSplits ? '⚠️ Fill in Splits' : '✏️ Edit Splits'}
              </button>
            )}
          </div>
          
          {expectedSplitCount > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>{isCustom ? 'PIECE' : 'INTERVAL'}</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>SPLIT</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>WATTS</th>
              </tr></thead>
              <tbody>
                {(isEditing ? editedSplits : displaySplits).map((split, index) => {
                  const splitValue = isEditing ? editedSplits[index] : (split || '');
                  const isEmpty = !splitValue || splitValue === '' || splitValue === '-' || splitValue === '--:--.-';
                  const splitWatts = isEditing 
                    ? calculateWatts(editedSplits[index]) 
                    : (entry.pieceWatts?.[index] || calculateWatts(split));
                  
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: isEmpty && !isEditing ? '#fef3c7' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500, color: '#374151' }}>{splitLabels[index] || `Split ${index + 1}`}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedSplits[index] || ''}
                            onChange={(e) => handleSplitChange(index, e.target.value)}
                            placeholder="1:45.0"
                            style={{
                              width: '80px',
                              padding: '6px 8px',
                              border: isEmpty ? '2px solid #f59e0b' : '2px solid #3b82f6',
                              borderRadius: '4px',
                              fontSize: '14px',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              textAlign: 'center',
                              color: '#10b981',
                              backgroundColor: isEmpty ? '#fffbeb' : '#fff'
                            }}
                          />
                        ) : (
                          <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 600, color: isEmpty ? '#f59e0b' : '#10b981' }}>
                            {isEmpty ? '—' : splitValue}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 500, color: '#374151' }}>{splitWatts > 0 ? splitWatts : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '24px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>No split data available for this test type.</div>
          )}
        </div>
        
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {isEditing ? (
            <>
              <button 
                onClick={() => setIsEditing(false)} 
                style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdits} 
                disabled={saving}
                style={{ flex: 1, padding: '12px', backgroundColor: saving ? '#9ca3af' : '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button onClick={onClose} style={{ width: '100%', padding: '12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function GroupPerformance({ user, userRole, userSport }) {
  // If no sport specified, use rowing defaults for display but show all data
  const effectiveSport = userSport || 'rowing';
  
  // Get test types - if no sport, show all common test types
  const testTypes = useMemo(() => {
    if (!userSport) {
      // Show all common test types when no sport filter
      return ['All', '2k', '5k', '6k', "20'@20", 'Custom', 'Mile', '5K', '10K'];
    }
    return getTestTypesBySport(effectiveSport);
  }, [effectiveSport, userSport]);
  
  // Use rowing columns as default (most comprehensive)
  const columns = useMemo(() => getColumnsBySport(effectiveSport), [effectiveSport]);
  
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTestType, setSelectedTestType] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');
  const [selectedCustomDate, setSelectedCustomDate] = useState('All');
  const [completionStatus, setCompletionStatus] = useState('All');
  const [sortBy, setSortBy] = useState('wattsPerKg');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);

  const isCoach = userRole === 'coach';

  const fetchTeamData = async () => {
    const currentUser = auth.currentUser;
    console.log('GroupPerformance - fetchTeamData called');
    console.log('GroupPerformance - currentUser:', currentUser?.uid);
    
    if (!currentUser) { setLoading(false); setError('No user logged in'); return; }
    try {
      setLoading(true);
      setError(null);
      const teamsRef = collection(db, 'teams');
      const teamsSnapshot = await getDocs(query(teamsRef));
      const teamMemberIds = new Set();
      
      console.log('GroupPerformance - teams found:', teamsSnapshot.size);
      
      teamsSnapshot.forEach((teamDoc) => {
        const data = teamDoc.data();
        console.log('GroupPerformance - checking team:', teamDoc.id, data);
        const allMembers = [...(data.members || []), ...(data.athletes || []), ...(data.coaches || [])];
        if (allMembers.includes(currentUser.uid)) {
          console.log('GroupPerformance - user is in team:', teamDoc.id);
          allMembers.forEach(id => teamMemberIds.add(id));
        }
      });
      
      console.log('GroupPerformance - team member IDs:', Array.from(teamMemberIds));
      
      if (teamMemberIds.size === 0) { setTeamData([]); setLoading(false); setError('You are not part of any team yet'); return; }

      const performances = [];
      for (const userId of Array.from(teamMemberIds)) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          const userName = userDoc.exists() ? (userDoc.data().displayName || userDoc.data().name || 'Unknown') : 'Unknown';
          
          const weightSnapshot = await getDocs(collection(db, 'users', userId, 'weightData'));
          const weightsByDate = {};
          weightSnapshot.forEach((weightDoc) => {
            const weightData = weightDoc.data();
            if (weightData.date && weightData.weight) weightsByDate[weightData.date] = weightData.weight;
          });
          
          const performancesSnapshot = await getDocs(collection(db, 'users', userId, 'testPerformances'));
          console.log('GroupPerformance - performances for user', userId, ':', performancesSnapshot.size);
          
          performancesSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const watts = data.watts || calculateWatts(data.split || data.avgSplit);
            let dateValue = data.date;
            if (dateValue?.toDate) dateValue = dateValue.toDate();
            
            const dateString = getDateString(dateValue);
            const athleteWeight = data.athleteWeight || weightsByDate[dateString] || null;
            const split = data.split || data.avgSplit || '-';
            
            const weightAdjustedSplit = athleteWeight ? calculateWeightAdjustedSplit(split, athleteWeight) : null;
            const weightAdjustedWatts = athleteWeight ? calculateWeightAdjustedWatts(split, athleteWeight) : null;
            const wattsPerKg = (athleteWeight && watts > 0) ? watts / athleteWeight : (data.wattsPerKg || null);
            
            performances.push({
              id: docSnap.id,
              athleteId: userId,
              athleteName: userName,
              testType: data.testType || data.eventType || 'Unknown',
              time: data.time || '--:--.-',
              split: split,
              splits: data.splits || [],
              watts: watts,
              wattsPerKg: wattsPerKg,
              athleteWeight: athleteWeight,
              weightAdjustedSplit: weightAdjustedSplit,
              weightAdjustedWatts: weightAdjustedWatts,
              date: dateValue || new Date(),
              completed: data.time && data.time !== '--:--.-' && data.completed !== false,
              isCustomWorkout: data.isCustomWorkout || false,
              customPieceCount: data.customPieceCount || null,
              pieceWatts: data.pieceWatts || [],
            });
          });
        } catch (e) { console.error('Error fetching user ' + userId, e); }
      }
      console.log('GroupPerformance - total performances found:', performances.length);
      console.log('GroupPerformance - performances:', performances);
      setTeamData(performances);
    } catch (err) { 
      console.error('GroupPerformance - fetch error:', err);
      setError('Failed to load: ' + err.message); 
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTeamData(); }, [effectiveSport]);

  // Reset date filter when test type changes
  useEffect(() => {
    setSelectedDate('All');
    if (selectedTestType !== 'Custom') setSelectedCustomDate('All');
  }, [selectedTestType]);

  const handleSaveEdit = async (athleteId, docId, updateData) => {
    try {
      console.log('Saving edit:', { athleteId, docId, updateData });
      await updateDoc(doc(db, 'users', athleteId, 'testPerformances', docId), updateData);
      console.log('Edit saved successfully');
      
      // Update local state immediately for faster UI response
      setTeamData(prev => prev.map(entry => 
        entry.id === docId && entry.athleteId === athleteId 
          ? { ...entry, ...updateData }
          : entry
      ));
      
      // Close the modal
      setSelectedEntry(null);
      
      // Optionally refetch in background (comment out if too slow)
      // fetchTeamData();
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Failed to save: ' + error.message);
    }
  };

  const handleConfirmDelete = async (athleteId, docId) => {
    await deleteDoc(doc(db, 'users', athleteId, 'testPerformances', docId));
    await fetchTeamData();
  };

  // Get available dates filtered by selected test type
  const availableDates = useMemo(() => getUniqueDatesByTestType(teamData, selectedTestType), [teamData, selectedTestType]);
  const customWorkoutDates = useMemo(() => getCustomWorkoutDates(teamData), [teamData]);

  const filteredData = useMemo(() => {
    return teamData.filter((entry) => {
      const matchesTestType = selectedTestType === 'All' || entry.testType === selectedTestType;
      const matchesDate = selectedDate === 'All' || formatDateForInput(entry.date) === selectedDate;
      const matchesCompletion = completionStatus === 'All' || (completionStatus === 'Complete' ? entry.completed : !entry.completed);
      const matchesCustomDate = selectedTestType !== 'Custom' || selectedCustomDate === 'All' || formatDateForInput(entry.date) === selectedCustomDate;
      return matchesTestType && matchesDate && matchesCompletion && matchesCustomDate;
    });
  }, [teamData, selectedTestType, selectedDate, completionStatus, selectedCustomDate]);

  const sortedDataWithGaps = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      if (sortBy === 'wattsPerKg') {
        const aWkg = a.wattsPerKg || 0;
        const bWkg = b.wattsPerKg || 0;
        if (aWkg === 0 && bWkg === 0) return (b.watts || 0) - (a.watts || 0);
        if (aWkg === 0) return 1;
        if (bWkg === 0) return -1;
        return bWkg - aWkg;
      } else if (sortBy === 'weightAdjusted') {
        const aWA = a.weightAdjustedWatts || 0;
        const bWA = b.weightAdjustedWatts || 0;
        if (aWA === 0 && bWA === 0) return (b.watts || 0) - (a.watts || 0);
        if (aWA === 0) return 1;
        if (bWA === 0) return -1;
        return bWA - aWA;
      }
      return splitToSeconds(a.split) - splitToSeconds(b.split);
    });
    
    const leaderWatts = sorted.length > 0 && sorted[0].completed ? (sorted[0].watts || 0) : 0;
    
    return sorted.map((entry, index) => {
      let wattsGapPercent = null;
      if (entry.completed && leaderWatts > 0 && entry.watts > 0) {
        if (index === 0) wattsGapPercent = 0;
        else if (entry.watts === leaderWatts) wattsGapPercent = 0.001;
        else wattsGapPercent = ((leaderWatts - entry.watts) / leaderWatts) * 100;
      }
      return { ...entry, rank: entry.completed ? index + 1 : '-', wattsGapPercent };
    });
  }, [filteredData, sortBy]);

  const teamRecords = useMemo(() => {
    const recordsMap = {};
    teamData.forEach((entry) => {
      if (!entry.completed || !entry.split || entry.split === '-') return;
      if (entry.testType === 'Custom') return;
      const seconds = splitToSeconds(entry.split);
      if (seconds === Infinity) return;
      if (!recordsMap[entry.testType] || seconds < recordsMap[entry.testType].seconds) {
        recordsMap[entry.testType] = { id: entry.id, split: entry.split, seconds, athleteName: entry.athleteName, time: entry.time, wattsPerKg: entry.wattsPerKg, weightAdjustedSplit: entry.weightAdjustedSplit };
      }
    });
    return recordsMap;
  }, [teamData]);

  const isTeamRecord = (entry) => entry.testType !== 'Custom' && teamRecords[entry.testType]?.id === entry.id;
  const totalAthletes = new Set(teamData.map(e => e.athleteId)).size;
  const completedTests = teamData.filter(e => e.completed).length;
  const incompleteTests = teamData.filter(e => !e.completed).length;
  const customWorkouts = teamData.filter(e => e.testType === 'Custom').length;

  if (loading) return <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '32px', textAlign: 'center', paddingTop: '100px' }}><p style={{ fontSize: '18px', color: '#6b7280' }}>Loading team performance data...</p></div>;
  if (error) return <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '32px', textAlign: 'center', paddingTop: '100px' }}><p style={{ fontSize: '18px', color: '#ef4444' }}>{error}</p><button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Retry</button></div>;
  if (teamData.length === 0) return <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '32px' }}><h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Team Performance</h1><div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '2px solid #e5e7eb' }}><p style={{ fontSize: '18px', color: '#6b7280' }}>No performance data found</p></div></div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', padding: '32px' }}>
      {selectedEntry && (
        <SplitBreakdownModal 
          entry={selectedEntry} 
          onClose={() => setSelectedEntry(null)} 
          onSave={handleSaveEdit}
          isCoach={isCoach}
        />
      )}
      {editEntry && <EditModal entry={editEntry} onClose={() => setEditEntry(null)} onSave={handleSaveEdit} />}
      {deleteEntry && <DeleteModal entry={deleteEntry} onClose={() => setDeleteEntry(null)} onConfirm={handleConfirmDelete} />}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Team Performance</h1>
        <p style={{ color: '#6b7280', fontSize: '15px' }}>View and compare test results {effectiveSport && <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 600 }}>({effectiveSport})</span>}</p>
      </div>

      {Object.keys(teamRecords).length > 0 && (
        <div style={{ marginBottom: '24px', backgroundColor: '#fef3c7', padding: '20px', borderRadius: '12px', border: '2px solid #f59e0b' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#92400e' }}>🏆 Team Records</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {Object.entries(teamRecords).map(([testType, record]) => (
              <div key={testType} style={{ backgroundColor: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fcd34d', minWidth: '180px' }}>
                <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600, marginBottom: '4px' }}>{testType}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{record.split}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', fontFamily: 'monospace' }}>({record.time})</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{record.athleteName}</div>
                {record.wattsPerKg && <div style={{ fontSize: '11px', color: '#10b981', marginTop: '2px', fontWeight: 600 }}>{record.wattsPerKg.toFixed(2)} W/kg</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '24px', backgroundColor: '#f9fafb', padding: '20px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Test Type</label>
            <select value={selectedTestType} onChange={e => setSelectedTestType(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '2px solid #e5e7eb', backgroundColor: '#fff', fontSize: '14px', fontWeight: 500, color: '#111827', cursor: 'pointer', minWidth: '140px' }}>
              {testTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          
          {/* Date filter - now shows dates only for the selected test type */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Test Date {selectedTestType !== 'All' && <span style={{ color: '#10b981', fontWeight: 400 }}>(for {selectedTestType})</span>}
            </label>
            <select 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)} 
              style={{ 
                padding: '10px 14px', 
                borderRadius: '8px', 
                border: selectedDate !== 'All' ? '2px solid #10b981' : '2px solid #e5e7eb', 
                backgroundColor: selectedDate !== 'All' ? '#d1fae5' : '#fff', 
                fontSize: '14px', 
                fontWeight: 500, 
                color: '#111827', 
                cursor: 'pointer', 
                minWidth: '180px' 
              }}
            >
              <option value="All">All Dates</option>
              {availableDates.map(date => (
                <option key={date} value={date}>
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </select>
            {selectedTestType !== 'All' && selectedDate === 'All' && (
              <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px', fontWeight: 500 }}>
                ⚠️ Select a date to compare {selectedTestType} tests from the same day
              </p>
            )}
          </div>
          
          {selectedTestType === 'Custom' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#7c3aed', marginBottom: '6px' }}>Custom Workout Date</label>
              <select value={selectedCustomDate} onChange={e => setSelectedCustomDate(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '2px solid #8b5cf6', backgroundColor: '#f5f3ff', fontSize: '14px', fontWeight: 500, color: '#111827', cursor: 'pointer', minWidth: '160px' }}>
                <option value="All">All Custom Workouts</option>
                {customWorkoutDates.map(date => <option key={date} value={date}>{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</option>)}
              </select>
            </div>
          )}
          
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Status</label>
            <select value={completionStatus} onChange={e => setCompletionStatus(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '2px solid #e5e7eb', backgroundColor: '#fff', fontSize: '14px', fontWeight: 500, color: '#111827', cursor: 'pointer', minWidth: '140px' }}>
              <option value="All">All</option>
              <option value="Complete">Complete</option>
              <option value="Incomplete">Incomplete</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Sort By</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '2px solid #e5e7eb', backgroundColor: '#fff', fontSize: '14px', fontWeight: 500, color: '#111827', cursor: 'pointer', minWidth: '150px' }}>
              <option value="wattsPerKg">W/kg (High→Low)</option>
              <option value="split">Split (Fast→Slow)</option>
              {columns.showWeightAdjusted && <option value="weightAdjusted">Wt-Adj (High→Low)</option>}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', padding: '10px 16px', backgroundColor: '#fff', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Showing <span style={{ fontWeight: 700, color: '#111827' }}>{sortedDataWithGaps.length}</span> results</span>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', border: '2px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '50px' }}>Rank</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase' }}>Athlete</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '80px' }}>Test</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '80px' }}>Time</th>
                {columns.showSplit && <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '80px' }}>Split</th>}
                {columns.showWatts && <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '60px' }}>Watts</th>}
                {columns.showWatts && <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '60px' }}>W/kg</th>}
                {columns.showWeightAdjusted && <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#f59e0b', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '80px', backgroundColor: '#fffbeb' }}>Wt-Adj</th>}
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '80px' }}>Δ Watts</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '60px' }}>Splits</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '70px' }}>Date</th>
                {isCoach && <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '100px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedDataWithGaps.length === 0 ? (
                <tr><td colSpan={isCoach ? 12 : 11} style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '15px' }}>No results for selected filters</td></tr>
              ) : sortedDataWithGaps.map((entry, index) => {
                const isTopThree = entry.rank !== '-' && entry.rank <= 3;
                const isRecord = isTeamRecord(entry);
                const hasSplits = entry.splits && entry.splits.length > 0;
                const isCustom = entry.isCustomWorkout || entry.testType === 'Custom';
                
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: isRecord ? '#fef9c3' : isCustom ? '#f5f3ff' : (index % 2 === 0 ? '#fff' : '#fafafa'), opacity: entry.completed ? 1 : 0.6 }}>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', padding: '4px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: isTopThree ? (entry.rank === 1 ? '#fef3c7' : entry.rank === 2 ? '#e5e7eb' : '#fed7aa') : 'transparent', color: isTopThree ? (entry.rank === 1 ? '#92400e' : entry.rank === 2 ? '#374151' : '#9a3412') : '#6b7280' }}>{entry.rank}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#111827', fontWeight: 600, fontSize: '14px' }}>{entry.athleteName}</span>
                        {isRecord && <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: '#f59e0b', color: '#fff', textTransform: 'uppercase' }}>🏆 TR</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, backgroundColor: isCustom ? '#ddd6fe' : '#dbeafe', color: isCustom ? '#7c3aed' : '#1e40af' }}>
                        {entry.testType}{isCustom && entry.customPieceCount && ` (${entry.customPieceCount})`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: entry.completed ? '#111827' : '#ef4444', fontFamily: 'monospace', fontSize: '14px', fontWeight: 600 }}>
                      {isCustom ? (entry.customPieceCount || entry.splits?.length || '-') + ' pcs' : entry.time}
                    </td>
                    {columns.showSplit && <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: entry.split !== '-' ? '#10b981' : '#9ca3af' }}>{entry.split}</td>}
                    {columns.showWatts && <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#111827' }}>{entry.watts > 0 ? entry.watts : '-'}</td>}
                    {columns.showWatts && <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: 700, color: entry.wattsPerKg ? '#10b981' : '#9ca3af' }}>{entry.wattsPerKg ? entry.wattsPerKg.toFixed(2) : '-'}</td>}
                    {columns.showWeightAdjusted && (
                      <td style={{ padding: '12px 16px', textAlign: 'center', backgroundColor: '#fffbeb' }}>
                        {entry.weightAdjustedSplit ? (
                          <div>
                            <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>{entry.weightAdjustedSplit}</div>
                            <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>{entry.weightAdjustedWatts ? `${entry.weightAdjustedWatts}W` : ''}</div>
                          </div>
                        ) : <span style={{ color: '#9ca3af', fontSize: '12px' }}>—</span>}
                      </td>
                    )}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {entry.wattsGapPercent === 0 ? (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', backgroundColor: '#d1fae5', padding: '4px 8px', borderRadius: '4px' }}>LEADER</span>
                      ) : entry.wattsGapPercent !== null && entry.wattsGapPercent < 0.1 ? (
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', fontFamily: 'monospace' }}>0.0%</span>
                      ) : entry.wattsGapPercent !== null ? (
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626', fontFamily: 'monospace' }}>-{entry.wattsGapPercent.toFixed(1)}%</span>
                      ) : <span style={{ color: '#9ca3af' }}>-</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button onClick={() => setSelectedEntry(entry)} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: hasSplits ? '2px solid #10b981' : '2px solid #e5e7eb', backgroundColor: hasSplits ? '#d1fae5' : '#f9fafb', color: hasSplits ? '#065f46' : '#9ca3af' }}>{hasSplits ? 'View' : '—'}</button>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>{formatDateDisplay(entry.date)}</td>
                    {isCoach && (
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button onClick={() => setEditEntry(entry)} style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: '1px solid #3b82f6', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>Edit</button>
                          <button onClick={() => setDeleteEntry(entry)} style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: '1px solid #ef4444', backgroundColor: '#fef2f2', color: '#dc2626' }}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {columns.showWeightAdjusted && (
        <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #f59e0b' }}>
          <p style={{ fontSize: '12px', color: '#92400e', margin: 0 }}>
           <strong>Weight-Adjusted Formula:</strong> WF = (weight/270)^0.222 • Corrected Split = WF × Actual Split • Final = avg(Corrected, Actual) 
          </p>
        </div>
      )}

      <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #e5e7eb' }}><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Athletes</div><div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>{totalAthletes}</div></div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #e5e7eb' }}><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Total Tests</div><div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>{teamData.length}</div></div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #10b981' }}><div style={{ fontSize: '12px', color: '#10b981', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Completed</div><div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>{completedTests}</div></div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #ef4444' }}><div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Incomplete</div><div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444' }}>{incompleteTests}</div></div>
        <div style={{ backgroundColor: '#f5f3ff', padding: '20px', borderRadius: '12px', border: '2px solid #8b5cf6' }}><div style={{ fontSize: '12px', color: '#7c3aed', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Custom Workouts</div><div style={{ fontSize: '28px', fontWeight: 700, color: '#7c3aed' }}>{customWorkouts}</div></div>
        <div style={{ backgroundColor: '#fef3c7', padding: '20px', borderRadius: '12px', border: '2px solid #f59e0b' }}><div style={{ fontSize: '12px', color: '#92400e', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>🏆 Records</div><div style={{ fontSize: '28px', fontWeight: 700, color: '#92400e' }}>{Object.keys(teamRecords).length}</div></div>
      </div>
    </div>
  );
}