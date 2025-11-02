// src/components/Dashboard.jsx
import { useLoaderData, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, onSnapshot, orderBy, doc } from "firebase/firestore";

export default function Dashboard({ userRole, user, unreadMessageCount = 0 }) {
  const data = useLoaderData();
  const navigate = useNavigate();
  const displayName = data?.displayName || user?.email || "";
  const [inTeam, setInTeam] = useState(true);

  const [teamId, setTeamId] = useState(null);
  const [reminders, setReminders] = useState([]);
  // 🩺 Athlete Health Status
  const [healthStatus, setHealthStatus] = useState("Loading...");

  useEffect(() => {
    if (userRole !== "athlete" || !auth.currentUser) return;

    const fetchAndListenHealth = async () => {
      try {
        const teamsQ = query(
          collection(db, "teams"),
          where("athletes", "array-contains", auth.currentUser.uid)
        );
        const snap = await getDocs(teamsQ);
        if (snap.empty) {
          setHealthStatus("No team found");
          return;
        }
        const teamId = snap.docs[0].id;
        const healthRef = doc(db, "teams", teamId, "athletes", auth.currentUser.uid);
        const unsub = onSnapshot(healthRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setHealthStatus(data.healthStatus || "Unknown");
          } else {
            setHealthStatus("Not set");
          }
        });
        return () => unsub();
      } catch (err) {
        console.error("Error loading health status:", err);
        setHealthStatus("Error");
      }
    };
    fetchAndListenHealth();
  }, [userRole]);


  useEffect(() => {
    if (!auth.currentUser || !userRole) {
      console.log("⏸️ Waiting for auth.currentUser or userRole...");
      return;
    }
  
    const checkTeamMembership = async () => {
      try {
        console.log("🔍 Checking team membership for:", userRole, auth.currentUser.uid);
        const q = query(
          collection(db, "teams"),
          where(
            userRole === "coach" ? "coaches" : "members",
            "array-contains",
            auth.currentUser.uid
          )
        );
        const snap = await getDocs(q);
        console.log("📦 Team membership found:", !snap.empty);
        setInTeam(!snap.empty);
      } catch (e) {
        console.error("Error checking team membership:", e);
        setInTeam(true);
      }
    };
  
    checkTeamMembership();
  
    const interval = setInterval(() => {
      if (auth.currentUser && userRole) {
        checkTeamMembership();
        clearInterval(interval);
      }
    }, 1500);
  
    return () => clearInterval(interval);
  }, [userRole, auth.currentUser]);
  
  // === ===
useEffect(() => {
  if (!auth.currentUser || !userRole) {
    console.log("⏸️ Waiting for auth or userRole before fetching teams...");
    return;
  }

  const fetchTeams = async () => {
    try {
      console.log("🔍 Fetching teams for:", userRole, auth.currentUser.uid);

      const teamRefs = [];

      const mainQ = query(
        collection(db, "teams"),
        where(userRole === "coach" ? "coaches" : "members", "array-contains", auth.currentUser.uid)
      );
      const mainSnap = await getDocs(mainQ);
      mainSnap.forEach((doc) => teamRefs.push(doc.id));

      if (userRole === "athlete") {
        const altQ = query(
          collection(db, "teams"),
          where("athletes", "array-contains", auth.currentUser.uid)
        );
        const altSnap = await getDocs(altQ);
        altSnap.forEach((doc) => {
          if (!teamRefs.includes(doc.id)) teamRefs.push(doc.id);
        });
      }

      if (teamRefs.length > 0) {
        console.log("✅ Found teams:", teamRefs);
        setTeamId(teamRefs); 
      } else {
        console.warn("⚠️ No teams found for user:", auth.currentUser.uid);
        setTeamId([]);
      }
    } catch (e) {
      console.error("Error fetching teams:", e);
    }
  };

  fetchTeams();
}, [userRole, auth.currentUser]);

useEffect(() => {
  if (!teamId || teamId.length === 0) {
    console.warn("⏸️ No teamIds yet, skipping reminder listener");
    return;
  }

  console.log("🎧 Listening for events in teams:", teamId);

  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);

  const unsubscribes = teamId.map((id) => {
    const q = query(collection(db, "teams", id, "events"), orderBy("datetime", "asc"));
    return onSnapshot(q, (snap) => {
      const events = snap.docs.map((doc) => {
        const data = doc.data();
        const dt =
          data.datetime?.toDate?.() ??
          (data.datetime instanceof Date ? data.datetime : null);
        return { id: doc.id, teamId: id, ...data, datetime: dt };
      });

      const upcoming = events.filter(
        (e) =>
          e.datetime &&
          e.datetime.getTime() >= now.getTime() &&
          e.datetime.getTime() <= nextWeek.getTime()
      );

      setReminders((prev) => {
        const filteredPrev = prev.filter((p) => p.teamId !== id);
        const merged = [...filteredPrev, ...upcoming];
        merged.sort((a, b) => a.datetime - b.datetime); 
        return merged;
      });;

      console.log(`✅ Team ${id} has ${upcoming.length} upcoming events`);
    });
  });

  return () => unsubscribes.forEach((unsub) => unsub());
}, [teamId]);
  

  // 
  const brand = "var(--brand-primary)";
  const brandTint = "var(--brand-primary-50)";
  const ink900 = "#111827";

  const cardBase = {
    textAlign: "center",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
    background: "#fff",
    transition: "background .18s ease, border-color .18s ease, transform .18s ease, box-shadow .18s ease",
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 300 }}>
        <h2 style={{ fontSize: 28, marginBottom: 8, fontWeight: 800, color: ink900 }}>
          Welcome back, {displayName}!
        </h2>
        <p className="text-muted" style={{ fontSize: 18, marginBottom: 16 }}>
          {userRole === "athlete" ? "Athlete" : userRole === "coach" ? "Coach" : "User"} Dashboard
        </p>
        {userRole === "athlete" && (
          <p style={{ fontSize: 16, marginBottom: 10 }}>
            <strong>Health Status:</strong>{" "}
            <span
              style={{
                color:
                  healthStatus === "injured"
                    ? "#dc2626"
                    : healthStatus === "unavailable"
                    ? "#f59e0b"
                    : "#16a34a",
              }}
            >
              {healthStatus}
            </span>
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
        {/* 🔔 Reminder Section */}
        <div style={{ width: "100%", maxWidth: 800, marginTop: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
            🔔 Upcoming Events (Next 7 Days)
          </h3>
          {reminders.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 15 }}>No upcoming events.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {reminders.map((event) => (
                <div
                  key={event.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "10px 16px",
                    background: "#f9fafb",
                  }}
                >
                  <h4 style={{ margin: 0, color: "#111827", fontSize: 16, fontWeight: 700 }}>
                    {event.title}
                  </h4>
                  <p style={{ color: "#4b5563", fontSize: 14, margin: "2px 0 0" }}>
                    {event.datetime.toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* notice */}
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

        {/* calculate */}
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
          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
          >
            <h3 style={{ marginBottom: 8, color: ink900 }}>Training Sessions</h3>
            <p style={{ fontSize: 36, fontWeight: 800, margin: "6px 0", color: brand }}>0</p>
            <p className="text-muted">This Week</p>
          </div>

          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
          >
            <h3 style={{ marginBottom: 8, color: ink900 }}>Messages</h3>
            <p style={{ fontSize: 36, fontWeight: 800, margin: "6px 0", color: unreadMessageCount > 0 ? "#ef4444" : brand }}>{unreadMessageCount}</p>
            <p className="text-muted">Unread</p>
          </div>

          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
          >
            <h3 style={{ marginBottom: 8, color: ink900 }}>Profile</h3>
            <p style={{ fontSize: 36, fontWeight: 800, margin: "6px 0", color: statusColor }}>{statusMark}</p>
            <p className="text-muted">{statusText}</p>
          </div>
        </div>

        <div style={{ marginTop: 32, width: "100%", maxWidth: 1000 }}>
          <h3 style={{ fontSize: 20, marginBottom: 12, color: ink900, fontWeight: 800 }}>Recent Activity</h3>
          <div className="card" style={{ borderColor: "var(--border)" }}>
            <p className="text-muted" style={{ textAlign: "center" }}>No recent activity to display</p>
          </div>
        </div>
      </div>
    </div>
  );
}
