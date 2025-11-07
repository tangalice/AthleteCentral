// src/components/EventAttendance.jsx
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";

// --- NEW IMPORTS ---
import { fetchTeamAthletes } from "../services/teamService"; // From Step 1
import { 
  ATTENDANCE_STATUS, 
  ATTENDANCE_CONFIG 
} from "../constants/constants"; // From Step 2

// --- DELETED ---
// The helper function 'fetchTeamAthletes' is no longer here (it's in teamService.js)

export default function EventAttendance({ eventId, teamId, isCoach = false }) {
  const [attendance, setAttendance] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventDetails, setEventDetails] = useState(null);
  const [saving, setSaving] = useState(false);

  // --- DELETED ---
  // The local 'ATTENDANCE_STATUS' object is no longer needed.
  // const ATTENDANCE_STATUS = { ... };
  
  // --- DELETED ---
  // The local 'statusConfig' object is no longer needed.
  // const statusConfig = { ... };

  // 1. Subscribe to event details and attendance records
  useEffect(() => {
    if (!teamId || !eventId) return;

    // Use onSnapshot for real-time updates
    const eventRef = doc(db, "teams", teamId, "events", eventId);
    const unsub = onSnapshot(eventRef, (docSnap) => {
      if (docSnap.exists()) {
        const details = docSnap.data();
        setEventDetails(details);
        setAttendance(details.attendanceRecords || {});
        setLoading(false); 
      } else {
        console.error("Event not found");
        setLoading(false);
      }
    });

    return () => unsub();
  }, [teamId, eventId]);

  // 2. Load assigned members OR all athletes if no one is assigned
  useEffect(() => {
    const loadMembers = async () => {
      if (!eventDetails || loading) return;

      const assignedIds = Array.isArray(eventDetails.assignedMemberIds) 
                          ? eventDetails.assignedMemberIds 
                          : [];
      
      let memberList = [];

      // ** Core Logic (using imported fetchTeamAthletes) **
      if (assignedIds.length > 0) {
        // Case 1: Specific athletes are assigned
        memberList = await fetchTeamAthletes(teamId);
        memberList = memberList.filter(m => assignedIds.includes(m.id));
      } else if (isCoach) {
        // Case 2: No specific athletes assigned (coach view)
        memberList = await fetchTeamAthletes(teamId);
      } else {
        // Case 3: Athlete viewing an 'all-team' event
        const myId = auth.currentUser?.uid;
        if (myId) {
             memberList = await fetchTeamAthletes(teamId);
             memberList = memberList.filter(m => m.id === myId);
        }
      }

      setTeamMembers(memberList);
    };

    loadMembers();
  }, [eventDetails, teamId, loading, isCoach]);

  // ... (updateStatus, updateNote remain unchanged) ...
  const updateStatus = (memberId, status) => {
    // Note: 'status' here is the string value, e.g., "present"
    setAttendance((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        status: status,
        note: prev[memberId]?.note || "",
      },
    }));
  };

  const updateNote = (memberId, note) => {
    setAttendance((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        // Default to 'present' if only note is added and status was unset
        status: prev[memberId]?.status || ATTENDANCE_STATUS.PRESENT,
        note: note,
      },
    }));
  };
  
  // --- MODIFICATION: Cleaned up getStatusColor ---
  // This now uses the shared ATTENDANCE_CONFIG
  const getStatusColor = (status) => {
    return ATTENDANCE_CONFIG[status]?.color || ATTENDANCE_CONFIG.unset.color;
  };


  // 3. Save attendance to Firestore
  const saveAttendance = async () => {
    // ... (logic unchanged)
    if (!isCoach) return;
    setSaving(true);
    try {
      const eventRef = doc(db, "teams", teamId, "events", eventId);
      
      const relevantMemberIds = teamMembers.map(m => m.id);
      
      // Calculate final total and rate
      const finalTotal = relevantMemberIds.length;
      let presentCount = 0;
      
      relevantMemberIds.forEach(id => {
          const status = attendance[id]?.status;
          // Count present, late, and excused towards the "present" total
          if (status === ATTENDANCE_STATUS.PRESENT || 
              status === ATTENDANCE_STATUS.LATE || 
              status === ATTENDANCE_STATUS.EXCUSED) {
              presentCount++;
          }
      });
      
      const attendanceSummary = {
        present: presentCount,
        total: finalTotal,
        rate: finalTotal > 0 ? Math.round((presentCount / finalTotal) * 100) : 0,
      };

      await updateDoc(eventRef, {
        attendanceRecords: attendance,
        attendanceSummary: attendanceSummary,
      });

      alert("Attendance saved successfully!");
    } catch (e) {
      console.error("Save failed", e);
      alert("Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  // Determine the final list of members to display
  const assignedMembers = teamMembers;

  if (loading) {
    return (
      <div style={{ padding: 18, textAlign: "center" }}>
        Loading event and member details...
      </div>
    );
  }

  if (!eventDetails) {
    return (
      <div style={{ padding: 18, color: "#ef4444", textAlign: "center" }}>
        Error: Event not found.
      </div>
    );
  }
  
  // --- MODIFICATION: Use ATTENDANCE_CONFIG for stats ---
  const attendanceStats = {
    present: Object.values(attendance).filter(
      (a) => a.status === ATTENDANCE_STATUS.PRESENT
    ).length,
    absent: Object.values(attendance).filter(
      (a) => a.status === ATTENDANCE_STATUS.ABSENT
    ).length,
    late: Object.values(attendance).filter(
      (a) => a.status === ATTENDANCE_STATUS.LATE
    ).length,
    excused: Object.values(attendance).filter(
      (a) => a.status === ATTENDANCE_STATUS.EXCUSED
    ).length,
  };


  return (
    // --- MODIFICATION: Cleaned up JSX, removed old inline styles ---
    <div style={{ padding: 20 }}>
      <div
        style={{
          marginBottom: 24,
          padding: 16,
          background: "#f9fafb", // --surface-alt
          borderRadius: 8,
          border: "1px solid #e5e7eb", // --border
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12, color: "#111827" }}>
          📋 Event Attendance
        </h3>
        {eventDetails && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#374151" }}>
              {eventDetails.title}
            </h4>
            <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
              {eventDetails.datetime?.toDate?.().toLocaleString() ||
                "No date available"}
            </p>
          </div>
        )}

        {/* Attendance Statistics (using imported config) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {/* Loop over the config object to ensure order */}
          {[
            ATTENDANCE_STATUS.PRESENT,
            ATTENDANCE_STATUS.ABSENT,
            ATTENDANCE_STATUS.LATE,
            ATTENDANCE_STATUS.EXCUSED,
          ].map((statusKey) => {
            const config = ATTENDANCE_CONFIG[statusKey];
            return (
              <div
                key={statusKey}
                style={{
                  textAlign: "center",
                  padding: 8,
                  background: "#fff",
                  borderRadius: 6,
                  border: `1px solid ${config.color}20`,
                }}
              >
                <div style={{ color: config.color, fontSize: 24, fontWeight: "bold" }}>
                  {attendanceStats[statusKey] || 0}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{config.label}</div>
              </div>
            );
          })}
        </div>

        {/* Member List */}
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 12, color: "#374151" }}>
            Assigned Athletes ({assignedMembers.length})
          </h4>
          
          {assignedMembers.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No athletes assigned to this event.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {assignedMembers.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    padding: 12,
                    background: "#fff",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb", // --border
                  }}
                >
                  {/* Row 1: Athlete Info */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 500, color: "#111827" }}>
                      {member.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {member.email}
                    </div>
                  </div>

                  {/* Row 2: Controls (using imported config) */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {/* Status Buttons */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "1 1 auto" }}>
                      {/* Loop over config again */}
                      {[
                        ATTENDANCE_STATUS.PRESENT,
                        ATTENDANCE_STATUS.ABSENT,
                        ATTENDANCE_STATUS.LATE,
                        ATTENDANCE_STATUS.EXCUSED,
                      ].map((statusKey) => {
                        const config = ATTENDANCE_CONFIG[statusKey];
                        const isSelected = attendance[member.id]?.status === statusKey;
                        return (
                          <button
                            key={statusKey}
                            onClick={() => isCoach && updateStatus(member.id, statusKey)}
                            disabled={!isCoach}
                            style={{
                              padding: "6px 12px",
                              background: isSelected ? config.color : "#fff",
                              color: isSelected ? "#fff" : config.color,
                              border: `1px solid ${config.color}`,
                              borderRadius: 6,
                              cursor: isCoach ? "pointer" : "not-allowed",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 14,
                              transition: "all 0.2s",
                            }}
                            title={config.label}
                          >
                            <span style={{ fontSize: 16 }}>{config.emoji}</span>
                            <span style={{ fontSize: 12 }}>{config.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Note field */}
                    {isCoach && (
                      <input
                        type="text"
                        placeholder="Note..."
                        value={attendance[member.id]?.note || ""}
                        onChange={(e) => updateNote(member.id, e.target.value)}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #e5e7eb", // --border
                          borderRadius: 4,
                          fontSize: 14,
                          flex: "1 1 150px",
                          minWidth: 120,
                        }}
                      />
                    )}
                    {!isCoach && attendance[member.id]?.note && (
                      <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", flexBasis: "100%", marginTop: 4 }}>
                        Note: {attendance[member.id].note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button (unchanged) */}
        {isCoach && assignedMembers.length > 0 && (
          <button
            onClick={saveAttendance}
            disabled={saving}
            style={{
              padding: "10px 20px",
              background: "#10b981", // --brand-primary
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: 500,
              width: "100%",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        )}
      </div>
    </div>
  );
}