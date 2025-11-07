// src/components/HealthAndAvailability.jsx
// Merged version:
// - Retains the V1 (stable file) logic for data loading, deterministic team picking,
//   race-condition prevention (useRef), and stale data cleaning.
// - Integrates the V2 (code block) features: "Best Days" card and <select> date picker.

import { useEffect, useMemo, useState, useRef } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

// --------- Constants ---------
// (From V2)
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "injured", label: "Injured" },
  { value: "unavailable", label: "Unavailable" },
];

function capitalize(s) {
  if (typeof s !== "string" || s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// (From V2)
function getNext7Days() {
  const days = [];
  const base = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push({
      value: d.toISOString().split("T")[0],
      label: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    });
  }
  return days;
}

export default function HealthAndAvailability() {
  // ----- Controls -----
  const [searchTerm, setSearchTerm] = useState("");
  const todayISO = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [selectedTeamId, setSelectedTeamId] = useState("all"); // 'all' or teamId

  // ----- Data state -----
  const [teams, setTeams] = useState([]); // [{id, name}]
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Each athlete: { id, name, email, healthStatus, teamIds: [] }
  const [athletes, setAthletes] = useState([]);
  const [loadingAthletes, setLoadingAthletes] = useState(true);

  // Per selectedDate: { [athleteId]: 'active'|'injured'|'unavailable' }
  const [athleteStatuses, setAthleteStatuses] = useState({});

  // UI helpers
  const [savingIds, setSavingIds] = useState(new Set()); // keys like `${athleteId}-${selectedDate}`
  const [error, setError] = useState("");
  const lastLoadReqId = useRef(0); // to avoid out-of-order writes overriding newer UI

  // ============================================================
  // 1) Load teams for the current coach
  // (Logic from V1)
  // ============================================================
  useEffect(() => {
    (async () => {
      if (!auth.currentUser) return;
      setLoadingTeams(true);
      try {
        const qTeams = query(
          collection(db, "teams"),
          where("coaches", "array-contains", auth.currentUser.uid)
        );
        const snap = await getDocs(qTeams);
        const list = snap.docs.map((d) => {
          const data = d.data() || {};
          return { id: d.id, name: data.name || data.teamName || d.id };
        });
        setTeams(list);
      } catch (e) {
        console.error("Load teams failed:", e);
        setTeams([]);
        setError("Failed to load teams.");
      } finally {
        setLoadingTeams(false);
      }
    })();
  }, []);

  // ============================================================
  // 2) Load athletes (union of all athletes across coach's teams)
  // (Logic from V1)
  // ============================================================
  useEffect(() => {
    if (!auth.currentUser) return;

    let cancelled = false;
    let unsubscribes = [];

    (async () => {
      setLoadingAthletes(true);
      setError("");

      try {
        const qTeams = query(
          collection(db, "teams"),
          where("coaches", "array-contains", auth.currentUser.uid)
        );
        const teamsSnap = await getDocs(qTeams);

        // Gather unique athlete IDs and the set of teamIds they belong to
        const athleteTeamSetMap = new Map(); // athleteId -> Set(teamIds)
        teamsSnap.forEach((td) => {
          const tId = td.id;
          const t = td.data() || {};
          const coaches = new Set(Array.isArray(t.coaches) ? t.coaches : []);
          const ids = [
            ...(Array.isArray(t.athletes) ? t.athletes : []),
            ...(Array.isArray(t.members) ? t.members : []), // some schemas use members
          ];
          ids.forEach((uid) => {
            if (coaches.has(uid)) return;
            if (!athleteTeamSetMap.has(uid)) athleteTeamSetMap.set(uid, new Set());
            athleteTeamSetMap.get(uid).add(tId);
          });
        });

        // Now subscribe to each user's basic profile once (name/email/healthStatus)
        const athletesMap = new Map();
        for (const [athleteId, teamSet] of athleteTeamSetMap.entries()) {
          const unsub = onSnapshot(
            doc(db, "users", athleteId),
            (snap) => {
              const data = snap.exists() ? snap.data() : {};
              athletesMap.set(athleteId, {
                id: athleteId,
                name: data.displayName || data.name || "Unnamed",
                email: data.email || "",
                healthStatus: data.healthStatus || "active", // only for TODAY reflection
                teamIds: Array.from(teamSet),
              });

              if (!cancelled) {
                const list = Array.from(athletesMap.values()).sort((a, b) =>
                  (a.name || "").localeCompare(b.name || "")
                );
                setAthletes(list);
                setLoadingAthletes(false);
              }
            },
            (err) => {
              console.warn("User snapshot error:", err);
              athletesMap.set(athleteId, {
                id: athleteId,
                name: "Unnamed",
                email: "",
                healthStatus: "active",
                teamIds: Array.from(teamSet),
              });
              if (!cancelled) {
                const list = Array.from(athletesMap.values()).sort((a, b) =>
                  (a.name || "").localeCompare(b.name || "")
                );
                setAthletes(list);
                setLoadingAthletes(false);
              }
            }
          );
          unsubscribes.push(unsub);
        }

        if (athleteTeamSetMap.size === 0 && !cancelled) {
          setAthletes([]);
          setLoadingAthletes(false);
        }
      } catch (e) {
        console.error("Load athletes failed:", e);
        if (!cancelled) {
          setError("Failed to load athletes.");
          setAthletes([]);
          setLoadingAthletes(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribes.forEach((u) => u && u());
    };
  }, []);

  // ============================================================
  // Helper: which teamId to use for a given athlete under current team filter?
  // (Logic from V1)
  // ============================================================
  const pickTeamIdForAthlete = (athlete) => {
    const { teamIds = [] } = athlete || {};
    if (!teamIds || teamIds.length === 0) return null;

    if (selectedTeamId !== "all" && teamIds.includes(selectedTeamId)) {
      return selectedTeamId;
    }
    if (teamIds.length === 1) return teamIds[0];
    // deterministic choice for "all" across multiple teams
    return teamIds.slice().sort()[0];
  };

  // ============================================================
  // 3) Load statuses for the selected date
  // (Logic from V1)
  // ============================================================
  const reloadStatusesForDate = async (dateISO, list = athletes) => {
    if (!dateISO || list.length === 0) {
      setAthleteStatuses({}); // Clear statuses if no athletes
      return;
    }

    const reqId = ++lastLoadReqId.current;
    const dateKey = dateISO.replace(/-/g, "");
    const map = {};

    for (const athlete of list) {
      // Use profile 'healthStatus' *only* if it's today's date
      const fallbackStatus = dateISO === todayISO ? athlete.healthStatus || "active" : "active";
      const tid = pickTeamIdForAthlete(athlete);
      
      if (!tid) {
        map[athlete.id] = fallbackStatus;
        continue;
      }
      const availabilityId = `${tid}_${athlete.id}_${dateKey}`;

      try {
        const snap = await getDoc(doc(db, "athleteAvailability", availabilityId));
        if (snap.exists()) {
          map[athlete.id] = snap.data()?.status || fallbackStatus;
        } else {
          map[athlete.id] = fallbackStatus;
        }
      } catch (e) {
        console.warn("Read availability failed:", availabilityId, e);
        map[athlete.id] = fallbackStatus;
      }
    }

    // Guard against out-of-order async overwrites
    if (reqId === lastLoadReqId.current) {
      setAthleteStatuses(map);
    }
  };

  // Trigger reload when date or roster changes, or when team filter changes
  useEffect(() => {
    reloadStatusesForDate(selectedDate, athletes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, athletes, selectedTeamId]);

  // ============================================================
  // 4) Save a status for the selected date
  // (Logic from V1)
  // ============================================================
  const handleDailyStatusChange = async (athleteId, newStatusRaw) => {
    if (!athleteId || !selectedDate) return;

    const newStatus = newStatusRaw || "active";
    const savingKey = `${athleteId}-${selectedDate}`;
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.add(savingKey);
      return next;
    });
    setError("");

    try {
      const dateKey = selectedDate.replace(/-/g, "");
      const athlete = athletes.find((a) => a.id === athleteId);
      if (!athlete) throw new Error("Athlete not found");
      const teamIdToUse = pickTeamIdForAthlete(athlete);
      if (!teamIdToUse) throw new Error("Athlete not in any team");

      const availabilityId = `${teamIdToUse}_${athleteId}_${dateKey}`;

      // Optimistic local update
      setAthleteStatuses((prev) => ({
        ...prev,
        [athleteId]: newStatus,
      }));

      // Use profile 'healthStatus' for comparison *only* if it's today
      const defaultStatus =
        selectedDate === todayISO ? athlete.healthStatus || "active" : "active";

      if (newStatus === defaultStatus) {
        // Delete sparse doc if status is same as default
        await deleteDoc(doc(db, "athleteAvailability", availabilityId)).catch(() => {});
      } else {
        // Upsert daily status
        await setDoc(doc(db, "athleteAvailability", availabilityId), {
          teamId: teamIdToUse,
          athleteId,
          date: selectedDate,
          dateKey,
          status: newStatus,
          updatedBy: auth.currentUser?.uid || null,
          updatedAt: serverTimestamp(),
        });
      }

      // Clean same-day records under other teams
      const others = (athlete.teamIds || []).filter((t) => t !== teamIdToUse);
      if (others.length > 0) {
        await Promise.all(
          others.map((t) =>
            deleteDoc(doc(db, "athleteAvailability", `${t}_${athleteId}_${dateKey}`)).catch(() => {})
          )
        );
      }

      // If editing TODAY, also reflect in profile so Dashboard shows it
      if (selectedDate === todayISO) {
        await setDoc(
          doc(db, "users", athleteId),
          {
            healthStatus: newStatus,
            healthStatusUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // Post-write reload to defeat any late old read
      await reloadStatusesForDate(selectedDate, athletes);
    } catch (e) {
      console.error("Update daily status failed:", e);
      setError(e?.message ? `Failed to update: ${e.message}` : "Failed to update status.");
      // Rollback optimistic update on error
      await reloadStatusesForDate(selectedDate, athletes);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(savingKey);
        return next;
      });
    }
  };

  // ============================================================
  // Derived UI data
  // ============================================================
  const filteredAthletes = useMemo(() => {
    let list = athletes;

    if (selectedTeamId !== "all") {
      list = list.filter((a) => (a.teamIds || []).includes(selectedTeamId));
    }

    const ql = searchTerm.trim().toLowerCase();
    if (ql) {
      list = list.filter(
        (a) =>
          (a.name || "").toLowerCase().includes(ql) ||
          (a.email || "").toLowerCase().includes(ql)
      );
    }
    return list;
  }, [athletes, selectedTeamId, searchTerm]);

  // (From V1)
  const dailyStats = useMemo(() => {
    const total = filteredAthletes.length;
    const available = filteredAthletes.filter((a) => {
      const st = athleteStatuses[a.id] || "active";
      return st === "active";
    }).length;
    const pct = total > 0 ? Math.round((available / total) * 100) : 0;
    return { total, available, pct };
  }, [filteredAthletes, athleteStatuses]);

  // (From V2)
  const bestDays = useMemo(() => {
    const next7 = getNext7Days();
    const dayScores = next7.map((day) => {
      const available = filteredAthletes.filter((a) => {
        let status;
        if (day.value === selectedDate) {
          status = athleteStatuses[a.id] || "active";
        } else {
          status = a.healthStatus || "active";
        }
        return status === "active";
      }).length;

      const total = filteredAthletes.length;
      const percent = total > 0 ? Math.round((available / total) * 100) : 0;

      return {
        ...day,
        available,
        total,
        percent,
      };
    });

    // Sort by availability percentage
    return dayScores.sort((a, b) => b.available - a.available);
  }, [filteredAthletes, athleteStatuses, selectedDate]); // This logic only depends on the athlete list

  // ============================================================
  // Render
  // ============================================================
  if (loadingTeams || (loadingAthletes && athletes.length === 0)) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#6b7280" }}>Loading teams and athletes...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
        Health & Availability
      </h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
        Set per-day status for each athlete. “Today” also updates the profile health status.
      </p>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            backgroundColor: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#dc2626",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Team selector */}
        {teams.length > 1 && (
          <div>
            <label
              style={{
                display: "block",
                marginBottom: 4,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Team
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: "#fff",
              }}
            >
              <option value="all">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date selector (From V2) */}
        <div>
          <label
            style={{
              display: "block",
              marginBottom: 4,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            Date
          </label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 14,
              backgroundColor: "#fff",
            }}
          >
            {getNext7Days().map((day) => (
              <option key={day.value} value={day.value}>
                {day.label} {day.value === todayISO && "(Today)"}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div style={{ minWidth: 220 }}>
          <label
            style={{
              display: "block",
              marginBottom: 4,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            Search athlete
          </label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Name or email"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 14,
              backgroundColor: "#fff",
            }}
          />
        </div>

        {/* Summary (From V1) */}
        <div
          style={{
            marginLeft: "auto",
            padding: "10px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            backgroundColor: "#f9fafb",
            fontSize: 13,
            color: "#374151",
          }}
        >
          <div>
            <strong>{dailyStats.available}</strong> / {dailyStats.total} available
          </div>
          <div>{dailyStats.pct}% Active</div>
        </div>
      </div>

      {/* Main Content Area (Layout from V2) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
        {/* Left: Set Daily Status (Content from V1) */}
        <div>
          <div
            style={{
              padding: 20,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              backgroundColor: "#fff",
            }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                marginBottom: 16,
                color: "#111827",
              }}
            >
              Set Daily Status
            </h2>
            {/* Athlete list */}
            {filteredAthletes.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
                {searchTerm
                  ? "No athletes match your search."
                  : "No athletes found."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredAthletes.map((a) => {
                  const key = `${a.id}-${selectedDate}`;
                  const currentStatus = athleteStatuses[a.id] || "active";
                  const isSaving = savingIds.has(key);

                  return (
                    <div
                      key={a.id}
                      style={{
                        padding: 16,
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        backgroundColor: "#fff",
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#111827",
                          }}
                        >
                          {a.name}
                        </div>
                        <div style={{ fontSize: 13, color: "#6b7280" }}>
                          {a.email}
                        </div>
                      </div>

                      <div
                        style={{ display: "flex", alignItems: "center", gap: 12 }}
                      >
                        {/* Badge (Colors from V2) */}
                        <div
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor:
                              currentStatus === "injured"
                                ? "#fee2e2"
                                : currentStatus === "unavailable"
                                ? "#fed7aa" // V2 color
                                : "#dcfce7",
                            color:
                              currentStatus === "injured"
                                ? "#dc2626"
                                : currentStatus === "unavailable"
                                ? "#ea580c" // V2 color
                                : "#16a34a",
                          }}
                        >
                          {capitalize(currentStatus)}
                        </div>

                        {/* Selector */}
                        <div>
                          <label
                            style={{
                              fontSize: 13,
                              color: "#374151",
                              marginRight: 8,
                            }}
                          >
                            Update:
                          </label>
                          <select
                            value={currentStatus}
                            disabled={isSaving}
                            onChange={(e) =>
                              handleDailyStatusChange(a.id, e.target.value)
                            }
                            style={{
                              padding: "6px 10px",
                              fontSize: 13,
                              border: "1px solid #d1d5db",
                              borderRadius: 6,
                              backgroundColor: "#fff",
                              cursor: isSaving ? "not-allowed" : "pointer",
                              opacity: isSaving ? 0.6 : 1,
                            }}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {isSaving && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 12,
                                color: "#6b7280",
                              }}
                            >
                              Saving...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Best Days (From V2) */}
        <div>
          <div
            style={{
              padding: 20,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              backgroundColor: "#f9fafb",
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginBottom: 16,
                color: "#111827",
              }}
            >
              Best Days for Availability
            </h3>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
              Next 7 days ranked by team availability (based on default status)
            </div>

            {bestDays.map((day, idx) => (
              <div
                key={day.value}
                style={{
                  padding: "8px 12px",
                  marginBottom: 8,
                  backgroundColor: idx === 0 ? "#dcfce7" : "#fff",
                  borderRadius: 6,
                  border:
                    idx === 0 ? "2px solid #16a34a" : "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: idx === 0 ? 600 : 400 }}>
                      {idx === 0 && "🏆 "}
                      {day.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {day.available}/{day.total} available
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color:
                        day.percent >= 80
                          ? "#16a34a"
                          : day.percent >= 60
                          ? "#ea580c"
                          : "#dc2626",
                    }}
                  >
                    {day.percent}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}