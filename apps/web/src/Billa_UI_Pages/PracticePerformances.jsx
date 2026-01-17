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
import { db } from "../firebase";

export default function AttendanceTracker({ user }) {
  const [activeTab, setActiveTab] = useState("log"); // "log", "team-absences", "team-makeups"
  const [isCoach, setIsCoach] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allAbsences, setAllAbsences] = useState([]);
  const [allMakeups, setAllMakeups] = useState([]);
  const [allExtraWork, setAllExtraWork] = useState([]);
  const [myAbsences, setMyAbsences] = useState([]);
  const [myMakeups, setMyMakeups] = useState([]);
  const [myExtraWork, setMyExtraWork] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [absenceDate, setAbsenceDate] = useState("");
  const [absenceType, setAbsenceType] = useState("excused");
  const [absenceReason, setAbsenceReason] = useState("");
  const [makeupDate, setMakeupDate] = useState("");
  const [makeupDescription, setMakeupDescription] = useState("");
  
  // Extra work form states
  const [extraWorkDate, setExtraWorkDate] = useState("");
  const [extraWorkMinutes, setExtraWorkMinutes] = useState("");
  const [extraWorkDescription, setExtraWorkDescription] = useState("");

  // Coach: marking unexcused
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [unexcusedDate, setUnexcusedDate] = useState("");

  // Filters
  const [selectedMonth, setSelectedMonth] = useState("all");

  // Check if user is coach and fetch team data
  useEffect(() => {
    if (!user) return;

    const fetchUserAndTeam = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsCoach(userData.role === "coach");

          // Get team members
          if (userData.teamId) {
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
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user/team:", err);
        setLoading(false);
      }
    };

    fetchUserAndTeam();
  }, [user]);

  // Listen to user's own absences
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "absences")
    );

    const unsub = onSnapshot(q, 
      (snapshot) => {
        const absences = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort client-side by date descending
        absences.sort((a, b) => new Date(b.date) - new Date(a.date));
        setMyAbsences(absences);
      },
      (error) => {
        console.error("Absences listener error:", error);
      }
    );

    return () => unsub();
  }, [user]);

  // Listen to user's own makeups
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "makeups")
    );

    const unsub = onSnapshot(q, 
      (snapshot) => {
        const makeups = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort client-side by date descending
        makeups.sort((a, b) => new Date(b.date) - new Date(a.date));
        setMyMakeups(makeups);
      },
      (error) => {
        console.error("Makeups listener error:", error);
      }
    );

    return () => unsub();
  }, [user]);

  // Listen to user's own extra work
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "extraWork")
    );

    const unsub = onSnapshot(q, 
      (snapshot) => {
        const extraWork = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort client-side by date descending
        extraWork.sort((a, b) => new Date(b.date) - new Date(a.date));
        setMyExtraWork(extraWork);
      },
      (error) => {
        console.error("Extra work listener error:", error);
      }
    );

    return () => unsub();
  }, [user]);

  // Coach: Listen to all team absences and makeups
  useEffect(() => {
    if (!isCoach || teamMembers.length === 0) return;

    const fetchAllData = async () => {
      const absencesPromises = teamMembers.map(async (member) => {
        const absencesSnapshot = await getDocs(
          collection(db, "users", member.id, "absences")
        );
        return absencesSnapshot.docs.map(d => ({
          id: d.id,
          odId: member.id,
          athleteName: member.displayName || member.email,
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
    };

    fetchAllData();
  }, [isCoach, teamMembers]);

  // Submit excused absence (athlete logs in advance)
  const handleSubmitExcusedAbsence = async (e) => {
    e.preventDefault();
    if (!absenceDate || !absenceReason) {
      alert("Please fill in both date and reason.");
      return;
    }

    console.log("Submitting absence for user:", user.uid);
    console.log("Absence data:", { date: absenceDate, reason: absenceReason });

    try {
      const absenceData = {
        date: absenceDate,
        type: "excused",
        reason: absenceReason,
        athleteName: user.displayName || user.email || "Unknown",
        athleteId: user.uid,
        createdAt: new Date(),
      };
      
      console.log("Writing to path:", `users/${user.uid}/absences`);
      const docRef = await addDoc(collection(db, "users", user.uid, "absences"), absenceData);
      console.log("Document written with ID:", docRef.id);

      setAbsenceDate("");
      setAbsenceReason("");
      alert("Excused absence submitted!");
    } catch (err) {
      console.error("Error submitting absence:", err);
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      alert(`Could not submit absence: ${err.message}`);
    }
  };

  // Coach: Mark unexcused absence
  const handleMarkUnexcused = async (e) => {
    e.preventDefault();
    if (!selectedAthlete || !unexcusedDate) return;

    try {
      const athlete = teamMembers.find(m => m.id === selectedAthlete);
      await addDoc(collection(db, "users", selectedAthlete, "absences"), {
        date: unexcusedDate,
        type: "unexcused",
        reason: "No-show",
        athleteName: athlete?.displayName || athlete?.email || "Unknown",
        athleteId: selectedAthlete,
        markedBy: user.uid,
        createdAt: new Date(),
      });

      setSelectedAthlete("");
      setUnexcusedDate("");
      alert("Unexcused absence recorded!");
      
      // Refresh data
      const absencesSnapshot = await getDocs(
        collection(db, "users", selectedAthlete, "absences")
      );
      // Trigger re-fetch
      setAllAbsences(prev => [...prev, {
        id: 'temp-' + Date.now(),
        odId: selectedAthlete,
        athleteName: athlete?.displayName || athlete?.email,
        date: unexcusedDate,
        type: "unexcused"
      }]);
    } catch (err) {
      console.error("Error marking unexcused:", err);
      alert("Could not record absence.");
    }
  };

  // Submit makeup workout (to offset absences)
  const handleSubmitMakeup = async (e) => {
    e.preventDefault();
    if (!makeupDate || !makeupDescription) {
      alert("Please fill in both date and description.");
      return;
    }

    try {
      const makeupData = {
        date: makeupDate,
        description: makeupDescription,
        athleteName: user.displayName || user.email || "Unknown",
        athleteId: user.uid,
        createdAt: new Date(),
      };
      
      await addDoc(collection(db, "users", user.uid, "makeups"), makeupData);

      setMakeupDate("");
      setMakeupDescription("");
      alert("Makeup workout logged!");
    } catch (err) {
      console.error("Error logging makeup:", err);
      alert(`Could not log makeup: ${err.message}`);
    }
  };

  // Submit extra work (tracking minutes)
  const handleSubmitExtraWork = async (e) => {
    e.preventDefault();
    if (!extraWorkDate || !extraWorkMinutes || !extraWorkDescription) {
      alert("Please fill in date, minutes, and description.");
      return;
    }

    const minutes = parseInt(extraWorkMinutes);
    if (isNaN(minutes) || minutes <= 0) {
      alert("Please enter a valid number of minutes.");
      return;
    }

    try {
      const extraWorkData = {
        date: extraWorkDate,
        minutes: minutes,
        description: extraWorkDescription,
        athleteName: user.displayName || user.email || "Unknown",
        athleteId: user.uid,
        createdAt: new Date(),
      };
      
      await addDoc(collection(db, "users", user.uid, "extraWork"), extraWorkData);

      setExtraWorkDate("");
      setExtraWorkMinutes("");
      setExtraWorkDescription("");
      alert("Extra work logged!");
    } catch (err) {
      console.error("Error logging extra work:", err);
      alert(`Could not log extra work: ${err.message}`);
    }
  };

  // Delete functions
  const handleDeleteAbsence = async (absenceId, athleteId = user.uid) => {
    if (!window.confirm("Delete this absence record?")) return;
    try {
      await deleteDoc(doc(db, "users", athleteId, "absences", absenceId));
    } catch (err) {
      console.error("Error deleting absence:", err);
    }
  };

  const handleDeleteMakeup = async (makeupId, athleteId = user.uid) => {
    if (!window.confirm("Delete this makeup record?")) return;
    try {
      await deleteDoc(doc(db, "users", athleteId, "makeups", makeupId));
    } catch (err) {
      console.error("Error deleting makeup:", err);
    }
  };

  const handleDeleteExtraWork = async (extraWorkId, athleteId = user.uid) => {
    if (!window.confirm("Delete this extra work record?")) return;
    try {
      await deleteDoc(doc(db, "users", athleteId, "extraWork", extraWorkId));
    } catch (err) {
      console.error("Error deleting extra work:", err);
    }
  };

  // Calculate stats for an athlete
  const getAthleteStats = (athleteId) => {
    const absences = isCoach 
      ? allAbsences.filter(a => a.odId === athleteId)
      : myAbsences;
    const makeups = isCoach
      ? allMakeups.filter(m => m.odId === athleteId)
      : myMakeups;
    const extraWork = isCoach
      ? allExtraWork.filter(e => e.odId === athleteId)
      : myExtraWork;

    const excused = absences.filter(a => a.type === "excused").length;
    const unexcused = absences.filter(a => a.type === "unexcused").length;
    const makeupCount = makeups.length;
    const totalMinutes = extraWork.reduce((sum, e) => sum + (e.minutes || 0), 0);
    const totalAbsences = excused + unexcused;
    const netAbsences = Math.max(0, totalAbsences - makeupCount);

    return { excused, unexcused, totalAbsences, makeupCount, totalMinutes, netAbsences };
  };

  // Get color gradient for absences (red scale)
  const getAbsenceColor = (count, maxCount = 5) => {
    if (count === 0) return "#d1fae5"; // Light green
    const intensity = Math.min(count / maxCount, 1);
    // Interpolate from light red to dark red
    const r = 254;
    const g = Math.round(226 - (226 - 100) * intensity);
    const b = Math.round(226 - (226 - 100) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Get color gradient for makeups (green scale)
  const getMakeupColor = (count, maxCount = 10) => {
    if (count === 0) return "#f3f4f6"; // Light gray
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
    });
  };

  // Calculate my stats
  const myStats = getAthleteStats(user?.uid);

  // Get team summary for coach view
  const getTeamSummary = () => {
    return teamMembers.map(member => {
      const stats = getAthleteStats(member.id);
      return {
        ...member,
        ...stats
      };
    }).sort((a, b) => b.netAbsences - a.netAbsences);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px", textAlign: "center" }}>
        <p style={{ color: "#6b7280" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Header */}
      <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Attendance Tracker
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "24px", fontSize: "15px" }}>
        {isCoach 
          ? "Track team attendance, mark absences, and view makeup workouts."
          : "Submit absence requests in advance and log makeup workouts."}
      </p>

      {/* My Stats Summary Card */}
      {!isCoach && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px",
          marginBottom: "30px",
        }}>
          <div style={{
            padding: "20px",
            backgroundColor: getAbsenceColor(myStats.excused),
            borderRadius: "12px",
            textAlign: "center",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#111827" }}>
              {myStats.excused}
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280", fontWeight: "500" }}>
              Excused (F)
            </div>
          </div>
          <div style={{
            padding: "20px",
            backgroundColor: getAbsenceColor(myStats.unexcused),
            borderRadius: "12px",
            textAlign: "center",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#111827" }}>
              {myStats.unexcused}
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280", fontWeight: "500" }}>
              Unexcused (U)
            </div>
          </div>
          <div style={{
            padding: "20px",
            backgroundColor: getAbsenceColor(myStats.netAbsences),
            borderRadius: "12px",
            textAlign: "center",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#111827" }}>
              {myStats.netAbsences}
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280", fontWeight: "500" }}>
              Net Total (T)
            </div>
          </div>
          <div style={{
            padding: "20px",
            backgroundColor: getMakeupColor(myStats.makeupCount),
            borderRadius: "12px",
            textAlign: "center",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#111827" }}>
              {myStats.makeupCount}
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280", fontWeight: "500" }}>
              Extra Workouts
            </div>
          </div>
          <div style={{
            padding: "20px",
            backgroundColor: getMakeupColor(myStats.totalMinutes, 150),
            borderRadius: "12px",
            textAlign: "center",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#111827" }}>
              {myStats.totalMinutes}
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280", fontWeight: "500" }}>
              Total Minutes
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: "8px",
        marginBottom: "24px",
        borderBottom: "1px solid #e5e7eb",
        paddingBottom: "12px",
      }}>
        <button
          onClick={() => setActiveTab("log")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeTab === "log" ? "#10b981" : "#f3f4f6",
            color: activeTab === "log" ? "white" : "#374151",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
          }}
        >
          {isCoach ? "Mark Absence" : "Log Absence / Makeup"}
        </button>
        {isCoach && (
          <>
            <button
              onClick={() => setActiveTab("team-absences")}
              style={{
                padding: "10px 20px",
                backgroundColor: activeTab === "team-absences" ? "#10b981" : "#f3f4f6",
                color: activeTab === "team-absences" ? "white" : "#374151",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
              }}
            >
              Team Absences
            </button>
            <button
              onClick={() => setActiveTab("team-makeups")}
              style={{
                padding: "10px 20px",
                backgroundColor: activeTab === "team-makeups" ? "#10b981" : "#f3f4f6",
                color: activeTab === "team-makeups" ? "white" : "#374151",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
              }}
            >
              Extra Work
            </button>
          </>
        )}
        {!isCoach && (
          <button
            onClick={() => setActiveTab("history")}
            style={{
              padding: "10px 20px",
              backgroundColor: activeTab === "history" ? "#10b981" : "#f3f4f6",
              color: activeTab === "history" ? "white" : "#374151",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            My History
          </button>
        )}
      </div>

      {/* Log Tab Content */}
      {activeTab === "log" && (
        <div style={{ display: "grid", gridTemplateColumns: isCoach ? "1fr" : "1fr 1fr", gap: "24px" }}>
          {/* Excused Absence Form (Athletes) / Mark Unexcused (Coaches) */}
          <div style={{
            padding: "24px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <span style={{ 
                width: "36px", 
                height: "36px", 
                backgroundColor: "#fef2f2", 
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px"
              }}>
                
              </span>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: 0 }}>
                {isCoach ? "Mark Unexcused Absence" : "Submit Excused Absence"}
              </h3>
            </div>
            <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
              {isCoach 
                ? "Record when an athlete missed practice without notice."
                : "Let your coach know in advance that you'll miss practice."}
            </p>

            <form onSubmit={isCoach ? handleMarkUnexcused : handleSubmitExcusedAbsence}>
              <div style={{ display: "grid", gap: "16px" }}>
                {isCoach && (
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                      Athlete
                    </label>
                    <select
                      value={selectedAthlete}
                      onChange={(e) => setSelectedAthlete(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        backgroundColor: "#fff",
                        fontSize: "14px",
                      }}
                    >
                      <option value="">Select athlete...</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.displayName || member.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                    Date of Absence
                  </label>
                  <input
                    type="date"
                    value={isCoach ? unexcusedDate : absenceDate}
                    onChange={(e) => isCoach ? setUnexcusedDate(e.target.value) : setAbsenceDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      backgroundColor: "#fff",
                      fontSize: "14px",
                    }}
                  />
                </div>

                {!isCoach && (
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                      Reason
                    </label>
                    <textarea
                      value={absenceReason}
                      onChange={(e) => setAbsenceReason(e.target.value)}
                      placeholder="Why will you miss practice? (class conflict, appointment, etc.)"
                      required
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        backgroundColor: "#fff",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        resize: "vertical",
                      }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  style={{
                    padding: "12px 24px",
                    fontSize: "15px",
                    fontWeight: "600",
                    background: isCoach ? "#ef4444" : "#f59e0b",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  {isCoach ? "Record Unexcused Absence" : "Submit Absence Request"}
                </button>
              </div>
            </form>
          </div>

          {/* Makeup Workout Form (Athletes Only) - to offset absences */}
          {!isCoach && (
            <div style={{
              padding: "24px",
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <span style={{ 
                  width: "36px", 
                  height: "36px", 
                  backgroundColor: "#fef3c7", 
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px"
                }}>
                  
                </span>
                <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: 0 }}>
                  Log Makeup Workout
                </h3>
              </div>
              <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
                Log a makeup workout to offset a missed practice. Each makeup cancels one absence from your total.
              </p>

              <form onSubmit={handleSubmitMakeup}>
                <div style={{ display: "grid", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                      Date Completed
                    </label>
                    <input
                      type="date"
                      value={makeupDate}
                      onChange={(e) => setMakeupDate(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        backgroundColor: "#fff",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                      What did you do?
                    </label>
                    <textarea
                      value={makeupDescription}
                      onChange={(e) => setMakeupDescription(e.target.value)}
                      placeholder="Describe your makeup workout"
                      required
                      rows={2}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        backgroundColor: "#fff",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      padding: "12px 24px",
                      fontSize: "15px",
                      fontWeight: "600",
                      background: "#f59e0b",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    Log Makeup (-1 Absence)
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Extra Work Section (Athletes Only) */}
      {!isCoach && (
        <div style={{
          marginTop: "24px",
          padding: "24px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <span style={{ 
              width: "36px", 
              height: "36px", 
              backgroundColor: "#ecfdf5", 
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px"
            }}>
              
            </span>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: 0 }}>
              Log Extra Work
            </h3>
          </div>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
            Track additional training minutes outside of regular practice. This builds up your total extra work minutes.
          </p>

          <form onSubmit={handleSubmitExtraWork}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: "16px", alignItems: "end" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                  Date
                </label>
                <input
                  type="date"
                  value={extraWorkDate}
                  onChange={(e) => setExtraWorkDate(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#fff",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                  Minutes
                </label>
                <input
                  type="number"
                  value={extraWorkMinutes}
                  onChange={(e) => setExtraWorkMinutes(e.target.value)}
                  placeholder="e.g., 45"
                  min="1"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#fff",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                  Description
                </label>
                <input
                  type="text"
                  value={extraWorkDescription}
                  onChange={(e) => setExtraWorkDescription(e.target.value)}
                  placeholder="e.g., Erg workout, lifting, cardio..."
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#fff",
                    fontSize: "14px",
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: "600",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                + Add
              </button>
            </div>
          </form>

          {/* Extra Work History */}
          {myExtraWork.length > 0 && (
            <div style={{ marginTop: "20px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Recent Extra Work</span>
                <span style={{ 
                  fontSize: "14px", 
                  fontWeight: "700", 
                  color: "#10b981",
                  backgroundColor: "#ecfdf5",
                  padding: "4px 12px",
                  borderRadius: "16px",
                }}>
                  Total: {myStats.totalMinutes} mins
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                {myExtraWork.slice(0, 5).map(work => (
                  <div 
                    key={work.id}
                    style={{ 
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      backgroundColor: "#f9fafb",
                      borderRadius: "8px",
                      fontSize: "14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ color: "#6b7280" }}>{formatDate(work.date)}</span>
                      <span style={{ 
                        fontWeight: "600", 
                        color: "#10b981",
                        backgroundColor: "#ecfdf5",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}>
                        {work.minutes} min
                      </span>
                      <span style={{ color: "#374151" }}>{work.description}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteExtraWork(work.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#9ca3af",
                        cursor: "pointer",
                        fontSize: "14px",
                        padding: "4px",
                      }}
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team Absences Tab (Coach View) */}
      {activeTab === "team-absences" && isCoach && (
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
        }}>
          <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: 0 }}>
              Missed Practice Summary
            </h3>
          </div>
          
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151", fontSize: "14px" }}>
                    Athlete
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "14px", width: "80px" }}>
                    F
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "14px", width: "80px" }}>
                    U
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "14px", width: "80px" }}>
                    Makeups
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "14px", width: "80px" }}>
                    T
                  </th>
                </tr>
              </thead>
              <tbody>
                {getTeamSummary().map((athlete, idx) => (
                  <tr key={athlete.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                      {athlete.displayName || athlete.email}
                    </td>
                    <td style={{ 
                      padding: "12px 16px", 
                      textAlign: "center", 
                      fontSize: "14px",
                      fontWeight: "600",
                      backgroundColor: getAbsenceColor(athlete.excused),
                    }}>
                      {athlete.excused}
                    </td>
                    <td style={{ 
                      padding: "12px 16px", 
                      textAlign: "center", 
                      fontSize: "14px",
                      fontWeight: "600",
                      backgroundColor: getAbsenceColor(athlete.unexcused * 1.5), // Unexcused weighted more red
                    }}>
                      {athlete.unexcused}
                    </td>
                    <td style={{ 
                      padding: "12px 16px", 
                      textAlign: "center", 
                      fontSize: "14px",
                      fontWeight: "600",
                      backgroundColor: getMakeupColor(athlete.makeupCount),
                    }}>
                      {athlete.makeupCount}
                    </td>
                    <td style={{ 
                      padding: "12px 16px", 
                      textAlign: "center", 
                      fontSize: "14px",
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

          {teamMembers.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
              No team members found.
            </div>
          )}
        </div>
      )}

      {/* Extra Work Tab (Coach View) */}
      {activeTab === "team-makeups" && isCoach && (
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
        }}>
          <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: 0 }}>
              Extra Work Logged
            </h3>
          </div>
          
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151", fontSize: "14px" }}>
                    Athlete
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "14px", width: "120px" }}>
                    Total Minutes
                  </th>
                </tr>
              </thead>
              <tbody>
                {getTeamSummary()
                  .sort((a, b) => b.totalMinutes - a.totalMinutes)
                  .map((athlete) => (
                  <tr key={athlete.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                      {athlete.displayName || athlete.email}
                    </td>
                    <td style={{ 
                      padding: "12px 16px", 
                      textAlign: "center", 
                      fontSize: "14px",
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
      )}

      {/* History Tab (Athlete View) */}
      {activeTab === "history" && !isCoach && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Absences List */}
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: 0 }}>
                My Absences
              </h3>
            </div>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {myAbsences.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
                  No absences recorded. Great attendance! 🎉
                </div>
              ) : (
                myAbsences.map(absence => (
                  <div 
                    key={absence.id}
                    style={{ 
                      padding: "16px 20px", 
                      borderBottom: "1px solid #f3f4f6",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                          {formatDate(absence.date)}
                        </span>
                        <span style={{
                          padding: "2px 8px",
                          backgroundColor: absence.type === "excused" ? "#fef3c7" : "#fee2e2",
                          color: absence.type === "excused" ? "#92400e" : "#991b1b",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "600",
                          textTransform: "uppercase",
                        }}>
                          {absence.type === "excused" ? "F" : "U"}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                        {absence.reason}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAbsence(absence.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#9ca3af",
                        cursor: "pointer",
                        fontSize: "16px",
                      }}
                    >
                      ✖
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Makeups List */}
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: 0 }}>
                My Makeups
              </h3>
            </div>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {myMakeups.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
                  No makeups logged yet.
                </div>
              ) : (
                myMakeups.map(makeup => (
                  <div 
                    key={makeup.id}
                    style={{ 
                      padding: "16px 20px", 
                      borderBottom: "1px solid #f3f4f6",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>
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
                          -1 Absence
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                        {makeup.description}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteMakeup(makeup.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#9ca3af",
                        cursor: "pointer",
                        fontSize: "16px",
                      }}
                    >
                      ✖
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: "30px",
        padding: "16px 20px",
        backgroundColor: "#f9fafb",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
      }}>
        <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#374151", marginBottom: "12px" }}>
          Legend
        </h4>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "13px", color: "#6b7280" }}>
          <div><strong style={{ color: "#111827" }}>F</strong> = Excused (form submitted in advance)</div>
          <div><strong style={{ color: "#111827" }}>U</strong> = Unexcused (no-show)</div>
          <div><strong style={{ color: "#111827" }}>T</strong> = Total (absences − makeups)</div>
          <div>
            <span style={{ 
              display: "inline-block", 
              width: "12px", 
              height: "12px", 
              backgroundColor: "#fecaca", 
              borderRadius: "2px",
              marginRight: "4px",
              verticalAlign: "middle",
            }}></span>
            More absences
          </div>
          <div>
            <span style={{ 
              display: "inline-block", 
              width: "12px", 
              height: "12px", 
              backgroundColor: "#86efac", 
              borderRadius: "2px",
              marginRight: "4px",
              verticalAlign: "middle",
            }}></span>
            More makeup work
          </div>
        </div>
      </div>
    </div>
  );
}