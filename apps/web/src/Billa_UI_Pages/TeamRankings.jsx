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

export default function TeamRankings({ user, userSport }) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedTestType, setSelectedTestType] = useState("overall");
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allPerformances, setAllPerformances] = useState({});

  // Get sport-specific test types
  const sportTestTypes = TEST_PIECE_TYPES[userSport?.toLowerCase()] || TEST_PIECE_TYPES.default;

  // Load team and members
  useEffect(() => {
    if (!user) return;

    const loadTeamAndMembers = async () => {
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
          
          // Get all team members
          const memberIds = teamData.members || [];
          const membersList = [];
          const performancesMap = {};
          
          for (const memberId of memberIds) {
            try {
              const userDocRef = doc(db, "users", memberId);
              const userDoc = await getDoc(userDocRef);
              
              if (userDoc.exists()) {
                const userData = userDoc.data();
                // Only include athletes for ranking
                if (userData.role === "athlete") {
                  membersList.push({
                    id: memberId,
                    name: userData.displayName || userData.email || "Unknown",
                    email: userData.email,
                  });
                  
                  // Load performances for this member
                  const performancesQuery = query(
                    collection(db, "users", memberId, "testPerformances"),
                    orderBy("date", "desc")
                  );
                  const perfSnapshot = await getDocs(performancesQuery);
                  performancesMap[memberId] = perfSnapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                  }));
                }
              }
            } catch (err) {
              console.error("Error loading member:", memberId, err);
            }
          }
          
          setTeamMembers(membersList);
          setAllPerformances(performancesMap);
        }
      } catch (err) {
        console.error("Error loading team:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTeamAndMembers();
  }, [user]);

  // Calculate rankings when test type changes
  useEffect(() => {
    if (teamMembers.length === 0) return;
    
    const calculated = calculateRankings();
    setRankings(calculated);
  }, [teamMembers, allPerformances, selectedTestType]);

  // Parse time string to seconds for comparison
  const parseTime = (timeValue) => {
    if (!timeValue) return Infinity;
    
    if (typeof timeValue === 'number') return timeValue;
    
    if (typeof timeValue === 'string') {
      const trimmed = timeValue.trim();
      if (!trimmed || trimmed === '-' || trimmed === 'N/A') return Infinity;
      if (trimmed.includes('--') || trimmed.match(/^-+:?-+\.?-+$/)) return Infinity;

      const parts = trimmed.split(':');
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

  // Check if a time value is valid
  const isValidTime = (timeValue) => {
    if (!timeValue) return false;
    const parsed = parseTime(timeValue);
    return parsed !== Infinity && parsed > 0;
  };

  // Format seconds back to time string
  const formatSecondsToTime = (totalSeconds) => {
    if (!totalSeconds || totalSeconds === Infinity) return "—";
    
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = (totalSeconds % 60).toFixed(1);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.padStart(4, '0')}`;
    }
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  // Calculate average time from an array of performances
  const calculateAverageTime = (performances) => {
    const validPerfs = performances.filter(p => isValidTime(p.time));
    if (validPerfs.length === 0) return null;
    
    const totalSeconds = validPerfs.reduce((sum, p) => sum + parseTime(p.time), 0);
    return totalSeconds / validPerfs.length;
  };

  // Get personal best for a specific test type
  const getPersonalBest = (performances, testType) => {
    const testsOfType = performances.filter(p => p.testType === testType && isValidTime(p.time));
    if (testsOfType.length === 0) return null;
    
    return testsOfType.reduce((best, current) => {
      const currentTime = parseTime(current.time);
      const bestTime = parseTime(best.time);
      return currentTime < bestTime ? current : best;
    });
  };

  // Calculate rankings
  const calculateRankings = () => {
    if (selectedTestType === "overall") {
      return calculateOverallRanking();
    } else {
      return calculateTestTypeRanking(selectedTestType);
    }
  };

  // Calculate overall ranking based on average of all test times
  const calculateOverallRanking = () => {
    const athleteScores = teamMembers.map(member => {
      const memberPerfs = allPerformances[member.id] || [];
      const validPerfs = memberPerfs.filter(p => isValidTime(p.time));
      
      if (validPerfs.length === 0) return null;

      const avgTime = calculateAverageTime(validPerfs);
      const bestPerf = validPerfs.reduce((best, current) => {
        const currentTime = parseTime(current.time);
        const bestTime = parseTime(best.time);
        return currentTime < bestTime ? current : best;
      });

      return {
        id: member.id,
        name: member.name,
        averageTime: avgTime,
        bestTime: parseTime(bestPerf.time),
        totalPerformances: validPerfs.length,
        testTypesCount: [...new Set(validPerfs.map(p => p.testType))].length,
      };
    }).filter(a => a !== null);

    // Sort by average time (lower is better)
    return athleteScores.sort((a, b) => a.averageTime - b.averageTime);
  };

  // Calculate ranking for a specific test type based on average time
  const calculateTestTypeRanking = (testType) => {
    const athleteScores = teamMembers.map(member => {
      const memberPerfs = allPerformances[member.id] || [];
      const testPerfs = memberPerfs.filter(p => p.testType === testType && isValidTime(p.time));
      
      if (testPerfs.length === 0) return null;

      const avgTime = calculateAverageTime(testPerfs);
      const bestPerf = getPersonalBest(memberPerfs, testType);

      return {
        id: member.id,
        name: member.name,
        averageTime: avgTime,
        bestTime: bestPerf ? parseTime(bestPerf.time) : null,
        bestTimeFormatted: bestPerf?.time,
        bestSplit: bestPerf?.split,
        bestDate: bestPerf?.date,
        totalAttempts: testPerfs.length,
      };
    }).filter(a => a !== null);

    // Sort by average time (lower is better)
    return athleteScores.sort((a, b) => a.averageTime - b.averageTime);
  };

  const formatTime = (timeValue) => {
    if (!timeValue || !isValidTime(timeValue)) return "—";
    
    if (typeof timeValue === 'string') return timeValue;
    
    if (typeof timeValue === 'number') {
      const mins = Math.floor(timeValue / 60);
      const secs = (timeValue % 60).toFixed(1);
      return `${mins}:${secs.padStart(4, '0')}`;
    }
    
    return "—";
  };

  const formatDate = (date) => {
    if (!date) return "—";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Find current user's rank
  const myRankIndex = rankings.findIndex(r => r.id === user?.uid);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;

  if (!user) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
        <p style={{ color: "#6b7280" }}>Please log in to view team rankings.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Page Header */}
      <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Team Rankings
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
        See where you rank compared to your teammates based on average times. Filter by test piece to view specific rankings.
      </p>

      {/* Filters & My Rank Card */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "16px",
        marginBottom: "30px",
        alignItems: "stretch",
      }}>
        {/* Filter */}
        <div style={{
          padding: "20px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}>
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
              maxWidth: "300px",
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
            <option value="overall">Overall Ranking</option>
            {sportTestTypes.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px", marginBottom: 0 }}>
            Rankings are based on average time across all attempts
          </p>
        </div>

        {/* My Rank Card */}
        {myRank && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 32px",
            backgroundColor: "#f0fdf4",
            borderRadius: "12px",
            border: "2px solid #10b981",
            minWidth: "180px",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>
                Your Rank
              </div>
              <div style={{ fontSize: "36px", fontWeight: "800", color: "#10b981" }}>
                #{myRank}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
                out of {rankings.length}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rankings Table */}
      {loading ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
        }}>
          <p style={{ color: "#6b7280", fontSize: "15px" }}>Loading rankings...</p>
        </div>
      ) : rankings.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
        }}>
          <p style={{ color: "#111827", fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
            No Rankings Available
          </p>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
            {selectedTestType === 'overall' 
              ? "No test data available for any team members yet."
              : `No ${selectedTestType} test data available yet.`}
          </p>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          overflow: "hidden"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151", width: "80px" }}>
                  Rank
                </th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  Athlete
                </th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    Avg Time
                    <span style={{
                      padding: "2px 6px",
                      backgroundColor: "#e0f2fe",
                      color: "#0369a1",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: "600"
                    }}>
                      RANKED BY
                    </span>
                  </div>
                </th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  Best Time
                </th>
                {selectedTestType !== 'overall' ? (
                  <>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Best Split
                    </th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Attempts
                    </th>
                  </>
                ) : (
                  <>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Test Types
                    </th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Total Tests
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rankings.map((athlete, index) => {
                const isCurrentUser = athlete.id === user.uid;
                const rank = index + 1;
                
                return (
                  <tr 
                    key={athlete.id}
                    style={{ 
                      borderBottom: index < rankings.length - 1 ? "1px solid #e5e7eb" : "none",
                      backgroundColor: isCurrentUser ? "#f0fdf4" : "transparent",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrentUser) {
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrentUser) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    {/* Rank */}
                    <td style={{ padding: "16px" }}>
                      <div style={{
                        width: "40px",
                        height: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        backgroundColor: rank === 1 ? "#fbbf24" : rank === 2 ? "#9ca3af" : rank === 3 ? "#d97706" : isCurrentUser ? "#10b981" : "#e5e7eb",
                        color: rank <= 3 || isCurrentUser ? "white" : "#6b7280",
                        fontSize: "16px",
                        fontWeight: "700"
                      }}>
                        {rank}
                      </div>
                    </td>

                    {/* Athlete Name */}
                    <td style={{ padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {/* Avatar */}
                        <div style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          backgroundColor: isCurrentUser ? "#10b981" : "#e5e7eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isCurrentUser ? "white" : "#6b7280",
                          fontSize: "14px",
                          fontWeight: "600"
                        }}>
                          {athlete.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span style={{ 
                            fontSize: "15px", 
                            fontWeight: isCurrentUser ? "700" : "500", 
                            color: isCurrentUser ? "#10b981" : "#111827" 
                          }}>
                            {athlete.name}
                          </span>
                          {isCurrentUser && (
                            <span style={{
                              marginLeft: "8px",
                              padding: "2px 8px",
                              backgroundColor: "#10b981",
                              color: "white",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "600"
                            }}>
                              YOU
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Average Time */}
                    <td style={{ padding: "16px" }}>
                      <div style={{ 
                        fontSize: "16px", 
                        fontWeight: "700", 
                        color: "#111827", 
                        fontFamily: "monospace" 
                      }}>
                        {formatSecondsToTime(athlete.averageTime)}
                      </div>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                        average
                      </div>
                    </td>

                    {/* Best Time */}
                    <td style={{ padding: "16px" }}>
                      <div style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: "#6b7280", 
                        fontFamily: "monospace" 
                      }}>
                        {selectedTestType !== 'overall' 
                          ? formatTime(athlete.bestTimeFormatted)
                          : formatSecondsToTime(athlete.bestTime)
                        }
                      </div>
                      {selectedTestType !== 'overall' && athlete.bestDate && (
                        <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                          {formatDate(athlete.bestDate)}
                        </div>
                      )}
                    </td>

                    {selectedTestType !== 'overall' ? (
                      <>
                        {/* Best Split */}
                        <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280", fontFamily: "monospace" }}>
                          {athlete.bestSplit || "—"}
                        </td>

                        {/* Attempts */}
                        <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                          {athlete.totalAttempts}
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Test Types */}
                        <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                          {athlete.testTypesCount}
                        </td>

                        {/* Total Tests */}
                        <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                          {athlete.totalPerformances}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: "20px",
        padding: "16px 20px",
        backgroundColor: "#f9fafb",
        borderRadius: "8px",
        display: "flex",
        gap: "24px",
        flexWrap: "wrap",
        fontSize: "13px",
        color: "#6b7280"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#fbbf24" }}></div>
          <span>1st Place</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#9ca3af" }}></div>
          <span>2nd Place</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#d97706" }}></div>
          <span>3rd Place</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#10b981" }}></div>
          <span>Your Position</span>
        </div>
      </div>

      {/* Info Box */}
      <div style={{
        marginTop: "16px",
        padding: "16px 20px",
        backgroundColor: "#eff6ff",
        borderRadius: "8px",
        border: "1px solid #bfdbfe",
        fontSize: "13px",
        color: "#1e40af"
      }}>
        <strong>How rankings work:</strong> Athletes are ranked by their average time across all {selectedTestType === 'overall' ? 'test performances' : `${selectedTestType} attempts`}. 
        Lower average time = higher rank.
      </div>
    </div>
  );
}