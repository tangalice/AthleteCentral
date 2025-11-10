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
    return {course1raw: 'scm', course1:"SCM Converted Time", course1Time: scmconvertedTime, course2raw: 'lcm', course2: "LCM Converted Time", course2Time: lcmconvertedTime, convertedCourse: "SCY", convertedTime: result.time};
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
    return {course1raw: 'scy', course1:"SCY Converted Time", course1Time: scyconvertedTime, course2raw: 'lcm', course2: "LCM Converted Time", course2Time: lcmconvertedTime, convertedCourse: "SCM", convertedTime: result.time};
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
    return {course1raw: 'scm', course1:"SCM Converted Time", course1Time: scmconvertedTime, course2raw: 'scy', course2: "SCY Converted Time", course2Time: scyconvertedTime, convertedCourse: "LCM", convertedTime: result.time, dist: result.distance};
  }

  return result;
}

// estimate formula from https://www.swimbikerun.net.nz/Calculators/SwimmingExpectationsCalculator

function estimateResult(eventToEstimate, resultsList) {
  const dist = Number(eventToEstimate.split('-')[0]);
  const stroke = eventToEstimate.split('-')[1];
  const course = eventToEstimate.split('-')[2];
  console.log("Event: ", eventToEstimate, "dist:", dist, "stroke:", stroke, "course:", course)

  // Group results by stroke type
  const grouped = [];
  for (let r of resultsList) {
    if (r.stroke === stroke) grouped.push(r);;
  }
  if (grouped.length === 0) return null;

  const groupedDist = {};
  groupedDist[0] = [];
  groupedDist[1] = [];
  for (let r of grouped) {
    if (Number(r.distance) === dist) {
      groupedDist[0].push(r);
    }
    else {
      groupedDist[1].push(r);
    }
  }

  if (groupedDist[0].length != 0) {
    // results found for event in other course
    const convertedResults = [];
    for (let r of groupedDist[0]) {
      convertedResults.push(convertResult(r));
    }
    let minTime = Infinity
    for (let r of convertedResults) {
      if (r.course1raw === course && r.course1Time < minTime) {
        minTime = r.course1Time;
      }
      else if (r.course2raw === course && r.course2Time < minTime) {
        minTime = r.course2raw;
      }
    }
    return minTime;
  }

  const convertedResults = [];
  for (let r of groupedDist[1]) {
    let currResult = convertResult(r);
      if (currResult.course1raw === course) {
        convertedResults.push({dist: Number(currResult.dist), time: currResult.course2Time});
      }
      else if (currResult.course2raw === course) {
        convertedResults.push({dist: Number(currResult.dist), time: currResult.course2Time});
      }
      else {
        convertedResults.push({dist: Number(r.distance), time: r.time});
      }
  }
  console.log("converted results: ", convertedResults);

  let nearestDist = Infinity;
  let minDist = Infinity
  let minTime = Infinity;
  for (let r of convertedResults) {
    if (Math.abs(r.dist - dist) < minDist) {
      nearestDist = r.dist;
      minDist = Math.abs(r.dist - dist);
      minTime = r.time;
    }
    if ((r.dist === nearestDist) && (r.time < minTime)) {
      minTime = r.time
    }
  }

  let calculatedTime = minTime * Math.pow(dist / nearestDist, 1.06);

  return calculatedTime;
}

function findPBs(resultsList) {
  const pbList = {};

  // Group results by event type
  const grouped = {};
  for (let r of resultsList) {
    if (!grouped[r.eventType]) grouped[r.eventType] = [];
    grouped[r.eventType].push(r);
  }

  // Process each event separately
  for (let eventType in grouped) {
    // Sort by date ascending
    const sorted = grouped[eventType].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    let bestTimeSoFar = Infinity;
    let allPBs = [];

    // Mark PBs at the time
    for (let res of sorted) {
      const { id, time } = res;

      // If this time beats all previous ones, it's a PB at the time
      const isPBAtTheTime = time < bestTimeSoFar;

      pbList[id] = {
        isPB: isPBAtTheTime, // "PB at time of performance"
        currPB: false,       // We'll fill this later
      };

      if (isPBAtTheTime) {
        bestTimeSoFar = time;
        allPBs.push(res);
      }
    }

    // The last (fastest) PB is the current one
    if (allPBs.length > 0) {
      const currentPB = allPBs[allPBs.length - 1];
      pbList[currentPB.id].currPB = true;
    }
  }

  return pbList;
}

function findEventsWithoutResults(allEvents, resultsList) {
  // Create a Set of all event keys that have at least one result
  const eventsWithResults = new Set(resultsList.map(r => r.eventType));

  // Filter allEvents by keys *not* in the results
  const eventsWithoutResults = Object.keys(allEvents)
    .filter(eventKey => !eventsWithResults.has(eventKey))
    .reduce((acc, key) => {
      acc[key] = allEvents[key];
      return acc;
    }, {});

  return eventsWithoutResults;
}

function formatTime(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return "00:00.00"; // Or handle invalid input as needed
  }

  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  // Format minutes with leading zero if less than 10
  const formattedMinutes = String(minutes).padStart(2, '0');

  // Format seconds with leading zero and two decimal places
  const formattedSeconds = remainingSeconds.toFixed(2).padStart(5, '0'); // e.g., "05.12" or "12.34"

  return `${formattedMinutes}:${formattedSeconds}`;
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
  const [pbList, setPbList] = useState(null);
  const chartRef = useRef(null);
  const [eventsWithoutResults, setEventsWithoutResults] = useState(null);
  const [eventToEstimate, setEventToEstimate] = useState("")
  const [showEstimatePopup, setShowEstimatePopup] = useState(false);
  const [estimatedResult, setEstimatedResult] = useState(null);

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

  useEffect(() => {
    if (!resultsList || resultsList.length === 0) return;

    const computed = findPBs(resultsList);
    setPbList(computed);

    const computedEventsWithoutResults = findEventsWithoutResults(allEvents, resultsList);
    setEventsWithoutResults(computedEventsWithoutResults);

    setLoading(false);
    console.log("PB List:", computed);
    console.log("Events without results:", computedEventsWithoutResults);
  }, [resultsList]);

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

  const handleChange = (e) => {
    const value = e.target.value;
    setEventToEstimate(value)
  };


  if (loading || !pbList) {
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
            <LineChart data={filteredResults.sort((a, b) => a.date - b.date)}>
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
            {result.time != null ? `${formatTime(result.time)}s` : '—'}
            </td>

            {/* Notes */}
            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
              {result.notes || '—'}
            </td>

            {/* isPB? */}
            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
              {pbList[result.id]?.isPB ? (pbList[result.id]?.currPB ? 'Current PB' : 'PB at time of performance') : 'Not a PB'}
            </td>

            {/* Options */}     
            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>   
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
          </td>
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
            Time Converted: {formatTime(convertedResult.convertedTime.toFixed(2))}s in {convertedResult.convertedCourse}<br/>
            {convertedResult.course1}: {formatTime(convertedResult.course1Time.toFixed(2))}s<br/>
            {convertedResult.course2}: {formatTime(convertedResult.course2Time.toFixed(2))}s<br/><br/>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => setShowConvertPopup(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Estimate Popup */}
      {showEstimatePopup && (
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
            <h3 style={{ marginTop: 0, marginBottom: 16, textAlign: 'center' }}>Estimated Result</h3>
            {console.log("Estimated Result:", estimatedResult)}
            {estimatedResult === null ? 'Not enough data to estimate a result in this event' : 
            `Estimated result in ${eventToEstimate} based on related times: ${formatTime(estimatedResult.toFixed(2))}`}
            <br/><br/>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => setShowEstimatePopup(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <br/>
      {/* Event Selection for time estimate */}
      {eventsWithoutResults.length === 0 ? null : (
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '6px', 
          fontWeight: 600, 
          fontSize: '14px',
          color: '#374151'
        }}>
        Select an Event with No Results to estimate a Time:
        </label>
        <select 
          name="eventType"
          value={eventToEstimate}
          onChange={handleChange}
          required
          style={{          
            width: '20%',
            padding: '10px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            backgroundColor: 'white'
          }}
        >
        <option value="">Select an event...</option>
          {Object.entries(eventsWithoutResults).map(([eventKey, eventName]) => (
          <option key={eventKey} value={eventKey}>
            {eventName}
          </option>
        ))}
        </select>

        <button 
          onClick={() => {
            setEstimatedResult(estimateResult(eventToEstimate, resultsList));
            setShowEstimatePopup(true);
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
        Estimate Time
        </button>
      </div>
      )}
    </div>
  );
}


const allEvents = {
  '50-fr-scy': '50 Freestyle (SCY)',
  '50-fr-scm': '50 Freestyle (SCM)',
  '50-fr-lcm': '50 Freestyle (LCM)',
  '100-fr-scy': '100 Freestyle (SCY)',
  '100-fr-scm': '100 Freestyle (SCM)',
  '100-fr-lcm': '100 Freestyle (LCM)',
  '200-fr-scy': '200 Freestyle (SCY)',
  '200-fr-scm': '200 Freestyle (SCM)',
  '200-fr-lcm': '200 Freestyle (LCM)',
  '500-fr-scy': '500 Freestyle (SCY)',
  '400-fr-scm': '400 Freestyle (SCM)',
  '400-fr-lcm': '400 Freestyle (LCM)',
  '1000-fr-scy': '1000 Freestyle (SCY)',
  '800-fr-scm': '800 Freestyle (SCM)',
  '800-fr-lcm': '800 Freestyle (LCM)',
  '1650-fr-scy': '1650 Freestyle (SCY)',
  '1500-fr-scm': '1500 Freestyle (SCM)',
  '1500-fr-lcm': '1500 Freestyle (LCM)',
  '50-bk-scy': '50 Backstroke (SCY)',
  '50-bk-scm': '50 Backstroke (SCM)',
  '50-bk-lcm': '50 Backstroke (LCM)',
  '100-bk-scy': '100 Backstroke (SCY)',
  '100-bk-scm': '100 Backstroke (SCM)',
  '100-bk-lcm': '100 Backstroke (LCM)',
  '200-bk-scy': '200 Backstroke (SCY)',
  '200-bk-scm': '200 Backstroke (SCM)',
  '200-bk-lcm': '200 Backstroke (LCM)',
  '50-br-scy': '50 Breaststroke (SCY)',
  '50-br-scm': '50 Breaststroke (SCM)',
  '50-br-lcm': '50 Breaststroke (LCM)',
  '100-br-scy': '100 Breaststroke (SCY)',
  '100-br-scm': '100 Breaststroke (SCM)',
  '100-br-lcm': '100 Breaststroke (LCM)',
  '200-br-scy': '200 Breaststroke (SCY)',
  '200-br-scm': '200 Breaststroke (SCM)',
  '200-br-lcm': '200 Breaststroke (LCM)',
  '50-fl-scy': '50 Butterfly (SCY)',
  '50-fl-scm': '50 Butterfly (SCM)',
  '50-fl-lcm': '50 Butterfly (LCM)',
  '100-fl-scy': '100 Butterfly (SCY)',
  '100-fl-scm': '100 Butterfly (SCM)',
  '100-fl-lcm': '100 Butterfly (LCM)',
  '200-fl-scy': '200 Butterfly (SCY)',
  '200-fl-scm': '200 Butterfly (SCM)',
  '200-fl-lcm': '200 Butterfly (LCM)',
  '200-im-scy': '200 Individual Medley (SCY)',
  '200-im-scm': '200 Individual Medley (SCM)',
  '200-im-lcm': '200 Individual Medley (LCM)',
  '400-im-scy': '400 Individual Medley (SCY)',
  '400-im-scm': '400 Individual Medley (SCM)',
  '400-im-lcm': '400 Individual Medley (LCM)',
}