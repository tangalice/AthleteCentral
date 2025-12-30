import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';

const getTestTypesBySport = (sport) => {
  const sportLower = sport?.toLowerCase() || '';
  switch (sportLower) {
    case 'rowing':
      return ['All', '2k', '5k', '6k', '2x5k', '30min', '60min'];
    case 'running':
    case 'track':
    case 'cross country':
      return ['All', 'Mile', '5K', '10K', 'Half Marathon', 'Marathon'];
    case 'swimming':
      return ['All', '50 Free', '100 Free', '200 Free', '500 Free', '100 Fly', '200 IM'];
    default:
      return ['All', '2k', '5k', '6k', '30min', '60min'];
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

// Weight-adjusted score calculation
// Formula: WF = (bodyWeight / 270) ^ 0.222
// Corrected split (seconds) = WF * actual split (seconds)
// Final = average of corrected split and actual split
const calculateWeightAdjustedSplit = (splitStr, weight) => {
  if (!splitStr || splitStr === '-' || splitStr === '--:--.-' || splitStr === '--:--') return null;
  if (!weight || weight <= 0) return null;
  
  try {
    const parts = splitStr.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    const splitSeconds = minutes * 60 + seconds;
    if (!splitSeconds || splitSeconds <= 0 || isNaN(splitSeconds)) return null;
    
    // Weight factor = (weight / 270) ^ 0.222
    const weightFactor = Math.pow(weight / 270, 0.222);
    
    // Corrected time in seconds
    const correctedSeconds = weightFactor * splitSeconds;
    
    // Average of corrected and actual
    const averageSeconds = (correctedSeconds + splitSeconds) / 2;
    
    // Convert back to split format (m:ss.s)
    const mins = Math.floor(averageSeconds / 60);
    const secs = averageSeconds % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
  } catch (err) {
    return null;
  }
};

// Calculate watts from weight-adjusted split
const calculateWeightAdjustedWatts = (splitStr, weight) => {
  const adjustedSplit = calculateWeightAdjustedSplit(splitStr, weight);
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

const getUniqueDates = (data) => {
  const dates = new Set();
  data.forEach(entry => {
    if (entry.date) {
      const formatted = formatDateForInput(entry.date);
      if (formatted) dates.add(formatted);
    }
  });
  return Array.from(dates).sort((a, b) => new Date(b) - new Date(a));
};

// Edit Modal Component - COACH ONLY
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
        {/* Weight Adjusted Row */}
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

// Delete Modal - COACH ONLY
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

// Split Breakdown Modal - Available to ALL users
const SplitBreakdownModal = ({ entry, onClose }) => {
  if (!entry) return null;
  const splits = entry.splits || [];
  const testType = entry.testType?.toLowerCase() || '';
  
  const getSplitLabels = () => {
    if (testType === '2k') return ['500m', '1000m', '1500m', '2000m'];
    if (testType === '5k') return ['1k', '2k', '3k', '4k', '5k'];
    if (testType === '6k') return ['1k', '2k', '3k', '4k', '5k', '6k'];
    if (testType === '2x5k') return ['Piece 1', 'Piece 2'];
    return splits.map((_, i) => 'Split ' + (i + 1));
  };
  const splitLabels = getSplitLabels();
  const getSplitValue = (split) => typeof split === 'string' ? split : split?.split || '-';

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{entry.athleteName}</h2>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>{entry.testType} • {formatDateDisplay(entry.date, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9ca3af' }}>×</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>TIME</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{entry.time}</div></div>
          <div style={{ backgroundColor: '#d1fae5', padding: '12px', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#065f46', fontWeight: 600, marginBottom: '4px' }}>AVG SPLIT</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#065f46', fontFamily: 'monospace' }}>{entry.split}</div></div>
          <div style={{ backgroundColor: '#dbeafe', padding: '12px', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600, marginBottom: '4px' }}>WATTS</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#1e40af', fontFamily: 'monospace' }}>{entry.watts || '-'}</div></div>
          <div style={{ backgroundColor: entry.wattsPerKg ? '#fef3c7' : '#f3f4f6', padding: '12px', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '11px', color: entry.wattsPerKg ? '#92400e' : '#6b7280', fontWeight: 600, marginBottom: '4px' }}>W/KG</div><div style={{ fontSize: '16px', fontWeight: 700, color: entry.wattsPerKg ? '#92400e' : '#9ca3af', fontFamily: 'monospace' }}>{entry.wattsPerKg ? entry.wattsPerKg.toFixed(2) : '-'}</div></div>
        </div>
        {/* Weight Adjusted Stats */}
        {entry.weightAdjustedSplit && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #f59e0b' }}><div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600, marginBottom: '4px' }}>WT-ADJ SPLIT</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#92400e', fontFamily: 'monospace' }}>{entry.weightAdjustedSplit}</div></div>
            <div style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #f59e0b' }}><div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600, marginBottom: '4px' }}>WT-ADJ WATTS</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#92400e', fontFamily: 'monospace' }}>{entry.weightAdjustedWatts || '-'}</div></div>
          </div>
        )}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>Split Breakdown</h3>
          {splits.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>INTERVAL</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>SPLIT</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>WATTS</th>
              </tr></thead>
              <tbody>
                {splits.map((split, index) => {
                  const splitValue = getSplitValue(split);
                  const splitWatts = calculateWatts(splitValue);
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500, color: '#374151' }}>{splitLabels[index] || `Split ${index + 1}`}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '14px', fontWeight: 600, color: '#10b981' }}>{splitValue}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 500, color: '#374151' }}>{splitWatts > 0 ? splitWatts : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '24px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>No split data available.</div>
          )}
        </div>
        <button onClick={onClose} style={{ width: '100%', padding: '12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
};

export default function GroupPerformance({ user, userRole, userSport = 'rowing' }) {
  const testTypes = useMemo(() => getTestTypesBySport(userSport), [userSport]);
  const columns = useMemo(() => getColumnsBySport(userSport), [userSport]);
  
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTestType, setSelectedTestType] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');
  const [completionStatus, setCompletionStatus] = useState('All');
  const [sortBy, setSortBy] = useState('wattsPerKg');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);

  const isCoach = userRole === 'coach';

  const fetchTeamData = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) { setLoading(false); setError('No user logged in'); return; }
    try {
      setLoading(true);
      setError(null);
      const teamsRef = collection(db, 'teams');
      const teamsSnapshot = await getDocs(query(teamsRef));
      const teamMemberIds = new Set();
      teamsSnapshot.forEach((teamDoc) => {
        const data = teamDoc.data();
        const allMembers = [...(data.members || []), ...(data.athletes || []), ...(data.coaches || [])];
        if (allMembers.includes(currentUser.uid)) allMembers.forEach(id => teamMemberIds.add(id));
      });
      if (teamMemberIds.size === 0) { setTeamData([]); setLoading(false); setError('You are not part of any team yet'); return; }

      const performances = [];
      for (const userId of Array.from(teamMemberIds)) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          const userName = userDoc.exists() ? (userDoc.data().displayName || userDoc.data().name || 'Unknown') : 'Unknown';
          const performancesSnapshot = await getDocs(collection(db, 'users', userId, 'testPerformances'));
          performancesSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const watts = data.watts || calculateWatts(data.split || data.avgSplit);
            let dateValue = data.date;
            if (dateValue?.toDate) dateValue = dateValue.toDate();
            
            // Calculate weight-adjusted values if weight is available
            const athleteWeight = data.athleteWeight || null;
            const split = data.split || data.avgSplit || '-';
            const weightAdjustedSplit = data.weightAdjustedSplit || calculateWeightAdjustedSplit(split, athleteWeight);
            const weightAdjustedWatts = data.weightAdjustedWatts || calculateWeightAdjustedWatts(split, athleteWeight);
            
            performances.push({
              id: docSnap.id,
              athleteId: userId,
              athleteName: userName,
              testType: data.testType || data.eventType || 'Unknown',
              time: data.time || '--:--.-',
              split: split,
              splits: data.splits || [],
              watts: watts,
              wattsPerKg: data.wattsPerKg || null,
              athleteWeight: athleteWeight,
              weightAdjustedSplit: weightAdjustedSplit,
              weightAdjustedWatts: weightAdjustedWatts,
              date: dateValue || new Date(),
              completed: data.time && data.time !== '--:--.-' && data.completed !== false,
            });
          });
        } catch (e) { console.error('Error fetching user ' + userId, e); }
      }
      setTeamData(performances);
    } catch (err) { setError('Failed to load: ' + err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTeamData(); }, [userSport]);

  const handleSaveEdit = async (athleteId, docId, updateData) => {
    await updateDoc(doc(db, 'users', athleteId, 'testPerformances', docId), updateData);
    await fetchTeamData();
  };

  const handleConfirmDelete = async (athleteId, docId) => {
    await deleteDoc(doc(db, 'users', athleteId, 'testPerformances', docId));
    await fetchTeamData();
  };

  const availableDates = useMemo(() => getUniqueDates(teamData), [teamData]);

  const filteredData = useMemo(() => {
    return teamData.filter((entry) => {
      const matchesTestType = selectedTestType === 'All' || entry.testType === selectedTestType;
      const matchesDate = selectedDate === 'All' || formatDateForInput(entry.date) === selectedDate;
      const matchesCompletion = completionStatus === 'All' || (completionStatus === 'Complete' ? entry.completed : !entry.completed);
      return matchesTestType && matchesDate && matchesCompletion;
    });
  }, [teamData, selectedTestType, selectedDate, completionStatus]);

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
        // Sort by weight-adjusted watts (higher is better)
        const aWA = a.weightAdjustedWatts || 0;
        const bWA = b.weightAdjustedWatts || 0;
        if (aWA === 0 && bWA === 0) return (b.watts || 0) - (a.watts || 0);
        if (aWA === 0) return 1;
        if (bWA === 0) return -1;
        return bWA - aWA;
      }
      return splitToSeconds(a.split) - splitToSeconds(b.split);
    });
    
    // Always calculate gaps
    const leaderWatts = sorted.length > 0 && sorted[0].completed ? (sorted[0].watts || 0) : 0;
    
    return sorted.map((entry, index) => {
      let wattsGapPercent = null;
      if (entry.completed && leaderWatts > 0 && entry.watts > 0) {
        if (index === 0) {
          wattsGapPercent = 0; // First place = LEADER
        } else if (entry.watts === leaderWatts) {
          wattsGapPercent = 0.001; // Tied with leader, show as 0.0%
        } else {
          wattsGapPercent = ((leaderWatts - entry.watts) / leaderWatts) * 100;
        }
      }
      return { ...entry, rank: entry.completed ? index + 1 : '-', wattsGapPercent };
    });
  }, [filteredData, sortBy]);

  const teamRecords = useMemo(() => {
    const recordsMap = {};
    teamData.forEach((entry) => {
      if (!entry.completed || !entry.split || entry.split === '-') return;
      const seconds = splitToSeconds(entry.split);
      if (seconds === Infinity) return;
      if (!recordsMap[entry.testType] || seconds < recordsMap[entry.testType].seconds) {
        recordsMap[entry.testType] = { id: entry.id, split: entry.split, seconds, athleteName: entry.athleteName, time: entry.time, wattsPerKg: entry.wattsPerKg, weightAdjustedSplit: entry.weightAdjustedSplit };
      }
    });
    return recordsMap;
  }, [teamData]);

  const isTeamRecord = (entry) => teamRecords[entry.testType]?.id === entry.id;
  const totalAthletes = new Set(teamData.map(e => e.athleteId)).size;
  const completedTests = teamData.filter(e => e.completed).length;
  const incompleteTests = teamData.filter(e => !e.completed).length;

  if (loading) return <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '32px', textAlign: 'center', paddingTop: '100px' }}><p style={{ fontSize: '18px', color: '#6b7280' }}>Loading team performance data...</p></div>;
  if (error) return <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '32px', textAlign: 'center', paddingTop: '100px' }}><p style={{ fontSize: '18px', color: '#ef4444' }}>{error}</p><button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Retry</button></div>;
  if (teamData.length === 0) return <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '32px' }}><h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Team Performance</h1><div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '2px solid #e5e7eb' }}><p style={{ fontSize: '18px', color: '#6b7280' }}>No performance data found</p></div></div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', padding: '32px' }}>
      {selectedEntry && <SplitBreakdownModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
      {editEntry && <EditModal entry={editEntry} onClose={() => setEditEntry(null)} onSave={handleSaveEdit} />}
      {deleteEntry && <DeleteModal entry={deleteEntry} onClose={() => setDeleteEntry(null)} onConfirm={handleConfirmDelete} />}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Team Performance</h1>
        <p style={{ color: '#6b7280', fontSize: '15px' }}>View and compare test results {userSport && <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 600 }}>({userSport})</span>}</p>
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
                {record.weightAdjustedSplit && <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px', fontWeight: 600 }}>Wt-Adj: {record.weightAdjustedSplit}</div>}
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
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Date</label>
            <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: selectedDate !== 'All' ? '2px solid #10b981' : '2px solid #e5e7eb', backgroundColor: selectedDate !== 'All' ? '#d1fae5' : '#fff', fontSize: '14px', fontWeight: 500, color: '#111827', cursor: 'pointer', minWidth: '160px' }}>
              <option value="All">All Dates</option>
              {availableDates.map(date => <option key={date} value={date}>{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</option>)}
            </select>
          </div>
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
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', width: '70px' }}>Test</th>
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
                
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: isRecord ? '#fef9c3' : (index % 2 === 0 ? '#fff' : '#fafafa'), opacity: entry.completed ? 1 : 0.6 }}>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', padding: '4px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: isTopThree ? (entry.rank === 1 ? '#fef3c7' : entry.rank === 2 ? '#e5e7eb' : '#fed7aa') : 'transparent', color: isTopThree ? (entry.rank === 1 ? '#92400e' : entry.rank === 2 ? '#374151' : '#9a3412') : '#6b7280' }}>{entry.rank}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#111827', fontWeight: 600, fontSize: '14px' }}>{entry.athleteName}</span>
                        {isRecord && <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: '#f59e0b', color: '#fff', textTransform: 'uppercase' }}>🏆 TR</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}><span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, backgroundColor: '#dbeafe', color: '#1e40af' }}>{entry.testType}</span></td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: entry.completed ? '#111827' : '#ef4444', fontFamily: 'monospace', fontSize: '14px', fontWeight: 600 }}>{entry.time}</td>
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
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '12px' }}>—</span>
                        )}
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

      {/* Formula explanation */}
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
        <div style={{ backgroundColor: '#fef3c7', padding: '20px', borderRadius: '12px', border: '2px solid #f59e0b' }}><div style={{ fontSize: '12px', color: '#92400e', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>🏆 Records</div><div style={{ fontSize: '28px', fontWeight: 700, color: '#92400e' }}>{Object.keys(teamRecords).length}</div></div>
      </div>
    </div>
  );
}