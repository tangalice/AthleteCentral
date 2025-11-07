// src/components/AttendanceHistory.jsx
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";

// --- NEW IMPORTS ---
import { fetchTeamAthletes } from "../services/teamService"; // From Step 1
import { ATTENDANCE_CONFIG } from "../constants/constants"; // From Step 2

export default function AttendanceHistory({ userRole }) {
  // ... (all states unchanged)
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [events, setEvents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [athletes, setAthletes] = useState({});
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [selectedAthlete, setSelectedAthlete] = useState("all");


  // Fetch user's teams (unchanged)
  useEffect(() => {
    // ... (logic unchanged)
    const fetchTeams = async () => {
      if (!auth.currentUser) return;

      try {
        const teamsQuery = query(
          collection(db, "teams"),
          where(
            userRole === "coach" ? "coaches" : "athletes",
            "array-contains",
            auth.currentUser.uid
          )
        );
        const snapshot = await getDocs(teamsQuery);
        const teamsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTeams(teamsList);
        if (teamsList.length > 0) {
          setSelectedTeam(teamsList[0].id);
        }
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };

    fetchTeams();
  }, [userRole]);

  // Fetch events and attendance data (CLEANED UP from Step 1)
  useEffect(() => {
    if (!selectedTeam) return;

    const fetchEventsAndAttendance = async () => {
      setLoading(true);
      try {
        // --- MODIFICATION: Use teamService ---
        const athletesList = await fetchTeamAthletes(selectedTeam);
        const memberProfiles = {};
        athletesList.forEach(athlete => {
          memberProfiles[athlete.id] = { 
            displayName: athlete.name, 
            email: athlete.email 
          };
        });
        setAthletes(memberProfiles);
        // --- END MODIFICATION ---

        // Fetch events within date range
        const eventsQuery = query(
          collection(db, "teams", selectedTeam, "events"),
          orderBy("datetime", "desc"),
          limit(100)
        );

        const eventsSnapshot = await getDocs(eventsQuery);
        const eventsList = [];
        const attendanceMap = {};

        for (const eventDoc of eventsSnapshot.docs) {
          const eventData = eventDoc.data();
          const eventDate = eventData.datetime?.toDate?.() || null;

          // Filter by date range
          if (eventDate) {
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);

            if (eventDate >= startDate && eventDate <= endDate) {
              eventsList.push({
                id: eventDoc.id,
                ...eventData,
                datetime: eventDate,
              });

              // Read attendance from the event doc directly
              if (eventData.attendanceRecords) {
                attendanceMap[eventDoc.id] = eventData.attendanceRecords;
              } else {
                attendanceMap[eventDoc.id] = {};
              }
            }
          }
        }

        setEvents(eventsList);
        setAttendanceData(attendanceMap);
      } catch (error) {
        console.error("Error fetching events and attendance:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEventsAndAttendance();
  }, [selectedTeam, dateRange]);

  // Calculate attendance statistics (unchanged)
  const calculateStats = () => {
    // ... (logic unchanged)
    const stats = {
      byAthlete: {},
      overall: {
        totalEvents: events.length,
        totalPresent: 0,
        totalAbsent: 0,
        totalLate: 0,
        totalExcused: 0,
      },
      byEvent: {},
    };

    events.forEach((event) => {
      const eventAttendance = attendanceData[event.id] || {};
      
      // --- FIX for all-team events ---
      // If no one is assigned, use all athletes from the 'athletes' state
      const assignedIds = (event.assignedMemberIds?.length > 0) 
        ? event.assignedMemberIds 
        : Object.keys(athletes);
      
      const eventStats = {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: assignedIds.length, // Use the correct total
      };

      assignedIds.forEach((athleteId) => {
        // Only process athletes that are actually in the team
        if (athletes[athleteId]) { 
          const status = eventAttendance[athleteId]?.status;
  
          if (!stats.byAthlete[athleteId]) {
            stats.byAthlete[athleteId] = {
              present: 0,
              absent: 0,
              late: 0,
              excused: 0,
              total: 0,
            };
          }
  
          stats.byAthlete[athleteId].total++;
  
          if (status === "present") {
            stats.byAthlete[athleteId].present++;
            eventStats.present++;
            stats.overall.totalPresent++;
          } else if (status === "absent") {
            stats.byAthlete[athleteId].absent++;
            eventStats.absent++;
            stats.overall.totalAbsent++;
          } else if (status === "late") {
            stats.byAthlete[athleteId].late++;
            eventStats.late++;
            stats.overall.totalLate++;
          } else if (status === "excused") {
            stats.byAthlete[athleteId].excused++;
            eventStats.excused++;
            stats.overall.totalExcused++;
          }
        }
      });

      stats.byEvent[event.id] = eventStats;
    });

    return stats;
  };
  
  const stats = calculateStats();

  // Filter events based on selected athlete
  const filteredEvents =
    selectedAthlete === "all"
      ? events
      : events.filter((event) => {
          const assignedIds = (event.assignedMemberIds?.length > 0) 
            ? event.assignedMemberIds 
            : Object.keys(athletes);
          return assignedIds.includes(selectedAthlete);
        });

  // getAttendanceRate (unchanged)
  const getAttendanceRate = (athleteId) => {
    // ... (logic unchanged)
    const athleteStats = stats.byAthlete[athleteId];
    if (!athleteStats || athleteStats.total === 0) return 0;
    // Calculate rate based on present, not total (excused shouldn't count against)
    const validEvents = athleteStats.total - athleteStats.excused;
    if (validEvents <= 0) return 100.0; // If only excused, rate is 100%
    return ((athleteStats.present / validEvents) * 100).toFixed(1);
  };

  // --- DELETED ---
  // The local 'getStatusColor' function is no longer needed.
  // const getStatusColor = (status) => { ... };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 24, color: "#111827" }}>
        📊 Attendance History
      </h2>

      {/* Filters (unchanged) */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, color: "#6b7280" }}>
            Team
          </label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, color: "#6b7280" }}>
            Start Date
          </label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, start: e.target.value }))
            }
            style={{
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, color: "#6b7280" }}>
            End Date
          </label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, end: e.target.value }))
            }
            style={{
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14, color: "#6b7280" }}>
            Athlete
          </label>
          <select
            value={selectedAthlete}
            onChange={(e) => setSelectedAthlete(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            <option value="all">All Athletes</option>
            {Object.entries(athletes).map(([id, athlete]) => (
              <option key={id} value={id}>
                {athlete.displayName || athlete.email || id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          Loading attendance data...
        </div>
      ) : (
        <>
          {/* Overall Statistics (unchanged) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                padding: 20,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", //
                borderRadius: 12,
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 32, fontWeight: "bold", marginBottom: 4 }}>
                {stats.overall.totalPresent}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Total Present</div>
            </div>

            <div
              style={{
                padding: 20,
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", //
                borderRadius: 12,
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 32, fontWeight: "bold", marginBottom: 4 }}>
                {stats.overall.totalAbsent}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Total Absent</div>
            </div>

            <div
              style={{
                padding: 20,
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", //
                borderRadius: 12,
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 32, fontWeight: "bold", marginBottom: 4 }}>
                {stats.overall.totalLate}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Total Late</div>
            </div>

            <div
              style={{
                padding: 20,
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                borderRadius: 12,
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 32, fontWeight: "bold", marginBottom: 4 }}>
                {stats.overall.totalEvents}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Total Events</div>
            </div>
          </div>

          {/* Athlete Performance Table (MODIFIED to use config colors) */}
          {userRole === "coach" && selectedAthlete === "all" && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ marginBottom: 16, color: "#374151" }}>
                Athlete Attendance Performance
              </h3>
              <div
                style={{
                  overflowX: "auto",
                  border: "1px solid #e5e7eb", //
                  borderRadius: 8,
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}> {/* */}
                      <th
                        style={{
                          padding: 12,
                          textAlign: "left",
                          borderBottom: "1px solid #e5e7eb",
                          fontSize: 14,
                        }}
                      >
                        Athlete
                      </th>
                      <th
                        style={{
                          padding: 12,
                          textAlign: "center",
                          borderBottom: "1px solid #e5e7eb",
                          fontSize: 14,
                        }}
                      >
                        Present
                      </th>
                      <th
                        style={{
                          padding: 12,
                          textAlign: "center",
                          borderBottom: "1px solid #e5e7eb",
                          fontSize: 14,
                        }}
                      >
                        Absent
                      </th>
                      <th
                        style={{
                          padding: 12,
                          textAlign: "center",
                          borderBottom: "1px solid #e5e7eb",
                          fontSize: 14,
                        }}
                      >
                        Late
                      </th>
                       <th
                        style={{
                          padding: 12,
                          textAlign: "center",
                          borderBottom: "1px solid #e5e7eb",
                          fontSize: 14,
                        }}
                      >
                        Excused
                      </th>
                      <th
                        style={{
                          padding: 12,
                          textAlign: "center",
                          borderBottom: "1px solid #e5e7eb",
                          fontSize: 14,
                        }}
                      >
                        Total
                      </th>
                      <th
                        style={{
                          padding: 12,
                          textAlign: "center",
                          borderBottom: "1px solid #e5e7eb",
                          fontSize: 14,
                        }}
                      >
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.byAthlete).map(([athleteId, athleteStats]) => (
                      <tr key={athleteId} style={{ background: "#fff" }}>
                        <td
                          style={{
                            padding: 12,
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: 14,
                          }}
                        >
                          {athletes[athleteId]?.displayName ||
                            athletes[athleteId]?.email ||
                            athleteId}
                        </td>
                        <td
                          style={{
                            padding: 12,
                            textAlign: "center",
                            borderBottom: "1px solid #f3f4f6",
                            color: ATTENDANCE_CONFIG.present.color, // Use config
                            fontWeight: 500,
                            fontSize: 14,
                          }}
                        >
                          {athleteStats.present}
                        </td>
                        <td
                          style={{
                            padding: 12,
                            textAlign: "center",
                            borderBottom: "1px solid #f3f4f6",
                            color: ATTENDANCE_CONFIG.absent.color, // Use config
                            fontWeight: 500,
                            fontSize: 14,
                          }}
                        >
                          {athleteStats.absent}
                        </td>
                        <td
                          style={{
                            padding: 12,
                            textAlign: "center",
                            borderBottom: "1px solid #f3f4f6",
                            color: ATTENDANCE_CONFIG.late.color, // Use config
                            fontWeight: 500,
                            fontSize: 14,
                          }}
                        >
                          {athleteStats.late}
                        </td>
                         <td
                          style={{
                            padding: 12,
                            textAlign: "center",
                            borderBottom: "1px solid #f3f4f6",
                            color: ATTENDANCE_CONFIG.excused.color, // Use config
                            fontWeight: 500,
                            fontSize: 14,
                          }}
                        >
                          {athleteStats.excused}
                        </td>
                        <td
                          style={{
                            padding: 12,
                            textAlign: "center",
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: 14,
                          }}
                        >
                          {athleteStats.total}
                        </td>
                        <td
                          style={{
                            padding: 12,
                            textAlign: "center",
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: 14,
                          }}
                        >
                          <span
                            style={{
                              padding: "4px 8px",
                              background:
                                getAttendanceRate(athleteId) >= 90
                                  ? ATTENDANCE_CONFIG.present.backgroundColor
                                  : getAttendanceRate(athleteId) >= 75
                                  ? ATTENDANCE_CONFIG.late.backgroundColor
                                  : ATTENDANCE_CONFIG.absent.backgroundColor,
                              color:
                                getAttendanceRate(athleteId) >= 90
                                  ? ATTENDANCE_CONFIG.present.color
                                  : getAttendanceRate(athleteId) >= 75
                                  ? ATTENDANCE_CONFIG.late.color
                                  : ATTENDANCE_CONFIG.absent.color,
                              borderRadius: 4,
                              fontWeight: 500,
                            }}
                          >
                            {getAttendanceRate(athleteId)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Events List (MODIFIED to use config colors) */}
          <div>
            <h3 style={{ marginBottom: 16, color: "#374151" }}>
              Event History ({filteredEvents.length} events)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredEvents.map((event) => {
                const eventStats = stats.byEvent[event.id] || {};
                const attendanceRate =
                  eventStats.total > 0
                    ? ((eventStats.present / eventStats.total) * 100).toFixed(1)
                    : 0;

                return (
                  <div
                    key={event.id}
                    style={{
                      padding: 16,
                      background: "#fff",
                      border: "1px solid #e5e7eb", //
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <h4 style={{ margin: "0 0 4px 0", color: "#111827" }}>
                          {event.title}
                        </h4>
                        <div style={{ fontSize: 14, color: "#6b7280" }}>
                          📅{" "}
                          {event.datetime.toLocaleDateString()} at{" "}
                          {event.datetime.toLocaleTimeString()}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "6px 12px",
                          background: attendanceRate >= 80 ? ATTENDANCE_CONFIG.present.backgroundColor : ATTENDANCE_CONFIG.absent.backgroundColor,
                          color: attendanceRate >= 80 ? ATTENDANCE_CONFIG.present.color : ATTENDANCE_CONFIG.absent.color,
                          borderRadius: 6,
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        {attendanceRate}% Attendance
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        fontSize: 14,
                        color: "#6b7280",
                      }}
                    >
                      <span>
                        <span style={{ color: ATTENDANCE_CONFIG.present.color, fontWeight: 500 }}>
                          {eventStats.present || 0}
                        </span>{" "}
                        present
                      </span>
                      <span>
                        <span style={{ color: ATTENDANCE_CONFIG.absent.color, fontWeight: 500 }}>
                          {eventStats.absent || 0}
                        </span>{" "}
                        absent
                      </span>
                      <span>
                        <span style={{ color: ATTENDANCE_CONFIG.late.color, fontWeight: 500 }}>
                          {eventStats.late || 0}
                        </span>{" "}
                        late
                      </span>
                       <span>
                        <span style={{ color: ATTENDANCE_CONFIG.excused.color, fontWeight: 500 }}>
                          {eventStats.excused || 0}
                        </span>{" "}
                        excused
                      </span>
                      <span>
                        <span style={{ color: "#6b7280", fontWeight: 500 }}>
                          {eventStats.total || 0}
                        </span>{" "}
                        total
                      </span>
                    </div>

                    {selectedAthlete !== "all" && (
                      <div style={{ marginTop: 8, fontSize: 14 }}>
                        <strong>
                          {athletes[selectedAthlete]?.displayName || selectedAthlete}:
                        </strong>{" "}
                        <span
                          style={{
                            padding: "2px 8px",
                            // Use config color
                            background: ATTENDANCE_CONFIG[attendanceData[event.id]?.[selectedAthlete]?.status || 'unset'].color,
                            color: "#fff",
                            borderRadius: 4,
                            marginLeft: 4,
                          }}
                        >
                          {ATTENDANCE_CONFIG[attendanceData[event.id]?.[selectedAthlete]?.status || 'unset'].label}
                        </span>
                        {attendanceData[event.id]?.[selectedAthlete]?.note && (
                          <span style={{ marginLeft: 8, color: "#6b7280", fontStyle: "italic" }}>
                            ({attendanceData[event.id][selectedAthlete].note})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}