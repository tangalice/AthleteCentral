import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  where,
  orderBy,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

const TEST_PIECE_TYPES = {
  rowing: ["2k", "6k", "5k", "20'@20", "Custom"],
  swimming: ["50 Free", "100 Free", "200 Free", "500 Free", "1000 Free", "1650 Free", "50 Fly", "100 Fly", "200 Fly", "50 Back", "100 Back", "200 Back", "50 Breast", "100 Breast", "200 Breast", "200 IM", "400 IM"],
  running: ["100m", "200m", "400m", "800m", "1500m", "Mile", "3000m", "5k", "10k"],
  default: ["Test 1", "Test 2", "Test 3", "Test 4"]
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

export default function IndividualPerformance({ user, userRole, userSport }) {
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [testPerformances, setTestPerformances] = useState([]);
  const [selectedTestType, setSelectedTestType] = useState("all");
  const [selectedCustomDate, setSelectedCustomDate] = useState("all");
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState(null);
  
  const [editingPerformance, setEditingPerformance] = useState(null);
  const [editFormData, setEditFormData] = useState({
    time: "",
    notes: "",
    testType: ""
  });

  const sportTestTypes = TEST_PIECE_TYPES[userSport?.toLowerCase()] || TEST_PIECE_TYPES.default;

  // ── OPTIMIZED: Parallel member fetching ──
  useEffect(() => {
    if (!user) return;

    const loadTeamAndAthletes = async () => {
      try {
        const teamsQuery = query(
          collection(db, "teams"),
          where("members", "array-contains", user.uid)
        );
        
        const teamsSnapshot = await getDocs(teamsQuery);
        
        if (!teamsSnapshot.empty) {
          const team = teamsSnapshot.docs[0];
          const teamData = team.data();
          setTeamId(team.id);
          
          const memberIds = teamData.members || [];
          
          // OPTIMIZED: Fetch ALL member docs in parallel instead of one by one
          const memberDocs = await Promise.all(
            memberIds.map(memberId => 
              getDoc(doc(db, "users", memberId)).catch(err => {
                console.error("Error loading member:", memberId, err);
                return null;
              })
            )
          );
          
          const athletesList = memberDocs
            .filter(userDoc => userDoc && userDoc.exists())
            .map(userDoc => {
              const userData = userDoc.data();
              return {
                id: userDoc.id,
                name: userData.displayName || userData.email || "Unknown",
                email: userData.email,
                role: userData.role
              };
            });
          
          setAthletes(athletesList);
          
          if (athletesList.length > 0) {
            const currentUserInList = athletesList.find(a => a.id === user.uid);
            setSelectedAthlete(currentUserInList?.id || athletesList[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading team:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTeamAndAthletes();
  }, [user]);

  useEffect(() => {
    if (!selectedAthlete) return;

    const loadTestPerformances = async () => {
      setLoading(true);
      try {
        const performancesQuery = query(
          collection(db, "users", selectedAthlete, "testPerformances"),
          orderBy("date", "desc")
        );
        
        const snapshot = await getDocs(performancesQuery);
        const performances = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        
        setTestPerformances(performances);
      } catch (err) {
        console.error("Error loading test performances:", err);
        setTestPerformances([]);
      } finally {
        setLoading(false);
      }
    };

    loadTestPerformances();
  }, [selectedAthlete]);

  useEffect(() => {
    if (selectedTestType !== "Custom") {
      setSelectedCustomDate("all");
    }
  }, [selectedTestType]);

  const customWorkoutDates = useMemo(() => {
    const dates = new Set();
    testPerformances.forEach(perf => {
      if (perf.testType === 'Custom' && perf.date) {
        const formatted = formatDateForInput(perf.date);
        if (formatted) dates.add(formatted);
      }
    });
    return Array.from(dates).sort((a, b) => new Date(b) - new Date(a));
  }, [testPerformances]);

  const filteredPerformances = useMemo(() => {
    return testPerformances.filter(perf => {
      const matchesTestType = selectedTestType === "all" || perf.testType === selectedTestType;
      const matchesCustomDate = selectedTestType !== "Custom" || selectedCustomDate === "all" || formatDateForInput(perf.date) === selectedCustomDate;
      return matchesTestType && matchesCustomDate;
    });
  }, [testPerformances, selectedTestType, selectedCustomDate]);

  const availableTestTypes = [...new Set(testPerformances.map(p => p.testType))].filter(Boolean);

  const formatTime = (timeValue) => {
    if (!timeValue) return "N/A";
    if (typeof timeValue === 'string') return timeValue;
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

  const handleDelete = async (performanceId) => {
    if (!window.confirm("Are you sure you want to delete this test result?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", selectedAthlete, "testPerformances", performanceId));
      setTestPerformances(prev => prev.filter(p => p.id !== performanceId));
      alert("Test result deleted successfully!");
    } catch (err) {
      console.error("Error deleting performance:", err);
      alert("Failed to delete test result. Please try again.");
    }
  };

  const handleEditClick = (performance) => {
    setEditingPerformance(performance);
    setEditFormData({
      time: performance.time || "",
      notes: performance.notes || "",
      testType: performance.testType || ""
    });
  };

  const handleEditSave = async () => {
    if (!editingPerformance) return;

    try {
      const perfRef = doc(db, "users", selectedAthlete, "testPerformances", editingPerformance.id);
      
      await updateDoc(perfRef, {
        time: editFormData.time,
        notes: editFormData.notes,
        testType: editFormData.testType,
        updatedAt: new Date()
      });
      
      setTestPerformances(prev => prev.map(p => 
        p.id === editingPerformance.id 
          ? { ...p, ...editFormData }
          : p
      ));
      
      setEditingPerformance(null);
      setEditFormData({ time: "", notes: "", testType: "" });
      
      alert("Test result updated successfully!");
    } catch (err) {
      console.error("Error updating performance:", err);
      alert("Failed to update test result. Please try again.");
    }
  };

  const selectedAthleteName = athletes.find(a => a.id === selectedAthlete)?.name || "Athlete";
  const isCoach = userRole === "coach";
  const customWorkoutCount = testPerformances.filter(p => p.testType === 'Custom').length;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Individual Test Performances
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
        View test results and performance history for team members.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "30px",
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
      }}>
        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
            Select Athlete
          </label>
          <select
            value={selectedAthlete}
            onChange={(e) => setSelectedAthlete(e.target.value)}
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
            {athletes.length === 0 && <option value="">No athletes found</option>}
            {athletes.map(athlete => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.name} {athlete.id === user.uid ? "(You)" : ""} {athlete.role === "coach" ? "- Coach" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
            Filter by Test Type
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
            <option value="all">All Test Types</option>
            {availableTestTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {selectedTestType === "Custom" && customWorkoutDates.length > 0 && (
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#7c3aed", fontSize: "14px" }}>
              Custom Workout Date
            </label>
            <select
              value={selectedCustomDate}
              onChange={(e) => setSelectedCustomDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "2px solid #8b5cf6",
                backgroundColor: "#f5f3ff",
                color: "#111827",
                fontSize: "14px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="all">All Custom Workouts</option>
              {customWorkoutDates.map(date => (
                <option key={date} value={date}>
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {testPerformances.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>TOTAL TESTS</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{testPerformances.length}</div>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '16px', borderRadius: '8px', border: '2px solid #8b5cf6', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginBottom: '4px' }}>CUSTOM WORKOUTS</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#7c3aed' }}>{customWorkoutCount}</div>
          </div>
          <div style={{ backgroundColor: '#d1fae5', padding: '16px', borderRadius: '8px', border: '1px solid #10b981', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 600, marginBottom: '4px' }}>FILTERED</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>{filteredPerformances.length}</div>
          </div>
        </div>
      )}

      <div>
        <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
          Test History for {selectedAthleteName} ({filteredPerformances.length})
        </h3>
        
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
            <p style={{ color: "#6b7280", fontSize: "15px" }}>Loading test results...</p>
          </div>
        ) : filteredPerformances.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
            <p style={{ color: "#111827", fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>No test results found</p>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
              {selectedAthlete 
                ? `${selectedAthleteName} hasn't completed any tests yet${selectedTestType !== 'all' ? ` for ${selectedTestType}` : ''}.`
                : "Select an athlete to view their test results."}
            </p>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Date</th>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Test Type</th>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Time/Split</th>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Watts</th>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Notes</th>
                  {isCoach && <th style={{ padding: "16px", textAlign: "right", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredPerformances.map((perf, index) => {
                  const isCustom = perf.isCustomWorkout || perf.testType === 'Custom';
                  return (
                    <tr 
                      key={perf.id} 
                      style={{ 
                        borderBottom: index < filteredPerformances.length - 1 ? "1px solid #e5e7eb" : "none",
                        backgroundColor: isCustom ? '#f5f3ff' : 'transparent',
                        transition: "background-color 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isCustom ? '#ede9fe' : "#f9fafb"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isCustom ? '#f5f3ff' : "transparent"}
                    >
                      <td style={{ padding: "16px", fontSize: "14px", color: "#111827" }}>{formatDate(perf.date)}</td>
                      <td style={{ padding: "16px" }}>
                        <span style={{
                          padding: "4px 12px",
                          backgroundColor: isCustom ? "#ddd6fe" : "#e0f2fe",
                          color: isCustom ? "#7c3aed" : "#0369a1",
                          borderRadius: "16px",
                          fontSize: "13px",
                          fontWeight: "600"
                        }}>
                          {perf.testType || "N/A"}
                          {isCustom && perf.customPieceCount && ` (${perf.customPieceCount} pcs)`}
                        </span>
                      </td>
                      <td style={{ padding: "16px", fontSize: "16px", fontWeight: "600", color: "#10b981", fontFamily: "monospace" }}>
                        {perf.split || perf.avgSplit || formatTime(perf.time)}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", fontWeight: "600", color: "#111827" }}>
                        {perf.watts || "-"}
                        {perf.wattsPerKg && (
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>
                            ({typeof perf.wattsPerKg === 'number' ? perf.wattsPerKg.toFixed(2) : perf.wattsPerKg} W/kg)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>{perf.notes || "-"}</td>
                      {isCoach && (
                        <td style={{ padding: "16px", textAlign: "right" }}>
                          <button onClick={() => handleEditClick(perf)} style={{ padding: "6px 12px", marginRight: "8px", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "500", cursor: "pointer" }}>Edit</button>
                          <button onClick={() => handleDelete(perf.id)} style={{ padding: "6px 12px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "500", cursor: "pointer" }}>Delete</button>
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

      {editingPerformance && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "32px", maxWidth: "500px", width: "90%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#111827" }}>Edit Test Result</h3>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>Test Type</label>
              <select value={editFormData.testType} onChange={(e) => setEditFormData({ ...editFormData, testType: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", outline: "none" }}>
                {sportTestTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>Time</label>
              <input type="text" value={editFormData.time} onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })} placeholder="e.g., 8:00.0" style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", outline: "none" }} />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>Notes</label>
              <textarea value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} rows="3" style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", outline: "none", resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setEditingPerformance(null)} style={{ padding: "10px 20px", backgroundColor: "#f3f4f6", color: "#374151", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleEditSave} style={{ padding: "10px 20px", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}