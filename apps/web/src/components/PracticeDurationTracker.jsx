import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { fetchTeamAthletes } from "../services/teamService";

export default function PracticeDurationTracker({ teamId, eventId, isCoach = false }) {
  const [eventDetails, setEventDetails] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [durationInputs, setDurationInputs] = useState({});
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const dirtyFieldsRef = useRef(new Set());

  // subscribe to event document
  useEffect(() => {
    if (!teamId || !eventId) return;
    const eventRef = doc(db, "teams", teamId, "events", eventId);
    const unsub = onSnapshot(eventRef, (snap) => {
      if (!snap.exists()) {
        setEventDetails(null);
        setDurationInputs({});
        setLoadingEvent(false);
        setMessage("Event not found.");
        return;
      }
      const data = snap.data();
      setEventDetails(data);
      const mapped = {};
      const records = data?.durationRecords || {};
      Object.entries(records).forEach(([athleteId, value]) => {
        mapped[athleteId] = value === undefined || value === null ? "" : String(value);
      });
      setDurationInputs((prev) => {
        const dirty = dirtyFieldsRef.current;
        const next = { ...prev };
        Object.entries(mapped).forEach(([athleteId, value]) => {
          if (!dirty.has(athleteId)) {
            next[athleteId] = value;
          }
        });
        Object.keys(next).forEach((athleteId) => {
          if (!Object.prototype.hasOwnProperty.call(mapped, athleteId) && !dirty.has(athleteId)) {
            delete next[athleteId];
          }
        });
        return next;
      });
      setLoadingEvent(false);
    });
    return () => unsub();
  }, [teamId, eventId]);

  // load athletes relevant to event
  useEffect(() => {
    if (!teamId || !eventDetails) return;
    let cancelled = false;
    setLoadingAthletes(true);
    (async () => {
      try {
        const members = await fetchTeamAthletes(teamId);
        const assignedIds = Array.isArray(eventDetails.assignedMemberIds)
          ? eventDetails.assignedMemberIds
          : [];
        const filtered =
          assignedIds.length > 0
            ? members.filter((m) => assignedIds.includes(m.id))
            : members;
        if (!cancelled) {
          setAthletes(filtered);
        }
      } catch (error) {
        console.error("Failed to load athletes for duration tracker", error);
        if (!cancelled) {
          setAthletes([]);
          setMessage("Unable to load athletes for this event.");
        }
      } finally {
        if (!cancelled) {
          setLoadingAthletes(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, eventDetails]);

  const totalDuration = useMemo(() => {
    return Object.values(durationInputs).reduce((sum, value) => {
      const num = parseFloat(value);
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);
  }, [durationInputs]);

  const updateDuration = (athleteId, value) => {
    if (!isCoach) return;
    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }
    dirtyFieldsRef.current.add(athleteId);
    setDurationInputs((prev) => ({
      ...prev,
      [athleteId]: value,
    }));
  };

  const saveDurations = async () => {
    if (!isCoach || !teamId || !eventId) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = {};
      Object.entries(durationInputs).forEach(([athleteId, value]) => {
        const num = parseFloat(value);
        if (Number.isFinite(num) && num >= 0) {
          payload[athleteId] = Number(num.toFixed(2));
        }
      });
      await updateDoc(doc(db, "teams", teamId, "events", eventId), {
        durationRecords: payload,
        durationSummary: {
          totalDuration: Object.values(payload).reduce((sum, val) => sum + val, 0),
          athleteCount: Object.keys(payload).length,
          lastUpdated: Timestamp.now(),
        },
      });
      dirtyFieldsRef.current.clear();
      setMessage("Durations saved successfully.");
    } catch (error) {
      console.error("Failed to save durations", error);
      setMessage("Failed to save durations. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingEvent) {
    return (
      <div style={{ padding: 18 }}>
        <p>Loading practice details…</p>
      </div>
    );
  }

  if (!eventDetails) {
    return (
      <div style={{ padding: 18 }}>
        <p style={{ color: "#ef4444" }}>{message || "Practice not found."}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>{eventDetails.title}</h3>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
          {eventDetails.datetime?.toDate?.().toLocaleString() || "No date available"}
        </p>
      </div>

      <div
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <strong style={{ fontSize: 16 }}>Total Duration</strong>
        <p style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 700, color: "#047857" }}>
          {totalDuration.toFixed(2)} mins
        </p>
        <span className="text-muted" style={{ fontSize: 12 }}>
          Sum of all athlete durations for this practice
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {loadingAthletes ? (
          <p>Loading athletes…</p>
        ) : athletes.length === 0 ? (
          <p className="text-muted">No athletes assigned to this practice.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {athletes.map((athlete) => (
              <div
                key={athlete.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <strong>{athlete.name || athlete.email || "Unnamed Athlete"}</strong>
                  {athlete.email && (
                    <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{athlete.email}</p>
                  )}
                </div>
                <label style={{ fontSize: 13, color: "#374151", marginBottom: 4, display: "block" }}>
                  Duration (minutes)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={durationInputs[athlete.id] ?? ""}
                  placeholder="e.g., 75"
                  onChange={(e) => updateDuration(athlete.id, e.target.value)}
                  disabled={!isCoach}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontSize: 16,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {isCoach && athletes.length > 0 && (
        <button
          className="btn btn-primary"
          onClick={saveDurations}
          disabled={saving}
          style={{ marginTop: 16 }}
        >
          {saving ? "Saving…" : "Save Durations"}
        </button>
      )}

      {message && (
        <div
          className={`alert ${
            message.toLowerCase().includes("fail") ? "alert-error" : "alert-success"
          }`}
          style={{ marginTop: 12 }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

