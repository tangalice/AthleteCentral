// src/components/ViewAthletePractices.jsx
// Coaches can view practice logs from all athletes on their team

import { useEffect, useState } from "react";
import {
  collection,
  query,
  getDocs,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

export default function ViewAthletePractices({ user }) {
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [practices, setPractices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPractices, setLoadingPractices] = useState(false);
  const [filters, setFilters] = useState({
    Low: true,
    Medium: true,
    High: true,
    "Very High": true,
  });

  // Load athletes from the coach's team
  useEffect(() => {
    if (!user || user.role !== "coach") return;

    const loadAthletes = async () => {
      try {
        // Get all users who are athletes on the same team
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          where("role", "==", "athlete"),
          where("teamId", "==", user.teamId)
        );
        
        const snapshot = await getDocs(q);
        const athleteList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        setAthletes(athleteList);
        setLoading(false);
      } catch (err) {
        console.error("Error loading athletes:", err);
        setLoading(false);
      }
    };

    loadAthletes();
  }, [user]);

  // Load practices for selected athlete
  const loadAthletePractices = async (athleteId) => {
    setLoadingPractices(true);
    try {
      const practicesRef = collection(db, "users", athleteId, "practices");
      const q = query(practicesRef, orderBy("date", "desc"));
      
      const snapshot = await getDocs(q);
      const practiceList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setPractices(practiceList);
      setLoadingPractices(false);
    } catch (err) {
      console.error("Error loading practices:", err);
      setLoadingPractices(false);
      alert("Could not load athlete practices. Check Firestore permissions.");
    }
  };

  // When athlete is selected, load their practices
  const handleSelectAthlete = (athlete) => {
    setSelectedAthlete(athlete);
    loadAthletePractices(athlete.id);
  };

  // Filter practices by intensity
  const filteredPractices = practices.filter((p) => filters[p.intensity]);

  // Helper to format date
  const formatDate = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Helper to get intensity color
  const getIntensityColor = (intensity) => {
    switch (intensity) {
      case "Low":
        return "#10b981";
      case "Medium":
        return "#f59e0b";
      case "High":
        return "#ef4444";
      case "Very High":
        return "#dc2626";
      default:
        return "#6b7280";
    }
  };

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
        {/* Page Header */}
        <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 10 }}>
          View Athlete Practices
        </h2>
        <p style={{ color: "#6b7280", marginBottom: 20 }}>
          View practice logs submitted by your athletes.
        </p>

        {/* Athlete Selection */}
        {loading ? (
          <p>Loading athletes...</p>
        ) : athletes.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            No athletes found on your team.
          </p>
        ) : (
          <div style={{ marginBottom: 30 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
              Select Athlete
            </label>
            <select
              value={selectedAthlete?.id || ""}
              onChange={(e) => {
                const athlete = athletes.find((a) => a.id === e.target.value);
                if (athlete) handleSelectAthlete(athlete);
              }}
              style={{
                padding: 10,
                fontSize: 16,
                borderRadius: 6,
                border: "1px solid #d1d5db",
                width: "100%",
                maxWidth: 400,
              }}
            >
              <option value="">Choose an athlete...</option>
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.displayName || athlete.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Show practices if athlete is selected */}
        {selectedAthlete && (
          <>
            {/* Intensity Filters */}
            <div
              style={{
                display: "flex",
                gap: 12,
                background: "#f9fafb",
                borderRadius: 8,
                padding: 10,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              {Object.keys(filters).map((key) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filters[key]}
                    onChange={() =>
                      setFilters((f) => ({ ...f, [key]: !f[key] }))
                    }
                  />
                  <span style={{ fontSize: 14 }}>{key}</span>
                </label>
              ))}
            </div>

            {/* Practice History */}
            <div>
              <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>
                {selectedAthlete.displayName || selectedAthlete.email}'s Practice History
              </h3>

              {loadingPractices ? (
                <p style={{ color: "#6b7280" }}>Loading practices...</p>
              ) : filteredPractices.length === 0 ? (
                <p style={{ color: "#6b7280" }}>
                  No practice entries found for this athlete.
                </p>
              ) : (
                filteredPractices.map((practice) => (
                  <div
                    key={practice.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderLeft: `5px solid ${getIntensityColor(practice.intensity)}`,
                      borderRadius: 8,
                      padding: 14,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        {formatDate(practice.date)}
                      </h4>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: getIntensityColor(practice.intensity),
                          background: `${getIntensityColor(practice.intensity)}20`,
                          padding: "3px 10px",
                          borderRadius: 4,
                        }}
                      >
                        {practice.intensity}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        color: "#374151",
                        fontSize: 14,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {practice.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}