// src/pages/HealthAndAvailability.jsx
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

export default function HealthAndAvailability() {
  const [searchTerm, setSearchTerm] = useState("");
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [athletes, setAthletes] = useState([]); // {id, name, email, healthStatus}

  useEffect(() => {
    let cancelled = false;
    let unsubs = [];
  
    const load = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      setError("");
  
      try {
        const teamsQ = query(
          collection(db, "teams"),
          where("coaches", "array-contains", auth.currentUser.uid)
        );
        const teamsSnap = await getDocs(teamsQ);
        const teamIds = teamsSnap.docs.map(d => d.id);
  
        const athleteMap = new Map();
  
        unsubs = teamIds.map(tId =>
          onSnapshot(collection(db, "teams", tId, "athletes"), (snap) => {
            snap.docs.forEach(sd => {
              const d = sd.data() || {};
              const existing = athleteMap.get(sd.id);
              const nextStatus = (d.healthStatus || "active");
              if (!existing) {
                athleteMap.set(sd.id, nextStatus);
              } else {
                const rank = (s) => s === "injured" ? 2 : s === "unavailable" ? 1 : 0;
                if (rank(nextStatus) > rank(existing)) athleteMap.set(sd.id, nextStatus);
              }
            });
  
            const updateList = async () => {
              const result = [];
              for (const [athleteId, status] of athleteMap.entries()) {
                const userSnap = await getDoc(doc(db, "users", athleteId));
                const u = userSnap.exists() ? (userSnap.data() || {}) : {};
                const name = u.displayName || u.name || u.email || "Unnamed";
                const email = u.email || "";
                result.push({
                  id: athleteId,
                  name,
                  email,
                  healthStatus: normalizeHealth(status)
                });
              }
              if (!cancelled) {
                result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                setAthletes(result);
              }
            };
            updateList();
          })
        );
      } catch (e) {
        if (!cancelled) setError("Failed to load athletes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
  
    load();
  
    return () => {
      cancelled = true;
      unsubs.forEach(unsub => unsub && unsub());
    };
  }, []);
  // Helpers
  function normalizeHealth(status) {
    const s = String(status || "").toLowerCase();
    if (s === "injured") return "Injured";
    if (s === "unavailable") return "Unavailable";
    return "Healthy"; // treat anything else as healthy/active
  }

  function derivedAvailabilityFromHealth(health) {
    if (health === "Injured" || health === "Unavailable") return "Unavailable";
    return "Available";
  }

  const getNext7Days = () => {
    const days = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push({
        value: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      });
    }
    return days;
  };

  // Filtered list
  const filteredAthletes = useMemo(() => {
    const source = athletes;
    if (!searchTerm.trim()) return source;
    const ql = searchTerm.toLowerCase();
    return source.filter(a =>
      (a.name || "").toLowerCase().includes(ql) ||
      (a.email || "").toLowerCase().includes(ql)
    );
  }, [athletes, searchTerm]);

  // Availability for selected date uses derived availability
  const athletesForDate = useMemo(() => {
    return filteredAthletes.filter(a => derivedAvailabilityFromHealth(a.healthStatus) !== "Unavailable");
  }, [filteredAthletes, selectedDate]);

  // Stats per day
  const availabilityStats = useMemo(() => {
    const days = [];
    const source = athletes;
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      let available = 0;
      let partiallyAvailable = 0; // not used now
      let unavailable = 0;

      for (const a of source) {
        const status = derivedAvailabilityFromHealth(a.healthStatus);
        if (status === "Available") available++; else unavailable++;
      }

      days.push({
        date: dateStr,
        dateObj: d,
        available,
        partiallyAvailable,
        unavailable,
        total: source.length,
      });
    }
    return days.sort((a, b) => b.available - a.available);
  }, [athletes]);

  const getHealthStatusColor = (status) => {
    switch (status) {
      case "Healthy":
        return "#10b981";
      case "Injured":
        return "#ef4444";
      case "Unavailable":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getAvailabilityColor = (status) => {
    switch (status) {
      case "Available":
        return "#10b981";
      case "Unavailable":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getDerivedAvailabilityForDate = (athlete) => {
    return derivedAvailabilityFromHealth(athlete.healthStatus);
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#6b7280" }}>Loading health and availability…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#ef4444" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px", color: "#111827" }}>
        Health and Availability
      </h1>
      <p style={{ fontSize: "16px", color: "#6b7280", marginBottom: "24px" }}>
        View health status and availability of all athletes
      </p>

      {/* Search Bar */}
      <div style={{ marginBottom: "24px" }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "400px",
            padding: "12px 16px",
            fontSize: "14px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            outline: "none",
          }}
          onFocus={(e) => e.target.style.borderColor = "#10b981"}
          onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
        />
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
        gap: "16px",
        marginBottom: "32px"
      }}>
        <div style={{
          padding: "20px",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>Total Athletes</div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#111827" }}>
            {athletes.length}
          </div>
        </div>
        <div style={{
          padding: "20px",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>Available Today</div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#10b981" }}>
            {filteredAthletes.filter(a => getDerivedAvailabilityForDate(a) === "Available").length}
          </div>
        </div>
        <div style={{
          padding: "20px",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>Healthy Athletes</div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#10b981" }}>
            {athletes.filter(a => a.healthStatus === "Healthy").length}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
        {/* Date Selector & Availability for Date */}
        <div style={{
          padding: "20px",
          backgroundColor: "#fff",
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", color: "#111827" }}>
            Availability by Date
          </h2>
          
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: "14px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              marginBottom: "16px",
              backgroundColor: "#fff",
              cursor: "pointer"
            }}
          >
            {getNext7Days().map(day => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>

          <div style={{ marginTop: "16px" }}>
            {filteredAthletes.map(athlete => {
              const availability = getDerivedAvailabilityForDate(athlete);
              const color = getAvailabilityColor(availability);
              return (
                <div
                  key={athlete.id}
                  style={{
                    padding: "12px",
                    marginBottom: "8px",
                    borderRadius: "6px",
                    backgroundColor: "#f9fafb",
                    borderLeft: `3px solid ${color}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: "#111827" }}>{athlete.name}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>{athlete.email}</div>
                  </div>
                  <span style={{
                    padding: "4px 12px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    backgroundColor: `${color}20`,
                    color: color
                  }}>
                    {availability}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Days with Most Availability */}
        <div style={{
          padding: "20px",
          backgroundColor: "#fff",
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", color: "#111827" }}>
            Best Days for Availability
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>
            Days with the most athletes available (next 7 days)
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {availabilityStats.map((day) => {
              const percentage = day.total > 0 ? Math.round((day.available / day.total) * 100) : 0;
              return (
                <div
                  key={day.date}
                  style={{
                    padding: "16px",
                    borderRadius: "6px",
                    backgroundColor: "#f9fafb",
                    border: "1px solid #e5e7eb"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 500, color: "#111827" }}>
                      {day.dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#10b981" }}>
                      {day.available}/{day.total} ({percentage}%)
                    </div>
                  </div>
                  <div style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: "#e5e7eb",
                    borderRadius: "4px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: "100%",
                      backgroundColor: "#10b981",
                      transition: "width 0.3s ease"
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Athletes List */}
      <div style={{
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "8px",
        border: "1px solid #e5e7eb"
      }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", color: "#111827" }}>
          All Athletes ({filteredAthletes.length})
        </h2>
        
        <div style={{ display: "grid", gap: "12px" }}>
          {filteredAthletes.map(athlete => (
            <div
              key={athlete.id}
              style={{
                padding: "16px",
                borderRadius: "6px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#fff"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 600, fontSize: "16px", color: "#111827" }}>
                      {athlete.name}
                    </div>
                    <span style={{
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 500,
                      backgroundColor: `${getHealthStatusColor(athlete.healthStatus)}20`,
                      color: getHealthStatusColor(athlete.healthStatus)
                    }}>
                      {athlete.healthStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "12px" }}>
                    {athlete.email}
                  </div>
                  
                  {/* Weekly Availability Summary */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {getNext7Days().map(day => {
                      const status = getDerivedAvailabilityForDate(athlete);
                      const color = getAvailabilityColor(status);
                      return (
                        <div
                          key={day.value}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            backgroundColor: `${color}15`,
                            color: color,
                            fontWeight: 500,
                            border: `1px solid ${color}40`
                          }}
                          title={day.label}
                        >
                          {day.label.split(',')[0].substring(0, 3)}: {status === "Available" ? "✓" : "✗"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAthletes.length === 0 && (
          <div style={{ 
            padding: "40px", 
            textAlign: "center", 
            color: "#6b7280",
            fontSize: "14px"
          }}>
            No athletes found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
