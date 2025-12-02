// src/pages/ImprovementRatesPage.jsx
import { useEffect, useState } from "react";
import {
  collection,
  query,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

// Sport-specific test piece types
const TEST_PIECE_TYPES = {
  rowing: ["2k", "6k", "500m", "5k", "10k", "30min"],
  swimming: [
    "50 Free", "100 Free", "200 Free", "500 Free", "1000 Free", "1650 Free",
    "50 Fly", "100 Fly", "200 Fly",
    "50 Back", "100 Back", "200 Back",
    "50 Breast", "100 Breast", "200 Breast",
    "200 IM", "400 IM"
  ],
  running: ["100m", "200m", "400m", "800m", "1500m", "Mile", "3000m", "5k", "10k"],
  default: ["Test 1", "Test 2", "Test 3", "Test 4"]
};

// Distance in meters for each rowing test type
const ROWING_DISTANCES = {
  "2k": 2000,
  "6k": 6000,
  "500m": 500,
  "5k": 5000,
  "10k": 10000,
  "30min": null
};

export default function ImprovementRatesPage({ user, userSport }) {
  const [performances, setPerformances] = useState([]);
  const [selectedTestType, setSelectedTestType] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Hypothetical calculator state
  const [hypotheticalTime, setHypotheticalTime] = useState("");
  const [hypotheticalResult, setHypotheticalResult] = useState(null);

  // Check if user is a rower
  const isRower = userSport?.toLowerCase() === "rowing";

  // Get sport-specific test types
  const sportTestTypes = TEST_PIECE_TYPES[userSport?.toLowerCase()] || TEST_PIECE_TYPES.default;

  // Load performances
  useEffect(() => {
    if (!user?.uid) return;

    const loadPerformances = async () => {
      setLoading(true);
      try {
        const performancesQuery = query(
          collection(db, "users", user.uid, "testPerformances"),
          orderBy("date", "asc") // Oldest first for improvement calculation
        );
        
        const snapshot = await getDocs(performancesQuery);
        const allPerformances = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        
        setPerformances(allPerformances);
        
        // Auto-select first test type that has data
        const testTypesWithData = [...new Set(allPerformances.map(p => p.testType))].filter(Boolean);
        if (testTypesWithData.length > 0 && !selectedTestType) {
          setSelectedTestType(testTypesWithData[0]);
        }
      } catch (err) {
        console.error("Error loading performances:", err);
        setPerformances([]);
      } finally {
        setLoading(false);
      }
    };

    loadPerformances();
  }, [user]);

  // Parse time string to seconds
  const parseTime = (timeValue) => {
    if (!timeValue) return Infinity;
    
    if (typeof timeValue === 'number') return timeValue;
    
    if (typeof timeValue === 'string') {
      const parts = timeValue.split(':');
      if (parts.length === 2) {
        const mins = parseInt(parts[0]) || 0;
        const secs = parseFloat(parts[1]) || 0;
        return mins * 60 + secs;
      } else if (parts.length === 3) {
        const hours = parseInt(parts[0]) || 0;
        const mins = parseInt(parts[1]) || 0;
        const secs = parseFloat(parts[2]) || 0;
        return hours * 3600 + mins * 60 + secs;
      }
    }
    
    return Infinity;
  };

  // Format seconds to time string
  const formatTime = (seconds) => {
    if (!seconds || seconds === Infinity) return "N/A";
    
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = (seconds % 60).toFixed(1);
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.padStart(4, '0')}`;
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Calculate split from total time and distance
  const calculateSplitFromTime = (timeSeconds, testType) => {
    const distance = ROWING_DISTANCES[testType];
    if (!distance || !timeSeconds || timeSeconds <= 0) return null;
    return (timeSeconds / distance) * 500;
  };

  // Calculate watts from split
  const calculateWatts = (splitSeconds) => {
    if (!splitSeconds || splitSeconds <= 0) return null;
    const pace = splitSeconds / 500;
    return Math.round(2.80 / Math.pow(pace, 3));
  };

  // Format split
  const formatSplit = (splitSeconds) => {
    if (!splitSeconds || splitSeconds <= 0) return "N/A";
    const mins = Math.floor(splitSeconds / 60);
    const secs = (splitSeconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  // Get performances for selected test type (sorted by date ascending)
  const filteredPerformances = performances
    .filter(p => p.testType === selectedTestType)
    .sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dateA - dateB;
    });

  // Calculate improvement data
  const calculateImprovementData = () => {
    if (filteredPerformances.length === 0) return [];

    return filteredPerformances.map((perf, index) => {
      const currentTime = parseTime(perf.time);
      const currentSplit = isRower ? calculateSplitFromTime(currentTime, selectedTestType) : null;
      const currentWatts = currentSplit ? calculateWatts(currentSplit) : null;

      let improvementFromLast = null;
      let improvementFromFirst = null;
      let percentFromLast = null;
      let percentFromFirst = null;
      let splitImprovementFromLast = null;
      let wattsImprovementFromLast = null;

      if (index > 0) {
        // Improvement from last test
        const lastTime = parseTime(filteredPerformances[index - 1].time);
        improvementFromLast = lastTime - currentTime; // Positive = improved (faster)
        percentFromLast = (improvementFromLast / lastTime) * 100;

        if (isRower) {
          const lastSplit = calculateSplitFromTime(lastTime, selectedTestType);
          const lastWatts = lastSplit ? calculateWatts(lastSplit) : null;
          splitImprovementFromLast = lastSplit && currentSplit ? lastSplit - currentSplit : null;
          wattsImprovementFromLast = lastWatts && currentWatts ? currentWatts - lastWatts : null;
        }
      }

      if (index > 0) {
        // Improvement from first test
        const firstTime = parseTime(filteredPerformances[0].time);
        improvementFromFirst = firstTime - currentTime;
        percentFromFirst = (improvementFromFirst / firstTime) * 100;
      }

      return {
        ...perf,
        index: index + 1,
        currentTime,
        currentSplit,
        currentWatts,
        improvementFromLast,
        percentFromLast,
        improvementFromFirst,
        percentFromFirst,
        splitImprovementFromLast,
        wattsImprovementFromLast,
      };
    });
  };

  const improvementData = calculateImprovementData();

  // Get overall stats
  const getOverallStats = () => {
    if (improvementData.length < 2) return null;

    const first = improvementData[0];
    const last = improvementData[improvementData.length - 1];
    const best = improvementData.reduce((best, curr) => 
      curr.currentTime < best.currentTime ? curr : best
    );

    const totalImprovement = first.currentTime - last.currentTime;
    const totalPercent = (totalImprovement / first.currentTime) * 100;

    const improvementToBest = first.currentTime - best.currentTime;
    const percentToBest = (improvementToBest / first.currentTime) * 100;

    // Calculate average improvement per test
    const avgImprovementPerTest = totalImprovement / (improvementData.length - 1);

    // Calculate days between first and last
    const firstDate = first.date?.toDate ? first.date.toDate() : new Date(first.date);
    const lastDate = last.date?.toDate ? last.date.toDate() : new Date(last.date);
    const daysBetween = Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24));

    // Average improvement per month
    const monthsBetween = daysBetween / 30;
    const avgImprovementPerMonth = monthsBetween > 0 ? totalImprovement / monthsBetween : 0;

    return {
      first,
      last,
      best,
      totalImprovement,
      totalPercent,
      improvementToBest,
      percentToBest,
      avgImprovementPerTest,
      avgImprovementPerMonth,
      totalTests: improvementData.length,
      daysBetween,
    };
  };

  const overallStats = getOverallStats();

  // Calculate hypothetical improvement
  const calculateHypothetical = () => {
    if (!hypotheticalTime || improvementData.length === 0) {
      setHypotheticalResult(null);
      return;
    }

    const hypotheticalSeconds = parseTime(hypotheticalTime);
    if (hypotheticalSeconds === Infinity) {
      setHypotheticalResult(null);
      return;
    }

    const first = improvementData[0];
    const last = improvementData[improvementData.length - 1];
    const best = improvementData.reduce((best, curr) => 
      curr.currentTime < best.currentTime ? curr : best
    );

    const improvementFromFirst = first.currentTime - hypotheticalSeconds;
    const percentFromFirst = (improvementFromFirst / first.currentTime) * 100;

    const improvementFromLast = last.currentTime - hypotheticalSeconds;
    const percentFromLast = (improvementFromLast / last.currentTime) * 100;

    const improvementFromBest = best.currentTime - hypotheticalSeconds;
    const percentFromBest = (improvementFromBest / best.currentTime) * 100;

    let hypotheticalSplit = null;
    let hypotheticalWatts = null;
    let splitImprovementFromBest = null;
    let wattsImprovementFromBest = null;

    if (isRower) {
      hypotheticalSplit = calculateSplitFromTime(hypotheticalSeconds, selectedTestType);
      hypotheticalWatts = hypotheticalSplit ? calculateWatts(hypotheticalSplit) : null;
      
      const bestSplit = calculateSplitFromTime(best.currentTime, selectedTestType);
      const bestWatts = bestSplit ? calculateWatts(bestSplit) : null;
      
      splitImprovementFromBest = bestSplit && hypotheticalSplit ? bestSplit - hypotheticalSplit : null;
      wattsImprovementFromBest = bestWatts && hypotheticalWatts ? hypotheticalWatts - bestWatts : null;
    }

    setHypotheticalResult({
      hypotheticalSeconds,
      hypotheticalSplit,
      hypotheticalWatts,
      improvementFromFirst,
      percentFromFirst,
      improvementFromLast,
      percentFromLast,
      improvementFromBest,
      percentFromBest,
      splitImprovementFromBest,
      wattsImprovementFromBest,
      isNewPR: hypotheticalSeconds < best.currentTime,
    });
  };

  // Format improvement value
  const formatImprovement = (value, isTime = true) => {
    if (value === null || value === undefined) return "-";
    
    const sign = value > 0 ? "-" : "+"; // Negative time = slower, so flip
    const absValue = Math.abs(value);
    
    if (isTime) {
      return `${sign}${absValue.toFixed(1)}s`;
    }
    return `${sign}${absValue.toFixed(1)}%`;
  };

  // Format watts improvement (positive = more power = better)
  const formatWattsImprovement = (value) => {
    if (value === null || value === undefined) return "-";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value}W`;
  };

  // Get test types that have data
  const testTypesWithData = [...new Set(performances.map(p => p.testType))].filter(Boolean);

  if (!user) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
        <p style={{ color: "#6b7280" }}>Please log in to view improvement rates.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Page Header */}
      <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Improvement Rates
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
        Track your progress over time. See how much you've improved between test pieces and calculate hypothetical improvements.
      </p>

      {/* Filters */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginBottom: "30px",
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
      }}>
        <div>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "500",
            color: "#374151",
            fontSize: "14px"
          }}>
            Select Test Piece
          </label>
          <select
            value={selectedTestType}
            onChange={(e) => {
              setSelectedTestType(e.target.value);
              setHypotheticalResult(null);
              setHypotheticalTime("");
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#111827",
              fontSize: "14px",
              outline: "none",
              cursor: "pointer"
            }}
          >
            <option value="">Select a test piece</option>
            {sportTestTypes.map(type => (
              <option key={type} value={type} disabled={!testTypesWithData.includes(type)}>
                {type} {testTypesWithData.includes(type) ? "" : "(no data)"}
              </option>
            ))}
          </select>
        </div>

        {overallStats && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backgroundColor: overallStats.totalImprovement > 0 ? "#f0fdf4" : "#fef2f2",
            borderRadius: "8px",
            border: `2px solid ${overallStats.totalImprovement > 0 ? "#10b981" : "#ef4444"}`
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>
                Total Improvement
              </div>
              <div style={{ 
                fontSize: "28px", 
                fontWeight: "800", 
                color: overallStats.totalImprovement > 0 ? "#10b981" : "#ef4444",
                fontFamily: "monospace"
              }}>
                {overallStats.totalImprovement > 0 ? "-" : "+"}{Math.abs(overallStats.totalImprovement).toFixed(1)}s
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                {Math.abs(overallStats.totalPercent).toFixed(1)}% {overallStats.totalImprovement > 0 ? "faster" : "slower"}
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
        }}>
          <p style={{ color: "#6b7280", fontSize: "15px" }}>Loading performance data...</p>
        </div>
      ) : !selectedTestType ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
        }}>
          <p style={{ color: "#111827", fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
            Select a Test Piece
          </p>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
            Choose a test piece from the dropdown to see your improvement rates.
          </p>
        </div>
      ) : filteredPerformances.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
        }}>
          <p style={{ color: "#111827", fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
            No Data Available
          </p>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
            You haven't recorded any {selectedTestType} tests yet.
          </p>
        </div>
      ) : (
        <>
          {/* Overall Stats Cards */}
          {overallStats && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "30px"
            }}>
              <div style={{
                padding: "20px",
                backgroundColor: "#fff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>First Test</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#111827", fontFamily: "monospace" }}>
                  {formatTime(overallStats.first.currentTime)}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  {formatDate(overallStats.first.date)}
                </div>
              </div>

              <div style={{
                padding: "20px",
                backgroundColor: "#fff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Latest Test</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#111827", fontFamily: "monospace" }}>
                  {formatTime(overallStats.last.currentTime)}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  {formatDate(overallStats.last.date)}
                </div>
              </div>

              <div style={{
                padding: "20px",
                backgroundColor: "#f0fdf4",
                borderRadius: "12px",
                border: "2px solid #10b981",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Personal Best</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#10b981", fontFamily: "monospace" }}>
                  {formatTime(overallStats.best.currentTime)}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  {formatDate(overallStats.best.date)}
                </div>
              </div>

              <div style={{
                padding: "20px",
                backgroundColor: "#fff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Tests Completed</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#111827" }}>
                  {overallStats.totalTests}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  over {overallStats.daysBetween} days
                </div>
              </div>

              <div style={{
                padding: "20px",
                backgroundColor: "#fff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Avg per Test</div>
                <div style={{ 
                  fontSize: "24px", 
                  fontWeight: "700", 
                  color: overallStats.avgImprovementPerTest > 0 ? "#10b981" : "#ef4444",
                  fontFamily: "monospace"
                }}>
                  {overallStats.avgImprovementPerTest > 0 ? "-" : "+"}{Math.abs(overallStats.avgImprovementPerTest).toFixed(1)}s
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  per test piece
                </div>
              </div>

              <div style={{
                padding: "20px",
                backgroundColor: "#fff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Avg per Month</div>
                <div style={{ 
                  fontSize: "24px", 
                  fontWeight: "700", 
                  color: overallStats.avgImprovementPerMonth > 0 ? "#10b981" : "#ef4444",
                  fontFamily: "monospace"
                }}>
                  {overallStats.avgImprovementPerMonth > 0 ? "-" : "+"}{Math.abs(overallStats.avgImprovementPerMonth).toFixed(1)}s
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  per month
                </div>
              </div>
            </div>
          )}

          {/* Improvement History Table */}
          <div style={{ marginBottom: "30px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
              Test History & Improvement
            </h3>
            
            <div style={{ 
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              overflow: "hidden"
            }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isRower ? "900px" : "600px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                      <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                        #
                      </th>
                      <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                        Date
                      </th>
                      <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                        Time
                      </th>
                      {isRower && (
                        <>
                          <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                            Split
                          </th>
                          <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                            Watts
                          </th>
                        </>
                      )}
                      <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                        vs Last Test
                      </th>
                      <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                        vs First Test
                      </th>
                      {isRower && (
                        <>
                          <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                            Split Δ
                          </th>
                          <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                            Watts Δ
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {improvementData.map((row, index) => {
                      const isPR = row.currentTime === overallStats?.best.currentTime;
                      
                      return (
                        <tr 
                          key={row.id}
                          style={{ 
                            borderBottom: index < improvementData.length - 1 ? "1px solid #e5e7eb" : "none",
                            backgroundColor: isPR ? "#f0fdf4" : "transparent",
                            transition: "background-color 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            if (!isPR) e.currentTarget.style.backgroundColor = "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            if (!isPR) e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                            {row.index}
                          </td>
                          <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                            {formatDate(row.date)}
                          </td>
                          <td style={{ padding: "16px", textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                              <span style={{ 
                                fontSize: "16px", 
                                fontWeight: "600", 
                                color: isPR ? "#10b981" : "#111827", 
                                fontFamily: "monospace" 
                              }}>
                                {formatTime(row.currentTime)}
                              </span>
                              {isPR && (
                                <span style={{
                                  padding: "2px 8px",
                                  backgroundColor: "#10b981",
                                  color: "white",
                                  borderRadius: "12px",
                                  fontSize: "10px",
                                  fontWeight: "600"
                                }}>
                                  PR
                                </span>
                              )}
                            </div>
                          </td>
                          {isRower && (
                            <>
                              <td style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "500", color: "#111827", fontFamily: "monospace" }}>
                                {row.currentSplit ? formatSplit(row.currentSplit) : "-"}
                              </td>
                              <td style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "500", color: "#111827", fontFamily: "monospace" }}>
                                {row.currentWatts ? `${row.currentWatts}W` : "-"}
                              </td>
                            </>
                          )}
                          <td style={{ padding: "16px", textAlign: "center" }}>
                            {row.improvementFromLast !== null ? (
                              <div>
                                <span style={{
                                  fontSize: "14px",
                                  fontWeight: "600",
                                  color: row.improvementFromLast > 0 ? "#10b981" : "#ef4444",
                                  fontFamily: "monospace"
                                }}>
                                  {row.improvementFromLast > 0 ? "-" : "+"}{Math.abs(row.improvementFromLast).toFixed(1)}s
                                </span>
                                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                                  ({Math.abs(row.percentFromLast).toFixed(1)}%)
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#9ca3af", fontSize: "14px" }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: "16px", textAlign: "center" }}>
                            {row.improvementFromFirst !== null ? (
                              <div>
                                <span style={{
                                  fontSize: "14px",
                                  fontWeight: "600",
                                  color: row.improvementFromFirst > 0 ? "#10b981" : "#ef4444",
                                  fontFamily: "monospace"
                                }}>
                                  {row.improvementFromFirst > 0 ? "-" : "+"}{Math.abs(row.improvementFromFirst).toFixed(1)}s
                                </span>
                                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                                  ({Math.abs(row.percentFromFirst).toFixed(1)}%)
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#9ca3af", fontSize: "14px" }}>-</span>
                            )}
                          </td>
                          {isRower && (
                            <>
                              <td style={{ padding: "16px", textAlign: "center" }}>
                                {row.splitImprovementFromLast !== null ? (
                                  <span style={{
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    color: row.splitImprovementFromLast > 0 ? "#10b981" : "#ef4444",
                                    fontFamily: "monospace"
                                  }}>
                                    {row.splitImprovementFromLast > 0 ? "-" : "+"}{Math.abs(row.splitImprovementFromLast).toFixed(1)}s
                                  </span>
                                ) : (
                                  <span style={{ color: "#9ca3af", fontSize: "14px" }}>-</span>
                                )}
                              </td>
                              <td style={{ padding: "16px", textAlign: "center" }}>
                                {row.wattsImprovementFromLast !== null ? (
                                  <span style={{
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    color: row.wattsImprovementFromLast > 0 ? "#10b981" : "#ef4444",
                                    fontFamily: "monospace"
                                  }}>
                                    {row.wattsImprovementFromLast > 0 ? "+" : ""}{row.wattsImprovementFromLast}W
                                  </span>
                                ) : (
                                  <span style={{ color: "#9ca3af", fontSize: "14px" }}>-</span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Hypothetical Calculator */}
          <div style={{
            padding: "24px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px", color: "#111827" }}>
              Hypothetical Improvement Calculator
            </h3>
            <p style={{ color: "#6b7280", marginBottom: "20px", fontSize: "14px" }}>
              Enter a hypothetical time to see how much improvement it would represent.
            </p>

            <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "24px" }}>
              <div>
                <label style={{ 
                  display: "block", 
                  marginBottom: "8px", 
                  fontWeight: "500",
                  color: "#374151",
                  fontSize: "14px"
                }}>
                  Hypothetical Time (M:SS.s)
                </label>
                <input
                  type="text"
                  value={hypotheticalTime}
                  onChange={(e) => setHypotheticalTime(e.target.value)}
                  placeholder="e.g., 6:30.0"
                  style={{
                    width: "180px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#fff",
                    color: "#111827",
                    fontSize: "14px",
                    fontFamily: "monospace",
                    outline: "none"
                  }}
                />
              </div>

              <button
                onClick={calculateHypothetical}
                disabled={!hypotheticalTime}
                style={{
                  padding: "10px 20px",
                  backgroundColor: hypotheticalTime ? "#3b82f6" : "#9ca3af",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: hypotheticalTime ? "pointer" : "not-allowed",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (hypotheticalTime) e.currentTarget.style.backgroundColor = "#2563eb";
                }}
                onMouseLeave={(e) => {
                  if (hypotheticalTime) e.currentTarget.style.backgroundColor = "#3b82f6";
                }}
              >
                Calculate
              </button>
            </div>

            {hypotheticalResult && (
              <div style={{
                padding: "20px",
                backgroundColor: hypotheticalResult.isNewPR ? "#f0fdf4" : "#f9fafb",
                borderRadius: "12px",
                border: hypotheticalResult.isNewPR ? "2px solid #10b981" : "1px solid #e5e7eb"
              }}>
                {hypotheticalResult.isNewPR && (
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    backgroundColor: "#10b981",
                    color: "white",
                    borderRadius: "16px",
                    fontSize: "12px",
                    fontWeight: "600",
                    marginBottom: "16px"
                  }}>
                    🎉 This would be a new PR!
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "20px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Hypothetical Time</div>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: "#111827", fontFamily: "monospace" }}>
                      {formatTime(hypotheticalResult.hypotheticalSeconds)}
                    </div>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>vs First Test</div>
                    <div style={{ 
                      fontSize: "20px", 
                      fontWeight: "700", 
                      color: hypotheticalResult.improvementFromFirst > 0 ? "#10b981" : "#ef4444",
                      fontFamily: "monospace"
                    }}>
                      {hypotheticalResult.improvementFromFirst > 0 ? "-" : "+"}{Math.abs(hypotheticalResult.improvementFromFirst).toFixed(1)}s
                    </div>
                    <div style={{ fontSize: "11px", color: "#6b7280" }}>
                      ({Math.abs(hypotheticalResult.percentFromFirst).toFixed(1)}%)
                    </div>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>vs Last Test</div>
                    <div style={{ 
                      fontSize: "20px", 
                      fontWeight: "700", 
                      color: hypotheticalResult.improvementFromLast > 0 ? "#10b981" : "#ef4444",
                      fontFamily: "monospace"
                    }}>
                      {hypotheticalResult.improvementFromLast > 0 ? "-" : "+"}{Math.abs(hypotheticalResult.improvementFromLast).toFixed(1)}s
                    </div>
                    <div style={{ fontSize: "11px", color: "#6b7280" }}>
                      ({Math.abs(hypotheticalResult.percentFromLast).toFixed(1)}%)
                    </div>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>vs Current PR</div>
                    <div style={{ 
                      fontSize: "20px", 
                      fontWeight: "700", 
                      color: hypotheticalResult.improvementFromBest > 0 ? "#10b981" : "#ef4444",
                      fontFamily: "monospace"
                    }}>
                      {hypotheticalResult.improvementFromBest > 0 ? "-" : "+"}{Math.abs(hypotheticalResult.improvementFromBest).toFixed(1)}s
                    </div>
                    <div style={{ fontSize: "11px", color: "#6b7280" }}>
                      ({Math.abs(hypotheticalResult.percentFromBest).toFixed(1)}%)
                    </div>
                  </div>

                  {isRower && hypotheticalResult.hypotheticalSplit && (
                    <>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Hypothetical Split</div>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "#111827", fontFamily: "monospace" }}>
                          {formatSplit(hypotheticalResult.hypotheticalSplit)}
                        </div>
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Hypothetical Watts</div>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "#111827", fontFamily: "monospace" }}>
                          {hypotheticalResult.hypotheticalWatts}W
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}