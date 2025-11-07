// src/components/Dashboard.jsx
import { useLoaderData, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { checkAndNotifyIncompleteProfile } from "../services/EmailNotificationService";

export default function Dashboard({ userRole, user, unreadMessageCount = 0 }) {
  const data = useLoaderData();
  const navigate = useNavigate();
  const displayName = data?.displayName || user?.email || "";

  const [inTeam, setInTeam] = useState(true);

  // teamsMeta: [{ id, coaches: string[] }]
  const [teamsMeta, setTeamsMeta] = useState([]);

  const teamIds = useMemo(
    () => teamsMeta.map((t) => t.id).sort(),
    [teamsMeta]
  );
  const teamIdsKey = useMemo(() => teamIds.join(","), [teamIds]);

  const coachKey = useMemo(
    () =>
      teamIds
        .map((id) => {
          const c = teamsMeta.find((t) => t.id === id)?.coaches || [];
          return `${id}:${c.slice().sort().join("|")}`;
        })
        .join(";"),
    [teamIds, teamsMeta]
  );

  const [reminders, setReminders] = useState([]);

  const [healthStatus, setHealthStatus] = useState("Loading...");

  const [assignedOnly, setAssignedOnly] = useState(false);

  // ========== Check profile completeness and send notification if needed ==========
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const checkProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          await checkAndNotifyIncompleteProfile(auth.currentUser.uid, userData, auth.currentUser);
        }
      } catch (error) {
        console.error("Error checking profile completeness:", error);
      }
    };
    
    // Check profile completeness on mount (with a small delay to avoid blocking initial render)
    const timeoutId = setTimeout(checkProfile, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  // ========== Athlete health live updates ==========
  useEffect(() => {
    if (userRole !== "athlete" || !auth.currentUser) return;

    // Read health status directly from user document
    const userRef = doc(db, "users", auth.currentUser.uid);
    const unsub = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setHealthStatus(d.healthStatus || "active");
      } else {
        setHealthStatus("Not set");
      }
    }, (err) => {
      console.error("Error loading health status:", err);
      setHealthStatus("Error");
    });

    return () => unsub();
  }, [userRole]);

  useEffect(() => {
    if (!auth.currentUser || !userRole) return;

    const checkTeamMembership = async () => {
      try {
        const qTeams = query(
          collection(db, "teams"),
          where(userRole === "coach" ? "coaches" : "members", "array-contains", auth.currentUser.uid)
        );
        const snap = await getDocs(qTeams);
        setInTeam(!snap.empty);
      } catch (e) {
        console.error("Error checking team membership:", e);
        setInTeam(true);
      }
    };

    checkTeamMembership();
    const t = setTimeout(checkTeamMembership, 1500);
    return () => clearTimeout(t);
  }, [userRole]);

  useEffect(() => {
    if (!auth.currentUser || !userRole) return;

    (async () => {
      try {
        const metas = [];

        const baseQ = query(
          collection(db, "teams"),
          where(userRole === "coach" ? "coaches" : "members", "array-contains", auth.currentUser.uid)
        );
        const baseSnap = await getDocs(baseQ);
        baseSnap.forEach((d) => {
          const data = d.data() || {};
          metas.push({ id: d.id, coaches: Array.isArray(data.coaches) ? data.coaches : [] });
        });

        if (userRole === "athlete") {
          const altQ = query(
            collection(db, "teams"),
            where("athletes", "array-contains", auth.currentUser.uid)
          );
          const altSnap = await getDocs(altQ);
          altSnap.forEach((d) => {
            if (!metas.find((m) => m.id === d.id)) {
              const data = d.data() || {};
              metas.push({ id: d.id, coaches: Array.isArray(data.coaches) ? data.coaches : [] });
            }
          });
        }

        setTeamsMeta(metas);
      } catch (e) {
        console.error("Error fetching teams meta:", e);
        setTeamsMeta([]);
      }
    })();
  }, [userRole]);


  const eventsByTeamRef = useRef({}); // {

  useEffect(() => {
    if (!teamIdsKey) return;

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const myId = auth.currentUser?.uid;

    const coachMap = {};
    coachKey.split(";").forEach((pair) => {
      if (!pair) return;
      const [id, coachesStr] = pair.split(":");
      coachMap[id] = coachesStr ? coachesStr.split("|").filter(Boolean) : [];
    });

    const unsubs = teamIds.map((id) => {
      const qRef = query(collection(db, "teams", id, "events"), orderBy("datetime", "asc"));
      return onSnapshot(qRef, (snap) => {
        const all = snap.docs.map((docSnap) => {
          const data = docSnap.data();
          const dt =
            data?.datetime?.toDate?.() ??
            (data.datetime instanceof Date ? data.datetime : null);
        return { id: docSnap.id, teamId: id, ...data, datetime: dt };
        });

        let upcoming = all.filter(
          (e) => e.datetime && e.datetime >= now && e.datetime <= nextWeek
        );

        if (userRole === "athlete") {
          const coaches = coachMap[id] || [];
          upcoming = upcoming.filter((e) => coaches.includes(e.createdBy));
          if (assignedOnly && myId) {
            upcoming = upcoming.filter(
              (e) =>
                Array.isArray(e.assignedMemberIds) &&
                e.assignedMemberIds.includes(myId)
            );
          }
        }

        eventsByTeamRef.current = {
          ...eventsByTeamRef.current,
          [id]: upcoming,
        };

        const merged = Object.values(eventsByTeamRef.current).flat();
        merged.sort((a, b) => a.datetime - b.datetime);
        setReminders(merged);
      });
    });

    return () => {
      unsubs.forEach((u) => u());
      eventsByTeamRef.current = {}; // 
    };
  }, [teamIdsKey, coachKey, userRole, assignedOnly]);

  // ---- UI styles ----
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
        <p className="text-muted" style={{ fontSize: 18, marginBottom: 16 }}>
          {userRole === "athlete"
            ? "Athlete"
            : userRole === "coach"
            ? "Coach"
            : "User"}{" "}
          Dashboard
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

        {/* Athlete: Assigned to me toggle */}
        {userRole === "athlete" && (
          <div style={{ marginTop: 6 }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={assignedOnly}
                onChange={(e) => setAssignedOnly(e.target.checked)}
              />
              Assigned to me
            </label>
          </div>
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

        {/* 🔔 Upcoming Events (Next 7 Days) */}
        <div
          style={{ width: "100%", maxWidth: 800, marginTop: 20, marginBottom: 24 }}
        >
          <h3
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 8,
            }}
          >
            🔔 Upcoming Events (Next 7 Days)
          </h3>
          {reminders.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 15 }}>No upcoming events.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {reminders.map((event) => (
                <div
                  key={`${event.teamId}:${event.id}`}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "10px 16px",
                    background: "#f9fafb",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      color: "#111827",
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    {event.title}
                  </h4>
                  <p
                    style={{
                      color: "#4b5563",
                      fontSize: 14,
                      margin: "2px 0 0",
                    }}
                  >
                    {event.datetime.toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {Array.isArray(event.assignedMemberIds) &&
                    event.assignedMemberIds.length > 0 && (
                      <p
                        style={{
                          color: "#6b7280",
                          fontSize: 12,
                          margin: "4px 0 0",
                        }}
                      >
                        Assigned IDs: {event.assignedMemberIds.join(", ")}
                      </p>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Not in team notice */}
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

        {/* Summary cards */}
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

          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
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

          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
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
      </div>
    </div>
  );
}
