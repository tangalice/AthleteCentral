import React, { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  getDoc,
  query,
  orderBy,
  setDoc,
} from "firebase/firestore";

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
        if (snap.empty) {
          const teamSnap = await getDoc(teamRef);
          if (teamSnap.exists()) {
            const teamData = teamSnap.data();
            if (Array.isArray(teamData.athletes)) {
              const list = [];
              for (const athleteId of teamData.athletes) {
                try {
                  const userSnap = await getDoc(doc(db, "users", athleteId));
                  if (userSnap.exists()) {
                    const u = userSnap.data();
                    list.push({
                      id: athleteId,
                      name: u.displayName || u.name || u.email || "Unnamed",
                      email: u.email || "",
                      healthStatus: "active",
                    });
                  }
                } catch (e) {
                  console.warn("Error loading athlete", athleteId, e);
                }
              }
              setAthletes(list);
            } else {
              setError("No athletes found for this team.");
            }
          } else {
            setError("Team not found.");
          }
        } else {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setAthletes(list);
        }
        setLoading(false);
      },
      (err) => {
        console.error("onSnapshot error:", err);
        setError("Failed to load athletes.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [teamId]);

  const handleStatusChange = async (athleteId, newStatus) => {
    if (!teamId || !athleteId) return;
    console.log("🟢 Updating health:", teamId, athleteId, newStatus);
  
    const ref = doc(db, "teams", teamId, "athletes", athleteId);
    setSavingIds((prev) => new Set(prev).add(athleteId));
  
    try {
      await updateDoc(ref, {
        healthStatus: newStatus || null,
        updatedAt: new Date(),
      });
      console.log("✅ updateDoc success");
    } catch (e) {
      console.warn("⚠️ updateDoc failed, trying setDoc:", e);
      try {
        await setDoc(
          ref,
          {
            healthStatus: newStatus || null,
            updatedAt: new Date(),
          },
          { merge: true }
        );
        console.log("✅ setDoc success");
      } catch (e2) {
        console.error("❌ setDoc failed:", e2);
        setError("Failed to save health status. Check console.");
      }
    } finally {
      setAthletes((prev) =>
        prev.map((a) =>
          a.id === athleteId ? { ...a, healthStatus: newStatus || null } : a
        )
      );
  
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(athleteId);
        return next;
      });
    }
  };

  if (loading) return <div className="p-4">Loading athletes…</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Manage Athlete Health Status</h1>

      {athletes.length === 0 ? (
        <div className="text-gray-500">No athletes found for this team.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {athletes.map((a) => {
            const saving = savingIds.has(a.id);
            return (
              <div key={a.id} className="rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-medium">{a.name}</div>
                    <div className="text-sm text-gray-500">{a.email}</div>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500 mr-1">Current:</span>
                    <span className="font-medium">
                      {a.healthStatus ? capitalize(a.healthStatus) : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <label htmlFor={`status-${a.id}`} className="text-sm text-gray-700">
                    Update status
                  </label>
                  <select
                    id={`status-${a.id}`}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
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

                  {saving && <span className="text-xs text-gray-500">Saving…</span>}
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
