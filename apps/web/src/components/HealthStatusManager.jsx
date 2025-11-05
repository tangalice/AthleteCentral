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

  const STATUS_OPTIONS = useMemo(
    () => [
      { value: "active", label: "Active" },
      { value: "injured", label: "Injured" },
      { value: "unavailable", label: "Unavailable" },
    ],
    []
  );

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    setError("");

    const teamRef = doc(db, "teams", teamId);

    // 
    const subCol = collection(db, "teams", teamId, "athletes");
    let q;
    try {
      q = query(subCol, orderBy("name", "asc"));
    } catch (e) {
      console.warn("No athletes collection yet, skipping orderBy:", e);
      q = subCol; // 
    }

    const unsub = onSnapshot(
      q,
      async (snap) => {
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
      
            // 
            const sub = subMap.get(athleteId);
            const healthStatus = sub?.healthStatus || "active";
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
      }      
    );

    return () => unsub();
  }, [teamId]);

  const handleStatusChange = async (athleteId, newStatus) => {
    if (!teamId || !athleteId) return;
  
    setSavingIds((prev) => new Set(prev).add(athleteId));
  
    try {
      const ref = doc(db, "teams", teamId, "athletes", athleteId);
      await setDoc(
        ref,
        {
          healthStatus: newStatus ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error("Failed to update athlete status:", e);
      setError("Failed to update status. Please try again.");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(athleteId);
        return next;
      });
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Loading athletes…</div>;
  if (error) return <div style={{ padding: 16, color: "#dc2626" }}>{error}</div>;

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
