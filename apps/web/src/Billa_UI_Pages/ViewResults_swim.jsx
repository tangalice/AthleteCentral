// src/Billa_UI_Pages/ViewResults_swim.jsx

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import html2canvas from "html2canvas";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";


// conversion formulas from https://motion-help.sportsengine.com/en/articles/8538107-how-to-perform-course-conversion-factoring-of-times

function convertResult(result) {
  let scmconvertedTime = null;
  let scyconvertedTime = null;
  let lcmconvertedTime = null;

  if (result.courseType === 'scy') {
    if (result.distance === '500' || result.distance === '1000') {
      scmconvertedTime = result.time * 0.875;
      lcmconvertedTime = result.time * 0.8925;
    }
    else if (result.distance === '1650') {
      scmconvertedTime = result.time * 0.997;
      lcmconvertedTime = result.time * 1.02;
    }
    else {
      scmconvertedTime = result.time * 1.11;
      lcmconvertedTime = scmconvertedTime * 1.02;
    }
    return {course1:"SCM Converted Time", course1Time: scmconvertedTime, course2: "LCM Converted Time", course2Time: lcmconvertedTime, convertedCourse: "SCY", convertedTime: result.time};
  }
  else if (result.courseType === 'scm') {
    if (result.distance === '400' || result.distance === '800') {
      scyconvertedTime = result.time / 0.875;
      lcmconvertedTime = result.time * 1.02;
    }
    else if (result.distance === '1500') {
      scyconvertedTime = result.time / 0.997;
      lcmconvertedTime = result.time * 1.02;
    }
    else {
      scyconvertedTime = result.time / 1.11;
      lcmconvertedTime = result.time * 1.02;
    }
    return {course1:"SCY Converted Time", course1Time: scyconvertedTime, course2: "LCM Converted Time", course2Time: lcmconvertedTime, convertedCourse: "SCM", convertedTime: result.time};
  }
  else if (result.courseType === 'lcm') {
    if (result.distance === '400' || result.distance === '800') {
      scmconvertedTime = result.time / 1.02;
      scyconvertedTime = scmconvertedTime / 0.875;
    }
    else if (result.distance === '1500') {
      scmconvertedTime = result.time / 1.02;
      scyconvertedTime = scmconvertedTime / 0.997;
    }
    else {
      scmconvertedTime = result.time / 1.02;
      scyconvertedTime = scmconvertedTime / 1.11;
    }
    return {course1:"SCM Converted Time", course1Time: scmconvertedTime, course2: "SCY Converted Time", course2Time: scyconvertedTime, convertedCourse: "LCM", convertedTime: result.time};
  }

  return result;
}

export default function ViewResults_swim({ user }) {
  const [filter, setFilter] = useState('all');
  const [practiceResults, setPracticeResults] = useState([]);
  const [competitionResults, setCompetitionResults] = useState([]);
  const [scmResults, setScmResults] = useState([]);
  const [scyResults, setScyResults] = useState([]);
  const [lcmResults, setLcmResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resultsList, setResultsList] = useState([]);
  const [convertedResult, setConvertedResult] = useState(null);
  const [showConvertPopup, setShowConvertPopup] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
  const fetchResults = async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', user.uid, 'performances'),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const allResults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || null, 
        //isPB: false,
        //currPB: false,
      }));

      const practiceData = allResults.filter(r => r.type === 'practice');
      const competitionData = allResults.filter(r => r.type === 'competition');
      const scmData = allResults.filter(r => r.courseType === 'scm');
      const scyData = allResults.filter(r => r.courseType === 'scy');
      const lcmData = allResults.filter(r => r.courseType === 'lcm');

      setPracticeResults(practiceData);
      setCompetitionResults(competitionData);
      setScmResults(scmData);
      setScyResults(scyData);
      setLcmResults(lcmData);
      setResultsList(allResults.sort((a, b) => a.date - b.date));
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchResults();
}, [user]);

  const findPBs= () => {
    Object.defineProperty(resultsList, 'writable', { value: true });
    console.log("Finding PBs...");
    for (let result of resultsList) {
      console.log("Checking result:", result);
      let pb = result.time;
      result.isPB = true;
      result.currPB = true;
      for (let otherResult of resultsList) {
        if (otherResult.eventType === result.eventType && otherResult.time < pb && otherResult.date < result.date) {
          pb = otherResult.time;
          result.isPB = false;
          otherResult.currPB = false;
          console.log("Found PB:", otherResult);
        }
      }
    }
  };

  // Combine and filter results
  const getFilteredResults = () => {
    let results = [];
    
    if (filter === 'all') {
      results = [...practiceResults, ...competitionResults];
    } else if (filter === 'practice') {
      results = practiceResults;
    } else if (filter === 'competition') {
      results = competitionResults;
    }
    else if (filter === 'scy') {
      results = scyResults;
    }
    else if (filter === 'scm') {
      results = scmResults;
    }
    else if (filter === 'lcm') {
      results = lcmResults;
    } 
    else {
      results = [...practiceResults, ...competitionResults].filter(r => r.eventType === filter);
    }

    // Sort by date descending
    return results.sort((a, b) => b.date - a.date);
  };

  const filteredResults = getFilteredResults();
  

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: '#6b7280' }}>Loading your results...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '24px',
        justifyContent: 'center'
      }}>
        <button 
          onClick={() => { setFilter('all'); setShowChart(false); }}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'all' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'all' ? '#10b981' : 'white',
            color: filter === 'all' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          All Results ({practiceResults.length + competitionResults.length})
        </button>
        <button 
          onClick={() => { setFilter('practice'); setShowChart(false); }}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'practice' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'practice' ? '#10b981' : 'white',
            color: filter === 'practice' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Practice ({practiceResults.length})
        </button>
        <button 
          onClick={() => { setFilter('competition'); setShowChart(false); }}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'competition' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'competition' ? '#10b981' : 'white',
            color: filter === 'competition' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Competition ({competitionResults.length})
        </button>
      </div>

      <div>
      {/* Filter Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '24px',
        justifyContent: 'center'
      }}>
        <button 
          onClick={() => { setFilter('scy'); setShowChart(false); }}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'scy' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'scy' ? '#10b981' : 'white',
            color: filter === 'scy' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Short Course Yards (SCY) ({scyResults.length})
        </button>
        <button 
          onClick={() => { setFilter('scm'); setShowChart(false); }}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'scm' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'scm' ? '#10b981' : 'white',
            color: filter === 'scm' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Short Course Meters (SCM) ({scmResults.length})
        </button>
        <button 
          onClick={() => { setFilter('lcm'); setShowChart(false); }}
          style={{ 
            padding: '10px 20px', 
            border: `2px solid ${filter === 'lcm' ? '#10b981' : '#d1d5db'}`, 
            borderRadius: '6px',
            backgroundColor: filter === 'lcm' ? '#10b981' : 'white',
            color: filter === 'lcm' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Long Course Meters (LCM) ({lcmResults.length})
        </button>
      </div>

      {/* Chart */}
      <div ref={chartRef}>
        {showChart && (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={filteredResults}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis
                label={{
                  value: "Time (s)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip />
              <Line type="monotone" dataKey="time" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Results Display */}
      {filteredResults.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>
            No {filter === 'all' ? '' : filter} results yet.
          </p>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>
            Your coach will add results here.
          </p>
        </div>
      ) : (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'white'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Date
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Type
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  {filter === 'practice' ? 'Workout' : 'Event'}
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Result
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Notes
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Personal Best?
                </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                  Options
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result, index) => (
            <tr
              key={result.id}
              style={{
              borderBottom: index < filteredResults.length - 1 ? '1px solid #e5e7eb' : 'none',
              backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
              cursor: 'pointer'
            }}
            onClick={() => { setFilter(result.eventType); setShowChart(true); }}

          >
            {/* Date */}
            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
              {result.date ? result.date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
              : 'N/A'}
            </td>

            {/* Type badge */}
            <td style={{ padding: '12px 16px' }}>
              <span
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor:
                result.type === 'competition' ? '#dbeafe' : '#f3e8ff',
                color: result.type === 'competition' ? '#1e40af' : '#6b21a8'
              }}
              >
              {result.type === 'competition' ? 'Competition' : 'Practice'}
              </span>
            </td>

            {/* Event Type */}
            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
              {result.eventType || '—'}
            </td>

            {/* Time / Score */}
            <td
            style={{
              padding: '12px 16px',
             fontSize: '14px',
             fontWeight: 600,
             color: '#10b981'
            }}
            >
            {result.time != null ? `${result.time}s` : '—'}
            </td>

            {/* Notes */}
            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
              {result.notes || '—'}
            </td>

            {/* isPB? */}
            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
              {result.isPB ? (result.currPB ? 'current PB' : 'PB at time of performance') : 'Not a PB'}
            </td>

            {/* Options */}        
            <button 
              onClick={() => {
                setConvertedResult(convertResult(result));
                setShowConvertPopup(true);
              }}
              style={{ 
                padding: '10px 20px', 
                border: `2px solid ${filter === 'scm' ? '#10b981' : '#d1d5db'}`, 
                borderRadius: '6px',
                backgroundColor: '#10b981',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
            Convert
          </button>
        </tr>


        ))}
        </tbody>

        </table>
        </div>
      )}
      </div>

      {/* Result Conversion Popup */}
      {showConvertPopup && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
          }}>
          <div className="card" style={{
            width: 420,
            maxWidth: 500,
            padding: 20
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, textAlign: 'center' }}>Converted Result</h3>
            {console.log("Converted Result:", convertedResult)}
            Time Converted: {convertedResult.convertedTime.toFixed(2)}s in {convertedResult.convertedCourse}<br/>
            {convertedResult.course1}: {convertedResult.course1Time.toFixed(2)}s<br/>
            {convertedResult.course2}: {convertedResult.course2Time.toFixed(2)}s<br/><br/>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => setShowConvertPopup(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}