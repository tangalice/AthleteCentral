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
  updateDoc,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { checkAndNotifyIncompleteProfile } from "../services/EmailNotificationService";

export default function Dashboard({ userRole, user, unreadMessageCount = 0 }) {
  const data = useLoaderData();
  const navigate = useNavigate();
  const displayName = data?.displayName || user?.email || "";

  // Existing state definitions
  const [inTeam, setInTeam] = useState(true);
  const [teamsMeta, setTeamsMeta] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [healthStatus, setHealthStatus] = useState("Loading...");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [userCache, setUserCache] = useState(new Map());
  const [expiredPoll, setExpiredPoll] = useState(null);
  const [expiredDismissed, setExpiredDismissed] = useState(false);
  const [coachNotifications, setCoachNotifications] = useState([]);
  const [loadingCoachNotifications, setLoadingCoachNotifications] = useState(true);
  const [athleteNotifications, setAthleteNotifications] = useState([]);
  const [loadingAthleteNotifications, setLoadingAthleteNotifications] = useState(true);
  
  // Existing feedbackPolls state (keep as-is)
  const [openPoll, setOpenPoll] = useState(null);

  // ========== NEW: Team Polls State (User Story #42) ==========
  const [pendingTeamPolls, setPendingTeamPolls] = useState([]);

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

  // ========== Coach Notifications (Goal completions) ==========
  useEffect(() => {
    if (userRole !== "coach") {
      setCoachNotifications([]);
      setLoadingCoachNotifications(false);
      return;
    }
    if (!auth.currentUser) return;

    const coachId = auth.currentUser.uid;
    const notificationsRef = collection(
      db,
      "users",
      coachId,
      "notifications"
    );
    const qRef = query(notificationsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCoachNotifications(list);
        setLoadingCoachNotifications(false);
      },
      (err) => {
        console.error("Error loading coach notifications:", err);
        setCoachNotifications([]);
        setLoadingCoachNotifications(false);
      }
    );

    return () => unsub();
  }, [userRole]);

  // ========== Athlete Notifications (coach suggestions & feedback) ==========
  useEffect(() => {
    if (userRole !== "athlete") {
      setAthleteNotifications([]);
      setLoadingAthleteNotifications(false);
      return;
    }
    if (!auth.currentUser) return;

    const athleteId = auth.currentUser.uid;
    const notificationsRef = collection(
      db,
      "users",
      athleteId,
      "notifications"
    );
    const qRef = query(notificationsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAthleteNotifications(list);
        setLoadingAthleteNotifications(false);
      },
      (err) => {
        console.error("Error loading athlete notifications:", err);
        setAthleteNotifications([]);
        setLoadingAthleteNotifications(false);
      }
    );

    return () => unsub();
  }, [userRole]);

  // ========== NEW: Load Team Polls for Athletes (User Story #42) ==========
  useEffect(() => {
    if (userRole !== "athlete") return;
    if (!auth.currentUser) return;
    if (teamIds.length === 0) {
      setPendingTeamPolls([]);
      return;
    }

    const me = auth.currentUser.uid;
    const now = new Date();

    // Real-time listener for teamPolls
    const pollsRef = collection(db, "teamPolls");
    // Ensure you created the index for 'status' if needed, or query simply and filter in memory if dataset is small
    const q = query(pollsRef, where("status", "==", "open"));

    const unsub = onSnapshot(q, async (snapshot) => {
      const pending = [];

      for (const d of snapshot.docs) {
        const poll = { id: d.id, ...d.data() };

        // Check if poll is for user's team
        if (!Array.isArray(poll.teamIds)) continue;
        const inMyTeam = poll.teamIds.some(id => teamIds.includes(id));
        if (!inMyTeam) continue;

        // Check deadline
        const deadline = poll.deadline?.toDate ? poll.deadline.toDate() : null;
        if (!deadline || deadline < now) continue;

        // Check if user has already voted
        const voters = poll.voters || [];
        if (voters.includes(me)) continue;

        pending.push(poll);
      }

      // Sort by deadline (earliest first)
      pending.sort((a, b) => {
        const aDeadline = a.deadline?.toDate ? a.deadline.toDate() : new Date();
        const bDeadline = b.deadline?.toDate ? b.deadline.toDate() : new Date();
        return aDeadline - bDeadline;
      });

      setPendingTeamPolls(pending);
    });

    return () => unsub();
  }, [userRole, teamIds]);

  // ========== Helper: Check if poll is urgent (within 24 hours) ==========
  const isPollUrgent = (poll) => {
    if (!poll?.deadline) return false;
    const deadline = poll.deadline.toDate ? poll.deadline.toDate() : new Date(poll.deadline);
    const now = new Date();
    const diffMs = deadline - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 24;
  };

  // ========== Helper: Format remaining time ==========
  const formatTimeRemaining = (poll) => {
    if (!poll?.deadline) return "";
    const deadline = poll.deadline.toDate ? poll.deadline.toDate() : new Date(poll.deadline);
    const now = new Date();
    const diffMs = deadline - now;
    
    if (diffMs <= 0) return "Expired";
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours < 24) {
      return `${diffHours}h ${diffMins}m remaining`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} remaining`;
  };

  // ========== Existing: feedbackPolls loader (keep as-is) ==========
  useEffect(() => {
    if (userRole !== "athlete") return;
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
        setExpiredPoll(null);
        return;
      }
    
      let candidates = [];
      let expiredCandidates = [];
    
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
    
        if (deadline < now) {
          if (!respSnap.exists()) {
            expiredCandidates.push({ id: pollId, ...poll });
          }
          continue;
        }
    
        if (!respSnap.exists()) {
          candidates.push({ id: pollId, ...poll });
        }
      }
    
      candidates.sort((a, b) => a.deadline.toDate() - b.deadline.toDate());
      setOpenPoll(candidates[0] || null);
    
      expiredCandidates.sort((a, b) => b.deadline.toDate() - a.deadline.toDate());
      setExpiredPoll(expiredCandidates[0] || null);
    }

    loadPoll();
  }, [userRole, teamIds]);

  // ========== Check profile completeness ==========
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const checkProfile = async () => {
      // 安全检查：防止用户登出后 current user 为 null 导致报错
      if (!auth.currentUser) return;

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
    
    const timeoutId = setTimeout(checkProfile, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  // ========== Athlete health live updates ==========
  useEffect(() => {
    if (userRole !== "athlete" || !auth.currentUser) return;

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

  // ========== Check team membership ==========
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

  // ========== Fetch Teams Meta ==========
  useEffect(() => {
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

  // ========== Fetch Events ==========
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

  // ========== Fetch User Names ==========
  useEffect(() => {
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

  // ========== UI Rendering Styles ==========
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

  // ========== JSX ==========
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
        
        {/* ========== Existing: Expired feedbackPoll Notice (keep as-is) ========== */}
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

        {/* ========== Existing: feedbackPoll Reminder (keep as-is) ========== */}
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
            {/* 标题：明确告诉这是哪一个 poll */}
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              Current feedback poll:{" "}
              <span style={{ fontWeight: 700 }}>
                {openPoll.title || "Weekly Feedback Poll"}
              </span>
            </p>

            {/* 可选：简单一句描述 */}
            <p style={{ fontSize: 14, marginBottom: 8 }}>
              Please complete this week’s anonymous feedback before the deadline.
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

        {/* ========== NEW: Team Polls Widget (User Story #42) ========== */}
        {userRole === "athlete" && pendingTeamPolls.length > 0 && (
          <div
            style={{
              width: "100%",
              maxWidth: 600,
              marginTop: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: ink900 }}>
              🗳️ Pending Team Polls ({pendingTeamPolls.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pendingTeamPolls.map((poll) => {
                const urgent = isPollUrgent(poll);
                return (
                  <div
                    key={poll.id}
                    style={{
                      background: urgent ? "#fef2f2" : "#f0f9ff",
                      padding: "1rem",
                      borderRadius: "8px",
                      border: urgent ? "2px solid #ef4444" : "1px solid #bae6fd",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Urgent Badge */}
                    {urgent && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          background: "#ef4444",
                          color: "white",
                          padding: "4px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          borderBottomLeftRadius: 8,
                        }}
                      >
                        ⏰ URGENT
                      </div>
                    )}

                    <p style={{ 
                      fontWeight: 600, 
                      color: urgent ? "#dc2626" : "#0369a1",
                      marginBottom: 4,
                      paddingRight: urgent ? 70 : 0,
                    }}>
                      {poll.title}
                    </p>
                    
                    <p style={{ 
                      fontSize: 13, 
                      color: urgent ? "#b91c1c" : "#64748b",
                      marginBottom: 8,
                    }}>
                      {formatTimeRemaining(poll)}
                    </p>

                    <button
                      onClick={() => navigate(`/team-poll/${poll.id}`)}
                      className="btn btn-primary"
                      style={{ 
                        fontSize: 14,
                        padding: "6px 16px",
                        background: urgent ? "#dc2626" : undefined,
                        borderColor: urgent ? "#dc2626" : undefined,
                      }}
                    >
                      {urgent ? "Vote Now!" : "Vote"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Health Status for Athletes */}
        {userRole === "athlete" && (
          <p className="mb-2" style={{ fontSize: 16 }}>
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
        
        {/* Assigned Only Filter */}
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

        {/* Decorative element */}
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

        {/* Upcoming Events */}
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

        {/* No Team Warning */}
        {!inTeam && (
          <div
            className="alert alert-warning text-center mb-3"
            style={{ maxWidth: 600 }}
          >
            <p className="mb-2">
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
          className="mt-2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
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

        {/* ========== Existing: Coach feedback poll buttons (keep as-is) ========== */}
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
            <button
              className="btn btn-primary"
              onClick={() => navigate("/create-feedback")}
              style={{ flex: 1 }}
            >
              ➕ Create Feedback Poll
            </button>

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

        {/* ========== NEW: Coach Team Polls buttons (User Story #68) ========== */}
        {userRole === "coach" && teamsMeta.length > 0 && (
          <div
            className="mt-2"
            style={{
              width: "100%",
              maxWidth: 1000,
              display: "flex",
              gap: "1rem",
            }}
          >
            <button
              className="btn btn-primary"
              onClick={() => navigate("/create-team-poll")}
              style={{ flex: 1, background: "#0ea5e9", borderColor: "#0ea5e9" }}
            >
              🗳️ Create Team Poll
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => navigate("/team-polls")}
              style={{
                flex: 1,
                background: "#0284c7",
                color: "white",
                border: "none",
              }}
            >
              📊 View Team Polls
            </button>
          </div>
        )}

        {/* Recent Activity / In‑App Notifications */}
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

          {/* Coach: goal completion notifications */}
          {userRole === "coach" ? (
            <div className="card" style={{ padding: 16 }}>
              {loadingCoachNotifications ? (
                <p className="text-muted text-center">Loading activity…</p>
              ) : coachNotifications.length === 0 ? (
                <p className="text-muted text-center">
                  No activity to display
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {coachNotifications.map((n) => {
                    if (n.type === "goalCompleted") {
                      const created =
                        n.createdAt?.toDate?.() ??
                        (n.createdAt instanceof Date ? n.createdAt : null);

                      return (
                        <div
                          key={n.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 8,
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "#ecfdf5",
                            border: "1px solid #bbf7d0",
                          }}
                        >
                          <div>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#065f46",
                              }}
                            >
                              {n.athleteName || "An athlete"} completed your
                              suggested goal "{n.goalTitle || "Goal"}".
                            </p>
                            {created && (
                              <p
                                className="text-muted"
                                style={{ margin: "4px 0 0", fontSize: 12 }}
                              >
                                {created.toLocaleString()}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const uid = auth.currentUser?.uid;
                                if (!uid) return;
                                await deleteDoc(
                                  doc(
                                    db,
                                    "users",
                                    uid,
                                    "notifications",
                                    n.id
                                  )
                                );
                              } catch (e) {
                                console.error(
                                  "Error dismissing notification:",
                                  e
                                );
                              }
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#6b7280",
                              cursor: "pointer",
                              fontSize: 16,
                              lineHeight: 1,
                            }}
                            aria-label="Dismiss notification"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    }

                    // Fallback for any future notification types
                    return (
                      <div
                        key={n.id}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "var(--surface-alt)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 14 }}>
                          {n.message || "New activity"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : userRole === "athlete" ? (
            <div className="card" style={{ padding: 16 }}>
              {loadingAthleteNotifications ? (
                <p className="text-muted text-center">Loading activity…</p>
              ) : athleteNotifications.length === 0 ? (
                <p className="text-muted text-center">No activity to display</p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {athleteNotifications.map((n) => {
                    const created =
                      n.createdAt?.toDate?.() ??
                      (n.createdAt instanceof Date ? n.createdAt : null);

                    let text = "New activity";
                    if (n.type === "coachSuggestedGoal") {
                      text = `${
                        n.coachName || "Your coach"
                      } suggested a goal: "${n.goalTitle || "Goal"}".`;
                    } else if (n.type === "coachFeedback") {
                      text = `${
                        n.coachName || "Your coach"
                      } sent you feedback${
                        n.category ? ` about ${n.category}` : ""
                      }: "${n.message || ""}"`;
                    } else if (n.message) {
                      text = n.message;
                    }

                    return (
                      <div
                        key={n.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#1d4ed8",
                            }}
                          >
                            {text}
                          </p>
                          {created && (
                            <p
                              className="text-muted"
                              style={{ margin: "4px 0 0", fontSize: 12 }}
                            >
                              {created.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const uid = auth.currentUser?.uid;
                              if (!uid) return;
                              await deleteDoc(
                                doc(db, "users", uid, "notifications", n.id)
                              );
                            } catch (e) {
                              console.error(
                                "Error dismissing notification:",
                                e
                              );
                            }
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#6b7280",
                            cursor: "pointer",
                            fontSize: 16,
                            lineHeight: 1,
                          }}
                          aria-label="Dismiss notification"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <p className="text-muted text-center">
                No recent activity to display
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}