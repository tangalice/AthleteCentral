// src/components/Dashboard.jsx
import { useLoaderData, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";

import { collection, query, where, getDocs, doc, onSnapshot, orderBy, limit } from "firebase/firestore";

export default function Dashboard({ userRole, user, unreadMessageCount = 0 }) {
  const data = useLoaderData();
  const navigate = useNavigate();
  const displayName = data?.displayName || user?.email || "";
  const [inTeam, setInTeam] = useState(true);

  const [healthStatus, setHealthStatus] = useState("loading");
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [teamId, setTeamId] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Fetch team and subscribe to health status (athlete only)
  useEffect(() => {
    if (userRole !== "athlete" || !auth.currentUser) return;

    const fetchTeamAndListen = async () => {
      try {
        const teamsQuery = query(
          collection(db, "teams"),
          where("athletes", "array-contains", auth.currentUser.uid)
        );
        const snapshot = await getDocs(teamsQuery);

        if (snapshot.empty) {
          setHealthStatus("no team");
          return;
        }

        const teamDoc = snapshot.docs[0];
        const teamId = teamDoc.id;

        const athleteRef = doc(db, "teams", teamId, "athletes", auth.currentUser.uid);
        const unsub = onSnapshot(athleteRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setHealthStatus(data.healthStatus || "Active");
          } else {
            setHealthStatus("Active");
          }
        });

        return () => unsub();
      } catch (error) {
        console.error("Error listening to health status:", error);
        setHealthStatus("loading fail");
      }
    };

    fetchTeamAndListen();
  }, [userRole]);

  // Check team membership and get team ID
  useEffect(() => {
    const checkTeamMembership = async () => {
      if (!auth.currentUser) return;
      try {
        // Check for team membership based on role
        const q = query(
          collection(db, "teams"),
          where(
            userRole === "coach" ? "coaches" : "athletes",
            "array-contains",
            auth.currentUser.uid
          )
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const teamDoc = snap.docs[0];
          setTeamId(teamDoc.id);
          setInTeam(true);
        } else {
          // Fallback check for 'members' field
          const membersQuery = query(
            collection(db, "teams"),
            where("members", "array-contains", auth.currentUser.uid)
          );
          const membersSnap = await getDocs(membersQuery);
          
          if (!membersSnap.empty) {
            const teamDoc = membersSnap.docs[0];
            setTeamId(teamDoc.id);
            setInTeam(true);
          } else {
            setInTeam(false);
          }
        }
      } catch (e) {
        console.error("Error checking team membership:", e);
        setInTeam(true);
      }
    };
    checkTeamMembership();
  }, [userRole]);

  // Subscribe to upcoming events (next 7 days)
  useEffect(() => {
    if (!teamId) {
      setLoadingEvents(false);
      return;
    }

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Query for events in the next 7 days
    const eventsQuery = query(
      collection(db, "teams", teamId, "events"),
      orderBy("datetime", "asc")
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const events = [];
        snapshot.docs.forEach((doc) => {
          const eventData = doc.data();
          const eventDate = eventData.datetime?.toDate();
          
          // Filter for events in the next 7 days
          if (eventDate && eventDate >= now && eventDate <= sevenDaysFromNow) {
            events.push({
              id: doc.id,
              ...eventData,
              datetime: eventDate,
            });
          }
        });
        
        setUpcomingEvents(events);
        setLoadingEvents(false);
      },
      (error) => {
        console.error("Error fetching events:", error);
        setLoadingEvents(false);
      }
    );

    return () => unsubscribe();
  }, [teamId]);

  // Format date for event display
  const formatEventDate = (date) => {
    if (!date) return "";
    
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if today
    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`;
    }
    
    // Check if tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`;
    }
    
    // Other days
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Get event type icon
  const getEventTypeIcon = (type) => {
    switch (type) {
      case "practice":
        return "🏃";
      case "game":
        return "🏆";
      case "meeting":
        return "📋";
      default:
        return "📅";
    }
  };

  // Get event type color
  const getEventTypeColor = (type) => {
    switch (type) {
      case "practice":
        return "#10b981";
      case "game":
        return "#ef4444";
      case "meeting":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };
  // --- Color tokens ---
  const brand = "var(--brand-primary)";
  const brandTint = "var(--brand-primary-50)";
  const ink900 = "#111827";

  const cardBase = {
    textAlign: "center",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
    background: "#fff",
    transition:
      "background .18s ease, border-color .18s ease, transform .18s ease, box-shadow .18s ease",
  };

  const onHover = (e) => {
    e.currentTarget.style.background = brandTint;
    e.currentTarget.style.borderColor = "#a7f3d0";
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 2px 6px rgba(16,185,129,.12)";
  };

  const offHover = (e) => {
    Object.assign(e.currentTarget.style, cardBase);
  };

  const profileDone = !!data?.raw?.profileComplete;
  const statusColor = profileDone ? brand : "#d97706";
  const statusText = profileDone ? "Complete" : "Incomplete";
  const statusMark = profileDone ? "✓" : "!";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: 300,
        }}
      >
        {/* ---- Header ---- */}
        <h2
          style={{
            fontSize: 28,
            marginBottom: 8,
            fontWeight: 800,
            color: ink900,
          }}
        >
          Welcome back, {displayName}!
        </h2>
        <p
          className="text-muted"
          style={{ fontSize: 18, marginBottom: 16 }}
        >
          {userRole === "athlete"
            ? "Athlete"
            : userRole === "coach"
            ? "Coach"
            : "User"}{" "}
          Dashboard
        </p>

        {userRole === "athlete" && (
          <p
            style={{
              fontSize: 16,
              marginBottom: 12,
              color:
                healthStatus === "injured"
                  ? "#dc2626" 
                  : healthStatus === "unavailable"
                  ? "#d97706" 
                  : "#047857",
            }}
          >
            Health Status: 
            <strong> {healthStatus}</strong>
          </p>
        )}

        <div
          style={{
            height: 4,
            width: 120,
            background: brand,
            borderRadius: 999,
            opacity: 0.25,
            marginBottom: 12,
          }}
        />

        {/* ---- Team Notice ---- */}
        {!inTeam && (
          <div
            style={{
              border: "1px solid #f59e0b",
              background: "#fff7ed",
              color: "#92400e",
              padding: "16px 20px",
              borderRadius: 8,
              textAlign: "center",
              marginBottom: 24,
              maxWidth: 600,
            }}
          >
            <p style={{ marginBottom: 12 }}>
              You are not in any team yet — please join or create one.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/teams")}
            >
              Go to Teams Page
            </button>
          </div>
        )}

        {/* ---- Upcoming Events Reminder Section ---- */}
        {inTeam && (
          <div
            style={{
              width: "100%",
              maxWidth: 1000,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: ink900,
                  margin: 0,
                }}
              >
                📅 Upcoming Events (Next 7 Days)
              </h3>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => navigate("/calendar")}
                style={{
                  fontSize: 14,
                  padding: "6px 12px",
                  borderColor: brand,
                  color: brand,
                }}
              >
                View Full Calendar →
              </button>
            </div>

            {loadingEvents ? (
              <div className="card" style={{ padding: 20, textAlign: "center" }}>
                <p className="text-muted">Loading events...</p>
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div
                className="card"
                style={{
                  padding: 24,
                  background: "#f9fafb",
                  borderStyle: "dashed",
                  textAlign: "center",
                }}
              >
                <p className="text-muted" style={{ margin: 0 }}>
                  No upcoming events in the next 7 days
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {upcomingEvents.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="card"
                    style={{
                      padding: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderLeft: `4px solid ${getEventTypeColor(event.type)}`,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => navigate("/calendar")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateX(4px)";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateX(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ fontSize: 24 }}>
                        {getEventTypeIcon(event.type)}
                      </span>
                      <div>
                        <h4
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: ink900,
                            margin: 0,
                            marginBottom: 4,
                          }}
                        >
                          {event.title}
                        </h4>
                        <p
                          style={{
                            fontSize: 14,
                            color: "#6b7280",
                            margin: 0,
                          }}
                        >
                          {formatEventDate(event.datetime)}
                        </p>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        background: getEventTypeColor(event.type) + "20",
                        color: getEventTypeColor(event.type),
                        borderRadius: 4,
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {event.type}
                    </span>
                  </div>
                ))}
                {upcomingEvents.length > 5 && (
                  <div
                    className="card"
                    style={{
                      padding: 12,
                      textAlign: "center",
                      background: "#f9fafb",
                      cursor: "pointer",
                    }}
                    onClick={() => navigate("/calendar")}
                  >
                    <p
                      style={{
                        margin: 0,
                        color: brand,
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      +{upcomingEvents.length - 5} more events →
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---- Stats Cards ---- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 16,
            width: "100%",
            maxWidth: 1000,
          }}
        >
          {/* Training Sessions */}
          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
          >
            <h3 style={{ marginBottom: 8, color: ink900 }}>
              Training Sessions
            </h3>
            <p
              style={{
                fontSize: 36,
                fontWeight: 800,
                margin: "6px 0",
                color: brand,
              }}
            >
              0
            </p>
            <p className="text-muted">This Week</p>
          </div>

          {/* Messages */}
          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
            onClick={() => navigate("/messages")}
          >
            <h3 style={{ marginBottom: 8, color: ink900 }}>Messages</h3>
            <p
              style={{
                fontSize: 36,
                fontWeight: 800,
                margin: "6px 0",
                color: unreadMessageCount > 0 ? "#ef4444" : brand,
              }}
            >
              {unreadMessageCount}
            </p>
            <p className="text-muted">Unread</p>
          </div>

          {/* Profile */}
          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
            onClick={() => navigate("/profile")}
          >
            <h3 style={{ marginBottom: 8, color: ink900 }}>Profile</h3>
            <p
              style={{
                fontSize: 36,
                fontWeight: 800,
                margin: "6px 0",
                color: statusColor,
              }}
            >
              {statusMark}
            </p>
            <p className="text-muted">{statusText}</p>
          </div>
        </div>

        {/* ---- Recent Activity ---- */}
        <div style={{ marginTop: 32, width: "100%", maxWidth: 1000 }}>
          <h3
            style={{
              fontSize: 20,
              marginBottom: 12,
              color: ink900,
              fontWeight: 800,
            }}
          >
            Recent Activity
          </h3>
          <div className="card" style={{ borderColor: "var(--border)" }}>
            <p className="text-muted" style={{ textAlign: "center" }}>
              No recent activity to display
            </p>
          </div>
        </div>

        {/* ---- Athlete Tools Button ---- */}
        {userRole === "athlete" && (
          <div style={{ marginTop: 40 }}>
            <button
              onClick={() => navigate("/athlete-tools")}
              style={{
                background: brand,
                color: "white",
                fontWeight: 600,
                padding: "12px 24px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              }}
            >
              Open Athlete Tools ⚙️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

