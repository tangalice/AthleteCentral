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
  const [selectedTestType, setSelectedTestType] = useState("all");
  const [selectedDateRange, setSelectedDateRange] = useState("all");
  const [rankings, setRankings] = useState([]);
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
          setTeamId(team.id);
          
          // Get all team members
          const memberIds = teamData.members || [];
          const membersList = [];
          
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
                }
              }
            } catch (err) {
              console.error("Error loading member:", memberId, err);
            }
          }
          
          setTeamMembers(membersList);
        }
      } catch (err) {
        console.error("Error loading team:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTeamAndMembers();
  }, [user]);

  // Load all performances and calculate rankings
  useEffect(() => {
    if (teamMembers.length === 0) return;

    const loadPerformancesAndRank = async () => {
      setLoading(true);
      
      try {
        const allPerformances = [];
        
        // Load test performances for each team member
        for (const member of teamMembers) {
          try {
            const performancesQuery = query(
              collection(db, "users", member.id, "testPerformances"),
              orderBy("date", "desc")
            );
            
            const snapshot = await getDocs(performancesQuery);
            const performances = snapshot.docs.map(d => ({
              id: d.id,
              athleteId: member.id,
              athleteName: member.name,
              ...d.data()
            }));
            
            // Filter by date range
            const filteredPerformances = filterByDateRange(performances, selectedDateRange);
            
            allPerformances.push({
              athleteId: member.id,
              athleteName: member.name,
              performances: filteredPerformances
            });
          } catch (err) {
            console.error(`Error loading performances for ${member.name}:`, err);
          }
        }
        
        // Calculate rankings
        const calculated = calculateRankings(allPerformances, selectedTestType);
        setRankings(calculated);
      } catch (err) {
        console.error("Error loading performances:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPerformancesAndRank();
  }, [teamMembers, selectedTestType, selectedDateRange]);

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

  // Parse time string to seconds for comparison
  const parseTime = (timeValue) => {
    if (!timeValue) return Infinity;
    
    if (typeof timeValue === 'number') return timeValue;
    
    if (typeof timeValue === 'string') {
      // Handle format like "6:40.5" or "1:30:45.2"
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

  // Check if a time value is valid
  const isValidTime = (timeValue) => {
    if (!timeValue) return false;
    
    if (typeof timeValue === 'number') {
      return timeValue > 0 && timeValue !== Infinity;
    }
    
    if (typeof timeValue === 'string') {
      const trimmed = timeValue.trim();
      if (!trimmed || trimmed === '-' || trimmed === 'N/A') return false;
      if (trimmed.includes('--') || trimmed.match(/^-+:?-+\.?-+$/)) return false;
      
      const parsed = parseTime(trimmed);
      return parsed !== Infinity && parsed > 0;
    }
    
    return false;
  };

  // Get personal best for a specific test type
  const getPersonalBest = (performances, testType) => {
    const testsOfType = performances.filter(p => p.testType === testType);
    if (testsOfType.length === 0) return null;
    
    return testsOfType.reduce((best, current) => {
      const currentTime = parseTime(current.time);
      const bestTime = parseTime(best.time);
      return currentTime < bestTime ? current : best;
    });
  };

  // Calculate overall ranking (average percentile across all test types)
  const calculateOverallRanking = (allPerformances) => {
    // Get all unique test types
    const allTestTypes = new Set();
    allPerformances.forEach(athlete => {
      athlete.performances.forEach(p => {
        if (p.testType && isValidTime(p.time)) {
          allTestTypes.add(p.testType);
        }
      });
    });

    const testTypesArray = Array.from(allTestTypes);
    
    // For each athlete, calculate their average ranking across test types
    const athleteScores = allPerformances.map(athlete => {
      let totalPercentile = 0;
      let testsRanked = 0;
      
      testTypesArray.forEach(testType => {
        const athleteBest = getPersonalBest(athlete.performances, testType);
        if (!athleteBest || !isValidTime(athleteBest.time)) return;
        
        // Get all athletes' best times for this test type
        const allBestsForTest = allPerformances
          .map(a => {
            const best = getPersonalBest(a.performances, testType);
            return best && isValidTime(best.time) ? parseTime(best.time) : null;
          })
          .filter(t => t !== null)
          .sort((a, b) => a - b); // Sort ascending (fastest first)
        
        if (allBestsForTest.length === 0) return;
        
        // Find athlete's rank in this test
        const athleteTime = parseTime(athleteBest.time);
        const rank = allBestsForTest.findIndex(t => t === athleteTime);
        
        // Convert to percentile (0 = best, 100 = worst)
        const percentile = (rank / (allBestsForTest.length - 1)) * 100;
        totalPercentile += percentile;
        testsRanked++;
      });
      
      return {
        athleteId: athlete.athleteId,
        athleteName: athlete.athleteName,
        averagePercentile: testsRanked > 0 ? totalPercentile / testsRanked : 100,
        testsCompleted: testsRanked,
        bestTime: null,
        testType: 'Overall'
      };
    });
    
    // Sort by average percentile (lower is better)
    return athleteScores
      .filter(a => a.testsCompleted > 0)
      .sort((a, b) => a.averagePercentile - b.averagePercentile);
  };

  // Calculate rankings for a specific test type
  const calculateTestTypeRanking = (allPerformances, testType) => {
    const athleteBests = allPerformances
      .map(athlete => {
        const best = getPersonalBest(athlete.performances, testType);
        if (!best || !isValidTime(best.time)) return null;
        
        return {
          athleteId: athlete.athleteId,
          athleteName: athlete.athleteName,
          bestTime: best.time,
          bestTimeSeconds: parseTime(best.time),
          date: best.date,
          split: best.split,
          testType: testType
        };
      })
      .filter(a => a !== null)
      .sort((a, b) => a.bestTimeSeconds - b.bestTimeSeconds); // Sort by fastest time
    
    return athleteBests;
  };

  // Main ranking calculation
  const calculateRankings = (allPerformances, testType) => {
    if (testType === "all") {
      return calculateOverallRanking(allPerformances);
    } else {
      return calculateTestTypeRanking(allPerformances, testType);
    }
  };

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

  // Get available test types from all team members
  const availableTestTypes = Array.from(
    new Set(
      teamMembers.flatMap(member => 
        rankings
          .filter(r => r.athleteId === member.id && r.testType)
          .map(r => r.testType)
      )
    )
  ).filter(type => type !== 'Overall');

  // Find current user's rank
  const myRank = rankings.findIndex(r => r.athleteId === user?.uid) + 1;

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
        See where you rank compared to your teammates. Filter by test piece and date range to view specific rankings.
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
            <option value="all">Overall Ranking</option>
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

        {myRank > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backgroundColor: "#f0fdf4",
            borderRadius: "8px",
            border: "2px solid #10b981"
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>
                Your Rank
              </div>
              <div style={{ fontSize: "32px", fontWeight: "800", color: "#10b981" }}>
                #{myRank}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
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
            {selectedTestType === 'all' 
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
                {selectedTestType !== 'all' ? (
                  <>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Best Time
                    </th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Split
                    </th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Date
                    </th>
                  </>
                ) : (
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                    Tests Completed
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rankings.map((athlete, index) => {
                const isCurrentUser = athlete.athleteId === user.uid;
                const rank = index + 1;
                
                return (
                  <tr 
                    key={athlete.athleteId}
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
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ 
                          fontSize: "15px", 
                          fontWeight: isCurrentUser ? "700" : "500", 
                          color: isCurrentUser ? "#10b981" : "#111827" 
                        }}>
                          {athlete.athleteName}
                          {isCurrentUser && " (You)"}
                        </span>
                      </div>
                    </td>

                    {selectedTestType !== 'all' ? (
                      <>
                        {/* Best Time */}
                        <td style={{ padding: "16px", fontSize: "16px", fontWeight: "600", color: "#111827", fontFamily: "monospace" }}>
                          {formatTime(athlete.bestTime)}
                        </td>

                        {/* Split */}
                        <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280", fontFamily: "monospace" }}>
                          {athlete.split || "-"}
                        </td>

                        {/* Date */}
                        <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                          {formatDate(athlete.date)}
                        </td>
                      </>
                    ) : (
                      /* Tests Completed */
                      <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                        {athlete.testsCompleted} test{athlete.testsCompleted !== 1 ? 's' : ''}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}