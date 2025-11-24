// src/components/Dashboard.jsx
// Refactored to use CSS classes from index.css for spacing and alerts.
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
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { checkAndNotifyIncompleteProfile } from "../services/EmailNotificationService";

export default function Dashboard({ userRole, user, unreadMessageCount = 0 }) {
  const data = useLoaderData();
  const navigate = useNavigate();
  const displayName = data?.displayName || user?.email || "";

  // ... (All state definitions remain the same) ...
  const [inTeam, setInTeam] = useState(true);
  const [teamsMeta, setTeamsMeta] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [healthStatus, setHealthStatus] = useState("Loading...");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [userCache, setUserCache] = useState(new Map());
  const [expiredPoll, setExpiredPoll] = useState(null);
  const [expiredDismissed, setExpiredDismissed] = useState(false);
  


  const teamIds = useMemo(
    () => teamsMeta.map((t) => t.id).sort(),
    [teamsMeta]
  );
  

  const teamIdsKey = useMemo(() => teamIds.join(","), [teamIds]);
  const teamNameMap = useMemo(() => {
    const map = new Map();
    teamsMeta.forEach(team => {
      map.set(team.id, team.name);
    });
    return map;
  }, [teamsMeta]);
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

  
  const eventsByTeamRef = useRef({});
  // ⭐ New athlete poll loader (replacing useOpenPoll)
const [openPoll, setOpenPoll] = useState(null);

useEffect(() => {
  if (userRole !== "athlete") return;         // only athletes
  if (!auth.currentUser) return;
  if (teamIds.length === 0) {
    setOpenPoll(null);
    return;
  }

  const me = auth.currentUser.uid;
  const now = new Date();

  async function loadPoll() {

    const qRef = query(
      collection(db, "feedbackPolls"),
      where("status", "==", "open")
    );
  
    const snap = await getDocs(qRef);
    if (snap.empty) {
      setOpenPoll(null);
      setExpiredPoll(null);   // ⭐ NEW
      return;
    }
  
    let candidates = [];
    let expiredCandidates = [];   // ⭐ NEW
  
    for (const d of snap.docs) {
      const poll = d.data();
      const pollId = d.id;
  
      if (!Array.isArray(poll.teamIds)) continue;
      const inMyTeam = poll.teamIds.some(id => teamIds.includes(id));
      if (!inMyTeam) continue;
  
      const deadline = poll.deadline?.toDate ? poll.deadline.toDate() : null;
      if (!deadline) continue;
  
      const respRef = doc(db, "feedbackPolls", pollId, "responses", me);
      const respSnap = await getDoc(respRef);
      const respData = respSnap.exists() ? respSnap.data() : null;
      const dismissed = respData?.dismissed === true;
  
      // 🟥 NEW: expired + not responded → expiredCandidates
      if (deadline < now) {
        if (!respSnap.exists() && !dismissed) {
          expiredCandidates.push({ id: pollId, ...poll });
        }
        continue;
      }
  
      // (unchanged) open poll but not responded
      if (!respSnap.exists() || dismissed) {
        candidates.push({ id: pollId, ...poll });
      }
    }
  
    // sort open polls
    candidates.sort((a, b) => a.deadline.toDate() - b.deadline.toDate());
    setOpenPoll(candidates[0] || null);
  
    // ⭐ NEW: sort expired polls (latest first)
    expiredCandidates.sort((a, b) => b.deadline.toDate() - a.deadline.toDate());
  
    // ⭐ NEW: set the most recent expired poll
    setExpiredPoll(expiredCandidates[0] || null);
  }

  loadPoll();
}, [userRole, teamIds]);

  

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

  /* ========== Athlete health live updates ========== */
  useEffect(() => {
    // ... (logic unchanged)
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

  /* ========== Check team membership (unchanged) ========== */
  useEffect(() => {
    // ... (logic unchanged)
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

  /* ========== Fetch Teams Meta (unchanged) ========== */
  useEffect(() => {
    // ... (logic unchanged)
    if (!auth.currentUser || !userRole) return;

    (async () => {
      try {
        const metas = [];
        const qRole = userRole === "coach" ? "coaches" : (userRole === "athlete" ? "athletes" : "members");

        const baseQ = query(
          collection(db, "teams"),
          where(qRole, "array-contains", auth.currentUser.uid)
        );
        const baseSnap = await getDocs(baseQ);
        baseSnap.forEach((d) => {
          const data = d.data() || {};
          metas.push({ 
            id: d.id, 
            name: data.name || "Unnamed Team",
            coaches: Array.isArray(data.coaches) ? data.coaches : [] 
          });
        });

        if (userRole === "athlete") {
          const altQ = query(
            collection(db, "teams"),
            where("members", "array-contains", auth.currentUser.uid)
          );
          const altSnap = await getDocs(altQ);
          altSnap.forEach((d) => {
            if (!metas.find((m) => m.id === d.id)) {
              const data = d.data() || {};
              metas.push({ 
                id: d.id, 
                name: data.name || "Unnamed Team",
                coaches: Array.isArray(data.coaches) ? data.coaches : [] 
              });
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


  /* ========== Fetch Events (unchanged) ========== */
  useEffect(() => {
    // ... (logic unchanged)
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
          upcoming = upcoming.filter((e) => {
            const ass = Array.isArray(e.assignedMemberIds) ? e.assignedMemberIds : [];
            return ass.includes(myId) || ass.length === 0;
          });
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
      eventsByTeamRef.current = {};
    };
  }, [teamIdsKey, coachKey, userRole, assignedOnly]);

  /* ========== Fetch User Names (unchanged) ========== */
  useEffect(() => {
    // ... (logic unchanged)
    if (reminders.length === 0) return;

    const fetchNames = async () => {
      const idsToFetch = new Set();
      reminders.forEach(event => {
        (event.assignedMemberIds || []).forEach(id => {
          if (!userCache.has(id)) {
            idsToFetch.add(id);
          }
        });
      });

      if (idsToFetch.size === 0) return;

      const newNames = new Map();
      const promises = Array.from(idsToFetch).map(async (id) => {
        try {
          const userDoc = await getDoc(doc(db, "users", id));
          if (userDoc.exists()) {
            const data = userDoc.data();
            newNames.set(id, data.displayName || data.email || "Unknown User");
          } else {
            newNames.set(id, "Unknown User");
          }
        } catch (err) {
          console.error("Error fetching user name:", err);
          newNames.set(id, "Error");
        }
      });
      
      await Promise.all(promises);

      if (newNames.size > 0) {
        setUserCache(prevCache => new Map([...prevCache, ...newNames]));
      }
    };
    
    fetchNames();
  }, [reminders, userCache]);


  /* ========== UI Rendering Styles (unchanged) ========== */
  const brand = "var(--brand-primary)";
  const brandTint = "var(--brand-primary-50)";
  const ink900 = "#111827";

  const cardBase = {
    textAlign: "center",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
    background: "var(--surface)",
    transition:
      "background .18s ease, border-color .18s ease, transform .18s ease, box-shadow .18s ease",
  };

  // JS-based hover effects (left as-is)
  const onHover = (e) => {
    e.currentTarget.style.background = brandTint;
    e.currentTarget.style.borderColor = "#a7f3d0";
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 2px 6px rgba(16,185,129,.12)";
  };
  const offHover = (e) => {
    // Resetting to cardBase styles
    Object.assign(e.currentTarget.style, cardBase);
  };

  const profileDone = !!data?.raw?.profileComplete;
  const statusColor = profileDone ? brand : "#d97706";
  const statusText = profileDone ? "Complete" : "Incomplete";
  const statusMark = profileDone ? "✓" : "!";

  // ========== JSX (Refactored with CSS classes) ==========
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
        {/* --- REFACTOR: Use CSS margin classes --- */}
        <h2 className="mb-1" style={{ color: ink900 }}>
          Welcome back, {displayName}!
        </h2>
        <p className="text-muted mb-2" style={{ fontSize: 18 }}>
          {userRole === "athlete"
            ? "Athlete"
            : userRole === "coach"
            ? "Coach"
            : "User"}{" "}
          Dashboard
        </p>
        
        {userRole === "athlete" && expiredPoll && !expiredDismissed && (
          <div
            style={{
              background: "#ffe4e6",
              padding: "1rem",
              marginTop: "1.2rem",
              borderRadius: 8,
              border: "1px solid #fda4af",
              width: "100%",
              maxWidth: 600
            }}
          >
            <p style={{ fontWeight: 600, color: "#b91c1c" }}>
              Feedback closed — You missed the deadline.
            </p>
            <p style={{ marginTop: 4, color: "#7f1d1d" }}>
              Poll: <strong>{expiredPoll.title}</strong>
            </p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: "0.5rem" }}
              onClick={async () => {
                try {
                  const uid = auth.currentUser?.uid;
                  if (uid && expiredPoll) {
                    await setDoc(
                      doc(db, "feedbackPolls", expiredPoll.id, "responses", uid),
                      {
                        dismissed: true,
                        dismissedAt: serverTimestamp(),
                      },
                      { merge: true } 
                    );
                  }
                } catch (e) {
                  console.error("Failed to dismiss expired poll:", e);
                } finally {
                  setExpiredDismissed(true);
                }
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ⭐⭐⭐ Athlete Poll Reminder (整合后的最终位置) */}
        {userRole === "athlete" && openPoll && (
          <div
            style={{
              background: "#fff4cc",
              padding: "1rem",
              marginTop: "1rem",
              marginBottom: "1.5rem",
              borderRadius: "8px",
              border: "1px solid #f2d98c",
              width: "100%",
              maxWidth: 600,
            }}
          >
            <p style={{ fontWeight: 600 }}>
              You have a feedback poll to fill!
            </p>
            <button
              onClick={() => navigate(`/feedback/submit/${openPoll.id}`)}
              className="btn btn-primary"
              style={{ marginTop: "0.5rem" }}
            >
              Fill Now
            </button>
          </div>
        )}
        
        
        {userRole === "athlete" && (
          <p className="mb-2" style={{ fontSize: 16 }}>
            <strong>Health Status:</strong>{" "}
            {/* Data-driven colors must stay inline */}
            <span
              style={{
                color:
                  healthStatus === "injured"
                    ? "#dc2626" // .text-danger
                    : healthStatus === "unavailable"
                    ? "#f59e0b" // ~ .text-warning
                    : "#16a34a", // .text-success
              }}
            >
              {healthStatus}
            </span>
          </p>
        )}
        


        {/* --- REFACTOR: Use CSS margin class --- */}
        {userRole === "athlete" && (
          <div className="mt-1">
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

        {/* Decorative element, left as-is */}
        <div
          style={{
            height: 4,
            width: 120,
            background: "var(--brand-primary)",
            borderRadius: 999,
            opacity: 0.25,
            marginBottom: 12,
          }}
        />

        {/* --- REFACTOR: Use CSS margin classes --- */}
        <div
          className="mt-3 mb-3"
          style={{
            width: "100%",
            maxWidth: 1000,
          }}
        >
          <h3
            className="mb-1"
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--ink-900)",
            }}
          >
            🔔 Upcoming Events (Next 7 Days)
          </h3>
          {reminders.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 15 }}>No upcoming events.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {reminders.map((event) => (
                <div
                  key={`${event.teamId}:${event.id}`}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 16px",
                    background: "var(--surface-alt)",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      color: "var(--ink-900)",
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    {event.title}
                  </h4>

                  {/* --- REFACTOR: Use CSS variable for color --- */}
                  {teamNameMap.has(event.teamId) && (
                    <p className="mt-1" style={{ color: "var(--brand-primary-dark)", fontSize: 13, fontWeight: 600 }}>
                      Team: {teamNameMap.get(event.teamId)}
                    </p>
                  )}

                  <p
                    className="text-muted mt-1"
                    style={{ fontSize: 14 }}
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
                        className="text-muted mt-1"
                        style={{ fontSize: 12 }}
                      >
                        <strong>Assigned to:</strong> {
                          event.assignedMemberIds.map(id => 
                            userCache.get(id) || "..."
                          ).join(", ")
                        }
                      </p>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- REFACTOR: Replaced inline styles with .alert class --- */}
        {!inTeam && (
          <div
            className="alert alert-warning text-center mb-3"
            style={{ maxWidth: 600 }} // Keep layout constraint
          >
            <p className="mb-2">
              You are not in any team yet — please join or create one.
            </p>
            <button
              className="btn btn-primary" // Already uses classes
              onClick={() => navigate("/teams")}
            >
              Go to Teams Page
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div
          className="mt-2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            width: "100%",
            maxWidth: 1000,
          }}
        >
          {/* Card styles are driven by JS hover, left as-is */}
          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
          >
            <h3 className="mb-2" style={{ color: ink900 }}>Training Sessions</h3>
            <p
              className="my-1"
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: "var(--brand-primary)",
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
            <h3 className="mb-2" style={{ color: ink900 }}>Messages</h3>
            <p
              className="my-1"
              style={{
                fontSize: 36,
                fontWeight: 800,
                margin: "6px 0",
                color: unreadMessageCount > 0 ? "#ef4444" : "var(--brand-primary)",
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
            <h3 className="mb-2" style={{ color: ink900 }}>Profile</h3>
            <p
              className="my-1"
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: statusColor,
              }}
            >
              {statusMark}
            </p>
            <p className="text-muted">{statusText}</p>
          </div>
        </div>
        {/* Coach create feedback poll + view summary buttons */}
        {userRole === "coach" && teamsMeta.length > 0 && (
          <div
            className="mt-3"
            style={{
              width: "100%",
              maxWidth: 1000,
              display: "flex",
              gap: "1rem",
            }}
          >
            {/* Create Poll Button */}
            <button
              className="btn btn-primary"
              onClick={() => navigate("/create-feedback")}
              style={{ flex: 1 }}
            >
              ➕ Create Feedback Poll
            </button>

            {/* View Summary Button */}
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/feedback-summary")}
              style={{
                flex: 1,
                background: "#4b5563",
                color: "white",
                border: "none",
              }}
            >
              📊 View Feedback Summary
            </button>
          </div>
        )}

        {/* --- REFACTOR: Use CSS margin classes --- */}
        <div className="mt-4" style={{ width: "100%", maxWidth: 1000 }}>
          <h3
            className="mb-2"
            style={{
              fontSize: 20,
              color: ink900,
              fontWeight: 800,
            }}
          >
            Recent Activity
          </h3>
          {/* --- REFACTOR: Removed redundant inline style --- */}
          <div className="card">
            <p className="text-muted text-center">
              No recent activity to display
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}