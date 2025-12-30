import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, getDoc, doc, onSnapshot, orderBy, addDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";

function CoachWeightInfo() {
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [weightHistory, setWeightHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWeights, setLoadingWeights] = useState(false);
  const [error, setError] = useState(null);
  
  // Form state for adding weight
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch athletes using the SAME logic as LineupBuilder
  useEffect(() => {
    const fetchTeamData = async () => {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        setLoading(false);
        setError('No user logged in');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('Fetching team data for weight tracking...');

        // Force token refresh (same as LineupBuilder)
        await currentUser.getIdToken(true);
        console.log('✅ Token refreshed successfully');

        // STEP 1: Get the user's team(s) - EXACT same pattern as LineupBuilder
        const teamsRef = collection(db, 'teams');
        const teamsQuery = query(teamsRef);
        const teamsSnapshot = await getDocs(teamsQuery);
        
        console.log('Found teams:', teamsSnapshot.size);

        // Find teams where current user is a member
        const userTeams = [];
        const teamMemberIds = new Set();

        teamsSnapshot.forEach((teamDoc) => {
          const teamData = teamDoc.data();
          const members = teamData.members || [];
          const athletes = teamData.athletes || [];
          const coaches = teamData.coaches || [];
          
          // Check if current user is in this team
          if (members.includes(currentUser.uid) || 
              athletes.includes(currentUser.uid) || 
              coaches.includes(currentUser.uid)) {
            
            userTeams.push({
              id: teamDoc.id,
              ...teamData
            });
            
            // Collect all member IDs from this team
            [...members, ...athletes, ...coaches].forEach(id => teamMemberIds.add(id));
          }
        });

        console.log('User teams:', userTeams.length);
        console.log('Team member IDs:', Array.from(teamMemberIds));

        if (teamMemberIds.size === 0) {
          setError('You are not part of any team yet');
          setAthletes([]);
          setLoading(false);
          return;
        }

        const athleteIds = Array.from(teamMemberIds);

        // STEP 2: Fetch user documents for all team members, filter for athletes only
        const athletesList = [];
        
        for (const userId of athleteIds) {
          try {
            const userDocRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userDocRef);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              console.log('User data for', userId, ':', userData);
              
              // Only include athletes
              if (userData.role === 'athlete') {
                athletesList.push({
                  id: userSnap.id,
                  ...userData,
                });
              }
            }
          } catch (userError) {
            console.error(`Error fetching user ${userId}:`, userError);
          }
        }

        // Sort by name
        athletesList.sort((a, b) => {
          const nameA = a.displayName || a.name || "";
          const nameB = b.displayName || b.name || "";
          return nameA.localeCompare(nameB);
        });
        
        console.log('Final athletes list:', athletesList);
        setAthletes(athletesList);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching team data:', err);
        setError(`Error loading data: ${err.message}`);
        setAthletes([]);
        setLoading(false);
      }
    };

    fetchTeamData();
  }, []);

  // Load weight history for selected athlete
  useEffect(() => {
    if (!selectedAthlete) {
      setWeightHistory([]);
      return;
    }

    console.log("Setting up weight listener for athlete:", selectedAthlete.id);
    setLoadingWeights(true);

    const q = query(
      collection(db, "users", selectedAthlete.id, "weightData"),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("Weight data snapshot received, docs count:", snapshot.docs.length);
      const weights = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("Weight data:", weights);
      setWeightHistory(weights);
      setLoadingWeights(false);
    }, (error) => {
      console.error("Error fetching weight data:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      setLoadingWeights(false);
    });

    return () => unsubscribe();
  }, [selectedAthlete]);

  // Handle adding weight for selected athlete
  const handleAddWeight = async (e) => {
    e.preventDefault();
    
    if (!selectedAthlete) {
      alert("Please select an athlete first");
      return;
    }

    if (!weight || !date) {
      alert("Please enter both weight and date");
      return;
    }

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      alert("Please enter a valid weight");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("You must be logged in to add weight data");
      return;
    }

    setSubmitting(true);

    try {
      await addDoc(collection(db, "users", selectedAthlete.id, "weightData"), {
        weight: weightNum,
        date: date,
        athleteId: selectedAthlete.id,
        athleteName: selectedAthlete.displayName || selectedAthlete.name || "Unknown",
        enteredBy: currentUser.uid,
        enteredByName: currentUser.displayName || "Coach",
        createdAt: new Date(),
      });
      
      setWeight("");
      setDate(new Date().toISOString().split('T')[0]);
      alert("Weight recorded successfully!");
    } catch (error) {
      console.error("Error adding weight:", error);
      alert("Error recording weight: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle deleting a weight entry
  const handleDelete = async (weightId) => {
    if (!selectedAthlete) return;
    
    if (!window.confirm("Are you sure you want to delete this weight entry?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", selectedAthlete.id, "weightData", weightId));
    } catch (error) {
      console.error("Error deleting weight:", error);
      alert("Error deleting weight: " + error.message);
    }
  };

  // Calculate stats
  const calculateStats = () => {
    if (weightHistory.length === 0) return null;

    const weights = weightHistory.map((entry) => entry.weight);
    const latestWeight = weights[0];
    const averageWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);

    return {
      latest: latestWeight,
      average: averageWeight,
      min: minWeight,
      max: maxWeight,
      entries: weights.length,
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading athletes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div style={{
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "8px",
          padding: "16px",
          color: "#991b1b"
        }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>
            Error
          </h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ 
        fontSize: "28px", 
        fontWeight: "bold", 
        marginBottom: "20px",
        color: "#1f2937"
      }}>
        Athlete Weight Tracking
      </h1>

      {/* Athlete Selection */}
      <div style={{
        backgroundColor: "white",
        padding: "24px",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        marginBottom: "24px",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
      }}>
        <label style={{
          display: "block",
          fontSize: "14px",
          fontWeight: "500",
          marginBottom: "8px",
          color: "#374151"
        }}>
          Select Athlete
        </label>
        <select
          value={selectedAthlete?.id || ""}
          onChange={(e) => {
            const athlete = athletes.find((a) => a.id === e.target.value);
            console.log("Selected athlete:", athlete);
            setSelectedAthlete(athlete || null);
          }}
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            outline: "none",
            backgroundColor: "white"
          }}
        >
          <option value="">-- Select an athlete --</option>
          {athletes.map((athlete) => (
            <option key={athlete.id} value={athlete.id}>
              {athlete.displayName || athlete.name || "Unknown Athlete"}
            </option>
          ))}
        </select>

        {athletes.length === 0 && (
          <p style={{ 
            marginTop: "12px", 
            color: "#6b7280", 
            fontSize: "14px" 
          }}>
            No athletes found on your team.
          </p>
        )}
      </div>

      {/* Add Weight Form - Only shown when athlete is selected */}
      {selectedAthlete && (
        <div style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          marginBottom: "24px",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
        }}>
          <h2 style={{
            fontSize: "20px",
            fontWeight: "600",
            marginBottom: "16px",
            color: "#374151"
          }}>
            Record Weight for {selectedAthlete.displayName || selectedAthlete.name}
          </h2>
          
          <form onSubmit={handleAddWeight}>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "16px"
            }}>
              <div>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                  color: "#374151"
                }}>
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Enter weight in kg"
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                />
              </div>

              <div>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                  color: "#374151"
                }}>
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: submitting ? "#9ca3af" : "#10b981",
                color: "white",
                padding: "10px 20px",
                borderRadius: "6px",
                border: "none",
                fontSize: "14px",
                fontWeight: "500",
                cursor: submitting ? "not-allowed" : "pointer",
                minWidth: "150px"
              }}
              onMouseOver={(e) => {
                if (!submitting) e.target.style.backgroundColor = "#059669";
              }}
              onMouseOut={(e) => {
                if (!submitting) e.target.style.backgroundColor = "#10b981";
              }}
            >
              {submitting ? "Saving..." : "Add Weight Entry"}
            </button>
          </form>
        </div>
      )}

      {/* Weight Statistics */}
      {selectedAthlete && stats && (
        <div style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          marginBottom: "24px",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
        }}>
          <h2 style={{
            fontSize: "20px",
            fontWeight: "600",
            marginBottom: "16px",
            color: "#374151"
          }}>
            Weight Statistics
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "16px"
          }}>
            <div style={{
              padding: "16px",
              backgroundColor: "#f9fafb",
              borderRadius: "6px",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                Latest Weight
              </div>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#10b981" }}>
                {stats.latest.toFixed(1)} kg
              </div>
            </div>

            <div style={{
              padding: "16px",
              backgroundColor: "#f9fafb",
              borderRadius: "6px",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                Average Weight
              </div>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#374151" }}>
                {stats.average.toFixed(1)} kg
              </div>
            </div>

            <div style={{
              padding: "16px",
              backgroundColor: "#f9fafb",
              borderRadius: "6px",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                Min Weight
              </div>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#374151" }}>
                {stats.min.toFixed(1)} kg
              </div>
            </div>

            <div style={{
              padding: "16px",
              backgroundColor: "#f9fafb",
              borderRadius: "6px",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                Max Weight
              </div>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#374151" }}>
                {stats.max.toFixed(1)} kg
              </div>
            </div>

            <div style={{
              padding: "16px",
              backgroundColor: "#f9fafb",
              borderRadius: "6px",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                Total Entries
              </div>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#374151" }}>
                {stats.entries}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weight History Table */}
      {selectedAthlete && (
        <div style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
        }}>
          <h2 style={{
            fontSize: "20px",
            fontWeight: "600",
            marginBottom: "16px",
            color: "#374151"
          }}>
            Weight History
          </h2>

          {loadingWeights ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: "20px" }}>
              Loading weight data...
            </p>
          ) : weightHistory.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: "20px" }}>
              No weight entries recorded for this athlete yet. Use the form above to add the first entry.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse"
              }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{
                      padding: "12px",
                      textAlign: "left",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#374151"
                    }}>
                      Date
                    </th>
                    <th style={{
                      padding: "12px",
                      textAlign: "left",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#374151"
                    }}>
                      Weight (kg)
                    </th>
                    <th style={{
                      padding: "12px",
                      textAlign: "left",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#374151"
                    }}>
                      Change
                    </th>
                    <th style={{
                      padding: "12px",
                      textAlign: "center",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#374151"
                    }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {weightHistory.map((entry, index) => {
                    const previousWeight = index < weightHistory.length - 1 
                      ? weightHistory[index + 1].weight 
                      : null;
                    const change = previousWeight ? entry.weight - previousWeight : null;
                    
                    return (
                      <tr key={entry.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{
                          padding: "12px",
                          fontSize: "14px",
                          color: "#374151"
                        }}>
                          {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td style={{
                          padding: "12px",
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#374151"
                        }}>
                          {entry.weight.toFixed(1)} kg
                        </td>
                        <td style={{
                          padding: "12px",
                          fontSize: "14px",
                          color: change === null 
                            ? "#6b7280" 
                            : change > 0 
                            ? "#ef4444" 
                            : change < 0 
                            ? "#10b981" 
                            : "#6b7280"
                        }}>
                          {change === null 
                            ? "-" 
                            : change > 0 
                            ? `+${change.toFixed(1)} kg ↑`
                            : change < 0 
                            ? `${change.toFixed(1)} kg ↓`
                            : "No change"}
                        </td>
                        <td style={{
                          padding: "12px",
                          textAlign: "center"
                        }}>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            style={{
                              backgroundColor: "#ef4444",
                              color: "white",
                              padding: "6px 12px",
                              borderRadius: "4px",
                              border: "none",
                              fontSize: "12px",
                              fontWeight: "500",
                              cursor: "pointer"
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = "#dc2626"}
                            onMouseOut={(e) => e.target.style.backgroundColor = "#ef4444"}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Privacy Note */}
      <div style={{
        marginTop: "16px",
        padding: "12px",
        backgroundColor: "#f0fdf4",
        border: "1px solid #bbf7d0",
        borderRadius: "6px",
        fontSize: "13px",
        color: "#166534"
      }}>
        <strong>Coach Access:</strong> Weight data is private and only visible to coaches. Athletes cannot view or modify their own weight data.
      </div>
    </div>
  );
}

export default CoachWeightInfo;