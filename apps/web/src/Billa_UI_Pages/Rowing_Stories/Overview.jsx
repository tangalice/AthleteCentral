import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

export default function Overview({ user }) {
  const [isCoach, setIsCoach] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allAbsences, setAllAbsences] = useState([]);
  const [allMakeups, setAllMakeups] = useState([]);
  const [allExtraWork, setAllExtraWork] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selected athlete for detail view
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athleteAbsences, setAthleteAbsences] = useState([]);
  const [athleteMakeups, setAthleteMakeups] = useState([]);
  const [athleteExtraWork, setAthleteExtraWork] = useState([]);

  // Form for adding unexcused absence
  const [showAddAbsence, setShowAddAbsence] = useState(false);
  const [newAbsenceDate, setNewAbsenceDate] = useState("");

  // Check if user is coach and fetch team data
  useEffect(() => {
    if (!user) return;

    const fetchUserAndTeam = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userIsCoach = userData.role === "coach";
          setIsCoach(userIsCoach);

          // Get team members
          const teamsSnapshot = await getDocs(collection(db, "teams"));
          const userTeam = teamsSnapshot.docs.find(teamDoc => {
            const teamData = teamDoc.data();
            return teamData.members?.includes(user.uid) || 
                   teamData.coaches?.includes(user.uid) ||
                   teamDoc.id === userData.teamId;
          });

          if (userTeam) {
            const teamData = userTeam.data();
            const memberIds = [...(teamData.members || []), ...(teamData.coaches || [])];
            
            // Fetch member details
            const memberPromises = memberIds.map(async (memberId) => {
              const memberDoc = await getDoc(doc(db, "users", memberId));
              if (memberDoc.exists()) {
                return { id: memberId, ...memberDoc.data() };
              }
              return null;
            });

            const members = (await Promise.all(memberPromises)).filter(Boolean);
            setTeamMembers(members.filter(m => m.role === "athlete"));
          }
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user/team:", err);
        setLoading(false);
      }
    };

    fetchUserAndTeam();
  }, [user]);

  // Fetch all team data
  useEffect(() => {
    if (teamMembers.length === 0) return;

    const fetchAllData = async () => {
      try {
        const absencesPromises = teamMembers.map(async (member) => {
          const absencesSnapshot = await getDocs(
            collection(db, "users", member.id, "absences")
          );
          return absencesSnapshot.docs.map(d => ({
            id: d.id,
            odId: member.id,
            odAthleteN: member.displayName || member.email,
            ...d.data()
          }));
        });

        const makeupsPromises = teamMembers.map(async (member) => {
          const makeupsSnapshot = await getDocs(
            collection(db, "users", member.id, "makeups")
          );
          return makeupsSnapshot.docs.map(d => ({
            id: d.id,
            odId: member.id,
            athleteName: member.displayName || member.email,
            ...d.data()
          }));
        });

        const extraWorkPromises = teamMembers.map(async (member) => {
          const extraWorkSnapshot = await getDocs(
            collection(db, "users", member.id, "extraWork")
          );
          return extraWorkSnapshot.docs.map(d => ({
            id: d.id,
            odId: member.id,
            athleteName: member.displayName || member.email,
            ...d.data()
          }));
        });

        const allAbsencesData = (await Promise.all(absencesPromises)).flat();
        const allMakeupsData = (await Promise.all(makeupsPromises)).flat();
        const allExtraWorkData = (await Promise.all(extraWorkPromises)).flat();

        setAllAbsences(allAbsencesData);
        setAllMakeups(allMakeupsData);
        setAllExtraWork(allExtraWorkData);
      } catch (err) {
        console.error("Error fetching team data:", err);
      }
    };

    fetchAllData();
  }, [teamMembers]);

  // When an athlete is selected, filter their data
  useEffect(() => {
    if (!selectedAthlete) {
      setAthleteAbsences([]);
      setAthleteMakeups([]);
      setAthleteExtraWork([]);
      return;
    }

    const absences = allAbsences.filter(a => a.odId === selectedAthlete.id);
    const makeups = allMakeups.filter(m => m.odId === selectedAthlete.id);
    const extraWork = allExtraWork.filter(e => e.odId === selectedAthlete.id);

    // Sort by date descending
    absences.sort((a, b) => new Date(b.date) - new Date(a.date));
    makeups.sort((a, b) => new Date(b.date) - new Date(a.date));
    extraWork.sort((a, b) => new Date(b.date) - new Date(a.date));

    setAthleteAbsences(absences);
    setAthleteMakeups(makeups);
    setAthleteExtraWork(extraWork);
  }, [selectedAthlete, allAbsences, allMakeups, allExtraWork]);

  // Calculate stats for an athlete
  const getAthleteStats = (athleteId) => {
    const absences = allAbsences.filter(a => a.odId === athleteId);
    const makeups = allMakeups.filter(m => m.odId === athleteId);
    const extraWork = allExtraWork.filter(e => e.odId === athleteId);

    const excused = absences.filter(a => a.type === "excused").length;
    const unexcused = absences.filter(a => a.type === "unexcused").length;
    const makeupCount = makeups.length;
    const totalMinutes = extraWork.reduce((sum, e) => sum + (e.minutes || 0), 0);
    const totalAbsences = excused + unexcused;
    const netAbsences = Math.max(0, totalAbsences - makeupCount);

    return { excused, unexcused, totalAbsences, makeupCount, totalMinutes, netAbsences };
  };

  // Get team summary sorted by net absences
  const getTeamSummary = () => {
    return teamMembers.map(member => {
      const stats = getAthleteStats(member.id);
      return {
        ...member,
        ...stats
      };
    }).sort((a, b) => b.netAbsences - a.netAbsences);
  };

  // Color functions
  const getAbsenceColor = (count, maxCount = 5) => {
    if (count === 0) return "#d1fae5";
    const intensity = Math.min(count / maxCount, 1);
    const r = 254;
    const g = Math.round(226 - (226 - 100) * intensity);
    const b = Math.round(226 - (226 - 100) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getMakeupColor = (count, maxCount = 10) => {
    if (count === 0) return "#f3f4f6";
    const intensity = Math.min(count / maxCount, 1);
    const r = Math.round(220 - (220 - 16) * intensity);
    const g = Math.round(252 - (252 - 185) * intensity);
    const b = Math.round(231 - (231 - 129) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  // Add unexcused absence (coach only)
  const handleAddUnexcused = async (e) => {
    e.preventDefault();
    if (!selectedAthlete || !newAbsenceDate || !isCoach) return;

    try {
      await addDoc(collection(db, "users", selectedAthlete.id, "absences"), {
        date: newAbsenceDate,
        type: "unexcused",
        reason: "No-show (marked by coach)",
        athleteName: selectedAthlete.displayName || selectedAthlete.email,
        athleteId: selectedAthlete.id,
        markedBy: user.uid,
        createdAt: new Date(),
      });

      // Update local state
      const newAbsence = {
        id: 'temp-' + Date.now(),
        odId: selectedAthlete.id,
        athleteName: selectedAthlete.displayName || selectedAthlete.email,
        date: newAbsenceDate,
        type: "unexcused",
        reason: "No-show (marked by coach)",
      };
      setAllAbsences(prev => [...prev, newAbsence]);

      setNewAbsenceDate("");
      setShowAddAbsence(false);
      alert("Unexcused absence recorded!");
    } catch (err) {
      console.error("Error adding absence:", err);
      alert("Could not record absence.");
    }
  };

  // Delete absence (coach only)
  const handleDeleteAbsence = async (absenceId, athleteId) => {
    if (!isCoach) return;
    if (!window.confirm("Delete this absence record?")) return;
    
    try {
      await deleteDoc(doc(db, "users", athleteId, "absences", absenceId));
      setAllAbsences(prev => prev.filter(a => a.id !== absenceId));
    } catch (err) {
      console.error("Error deleting absence:", err);
      alert("Could not delete absence.");
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px", textAlign: "center" }}>
        <p style={{ color: "#6b7280" }}>Loading...</p>
      </div>
    );
  }

  const teamSummary = getTeamSummary();
  const selectedStats = selectedAthlete ? getAthleteStats(selectedAthlete.id) : null;

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
          Attendance Overview
        </h2>
        <p style={{ color: "#6b7280", fontSize: "15px" }}>
          Team attendance summary. Click on an athlete's name to view their detailed history.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedAthlete ? "1fr 1fr" : "1fr 400px", gap: "24px" }}>
        {/* Left: Team Summary Tables */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Missed Practice Table */}
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: 0 }}>
                Missed Practice
              </h3>
            </div>
            
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: "600", color: "#374151", fontSize: "13px" }}>
                      Athlete
                    </th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "13px", width: "50px" }}>
                      F
                    </th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "13px", width: "50px" }}>
                      U
                    </th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "13px", width: "50px" }}>
                      T
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teamSummary.map((athlete) => (
                    <tr 
                      key={athlete.id} 
                      style={{ 
                        borderTop: "1px solid #e5e7eb",
                        cursor: "pointer",
                        backgroundColor: selectedAthlete?.id === athlete.id ? "#eff6ff" : "transparent",
                      }}
                      onClick={() => setSelectedAthlete(athlete)}
                    >
                      <td style={{ 
                        padding: "10px 16px", 
                        fontSize: "14px", 
                        fontWeight: "500", 
                        color: "#111827",
                      }}>
                        <span style={{ 
                          borderBottom: "1px dashed #9ca3af",
                          cursor: "pointer",
                        }}>
                          {athlete.displayName || athlete.email}
                        </span>
                      </td>
                      <td style={{ 
                        padding: "10px 12px", 
                        textAlign: "center", 
                        fontSize: "13px",
                        fontWeight: "600",
                        backgroundColor: getAbsenceColor(athlete.excused),
                      }}>
                        {athlete.excused}
                      </td>
                      <td style={{ 
                        padding: "10px 12px", 
                        textAlign: "center", 
                        fontSize: "13px",
                        fontWeight: "600",
                        backgroundColor: getAbsenceColor(athlete.unexcused * 1.5),
                      }}>
                        {athlete.unexcused}
                      </td>
                      <td style={{ 
                        padding: "10px 12px", 
                        textAlign: "center", 
                        fontSize: "13px",
                        fontWeight: "700",
                        backgroundColor: getAbsenceColor(athlete.netAbsences),
                      }}>
                        {athlete.netAbsences}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Extra Work Table */}
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: 0 }}>
                Extra Work
              </h3>
            </div>
            
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: "600", color: "#374151", fontSize: "13px" }}>
                      Athlete
                    </th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "13px", width: "100px" }}>
                      Total Minutes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...teamSummary]
                    .sort((a, b) => b.totalMinutes - a.totalMinutes)
                    .map((athlete) => (
                    <tr 
                      key={athlete.id} 
                      style={{ 
                        borderTop: "1px solid #e5e7eb",
                        cursor: "pointer",
                        backgroundColor: selectedAthlete?.id === athlete.id ? "#eff6ff" : "transparent",
                      }}
                      onClick={() => setSelectedAthlete(athlete)}
                    >
                      <td style={{ 
                        padding: "10px 16px", 
                        fontSize: "14px", 
                        fontWeight: "500", 
                        color: "#111827",
                      }}>
                        <span style={{ 
                          borderBottom: "1px dashed #9ca3af",
                          cursor: "pointer",
                        }}>
                          {athlete.displayName || athlete.email}
                        </span>
                      </td>
                      <td style={{ 
                        padding: "10px 12px", 
                        textAlign: "center", 
                        fontSize: "13px",
                        fontWeight: "600",
                        backgroundColor: getMakeupColor(athlete.totalMinutes, 150),
                      }}>
                        {athlete.totalMinutes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Selected Athlete Detail or Legend */}
        <div>
          {selectedAthlete ? (
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}>
              {/* Athlete Header */}
              <div style={{ 
                padding: "20px", 
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: 0 }}>
                    {selectedAthlete.displayName || selectedAthlete.email}
                  </h3>
                  <p style={{ fontSize: "13px", color: "#6b7280", margin: "4px 0 0 0" }}>
                    Attendance History
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAthlete(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#6b7280",
                    cursor: "pointer",
                    fontSize: "20px",
                    padding: "4px 8px",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Stats Summary */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(5, 1fr)", 
                gap: "1px",
                backgroundColor: "#e5e7eb",
                borderBottom: "1px solid #e5e7eb",
              }}>
                <div style={{ padding: "12px", textAlign: "center", backgroundColor: getAbsenceColor(selectedStats.excused) }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>{selectedStats.excused}</div>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "500" }}>Excused</div>
                </div>
                <div style={{ padding: "12px", textAlign: "center", backgroundColor: getAbsenceColor(selectedStats.unexcused * 1.5) }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>{selectedStats.unexcused}</div>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "500" }}>Unexcused</div>
                </div>
                <div style={{ padding: "12px", textAlign: "center", backgroundColor: getMakeupColor(selectedStats.makeupCount) }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>{selectedStats.makeupCount}</div>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "500" }}>Makeups</div>
                </div>
                <div style={{ padding: "12px", textAlign: "center", backgroundColor: getAbsenceColor(selectedStats.netAbsences) }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>{selectedStats.netAbsences}</div>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "500" }}>Net Total</div>
                </div>
                <div style={{ padding: "12px", textAlign: "center", backgroundColor: getMakeupColor(selectedStats.totalMinutes, 150) }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>{selectedStats.totalMinutes}</div>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "500" }}>Extra Mins</div>
                </div>
              </div>

              {/* Coach: Add Absence Button */}
              {isCoach && (
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#fef2f2" }}>
                  {!showAddAbsence ? (
                    <button
                      onClick={() => setShowAddAbsence(true)}
                      style={{
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: "600",
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      + Add Unexcused Absence
                    </button>
                  ) : (
                    <form onSubmit={handleAddUnexcused} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <input
                        type="date"
                        value={newAbsenceDate}
                        onChange={(e) => setNewAbsenceDate(e.target.value)}
                        required
                        style={{
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #d1d5db",
                          fontSize: "13px",
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          padding: "8px 16px",
                          fontSize: "13px",
                          fontWeight: "600",
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowAddAbsence(false); setNewAbsenceDate(""); }}
                        style={{
                          padding: "8px 16px",
                          fontSize: "13px",
                          fontWeight: "600",
                          background: "#f3f4f6",
                          color: "#374151",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Absences List */}
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                <div style={{ padding: "12px 20px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>Absences</span>
                </div>
                {athleteAbsences.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
                    No absences recorded
                  </div>
                ) : (
                  athleteAbsences.map(absence => (
                    <div 
                      key={absence.id}
                      style={{ 
                        padding: "12px 20px", 
                        borderBottom: "1px solid #f3f4f6",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "13px", color: "#374151" }}>
                          {formatDate(absence.date)}
                        </span>
                        <span style={{
                          padding: "2px 8px",
                          backgroundColor: absence.type === "excused" ? "#fef3c7" : "#fee2e2",
                          color: absence.type === "excused" ? "#92400e" : "#991b1b",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "600",
                        }}>
                          {absence.type === "excused" ? "F" : "U"}
                        </span>
                        {absence.reason && (
                          <span style={{ fontSize: "12px", color: "#6b7280" }}>
                            {absence.reason}
                          </span>
                        )}
                      </div>
                      {isCoach && (
                        <button
                          onClick={() => handleDeleteAbsence(absence.id, selectedAthlete.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#9ca3af",
                            cursor: "pointer",
                            fontSize: "14px",
                          }}
                        >
                          ✖
                        </button>
                      )}
                    </div>
                  ))
                )}

                {/* Makeups List */}
                <div style={{ padding: "12px 20px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb", borderTop: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>Makeups</span>
                </div>
                {athleteMakeups.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
                    No makeups logged
                  </div>
                ) : (
                  athleteMakeups.map(makeup => (
                    <div 
                      key={makeup.id}
                      style={{ 
                        padding: "12px 20px", 
                        borderBottom: "1px solid #f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span style={{ fontSize: "13px", color: "#374151" }}>
                        {formatDate(makeup.date)}
                      </span>
                      <span style={{
                        padding: "2px 8px",
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}>
                        -1
                      </span>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        {makeup.description}
                      </span>
                    </div>
                  ))
                )}

                {/* Extra Work List */}
                <div style={{ padding: "12px 20px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb", borderTop: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>Extra Work</span>
                </div>
                {athleteExtraWork.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
                    No extra work logged
                  </div>
                ) : (
                  athleteExtraWork.map(work => (
                    <div 
                      key={work.id}
                      style={{ 
                        padding: "12px 20px", 
                        borderBottom: "1px solid #f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span style={{ fontSize: "13px", color: "#374151" }}>
                        {formatDate(work.date)}
                      </span>
                      <span style={{
                        padding: "2px 8px",
                        backgroundColor: "#ecfdf5",
                        color: "#065f46",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}>
                        {work.minutes} min
                      </span>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        {work.description}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Legend Card when no athlete selected */
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "24px",
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", marginBottom: "20px" }}>
                Legend
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "8px" }}>
                    Absence Types
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#6b7280" }}>
                    <div><strong style={{ color: "#111827" }}>F</strong> = Excused (form submitted in advance)</div>
                    <div><strong style={{ color: "#111827" }}>U</strong> = Unexcused (no-show)</div>
                    <div><strong style={{ color: "#111827" }}>T</strong> = Net Total (absences − makeups)</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "8px" }}>
                    Color Scale
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "20px", height: "20px", backgroundColor: "#fecaca", borderRadius: "4px" }}></div>
                      <span style={{ fontSize: "13px", color: "#6b7280" }}>More absences (bad)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "20px", height: "20px", backgroundColor: "#d1fae5", borderRadius: "4px" }}></div>
                      <span style={{ fontSize: "13px", color: "#6b7280" }}>No absences (good)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "20px", height: "20px", backgroundColor: "#86efac", borderRadius: "4px" }}></div>
                      <span style={{ fontSize: "13px", color: "#6b7280" }}>More extra work (good)</span>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  marginTop: "12px", 
                  padding: "16px", 
                  backgroundColor: "#f0f9ff", 
                  borderRadius: "8px",
                  border: "1px solid #bae6fd",
                }}>
                  <div style={{ fontSize: "13px", color: "#0369a1" }}>
                    <strong>Tip:</strong> Click on any athlete's name to view their detailed attendance history.
                  </div>
                </div>

                {isCoach && (
                  <div style={{ 
                    marginTop: "4px", 
                    padding: "16px", 
                    backgroundColor: "#fef2f2", 
                    borderRadius: "8px",
                    border: "1px solid #fecaca",
                  }}>
                    <div style={{ fontSize: "13px", color: "#991b1b" }}>
                      🔒 <strong>Coach:</strong> You can add or remove unexcused absences when viewing an athlete's history.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}