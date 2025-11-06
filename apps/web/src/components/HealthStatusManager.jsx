import React, { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  setDoc,
} from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";



export default function HealthStatusManager({ teamId }) {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState(new Set());
  const [error, setError] = useState("");
  const [userStatusCache, setUserStatusCache] = useState({});
  async function getUnifiedStatus(athleteId) {
    const teamsSnap = await getDocs(collection(db, "teams"));
    let latestStatus = "active";
    let latestTime = 0;
  
    for (const teamDoc of teamsSnap.docs) {
      const athleteRef = doc(db, "teams", teamDoc.id, "athletes", athleteId);
      const athleteSnap = await getDoc(athleteRef);
      if (athleteSnap.exists()) {
        const data = athleteSnap.data();
        const time = data.updatedAt?.seconds || 0;
        if (time > latestTime) {
          latestTime = time;
          latestStatus = data.healthStatus || "active";
        }
      }
    }
    return latestStatus;
  }


  const STATUS_OPTIONS = useMemo(
    () => [
      { value: "active", label: "Active" },
      { value: "injured", label: "Injured" },
      { value: "unavailable", label: "Unavailable" },
    ],
    []
  );
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === "healthStatusBroadcast" && event.newValue) {
        try {
          const { athleteId, newStatus } = JSON.parse(event.newValue);
          setAthletes((prev) =>
            prev.map((a) =>
              a.id === athleteId ? { ...a, healthStatus: newStatus } : a
            )
          );
        } catch (err) {
          console.warn("Storage sync parse error:", err);
        }
      }
    };
  
      
    const handleCustomEvent = (e) => {
      const { athleteId, newStatus } = e.detail;
      setAthletes((prev) =>
        prev.map((a) =>
          a.id === athleteId ? { ...a, healthStatus: newStatus } : a
        )
      );
    };
  
    window.addEventListener("storage", handleStorage);
    window.addEventListener("healthStatusChanged", handleCustomEvent);
  
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("healthStatusChanged", handleCustomEvent);
    };
  }, []);
  

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    setError("");
  
    const teamRef = doc(db, "teams", teamId);
    const subCol = collection(db, "teams", teamId, "athletes");
    let q;
    try {
      q = query(subCol, orderBy("name", "asc"));
    } catch (e) {
      console.warn("No athletes collection yet, skipping orderBy:", e);
      q = subCol;
    }
  
    const unsub = onSnapshot(q, async (snap) => {
      try {
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) {
          setError("Team not found.");
          setAthletes([]);
          setLoading(false);
          return;
        }
  
        const teamData = teamSnap.data();
        const athleteIds = Array.isArray(teamData.athletes) ? teamData.athletes : [];
  
        const subMap = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  
        const list = [];
        for (const athleteId of athleteIds) {
          let name = "Unnamed";
          let email = "";
  
          try {
            const userSnap = await getDoc(doc(db, "users", athleteId));
            if (userSnap.exists()) {
              const u = userSnap.data();
              name = u.displayName || u.name || u.email || "Unnamed";
              email = u.email || "";
            }
          } catch (e) {
            console.warn("Load user failed:", athleteId, e);
          }
  
          const sub = subMap.get(athleteId);
          let healthStatus = "active";

          if (sub?.healthStatus) {
            healthStatus = sub.healthStatus;
          } else {
            healthStatus = await getUnifiedStatus(athleteId);
          }
  
          
  
          
  
          list.push({ id: athleteId, name, email, healthStatus });
  
          if (!sub) {
            try {
              await setDoc(
                doc(db, "teams", teamId, "athletes", athleteId),
                {
                  name,
                  email,
                  healthStatus,
                  createdAt: serverTimestamp(),
                },
                { merge: true }
              );
            } catch (e) {
              console.warn("Backfill athlete doc failed:", athleteId, e);
            }
          }
        }
  
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setAthletes(list);
        setLoading(false);
      } catch (err) {
        console.error("onSnapshot handler error:", err);
        setError("Failed to load athletes.");
        setLoading(false);
      }
    });
  
    return () => unsub();
  }, [teamId]);
  useEffect(() => {
    const globalCol = collection(db, "sharedHealthStatus");
    const unsubGlobal = onSnapshot(globalCol, (snap) => {
      const updates = {};
      snap.forEach((docSnap) => {
        updates[docSnap.id] = docSnap.data().healthStatus;
      });

      setAthletes((prev) =>
        prev.map((a) =>
          updates[a.id] ? { ...a, healthStatus: updates[a.id] } : a
        )
      );
    });

    return () => unsubGlobal();
  }, []);

  const handleStatusChange = async (athleteId, newStatus) => {
    if (!teamId || !athleteId) return;
    
    setSavingIds((prev) => new Set(prev).add(athleteId));
    setError(""); // Clear any previous errors
  
    try {
      // Update only the current team's athlete document
      const ref = doc(db, "teams", teamId, "athletes", athleteId);
      await setDoc(
        ref,
        {
          healthStatus: newStatus || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      
      // Optimistically update the UI
      setAthletes((prev) =>
        prev.map((a) =>
          a.id === athleteId ? { ...a, healthStatus: newStatus || null } : a
        )
      );
      
      // Clear error on success
      setError("");
    } catch (e) {
      console.error("Failed to update athlete status:", e);
      setError("Failed to update status. Please try again.");
      // Revert the optimistic update on error
      // The onSnapshot listener will restore the correct state
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(athleteId);
        return next;
      });
    }
  };
  
  

  if (loading) return <div style={{ padding: 16 }}>Loading athletes…</div>;

  const containerStyle = { padding: 16 };
  const titleStyle = { fontSize: 18, fontWeight: 600, marginBottom: 16, color: "#111827" };
  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 };
  const cardStyle = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };
  const nameStyle = { fontSize: 16, fontWeight: 600, color: "#111827" };
  const emailStyle = { fontSize: 13, color: "#6b7280" };
  const labelStyle = { fontSize: 12, color: "#6b7280", marginRight: 6 };
  const currentStyle = { fontSize: 14, fontWeight: 600, color: "#111827" };
  const rowStyle = { marginTop: 12, display: "flex", alignItems: "center", gap: 8 };
  const selectStyle = { padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, backgroundColor: "#fff", cursor: "pointer" };
  const savingStyle = { fontSize: 12, color: "#6b7280" };

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Manage Athlete Health Status</h1>
      
      {error && (
        <div style={{
          padding: "12px 16px",
          marginBottom: 16,
          backgroundColor: "#fee2e2",
          border: "1px solid #fecaca",
          borderRadius: 8,
          color: "#dc2626",
          fontSize: 14
        }}>
          {error}
        </div>
      )}

      {athletes.length === 0 ? (
        <div style={{ color: "#6b7280" }}>No athletes found for this team.</div>
      ) : (
        <div style={gridStyle}>
          {athletes.map((a) => {
            const saving = savingIds.has(a.id);
            return (
              <div key={a.id} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={nameStyle}>{a.name}</div>
                    <div style={emailStyle}>{a.email}</div>
                  </div>
                  <div style={{ fontSize: 13 }}>
                    <span style={labelStyle}>Current:</span>
                    <span style={currentStyle}>
                      {a.healthStatus ? capitalize(a.healthStatus) : "N/A"}
                    </span>
                  </div>
                </div>

                <div style={rowStyle}>
                  <label htmlFor={`status-${a.id}`} style={{ fontSize: 13, color: "#374151" }}>
                    Update status
                  </label>
                  <select
                    id={`status-${a.id}`}
                    style={selectStyle}
                    value={a.healthStatus || ""}
                    onChange={(e) => handleStatusChange(a.id, e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Select…</option>
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {saving && <span style={savingStyle}>Saving…</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function capitalize(s) {
  if (typeof s !== "string" || s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
