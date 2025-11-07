import React, { useEffect, useState, useMemo } from "react";
import { db, auth } from "../firebase";
import {
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { sendEmailNotification } from "../services/EmailNotificationService";



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
  // Removed storage/event listeners since we're using Firestore real-time listeners now
  

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    setError("");
  
    const teamRef = doc(db, "teams", teamId);
    let userUnsubs = [];
    
    const unsubTeam = onSnapshot(teamRef, (teamSnap) => {
      try {
        // Clean up previous user listeners
        userUnsubs.forEach(unsub => unsub());
        userUnsubs = [];
        
        if (!teamSnap.exists()) {
          setError("Team not found.");
          setAthletes([]);
          setLoading(false);
          return;
        }
  
        const teamData = teamSnap.data();
        const athleteIds = Array.isArray(teamData.athletes) ? teamData.athletes : [];
  
        if (athleteIds.length === 0) {
          setAthletes([]);
          setLoading(false);
          return;
        }
  
        // Load all athlete user documents and set up listeners for health status
        const athleteMap = new Map();
  
        for (const athleteId of athleteIds) {
          const userRef = doc(db, "users", athleteId);
          const unsubUser = onSnapshot(userRef, (userSnap) => {
            if (userSnap.exists()) {
              const u = userSnap.data();
              const name = u.displayName || u.name || u.email || "Unnamed";
              const email = u.email || "";
              const healthStatus = u.healthStatus || "active";
              
              athleteMap.set(athleteId, { id: athleteId, name, email, healthStatus });
            } else {
              // User doesn't exist, still add to list with defaults
              athleteMap.set(athleteId, { 
                id: athleteId, 
                name: "Unnamed", 
                email: "", 
                healthStatus: "active" 
              });
            }
            
            // Update the list whenever any user document changes
            const list = Array.from(athleteMap.values());
            list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            setAthletes(list);
            setLoading(false);
          }, (err) => {
            console.warn("Error loading user:", athleteId, err);
            // Add with defaults on error
            athleteMap.set(athleteId, { 
              id: athleteId, 
              name: "Unnamed", 
              email: "", 
              healthStatus: "active" 
            });
            
            const list = Array.from(athleteMap.values());
            list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            setAthletes(list);
            setLoading(false);
          });
          
          userUnsubs.push(unsubUser);
        }
      } catch (err) {
        console.error("Error loading team:", err);
        setError("Failed to load athletes.");
        setLoading(false);
      }
    });
  
    return () => {
      unsubTeam();
      userUnsubs.forEach(unsub => unsub());
    };
  }, [teamId]);

  const handleStatusChange = async (athleteId, newStatus) => {
    if (!athleteId) return;
    
    setSavingIds((prev) => new Set(prev).add(athleteId));
    setError(""); // Clear any previous errors
  
    try {
      // Update the user document (source of truth)
      // Health status is now stored only in user documents, not in team subcollections
      const userRef = doc(db, "users", athleteId);
      await setDoc(
        userRef,
        {
          healthStatus: newStatus || null,
          healthStatusUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      
      // Optimistically update the UI
      setAthletes((prev) =>
        prev.map((a) =>
          a.id === athleteId ? { ...a, healthStatus: newStatus || null } : a
        )
      );
      
      // Send email notification if status was updated (fire and forget)
      if (newStatus) {
        const coach = auth.currentUser;
        const coachName = coach?.displayName || coach?.email || "Coach";
        const statusLabels = {
          active: "Active",
          injured: "Injured",
          unavailable: "Unavailable"
        };
        const statusLabel = statusLabels[newStatus] || newStatus;
        
        sendEmailNotification(athleteId, 'coachUpdatedHealthStatus', {
          healthStatus: statusLabel,
          coachName,
        }).catch((emailError) => {
          console.error('Error sending email notification:', emailError);
        });
      }
      
      // Clear error on success
      setError("");
    } catch (e) {
      console.error("Failed to update athlete status:", e);
      console.error("Error code:", e.code);
      console.error("Error details:", e);
      setError(`Failed to update status: ${e.message || "Please try again."}`);
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
