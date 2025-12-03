import { useEffect, useState } from "react";
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  where,
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

export default function TeammateComparison({ user, userSport }) {
  const [teammates, setTeammates] = useState([]);
  const [selectedTeammate, setSelectedTeammate] = useState("");
  const [selectedTestType, setSelectedTestType] = useState("all");
  const [selectedDateRange, setSelectedDateRange] = useState("all");
  
  const [myPerformances, setMyPerformances] = useState([]);
  const [teammatePerformances, setTeammatePerformances] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState(null);

  // Get sport-specific test types
  const sportTestTypes = TEST_PIECE_TYPES[userSport?.toLowerCase()] || TEST_PIECE_TYPES.default;

  // Date range options
  const dateRangeOptions = [
    { value: "all", label: "All Time" },
    { value: "7", label: "Last 7 Days" },
    { value: "30", label: "Last 30 Days" },
    { value: "90", label: "Last 3 Months" },
    { value: "180", label: "Last 6 Months" },
    { value: "365", label: "Last Year" },
  ];

  // Filter performances by date range
  const filterByDateRange = (performances, dateRange) => {
    if (dateRange === "all") return performances;
    
    const days = parseInt(dateRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return performances.filter(perf => {
      if (!perf.date) return false;
      const perfDate = perf.date.toDate ? perf.date.toDate() : new Date(perf.date);
      return perfDate >= cutoffDate;
    });
  };

  // Load team and teammates
  useEffect(() => {
    if (!user) return;

    const loadTeamAndTeammates = async () => {
      try {
        // Find teams where user is a member
        const teamsQuery = query(
          collection(db, "teams"),
          where("members", "array-contains", user.uid)
        );
        
        const teamsSnapshot = await getDocs(teamsQuery);
        
        if (!teamsSnapshot.empty) {
          const team = teamsSnapshot.docs[0];
          const teamData = team.data();
          setTeamId(team.id);
          
          // Get all team members
          const memberIds = teamData.members || [];
          const teammatesList = [];
          
          for (const memberId of memberIds) {
            // Skip current user
            if (memberId === user.uid) continue;
            
            try {
              const userDocRef = doc(db, "users", memberId);
              const userDoc = await getDoc(userDocRef);
              
              if (userDoc.exists()) {
                const userData = userDoc.data();
                // Only include athletes (not coaches) for comparison
                if (userData.role === "athlete") {
                  teammatesList.push({
                    id: memberId,
                    name: userData.displayName || userData.email || "Unknown",
                    email: userData.email,
                  });
                }
              }
            } catch (err) {
              console.error("Error loading teammate:", memberId, err);
            }
          }
          
          setTeammates(teammatesList);
          
          // Auto-select first teammate
          if (teammatesList.length > 0) {
            setSelectedTeammate(teammatesList[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading team:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTeamAndTeammates();
  }, [user]);

  // Load my test performances
  useEffect(() => {
    if (!user?.uid) return;

    const loadMyPerformances = async () => {
      try {
        const performancesQuery = query(
          collection(db, "users", user.uid, "testPerformances"),
          orderBy("date", "desc")
        );
        
        const snapshot = await getDocs(performancesQuery);
        const allPerformances = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        
        // Filter by date range
        const filtered = filterByDateRange(allPerformances, selectedDateRange);
        setMyPerformances(filtered);
      } catch (err) {
        console.error("Error loading my performances:", err);
        setMyPerformances([]);
      }
    };

    loadMyPerformances();
  }, [user, selectedDateRange]);

  // Load teammate's test performances
  useEffect(() => {
    if (!selectedTeammate) return;

    const loadTeammatePerformances = async () => {
      setLoading(true);
      try {
        const performancesQuery = query(
          collection(db, "users", selectedTeammate, "testPerformances"),
          orderBy("date", "desc")
        );
        
        const snapshot = await getDocs(performancesQuery);
        const allPerformances = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        
        // Filter by date range
        const filtered = filterByDateRange(allPerformances, selectedDateRange);
        setTeammatePerformances(filtered);
      } catch (err) {
        console.error("Error loading teammate performances:", err);
        setTeammatePerformances([]);
      } finally {
        setLoading(false);
      }
    };

    loadTeammatePerformances();
  }, [selectedTeammate, selectedDateRange]);

  // Filter performances by test type
  const getFilteredPerformances = (performances) => {
    if (selectedTestType === "all") return performances;
    return performances.filter(perf => perf.testType === selectedTestType);
  };

  const filteredMyPerformances = getFilteredPerformances(myPerformances);
  const filteredTeammatePerformances = getFilteredPerformances(teammatePerformances);

  // Parse time string to seconds for comparison
  const parseTime = (timeValue) => {
    if (!timeValue) return Infinity;
    
    if (typeof timeValue === 'number') return timeValue;
    
    if (typeof timeValue === 'string') {
      // Handle format like "6:40.5" or "1:30:45.2"
      const parts = timeValue.split(':');
      if (parts.length === 2) {
        // MM:SS.ms
        const mins = parseInt(parts[0]) || 0;
        const secs = parseFloat(parts[1]) || 0;
        return mins * 60 + secs;
      } else if (parts.length === 3) {
        // HH:MM:SS
        const hours = parseInt(parts[0]) || 0;
        const mins = parseInt(parts[1]) || 0;
        const secs = parseFloat(parts[2]) || 0;
        return hours * 3600 + mins * 60 + secs;
      }
    }
    
    return Infinity;
  };

  // Get personal best for a specific test type
  const getPersonalBest = (performances, testType) => {
    const testsOfType = performances.filter(p => p.testType === testType);
    if (testsOfType.length === 0) return null;
    
    // Find the best (lowest) time
    return testsOfType.reduce((best, current) => {
      const currentTime = parseTime(current.time);
      const bestTime = parseTime(best.time);
      return currentTime < bestTime ? current : best;
    });
  };

  // Check if a time value is valid (not a placeholder)
  const isValidTime = (timeValue) => {
    if (!timeValue) return false;
    
    // If it's a number, it's valid if positive and not Infinity
    if (typeof timeValue === 'number') {
      return timeValue > 0 && timeValue !== Infinity;
    }
    
    // If it's a string, check if it's a valid time format (not "--:--.-" or similar)
    if (typeof timeValue === 'string') {
      const trimmed = timeValue.trim();
      
      // Check for empty or placeholder patterns
      if (!trimmed || trimmed === '-' || trimmed === 'N/A') {
        return false;
      }
      
      // Check for placeholder patterns with dashes
      if (trimmed.includes('--') || trimmed.match(/^-+:?-+\.?-+$/)) {
        return false;
      }
      
      // Try to parse it - if it results in a valid number, it's good
      const parsed = parseTime(trimmed);
      return parsed !== Infinity && parsed > 0;
    }
    
    return false;
  };

  // Get available test types from both users
  const myTestTypes = [...new Set(myPerformances.map(p => p.testType))].filter(Boolean);
  const teammateTestTypes = [...new Set(teammatePerformances.map(p => p.testType))].filter(Boolean);
  const allTestTypes = [...new Set([...myTestTypes, ...teammateTestTypes])].sort();

  const formatTime = (timeValue) => {
    if (!timeValue) return "N/A";
    
    if (typeof timeValue === 'string') {
      return timeValue;
    }
    
    if (typeof timeValue === 'number') {
      const mins = Math.floor(timeValue / 60);
      const secs = (timeValue % 60).toFixed(1);
      return `${mins}:${secs.padStart(4, '0')}`;
    }
    
    return "N/A";
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Calculate time difference (positive = I'm slower, negative = I'm faster)
  const calculateTimeDifference = (myTime, teammateTime) => {
    const mySeconds = parseTime(myTime);
    const teammateSeconds = parseTime(teammateTime);
    
    if (mySeconds === Infinity || teammateSeconds === Infinity) return null;
    
    const diff = mySeconds - teammateSeconds;
    return diff;
  };

  const formatTimeDifference = (diff) => {
    if (diff === null) return "";
    
    const absDiff = Math.abs(diff);
    const sign = diff > 0 ? "+" : "-";
    const secs = absDiff.toFixed(1);
    
    return `${sign}${secs}s`;
  };

  const selectedTeammateName = teammates.find(t => t.id === selectedTeammate)?.name || "Teammate";

  // Build comparison data for side-by-side view
  const buildComparisonData = () => {
    if (selectedTestType === "all") {
      // Show only test types where BOTH athletes have performances
      return allTestTypes
        .map(testType => {
          const myBest = getPersonalBest(myPerformances, testType);
          const teammateBest = getPersonalBest(teammatePerformances, testType);
          
          return {
            testType,
            myBest,
            teammateBest,
            myCount: myPerformances.filter(p => p.testType === testType).length,
            teammateCount: teammatePerformances.filter(p => p.testType === testType).length,
          };
        })
        .filter(row => row.myBest && row.teammateBest && isValidTime(row.myBest.time) && isValidTime(row.teammateBest.time));
    } else {
      // Show recent performances for selected test type
      const myTests = myPerformances.filter(p => p.testType === selectedTestType);
      const teammateTests = teammatePerformances.filter(p => p.testType === selectedTestType);
      
      const maxLength = Math.max(myTests.length, teammateTests.length);
      const comparisons = [];
      
      for (let i = 0; i < maxLength; i++) {
        comparisons.push({
          testType: selectedTestType,
          myTest: myTests[i] || null,
          teammateTest: teammateTests[i] || null,
          index: i,
        });
      }
      
      return comparisons;
    }
  };

  const comparisonData = buildComparisonData();

  if (!user) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
        <p style={{ color: "#6b7280" }}>Please log in to view teammate comparisons.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Page Header */}
      <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Teammate Comparison
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
        Compare your test performances with your teammates side by side. Filter by test piece and date range to see specific comparisons.
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
            Compare With Teammate
          </label>
          <select
            value={selectedTeammate}
            onChange={(e) => setSelectedTeammate(e.target.value)}
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
            {teammates.length === 0 && <option value="">No teammates found</option>}
            {teammates.map(teammate => (
              <option key={teammate.id} value={teammate.id}>
                {teammate.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "500",
            color: "#374151",
            fontSize: "14px"
          }}>
            Filter by Test Piece
          </label>
          <select
            value={selectedTestType}
            onChange={(e) => setSelectedTestType(e.target.value)}
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
            <option value="all">All Test Types (Personal Bests)</option>
            {sportTestTypes.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "500",
            color: "#374151",
            fontSize: "14px"
          }}>
            Date Range
          </label>
          <select
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value)}
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
            {dateRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison View */}
      {loading ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
        }}>
          <p style={{ color: "#6b7280", fontSize: "15px" }}>Loading comparison data...</p>
        </div>
      ) : teammates.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
        }}>
          <p style={{ color: "#111827", fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
            No Teammates Found
          </p>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
            You need teammates on your team to use the comparison feature.
          </p>
        </div>
      ) : selectedTestType === "all" ? (
        /* Personal Bests Comparison View */
        <div>
          <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
            Personal Bests Comparison
          </h3>
          
          <div style={{ 
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            overflow: "hidden"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                    Test Type
                  </th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                    My Best
                  </th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                    {selectedTeammateName}'s Best
                  </th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                    Difference
                  </th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                    Tests Completed
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: "32px", textAlign: "center", color: "#6b7280" }}>
                      <div style={{ marginBottom: "8px", fontSize: "16px", fontWeight: "500", color: "#111827" }}>
                        No common test types found
                      </div>
                      <div style={{ fontSize: "14px" }}>
                        You and {selectedTeammateName} haven't both completed the same test types yet.
                      </div>
                    </td>
                  </tr>
                ) : (
                  comparisonData.map((row, index) => {
                    const myTime = row.myBest?.time;
                    const teammateTime = row.teammateBest?.time;
                    const diff = calculateTimeDifference(myTime, teammateTime);
                    
                    return (
                      <tr 
                        key={row.testType}
                        style={{ 
                          borderBottom: index < comparisonData.length - 1 ? "1px solid #e5e7eb" : "none",
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <td style={{ padding: "16px" }}>
                          <span style={{
                            padding: "4px 12px",
                            backgroundColor: "#e0f2fe",
                            color: "#0369a1",
                            borderRadius: "16px",
                            fontSize: "13px",
                            fontWeight: "600"
                          }}>
                            {row.testType}
                          </span>
                        </td>
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827", fontFamily: "monospace" }}>
                            {myTime ? formatTime(myTime) : "-"}
                          </div>
                          {row.myBest && (
                            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                              {formatDate(row.myBest.date)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827", fontFamily: "monospace" }}>
                            {teammateTime ? formatTime(teammateTime) : "-"}
                          </div>
                          {row.teammateBest && (
                            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                              {formatDate(row.teammateBest.date)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          {diff !== null ? (
                            <span style={{
                              fontSize: "14px",
                              fontWeight: "600",
                              color: diff > 0 ? "#dc2626" : "#10b981",
                              fontFamily: "monospace"
                            }}>
                              {formatTimeDifference(diff)}
                            </span>
                          ) : (
                            <span style={{ color: "#9ca3af", fontSize: "14px" }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "16px", textAlign: "center", fontSize: "14px", color: "#6b7280" }}>
                          {row.myCount} vs {row.teammateCount}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Detailed Comparison for Selected Test Type */
        <div>
          <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
            {selectedTestType} - Detailed Comparison
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {/* My Performances */}
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "20px"
            }}>
              <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
                My Performances
              </h4>
              
              {filteredMyPerformances.length === 0 ? (
                <p style={{ color: "#6b7280", fontSize: "14px", textAlign: "center", padding: "20px" }}>
                  No {selectedTestType} tests recorded
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {(() => {
                    // Find the actual personal best (fastest time)
                    const myBestPerf = getPersonalBest(filteredMyPerformances, selectedTestType);
                    const myBestId = myBestPerf?.id;
                    
                    return filteredMyPerformances.map((perf) => {
                      const isBest = perf.id === myBestId;
                      
                      return (
                        <div 
                          key={perf.id}
                          style={{
                            padding: "12px",
                            backgroundColor: isBest ? "#f0fdf4" : "#f9fafb",
                            borderRadius: "8px",
                            border: isBest ? "2px solid #10b981" : "1px solid #e5e7eb"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontSize: "18px", fontWeight: "700", color: "#111827", fontFamily: "monospace" }}>
                              {formatTime(perf.time)}
                            </span>
                            {isBest && (
                              <span style={{
                                padding: "2px 8px",
                                backgroundColor: "#10b981",
                                color: "white",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "600"
                              }}>
                                BEST
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            {formatDate(perf.date)}
                            {perf.split && ` • Split: ${perf.split}`}
                          </div>
                          {perf.notes && (
                            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", fontStyle: "italic" }}>
                              {perf.notes}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Teammate's Performances */}
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "20px"
            }}>
              <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
                {selectedTeammateName}'s Performances
              </h4>
              
              {filteredTeammatePerformances.length === 0 ? (
                <p style={{ color: "#6b7280", fontSize: "14px", textAlign: "center", padding: "20px" }}>
                  No {selectedTestType} tests recorded
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {(() => {
                    // Find the actual personal best (fastest time)
                    const teammateBestPerf = getPersonalBest(filteredTeammatePerformances, selectedTestType);
                    const teammateBestId = teammateBestPerf?.id;
                    
                    return filteredTeammatePerformances.map((perf) => {
                      const isBest = perf.id === teammateBestId;
                      
                      return (
                        <div 
                          key={perf.id}
                          style={{
                            padding: "12px",
                            backgroundColor: isBest ? "#eff6ff" : "#f9fafb",
                            borderRadius: "8px",
                            border: isBest ? "2px solid #3b82f6" : "1px solid #e5e7eb"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontSize: "18px", fontWeight: "700", color: "#111827", fontFamily: "monospace" }}>
                              {formatTime(perf.time)}
                            </span>
                            {isBest && (
                              <span style={{
                                padding: "2px 8px",
                                backgroundColor: "#3b82f6",
                                color: "white",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "600"
                              }}>
                                BEST
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            {formatDate(perf.date)}
                            {perf.split && ` • Split: ${perf.split}`}
                          </div>
                          {perf.notes && (
                            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", fontStyle: "italic" }}>
                              {perf.notes}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Personal Best Summary for Selected Test */}
          {filteredMyPerformances.length > 0 && filteredTeammatePerformances.length > 0 && (() => {
            // Get actual personal bests (fastest times)
            const myBestPerf = getPersonalBest(filteredMyPerformances, selectedTestType);
            const teammateBestPerf = getPersonalBest(filteredTeammatePerformances, selectedTestType);
            
            if (!myBestPerf || !teammateBestPerf) return null;
            
            return (
              <div style={{
                marginTop: "20px",
                padding: "20px",
                backgroundColor: "#fff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb"
              }}>
                <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", color: "#111827" }}>
                  Personal Best Comparison - {selectedTestType}
                </h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>My Best</div>
                    <div style={{ fontSize: "24px", fontWeight: "700", color: "#10b981", fontFamily: "monospace" }}>
                      {formatTime(myBestPerf.time)}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Difference</div>
                    <div style={{ 
                      fontSize: "24px", 
                      fontWeight: "700", 
                      color: calculateTimeDifference(
                        myBestPerf.time, 
                        teammateBestPerf.time
                      ) > 0 ? "#dc2626" : "#10b981",
                      fontFamily: "monospace"
                    }}>
                      {formatTimeDifference(
                        calculateTimeDifference(
                          myBestPerf.time, 
                          teammateBestPerf.time
                        )
                      )}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                      {selectedTeammateName}'s Best
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: "700", color: "#3b82f6", fontFamily: "monospace" }}>
                      {formatTime(teammateBestPerf.time)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}