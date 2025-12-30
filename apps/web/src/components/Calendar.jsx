// src/components/Calendar.jsx
// Refactored: Added practice availability feature for athletes and coaches
// Athletes can indicate morning/evening availability for Mon-Sat
// Coaches can view individual athlete availability and filter by time slot
import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { sendEmailNotificationToMultiple } from "../services/EmailNotificationService";
import EventAttendance from "./EventAttendance";
import PracticeDurationTracker from "./PracticeDurationTracker";

import { ATTENDANCE_CONFIG } from "../constants/constants";
import { fetchTeamAthletes } from "../services/teamService";

// --- In-App Notification: mark reflection as having unread coach feedback ---
const sendInAppNotification = async (targetUid, type, data) => {
  if (type !== "coach_comment") return;
  const { teamId, eventId } = data || {};
  if (!teamId || !eventId) return;

  console.log("[Notif] will set hasUnreadFeedback", { targetUid, teamId, eventId });

  const reflectionRef = doc(
    db,
    "teams",
    teamId,
    "events",
    eventId,
    "reflections",
    targetUid
  );

  await setDoc(
    reflectionRef,
    {
      hasUnreadFeedback: true,
      lastCoachFeedbackAt: Timestamp.now(),
    },
    { merge: true }
  );

  console.log("[Notif] hasUnreadFeedback written OK");
};

// ---- UI helpers ----
const TYPE_COLORS = {
  practice: "#10b981",
  game: "#3b82f6",
  meeting: "#8b5cf6",
  other: "#6b7280",
};

// Days of the week for availability (excluding Sunday)
const AVAILABILITY_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---- Athlete Availability Component ----
function AthleteAvailability({ teamId, userId, userRole }) {
  const [availability, setAvailability] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Load availability on mount
  useEffect(() => {
    if (!teamId || !userId) return;

    const loadAvailability = async () => {
      setLoading(true);
      try {
        const availRef = doc(db, "teams", teamId, "availability", userId);
        const availDoc = await getDoc(availRef);
        if (availDoc.exists()) {
          setAvailability(availDoc.data().schedule || {});
        } else {
          // Initialize with empty availability
          const initial = {};
          AVAILABILITY_DAYS.forEach(day => {
            initial[day] = { morning: false, evening: false };
          });
          setAvailability(initial);
        }
      } catch (error) {
        console.error("Error loading availability:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, [teamId, userId]);

  const toggleAvailability = (day, timeSlot) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [timeSlot]: !prev[day]?.[timeSlot]
      }
    }));
  };

  const saveAvailability = async () => {
    if (!teamId || !userId) return;
    setSaving(true);
    setMessage("");

    try {
      const availRef = doc(db, "teams", teamId, "availability", userId);
      await setDoc(availRef, {
        schedule: availability,
        updatedAt: Timestamp.now(),
        athleteId: userId,
        athleteName: auth.currentUser?.displayName || "Unknown"
      }, { merge: true });
      setMessage("Availability saved!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error saving availability:", error);
      setMessage("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (userRole !== "athlete") return null;

  return (
    <div style={{ 
      marginBottom: 24, 
      padding: 20, 
      background: "#fff", 
      borderRadius: 12, 
      border: "1px solid #e5e7eb",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
    }}>
      <h3 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700, color: "#1f2937" }}>
        🗓️ My Practice Availability
      </h3>
      <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#6b7280" }}>
        Select when you're available for morning or evening practice (Mon-Sat)
      </p>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading availability...</p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 600, fontSize: 14, color: "#374151" }}>
                    Day
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e5e7eb", fontWeight: 600, fontSize: 14, color: "#374151" }}>
                    ☀️ Morning
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e5e7eb", fontWeight: 600, fontSize: 14, color: "#374151" }}>
                    Evening
                  </th>
                </tr>
              </thead>
              <tbody>
                {AVAILABILITY_DAYS.map((day, idx) => (
                  <tr key={day} style={{ background: idx % 2 === 0 ? "transparent" : "#f9fafb" }}>
                    <td style={{ padding: "12px", fontWeight: 500, fontSize: 14, color: "#1f2937" }}>{day}</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => toggleAvailability(day, "morning")}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 6,
                          border: availability[day]?.morning ? "2px solid #10b981" : "2px solid #d1d5db",
                          cursor: "pointer",
                          fontWeight: 500,
                          fontSize: 13,
                          transition: "all 0.2s",
                          background: availability[day]?.morning ? "#d1fae5" : "#fff",
                          color: availability[day]?.morning ? "#065f46" : "#6b7280",
                          minWidth: 100
                        }}
                      >
                        {availability[day]?.morning ? "✓ Available" : "Unavailable"}
                      </button>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => toggleAvailability(day, "evening")}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 6,
                          border: availability[day]?.evening ? "2px solid #10b981" : "2px solid #d1d5db",
                          cursor: "pointer",
                          fontWeight: 500,
                          fontSize: 13,
                          transition: "all 0.2s",
                          background: availability[day]?.evening ? "#d1fae5" : "#fff",
                          color: availability[day]?.evening ? "#065f46" : "#6b7280",
                          minWidth: 100
                        }}
                      >
                        {availability[day]?.evening ? "✓ Available" : "Unavailable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={saveAvailability}
              disabled={saving}
              style={{
                padding: "10px 24px",
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? "Saving..." : "Save Availability"}
            </button>
            {message && (
              <span style={{ 
                color: message.includes("saved") ? "#10b981" : "#ef4444", 
                fontSize: 14, 
                fontWeight: 500 
              }}>
                {message}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Coach Availability Overview Component ----
function CoachAvailabilityOverview({ teamId, athletes, isCoach }) {
  const [allAvailability, setAllAvailability] = useState({});
  const [loading, setLoading] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [filterDay, setFilterDay] = useState("");
  const [filterTime, setFilterTime] = useState("");
  const [selectedAthlete, setSelectedAthlete] = useState("");

  // Load all athlete availability
  const loadAllAvailability = async () => {
    if (!teamId || athletes.length === 0) return;

    setLoading(true);
    try {
      const availabilityMap = {};
      
      for (const athlete of athletes) {
        const availRef = doc(db, "teams", teamId, "availability", athlete.id);
        const availDoc = await getDoc(availRef);
        if (availDoc.exists()) {
          availabilityMap[athlete.id] = {
            ...availDoc.data(),
            athleteName: athlete.name || athlete.email || `User ${athlete.id.slice(0, 6)}`
          };
        } else {
          availabilityMap[athlete.id] = {
            schedule: {},
            athleteName: athlete.name || athlete.email || `User ${athlete.id.slice(0, 6)}`,
            noData: true
          };
        }
      }
      
      setAllAvailability(availabilityMap);
    } catch (error) {
      console.error("Error loading availability:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showOverview && teamId && athletes.length > 0) {
      loadAllAvailability();
    }
  }, [showOverview, teamId, athletes]);

  // Filter athletes based on selected day and time
  const getFilteredAthletes = () => {
    if (!filterDay || !filterTime) {
      return Object.entries(allAvailability);
    }

    return Object.entries(allAvailability).filter(([athleteId, data]) => {
      if (data.noData || !data.schedule) return false;
      return data.schedule[filterDay]?.[filterTime] === true;
    });
  };

  // Get selected athlete's availability
  const selectedAthleteData = selectedAthlete ? allAvailability[selectedAthlete] : null;

  if (!isCoach) return null;

  return (
    <div style={{ 
      marginBottom: 24, 
      padding: 20, 
      background: "#fff", 
      borderRadius: 12, 
      border: "1px solid #e5e7eb",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showOverview ? 16 : 0 }}>
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700, color: "#1f2937" }}>
            👥 Team Availability
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
            View and filter athlete practice availability
          </p>
        </div>
        <button
          onClick={() => setShowOverview(!showOverview)}
          style={{
            padding: "8px 16px",
            background: showOverview ? "#f3f4f6" : "#10b981",
            color: showOverview ? "#374151" : "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontWeight: 500,
            fontSize: 14,
            cursor: "pointer"
          }}
        >
          {showOverview ? "Hide" : "Show Availability"}
        </button>
      </div>

      {showOverview && (
        <>
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading team availability...</p>
          ) : (
            <div style={{ display: "grid", gap: 20 }}>
              {/* Filter Section */}
              <div style={{ 
                padding: 16, 
                background: "#f9fafb", 
                borderRadius: 8,
                border: "1px solid #e5e7eb"
              }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 600, color: "#374151" }}>
                  🔍 Filter Athletes by Availability
                </h4>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500, color: "#6b7280" }}>
                      Day
                    </label>
                    <select
                      value={filterDay}
                      onChange={(e) => setFilterDay(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 14,
                        minWidth: 140,
                        background: "#fff"
                      }}
                    >
                      <option value="">All Days</option>
                      {AVAILABILITY_DAYS.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500, color: "#6b7280" }}>
                      Time
                    </label>
                    <select
                      value={filterTime}
                      onChange={(e) => setFilterTime(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 14,
                        minWidth: 140,
                        background: "#fff"
                      }}
                    >
                      <option value="">All Times</option>
                      <option value="morning">☀️ Morning</option>
                      <option value="evening">🌙 Evening</option>
                    </select>
                  </div>
                  {(filterDay || filterTime) && (
                    <button
                      onClick={() => { setFilterDay(""); setFilterTime(""); }}
                      style={{
                        padding: "8px 12px",
                        background: "#fff",
                        color: "#6b7280",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        fontSize: 13,
                        cursor: "pointer"
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Filtered Results */}
                {(filterDay && filterTime) && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 500, color: "#374151" }}>
                      Athletes available on <strong>{filterDay}</strong> {filterTime === "morning" ? "☀️ Morning" : "🌙 Evening"}:
                    </p>
                    {getFilteredAthletes().length === 0 ? (
                      <p style={{ color: "#ef4444", fontSize: 14, margin: 0 }}>No athletes available for this time slot.</p>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {getFilteredAthletes().map(([athleteId, data]) => (
                          <span
                            key={athleteId}
                            style={{
                              padding: "6px 12px",
                              background: "#d1fae5",
                              color: "#065f46",
                              borderRadius: 20,
                              fontSize: 13,
                              fontWeight: 500
                            }}
                          >
                            {data.athleteName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Individual Athlete View */}
              <div style={{ 
                padding: 16, 
                background: "#f9fafb", 
                borderRadius: 8,
                border: "1px solid #e5e7eb"
              }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 600, color: "#374151" }}>
                  👤 View Individual Athlete
                </h4>
                <select
                  value={selectedAthlete}
                  onChange={(e) => setSelectedAthlete(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    minWidth: 200,
                    background: "#fff"
                  }}
                >
                  <option value="">-- Select an athlete --</option>
                  {athletes.map((ath) => (
                    <option key={ath.id} value={ath.id}>
                      {ath.name || ath.email || `User ${ath.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>

                {selectedAthlete && selectedAthleteData && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600, color: "#1f2937" }}>
                      {selectedAthleteData.athleteName}'s Availability:
                    </p>
                    
                    {selectedAthleteData.noData || !selectedAthleteData.schedule || Object.keys(selectedAthleteData.schedule).length === 0 ? (
                      <p style={{ color: "#6b7280", fontSize: 14, margin: 0, fontStyle: "italic" }}>
                        This athlete hasn't set their availability yet.
                      </p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
                          <thead>
                            <tr style={{ background: "#f3f4f6" }}>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#374151" }}>Day</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#374151" }}>☀️ Morning</th>
                              <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#374151" }}>🌙 Evening</th>
                            </tr>
                          </thead>
                          <tbody>
                            {AVAILABILITY_DAYS.map((day, idx) => {
                              const dayAvail = selectedAthleteData.schedule[day] || {};
                              return (
                                <tr key={day} style={{ borderTop: "1px solid #e5e7eb" }}>
                                  <td style={{ padding: "8px 12px", fontWeight: 500, fontSize: 13, color: "#1f2937" }}>{day}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <span style={{
                                      display: "inline-block",
                                      padding: "4px 10px",
                                      borderRadius: 4,
                                      fontSize: 12,
                                      fontWeight: 500,
                                      background: dayAvail.morning ? "#d1fae5" : "#fee2e2",
                                      color: dayAvail.morning ? "#065f46" : "#991b1b"
                                    }}>
                                      {dayAvail.morning ? "✓ Yes" : "✗ No"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <span style={{
                                      display: "inline-block",
                                      padding: "4px 10px",
                                      borderRadius: 4,
                                      fontSize: 12,
                                      fontWeight: 500,
                                      background: dayAvail.evening ? "#d1fae5" : "#fee2e2",
                                      color: dayAvail.evening ? "#065f46" : "#991b1b"
                                    }}>
                                      {dayAvail.evening ? "✓ Yes" : "✗ No"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {selectedAthleteData.updatedAt && (
                          <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#6b7280" }}>
                            Last updated: {selectedAthleteData.updatedAt?.toDate?.()?.toLocaleDateString() || "Unknown"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Summary Table */}
              <div style={{ 
                padding: 16, 
                background: "#f9fafb", 
                borderRadius: 8,
                border: "1px solid #e5e7eb"
              }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 600, color: "#374151" }}>
                  📊 Availability Summary
                </h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#374151", position: "sticky", left: 0, background: "#f3f4f6" }}>Athlete</th>
                        {AVAILABILITY_DAYS.map(day => (
                          <th key={day} colSpan={2} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, color: "#374151", borderLeft: "1px solid #e5e7eb" }}>
                            {day.slice(0, 3)}
                          </th>
                        ))}
                      </tr>
                      <tr style={{ background: "#f9fafb" }}>
                        <th style={{ padding: "4px 10px", position: "sticky", left: 0, background: "#f9fafb" }}></th>
                        {AVAILABILITY_DAYS.map(day => [
                            <th key={`${day}-am`} style={{ padding: "4px 4px", textAlign: "center", fontSize: 10, color: "#6b7280", borderLeft: "1px solid #e5e7eb" }}>AM</th>,
                            <th key={`${day}-pm`} style={{ padding: "4px 4px", textAlign: "center", fontSize: 10, color: "#6b7280" }}>PM</th>
                        ])}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(allAvailability).map(([athleteId, data], idx) => (
                        <tr key={athleteId} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ 
                            padding: "6px 10px", 
                            fontWeight: 500, 
                            color: "#1f2937",
                            position: "sticky",
                            left: 0,
                            background: idx % 2 === 0 ? "#fff" : "#f9fafb",
                            whiteSpace: "nowrap"
                          }}>
                            {data.athleteName}
                          </td>
                          {AVAILABILITY_DAYS.map(day => {
                            const dayAvail = data.schedule?.[day] || {};
                            return [
                              <td key={`${day}-am`} style={{ padding: "6px 4px", textAlign: "center", borderLeft: "1px solid #e5e7eb" }}>
                                <span style={{
                                  display: "inline-block",
                                  width: 18,
                                  height: 18,
                                  borderRadius: 4,
                                  background: dayAvail.morning ? "#10b981" : "#e5e7eb",
                                  color: dayAvail.morning ? "#fff" : "#9ca3af",
                                  fontSize: 10,
                                  lineHeight: "18px"
                                }}>
                                  {dayAvail.morning ? "✓" : "–"}
                                </span>
                              </td>,
                              <td key={`${day}-pm`} style={{ padding: "6px 4px", textAlign: "center" }}>
                                <span style={{
                                  display: "inline-block",
                                  width: 18,
                                  height: 18,
                                  borderRadius: 4,
                                  background: dayAvail.evening ? "#10b981" : "#e5e7eb",
                                  color: dayAvail.evening ? "#fff" : "#9ca3af",
                                  fontSize: 10,
                                  lineHeight: "18px"
                                }}>
                                  {dayAvail.evening ? "✓" : "–"}
                                </span>
                              </td>
                            ];
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Calendar({ userRole }) {
  const isCoach = userRole === "coach";
  const me = auth.currentUser?.uid || null;
  const userDisplayName = auth.currentUser?.displayName || "Athlete";

  // --- Core State ---
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [currentTeamData, setCurrentTeamData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [assignables, setAssignables] = useState([]);
  const userCache = useRef(new Map());
  
  // --- Event Management State ---
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState({});
  const [createForm, setCreateForm] = useState({ title: "", date: "", time: "", type: "practice", description: "" });
  const [createAssigned, setCreateAssigned] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", date: "", time: "", type: "practice", description: "" });
  const [editAssigned, setEditAssigned] = useState([]);
  const [editErr, setEditErr] = useState("");
  
  // --- Attendance State (Preserved) ---
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceEvent, setAttendanceEvent] = useState(null);
  const [showDurationTracker, setShowDurationTracker] = useState(false);
  const [durationEvent, setDurationEvent] = useState(null);

  // --- Reflection Log & Comment State ---
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionEvent, setReflectionEvent] = useState(null);
  const [reflectionUser, setReflectionUser] = useState(null); 
  const [reflectionForm, setReflectionForm] = useState({ feelings: "", performance: "", improvements: "" });
  const [savingReflection, setSavingReflection] = useState(false);
  const [reflectionMessage, setReflectionMessage] = useState("");
  const [reflectionMode, setReflectionMode] = useState('athlete_edit'); 

  
  // --- Coach Feedback State ---
  const [coachComments, setCoachComments] = useState([]); 
  const [newCommentText, setNewCommentText] = useState(''); 
  const [commenting, setCommenting] = useState(false);
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);
  let closeReflectionUnsubRef = useRef(() => {});
  
  // --- Unread coach feedback for current athlete ---
  const [unreadFeedbackEventIds, setUnreadFeedbackEventIds] = useState(() => new Set());
  const unreadFeedbackUnsubsRef = useRef([]);
  
  // --- Reflection Overview State ---
  const [showReflectionOverview, setShowReflectionOverview] = useState(false);
  const [reflectionOverviewEvent, setReflectionOverviewEvent] = useState(null);
  const [reflectionsSummary, setReflectionsSummary] = useState([]);
  const [loadingReflectionsSummary, setLoadingReflectionsSummary] = useState(false);
  
  /* useEffect: load my teams */
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    (async () => {
      try {
        const teamsCol = collection(db, "teams");
        const [asCoach, asAth, asMem] = await Promise.all([
          getDocs(query(teamsCol, where("coaches", "array-contains", uid))),
          getDocs(query(teamsCol, where("athletes", "array-contains", uid))),
          getDocs(query(teamsCol, where("members", "array-contains", uid))),
        ]);
        const map = new Map();
        const add = (snap) =>
          snap.forEach((d) => map.set(d.id, { id: d.id, ...d.data(), name: d.data()?.name || "Unnamed Team" }));
        add(asCoach);
        add(asAth);
        add(asMem);
        const list = Array.from(map.values());
        setTeams(list);
        if (!teamId && list.length) {
          setTeamId(list[0].id);
          setCurrentTeamData(list[0]);
        }
      } catch (e) {
        console.error("load teams failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update current team data when teamId changes
  useEffect(() => {
    if (teamId && teams.length > 0) {
      const team = teams.find(t => t.id === teamId);
      setCurrentTeamData(team || null);
    }
  }, [teamId, teams]);

  /* ========== useEffect: subscribe events ========== */
  useEffect(() => {
    if (!teamId) return;
    setLoadingEvents(true);

    const qRef = query(collection(db, "teams", teamId, "events"), orderBy("datetime", "asc"));
    const unsub = onSnapshot(qRef, (snap) => {
      const now = Date.now();
      const dayAgo = now - 24 * 3600_000;
      const all = snap.docs.map((d) => {
        const e = d.data();
        const dt = e?.datetime?.toDate?.() ?? (e.datetime instanceof Date ? e.datetime : null);
        return { id: d.id, ...e, datetime: dt, upcoming: dt ? dt.getTime() >= dayAgo : false };
      });

      let visible = all;
      if (userRole === "athlete" && me) {
        visible = all.filter((ev) => {
          const assigned = Array.isArray(ev.assignedMemberIds) ? ev.assignedMemberIds : [];
          return assigned.length === 0 || assigned.includes(me);
        });
      }

      setEvents(visible);
      setLoadingEvents(false);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, userRole, me]);

  /* ========== useEffect: load assignables ========== */
  useEffect(() => {
    if (!teamId) {
      setAssignables([]);
      return;
    }
    
    (async () => {
      try {
        const athletes = await fetchTeamAthletes(teamId);
        athletes.forEach(ath => {
          if (!userCache.current.has(ath.id)) {
            userCache.current.set(ath.id, { name: ath.name, email: ath.email });
          }
        });
        setAssignables(athletes);
      } catch (e) {
        console.error("load assignables failed", e);
        setAssignables([]);
      }
    })();
  }, [teamId]);
  
  /* Computed Variables */
  const upcoming = useMemo(() => events.filter((e) => e.upcoming), [events]);
  const past = useMemo(() => events.filter((e) => !e.upcoming), [events]);

  useEffect(() => {
    if (userRole !== "athlete" || !me || !teamId) {
      unreadFeedbackUnsubsRef.current.forEach((unsub) => unsub());
      unreadFeedbackUnsubsRef.current = [];
      setUnreadFeedbackEventIds(new Set());
      return;
    }
  
    unreadFeedbackUnsubsRef.current.forEach((unsub) => unsub());
    unreadFeedbackUnsubsRef.current = [];
  
    const unsubs = past.map((ev) => {
      const reflectionRef = doc(
        db,
        "teams",
        teamId,
        "events",
        ev.id,
        "reflections",
        me
      );
  
      console.log("[UnreadEffect] listen reflections for event", ev.id);
  
      const unsub = onSnapshot(
        reflectionRef,
        (snap) => {
          const data = snap.data();
          const hasUnread = !!data?.hasUnreadFeedback;
          console.log("[UnreadEffect] snapshot", ev.id, { data, hasUnread });
  
          setUnreadFeedbackEventIds((prev) => {
            const next = new Set(prev);
            if (hasUnread) next.add(ev.id);
            else next.delete(ev.id);
            console.log("[UnreadEffect] current unread set:", Array.from(next));
            return next;
          });
        },
        (error) => {
          console.error("Error listening for unread feedback", error);
        }
      );
  
      return unsub;
    });
  
    unreadFeedbackUnsubsRef.current = unsubs;
  
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [past, teamId, userRole, me]);
  
  

  /* CRUD operations */
  const openCreate = () => {
    if (!isCoach) return alert("Only coaches can create events");
    setCreateErr({});
    setCreateForm({ title: "", date: "", time: "", type: "practice", description: "" });
    setCreateAssigned([]);
    setShowCreate(true);
  };
  const closeCreate = () => setShowCreate(false);
  const submitCreate = async (e) => {
    e.preventDefault();
    if (!isCoach) return;
    const errs = {};
    if (!createForm.title) errs.title = "Title is required";
    if (!createForm.date) errs.date = "Date is required";
    if (!createForm.time) errs.time = "Time is required";
    setCreateErr(errs);
    if (Object.keys(errs).length) return;

    setCreating(true);
    try {
      const teamDoc = await getDoc(doc(db, "teams", teamId));
      const teamData = teamDoc.data();
      const attendanceTotal = createAssigned.length > 0 ? createAssigned.length : (assignables.length || teamData?.athletes?.length || 0);
      
      const dt = new Date(`${createForm.date}T${createForm.time}`);
      await addDoc(collection(db, "teams", teamId, "events"), {
        title: createForm.title.trim(), description: createForm.description.trim(), type: createForm.type, datetime: Timestamp.fromDate(dt),
        assignedMemberIds: createAssigned.slice(), createdBy: me, createdAt: Timestamp.fromDate(new Date()),
        attendanceSummary: { present: 0, total: attendanceTotal, rate: 0 }, attendanceRecords: {},
        durationRecords: {}, durationSummary: { totalDuration: 0, athleteCount: 0 },
      });
      
      closeCreate();
    } catch (e) {
      console.error("create event failed", e);
      setCreateErr({ submit: "Failed to create event" });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (ev) => {
    const dt = ev.datetime instanceof Date ? ev.datetime : (ev.datetime ? new Date(ev.datetime) : new Date());
    const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, "0"); const d = String(dt.getDate()).padStart(2, "0");
    const h = String(dt.getHours()).padStart(2, "0"); const mi = String(dt.getMinutes()).padStart(2, "0");
    setEditForm({ title: ev.title || "", date: `${y}-${m}-${d}`, time: `${h}:${mi}`, type: ev.type || "practice", description: ev.description || "", });
    setEditAssigned(Array.isArray(ev.assignedMemberIds) ? [...ev.assignedMemberIds] : []);
    setEditing(ev); setEditErr("");
  };
  const closeEdit = () => setEditing(null);
  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.title || !editForm.date || !editForm.time) { setEditErr("Title, Date and Time are required."); return; }
    try {
      const dt = new Date(`${editForm.date}T${editForm.time}`);
      await updateDoc(doc(db, "teams", teamId, "events", editing.id), {
        title: editForm.title.trim(), description: editForm.description.trim(), type: editForm.type, datetime: Timestamp.fromDate(dt), assignedMemberIds: editAssigned.slice(),
      });
      closeEdit();
    } catch (e) { console.error("update event failed", e); setEditErr("Failed to update event"); }
  };
  const deleteEvent = async (ev) => {
    if (!confirm("Delete this event?")) return;
    try { await deleteDoc(doc(db, "teams", teamId, "events", ev.id)); } catch (e) { console.error("delete failed", e); alert("Failed to delete"); }
  };
  
  // --- Attendance Functions (Preserved) ---
  const openAttendance = (ev) => { setAttendanceEvent(ev); setShowAttendance(true); };
  const closeAttendance = () => setShowAttendance(false);
  const openDurationTracker = (ev) => { setDurationEvent(ev); setShowDurationTracker(true); };
  const closeDurationTracker = () => setShowDurationTracker(false);

  /* ========== Reflection & Feedback Logic ========== */

  // 1. Load Feedback
  const loadCoachFeedbacks = (eventId, athleteId) => {
    const feedbacksCol = collection(db, "teams", teamId, "events", eventId, "reflections", athleteId, "coachFeedback");
    const q = query(feedbacksCol, orderBy("updatedAt", "asc"));
    
    const unsub = onSnapshot(q, (snap) => {
      const loadedFeedbacks = snap.docs.map(d => ({
        id: d.id, 
        ...d.data(),
        updatedAt: d.data().updatedAt?.toDate()?.toLocaleTimeString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'N/A'
      }));
      setCoachComments(loadedFeedbacks);
    });
    return unsub; 
  };
  
  // 2. Close Modal & Reset States
  const closeReflection = () => {
    closeReflectionUnsubRef.current(); 
    setShowReflection(false);
    setReflectionEvent(null);
    setReflectionUser(null);
    setCoachComments([]);
    setReflectionMessage("");
    setIsEditingFeedback(false);
    setNewCommentText('');
  };

  const markFeedbackAsRead = async (eventId, athleteId) => {
    if (!teamId || !athleteId) return;
    try {
      const reflectionRef = doc(
        db,
        "teams",
        teamId,
        "events",
        eventId,
        "reflections",
        athleteId
      );
      await setDoc(
        reflectionRef,
        {
          hasUnreadFeedback: false,
          lastFeedbackReadAt: Timestamp.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to mark feedback as read", err);
    }
  };
  

  // 3. Open Modal
  const openReflectionAndComments = async (ev, athleteId = me) => {
    if (!me || !teamId || !athleteId) return;
    
    setReflectionMode(athleteId === me ? 'athlete_edit' : 'coach_view');
    setReflectionEvent(ev);
    setReflectionUser(athleteId);
    setReflectionMessage("");
    setNewCommentText("");
    setIsEditingFeedback(false);
    
    let reflectionExists = false;
    try {
      const refDoc = await getDoc(doc(db, "teams", teamId, "events", ev.id, "reflections", athleteId));
      if (refDoc.exists()) {
        const data = refDoc.data();
        setReflectionForm({
          feelings: data.feelings || "", performance: data.performance || "", improvements: data.improvements || "",
        });
        reflectionExists = true;
      } else {
        if (athleteId !== me) { setReflectionMessage("Athlete has not submitted a reflection yet."); return; }
        setReflectionForm({ feelings: "", performance: "", improvements: "" });
      }
    } catch (error) { console.error("Error fetching reflection:", error); }
    
    if (reflectionExists || athleteId === me) {
      closeReflectionUnsubRef.current = loadCoachFeedbacks(ev.id, athleteId);
    }
    
    setShowReflection(true);

    if (!isCoach && athleteId === me) {
      markFeedbackAsRead(ev.id, athleteId);
    }
  };

  // 4. Save Reflection (Athlete)
  const saveReflection = async (e) => {
    e.preventDefault();
    if (!me || !teamId || !reflectionEvent || reflectionMode !== 'athlete_edit') return;

    setSavingReflection(true);
    try {
      const reflectionRef = doc(db, "teams", teamId, "events", reflectionEvent.id, "reflections", me);
      await setDoc(reflectionRef, {
        ...reflectionForm,
        athleteId: me,
        updatedAt: Timestamp.now(),
        athleteName: userDisplayName,
      }, { merge: true });

      setReflectionMessage("Reflection saved successfully!");
      setTimeout(() => { closeReflection(); }, 1000);
    } catch (error) { console.error("Error saving reflection:", error); setReflectionMessage("Error saving reflection. Please try again."); } 
    finally { setSavingReflection(false); }
  };

  // 5. Submit Feedback (Coach)
const submitComment = async (e) => {
  e.preventDefault();
  if (!isCoach || !newCommentText.trim() || !reflectionEvent || !reflectionUser) return;

  setCommenting(true);
  try {
    const coachId = me;
    const coachName = userDisplayName;

    const feedbackRef = doc(db, "teams", teamId, "events", reflectionEvent.id, "reflections", reflectionUser, "coachFeedback", coachId);
    
    const existingDoc = await getDoc(feedbackRef);
    const createdAt = existingDoc.exists() ? existingDoc.data().createdAt : Timestamp.now();

    // Write Feedback
    await setDoc(feedbackRef, {
      text: newCommentText.trim(),
      createdBy: coachId,
      createdByName: coachName,
      createdAt: createdAt,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    
    try {
      await sendInAppNotification(reflectionUser, "coach_comment", {
        teamId,
        eventId: reflectionEvent.id,
        eventName: reflectionEvent.title,
        coachName,
      });
      console.log("[submitComment] Notification sent successfully");
    } catch (notificationError) {
      console.error("[submitComment] Notification failed:", notificationError);
    }
    
    setNewCommentText('');
    setIsEditingFeedback(false); 
    
  } catch (error) { 
    console.error("Error submitting comment:", error); 
    setReflectionMessage("Failed to submit feedback."); 
  } 
  finally { setCommenting(false); }
};
  
  
  // 6. Reflection Overview (Coach)
  const openReflectionOverview = async (ev) => {
    if (!isCoach) return;
    setReflectionOverviewEvent(ev);
    setShowReflectionOverview(true);
    setLoadingReflectionsSummary(true);
    setReflectionsSummary([]);

    try {
        const reflectionsCol = collection(db, "teams", teamId, "events", ev.id, "reflections");
        const snapshot = await getDocs(reflectionsCol);
        
        const summary = snapshot.docs.map(doc => {
            const data = doc.data();
            const athleteId = doc.id;
            const athleteInfo = userCache.current.get(athleteId) || { name: data.athleteName || `User ${athleteId.slice(0, 6)}` };
            return {
                id: doc.id, ...data, athleteName: athleteInfo.name, submitted: true,
                updatedAt: data.updatedAt?.toDate()?.toLocaleDateString() || 'N/A'
            };
        });
        setReflectionsSummary(summary);
    } catch (e) { console.error("Error loading reflections summary:", e); } 
    finally { setLoadingReflectionsSummary(false); }
  };

  const closeReflectionOverview = () => {
    setShowReflectionOverview(false);
    setReflectionOverviewEvent(null);
    setReflectionsSummary([]);
  };

  // --- Render Helpers ---
  const AttendanceBadge = ({ s }) => {
    if (!s) return null;
    const rate = s.total ? Math.round((s.present / s.total) * 100) : 0;
    const config = rate >= 80 ? ATTENDANCE_CONFIG.present : rate >= 60 ? ATTENDANCE_CONFIG.late : ATTENDANCE_CONFIG.absent;
    return (
      <span style={{ marginLeft: 8, padding: "2px 8px", fontSize: 12, borderRadius: 4, background: config.backgroundColor, color: config.color, fontWeight: 500 }}>
        {s.present}/{s.total} ({rate}%)
      </span>
    );
  };

  const MyAttendanceStatus = ({ event, me }) => {
    if (!me) return null; 
    const status = event.attendanceRecords?.[me]?.status;
    const config = ATTENDANCE_CONFIG[status] || ATTENDANCE_CONFIG.unset;
    return (
      <span style={{ marginLeft: 8, padding: "2px 8px", fontSize: 12, borderRadius: 4, background: config.backgroundColor, color: config.color, fontWeight: 500 }}>
        {config.label}
      </span>
    );
  };

  // Check if current coach has already submitted feedback
  const myExistingFeedback = coachComments.find(c => c.id === me);
  const hasMyFeedback = !!myExistingFeedback;

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h2 className="mb-1">📅 Team Calendar</h2>
      <p className="text-muted mb-3">
        Manage and track team events, practices, and competitions
      </p>

      <div className="mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 4, minHeight: '60px' }}>
        <div>
          <label className="mb-1" style={{ fontWeight: 600, display: "block" }}>Select Team:</label>
          <select
            value={teamId || ""}
            onChange={(e) => setTeamId(e.target.value)}
            className="form-control"
            style={{ minWidth: 360, maxWidth: 400, borderColor: "#10b981", boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.2)" }}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {isCoach && (
          <button className="btn btn-primary" onClick={openCreate} style={{ height: 'fit-content', whiteSpace: 'nowrap', background: "#10b981", border: "none" }}>
            ➕ Create New Event
          </button>
        )}
      </div>

      {/* Athlete Availability Section */}
      {!isCoach && teamId && me && (
        <AthleteAvailability 
          teamId={teamId} 
          userId={me} 
          userRole={userRole}
        />
      )}

      {/* Coach Availability Overview */}
      {isCoach && teamId && (
        <CoachAvailabilityOverview 
          teamId={teamId} 
          athletes={assignables} 
          isCoach={isCoach}
        />
      )}

      <h3 className="mt-3 mb-2" style={{ fontSize:22, fontWeight:700 }}>🔜 Upcoming Events</h3>
      {loadingEvents ? <p>Loading events…</p> : (
        <div className="mb-4" style={{ display:"grid", gap:12 }}>
          {upcoming.length===0 ? <p className="text-muted">No upcoming events scheduled.</p> :
            upcoming.map((ev)=>(
              <div key={ev.id} className="card"
                   style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", borderLeft:`4px solid ${TYPE_COLORS[ev.type]||"#6b7280"}`, margin: 0 }}>
                <div style={{ flex:1 }}>
                  <strong style={{ fontSize:16 }}>{ev.title}</strong>
                  {isCoach ? <AttendanceBadge s={ev.attendanceSummary} /> : <MyAttendanceStatus event={ev} me={me} />}
                  <p className="text-muted" style={{ margin:"4px 0 0", fontSize:14 }}>
                    {ev.datetime.toLocaleDateString()} {ev.datetime.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
                  </p>
                  {ev.description && <p style={{ margin:0, color:"#4b5563", fontSize:14 }}>{ev.description}</p>}
                </div>
                
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {isCoach && (
                    <>
                      <button className="btn" onClick={()=>openAttendance(ev)} style={{ border:"1px solid #e5e7eb", background:"#fff" }}>Track Attendance</button>
                      {(ev.type || "").toLowerCase() === "practice" && (
                        <button className="btn" onClick={()=>openDurationTracker(ev)} style={{ border:"1px solid #e5e7eb", background:"#fff" }}>Track Duration</button>
                      )}
                      <button className="btn" onClick={()=>openEdit(ev)} style={{ border:"1px solid #e5e7eb", background:"#fff" }}>Edit</button>
                      <button className="btn" onClick={()=>deleteEvent(ev)} style={{ border:"1px solid #ef4444", color:"#ef4444", background:"#fff" }}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))
          }
        </div>
      )}

      <h3 className="mt-3 mb-2" style={{ fontSize:22, fontWeight:700 }}>📜 Past Events</h3>
      <div style={{ display:"grid", gap:12 }}>
        {past.length===0 ? <p className="text-muted">No past events.</p> :
          past.map((ev)=>(
            <div key={ev.id} className="card"
                 style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", borderLeft:`4px solid ${TYPE_COLORS[ev.type]||"#6b7280"}`, margin: 0 }}>
              <div>
                <strong style={{ fontSize:16 }}>{ev.title}</strong>
                {isCoach ? <AttendanceBadge s={ev.attendanceSummary} /> : <MyAttendanceStatus event={ev} me={me} />}
                {ev.datetime && <p className="text-muted" style={{ margin:"6px 0 0", fontSize:14 }}>{ev.datetime.toLocaleString()}</p>}
              </div>
              
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {isCoach ? (
                  <>
                    {(ev.type || "").toLowerCase() === "practice" && (
                      <button className="btn" onClick={()=>openDurationTracker(ev)} style={{ border:"1px solid #e5e7eb", background:"#fff" }}>Track Duration</button>
                    )}
                    <button className="btn btn-primary" onClick={() => openReflectionOverview(ev)} style={{ fontSize: 14, background: "#10b981", border: "none" }}>View Reflections</button>
                    <button className="btn" onClick={()=>openAttendance(ev)} style={{ border:"1px solid #e5e7eb", background:"#fff" }}>View Attendance</button>
                    <button className="btn" onClick={()=>deleteEvent(ev)} style={{ border:"1px solid #ef4444", color:"#ef4444", background:"#fff" }}>Delete</button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => openReflectionAndComments(ev, me)}
                    style={{ fontSize: 14, position: "relative", paddingRight: 18, background: "#10b981", border: "none" }}
                  >
                    Reflection Log
                    {unreadFeedbackEventIds.has(ev.id) && (
                      <span
                        aria-label="New coach feedback"
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 6,
                          width: 10,
                          height: 10,
                          borderRadius: "999px",
                          backgroundColor: "#ef4444",
                        }}
                      />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* Edit Modal */}
      {editing && (
        <div role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) closeEdit(); }}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 }}>
          <div style={{ width:"100%", maxWidth:760, background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", boxShadow:"0 10px 30px rgba(0,0,0,.15)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid #e5e7eb" }}>
              <strong>Edit Event</strong>
              <button onClick={closeEdit} aria-label="Close" style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <form onSubmit={submitEdit} style={{ padding:18 }}>
              <div style={{ display:"grid", gap:14 }}>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Title *</label><input className="form-control" value={editForm.title} onChange={(e)=>setEditForm(p=>({...p, title:e.target.value}))} /></div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Date *</label><input type="date" className="form-control" value={editForm.date} onChange={(e)=>setEditForm(p=>({...p, date:e.target.value}))} /></div>
                  <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Time *</label><input type="time" className="form-control" value={editForm.time} onChange={(e)=>setEditForm(p=>({...p, time:e.target.value}))} /></div>
                </div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Type</label><select className="form-control" value={editForm.type} onChange={(e)=>setEditForm(p=>({...p, type:e.target.value}))}><option value="practice">Practice</option><option value="game">Game/Competition</option><option value="meeting">Team Meeting</option><option value="other">Other</option></select></div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Description (Optional)</label><textarea rows={3} className="form-control" value={editForm.description} onChange={(e)=>setEditForm(p=>({...p, description:e.target.value}))} /></div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Assign to Athletes</label><div style={{ border:"1px solid #e5e7eb", borderRadius:8, maxHeight:220, overflowY:"auto", padding:8 }}>{assignables.length===0 ? (<div className="text-muted" style={{ padding:8 }}>No athletes in this team.</div>) : assignables.map((m)=>(<label key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px" }}><input type="checkbox" checked={editAssigned.includes(m.id)} onChange={(e)=>setEditAssigned(prev=> e.target.checked ? [...prev, m.id] : prev.filter(id=>id!==m.id))} /><span>{m.name || m.email || `User ${m.id.slice(0,6)}`}</span></label>))}</div></div>
                {editErr && (<div className="alert alert-error" style={{padding: "8px 12px", margin: 0}}>{editErr}</div>)}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><button type="button" className="btn" onClick={closeEdit} style={{ border:"1px solid #e5e7eb", background:"#fff" }}>Cancel</button><button type="submit" className="btn btn-primary" style={{ background: "#10b981", border: "none" }}>Save Changes</button></div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) setShowCreate(false); }}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 }}>
          <div style={{ width:"100%", maxWidth:760, background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", boxShadow:"0 10px 30px rgba(0,0,0,.15)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid #e5e7eb" }}>
              <strong>Create New Event</strong>
              <button onClick={closeCreate} aria-label="Close" style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <form onSubmit={submitCreate} style={{ padding:18 }}>
              <div style={{ display:"grid", gap:14 }}>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Title *</label><input className="form-control" value={createForm.title} onChange={(e)=>setCreateForm(p=>({...p, title:e.target.value}))} placeholder="e.g., Morning Practice" />{createErr.title && <small className="text-danger">{createErr.title}</small>}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Date *</label><input type="date" className="form-control" value={createForm.date} onChange={(e)=>setCreateForm(p=>({...p, date:e.target.value}))} />{createErr.date && <small className="text-danger">{createErr.date}</small>}</div>
                  <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Time *</label><input type="time" className="form-control" value={createForm.time} onChange={(e)=>setCreateForm(p=>({...p, time:e.target.value}))} />{createErr.time && <small className="text-danger">{createErr.time}</small>}</div>
                </div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Type</label><select className="form-control" value={createForm.type} onChange={(e)=>setCreateForm(p=>({...p, type:e.target.value}))}><option value="practice">Practice</option><option value="game">Game/Competition</option><option value="meeting">Team Meeting</option><option value="other">Other</option></select></div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Description (Optional)</label><textarea rows={3} className="form-control" value={createForm.description} onChange={(e)=>setCreateForm(p=>({...p, description:e.target.value}))} /></div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Assign to Athletes</label><div style={{ border:"1px solid #e5e7eb", borderRadius:8, maxHeight:220, overflowY:"auto", padding:8 }}>{assignables.length===0 ? (<div className="text-muted" style={{ padding:8 }}>No athletes in this team.</div>) : assignables.map((m)=>(<label key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px" }}><input type="checkbox" checked={createAssigned.includes(m.id)} onChange={(e)=>setCreateAssigned(prev=> e.target.checked ? [...prev, m.id] : prev.filter(id=>id!==m.id))} /><span>{m.name || m.email || `User ${m.id.slice(0,6)}`}</span></label>))}</div></div>
                {createErr.submit && (<div className="alert alert-error" style={{padding: "8px 12px", margin: 0}}>{createErr.submit}</div>)}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><button type="button" className="btn" onClick={closeCreate} style={{ border:"1px solid #e5e7eb", background:"#fff" }}>Cancel</button><button type="submit" className="btn btn-primary" disabled={creating} style={{ background: "#10b981", border: "none" }}>{creating ? "Creating..." : "Create Event"}</button></div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Drawer (Restored) */}
      {showAttendance && attendanceEvent && (
        <div style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(520px, 100%)", background:"#fff", borderLeft:"1px solid #e5e7eb", boxShadow:"-8px 0 24px rgba(0,0,0,.08)", zIndex:40, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:12, borderBottom:"1px solid #e5e7eb", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <strong>Event Attendance</strong>
            <button className="btn" onClick={closeAttendance} style={{ border:"1px solid #e5e7eb", background:"#fff" }}>Close</button>
          </div>
          <div style={{ overflow:"auto" }}>
            <EventAttendance isCoach={isCoach} teamId={teamId} eventId={attendanceEvent.id} />
          </div>
        </div>
      )}

      {/* Duration Tracker Drawer */}
      {showDurationTracker && durationEvent && (
        <div style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(520px, 100%)", background:"#fff", borderLeft:"1px solid #e5e7eb", boxShadow:"-8px 0 24px rgba(0,0,0,.08)", zIndex:41, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:12, borderBottom:"1px solid #e5e7eb", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <strong>Practice Duration Tracker</strong>
            <button className="btn" onClick={closeDurationTracker} style={{ border:"1px solid #e5e7eb", background:"#fff" }}>Close</button>
          </div>
          <div style={{ overflow:"auto" }}>
            <PracticeDurationTracker isCoach={isCoach} teamId={teamId} eventId={durationEvent.id} />
          </div>
        </div>
      )}

      {/* Reflection Overview Modal */}
      {showReflectionOverview && reflectionOverviewEvent && (
          <div role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) closeReflectionOverview(); }}
               style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 }}>
              <div style={{ width:"100%", maxWidth:500, background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", boxShadow:"0 10px 30px rgba(0,0,0,.15)", maxHeight: '80vh', overflowY: 'auto' }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid #e5e7eb" }}>
                      <strong>Reflections for: {reflectionOverviewEvent.title}</strong>
                      <button onClick={closeReflectionOverview} aria-label="Close" style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>×</button>
                  </div>
                  <div style={{ padding: 18 }}>
                      {loadingReflectionsSummary ? (<p>Loading reflections...</p>) : (
                          reflectionsSummary.length === 0 ? (<p className="text-muted">No athletes have submitted a reflection for this event.</p>) : (
                              <div style={{ display: 'grid', gap: 10 }}>
                                  {reflectionsSummary.map(r => (
                                      <div key={r.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <div><strong style={{ display: 'block' }}>{r.athleteName}</strong><span className="text-muted" style={{ fontSize: 12 }}>Last updated: {r.updatedAt}</span></div>
                                          <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 10px', background: "#10b981", border: "none" }} onClick={() => { closeReflectionOverview(); openReflectionAndComments(reflectionOverviewEvent, r.id); }}>View & Comment</button>
                                      </div>
                                  ))}
                              </div>
                          )
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Reflection & Feedback Modal */}
      {showReflection && reflectionEvent && reflectionUser && (
        <div role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) closeReflection(); }}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 }}>
          <div style={{ width:"100%", maxWidth:600, background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", boxShadow:"0 10px 30px rgba(0,0,0,.15)", maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid #e5e7eb" }}>
                <strong>{reflectionMode === 'athlete_edit' ? 'My Reflection' : `Athlete Reflection Log`}{reflectionMode === 'coach_view' && ` (Athlete: ${userCache.current.get(reflectionUser)?.name || 'Unknown'})`}</strong>
                <button onClick={closeReflection} aria-label="Close" style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            
            {/* Athlete Reflection Inputs */}
            <form onSubmit={reflectionMode === 'athlete_edit' ? saveReflection : (e) => e.preventDefault()} style={{ padding:18, borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display:"grid", gap:14 }}>
                    <p className="text-muted" style={{fontSize: 14, margin: 0}}>Reflection submitted {reflectionForm.updatedAt ? `on ${reflectionForm.updatedAt}` : 'for this event.'}</p>
                    {['feelings', 'performance', 'improvements'].map(key => (
                        <div key={key}>
                            <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</label>
                            {reflectionMode === 'athlete_edit' ? (
                                <textarea className="form-control" rows={key === 'performance' ? 3 : 2} value={reflectionForm[key]} onChange={(e) => setReflectionForm(prev => ({...prev, [key]: e.target.value}))} />
                            ) : (
                                <div style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 4, minHeight: key === 'performance' ? 80 : 50, backgroundColor: '#f9fafb' }}>{reflectionForm[key] || <span className="text-muted">No entry.</span>}</div>
                            )}
                        </div>
                    ))}
                    {reflectionMode === 'athlete_edit' && (
                        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop: 10 }}>
                            <button type="submit" className="btn btn-primary" disabled={savingReflection} style={{ background: "#10b981", border: "none" }}>{savingReflection ? "Saving..." : "Save Reflection"}</button>
                        </div>
                    )}
                </div>
            </form>

            {/* Coach Feedback Section */}
            <div style={{ padding:18, paddingTop: 10 }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 18, fontWeight: 700 }}>Coach Feedback ({coachComments.length})</h4>
                <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 15, paddingRight: 8 }}>
                    {coachComments.length === 0 ? (
                        <p className="text-muted" style={{ fontSize: 14 }}>No feedback yet.</p>
                    ) : (
                        coachComments.map(comment => (
                            <div key={comment.id} style={{ marginBottom: 10, padding: 10, borderRadius: 6, borderLeft: '3px solid #10b981', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600 }}>{comment.createdByName} (Coach)</span>
                                        <span className="text-muted">{comment.updatedAt}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 14 }}>{comment.text}</p>
                                </div>
                                {/* Edit Button for Coach */}
                                {comment.id === me && !isEditingFeedback && (
                                    <button onClick={() => { setNewCommentText(comment.text); setIsEditingFeedback(true); }}
                                        className="btn btn-outline" style={{ fontSize: 12, padding: '2px 8px', marginLeft: 10, alignSelf: 'center' }}>Edit</button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Feedback Input: Shows if no feedback exists OR if in Edit Mode */}
                {(isCoach && reflectionMode === 'coach_view' && (!hasMyFeedback || isEditingFeedback)) && (
                    <form onSubmit={submitComment}>
                        <textarea className="form-control" rows={3} placeholder="Type your feedback, guidance, or comments here..." value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} style={{ marginBottom: 10 }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            {isEditingFeedback && (
                                <button type="button" onClick={() => { setIsEditingFeedback(false); setNewCommentText(myExistingFeedback?.text || ''); }} className="btn btn-outline">Cancel Edit</button>
                            )}
                            <button type="submit" className="btn btn-primary" disabled={commenting || !newCommentText.trim()} style={{ background: "#10b981", border: "none" }}>
                                {isEditingFeedback ? "Update Feedback" : "Submit Feedback"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
            {reflectionMessage && (
                <div className={`alert ${reflectionMessage.includes("Error") || reflectionMessage.includes("Failed") ? "alert-error" : "alert-success"}`} style={{padding: "8px 12px", margin: 18, marginTop: 0}}>
                    {reflectionMessage}
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}