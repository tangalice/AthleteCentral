import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

export default function CoachViewPractices({ user }) {
  const [practices, setPractices] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("all");
  const [selectedIntensity, setSelectedIntensity] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState(null);

  // Get coach's team and athletes
  useEffect(() => {
    if (!user) return;

    const loadTeamAndAthletes = async () => {
        try {
          // Find team where user is a coach
          const teamsQuery = query(
            collection(db, "teams"),
            where("coaches", "array-contains", user.uid)
          );
          const teamsSnapshot = await getDocs(teamsQuery);
          
          if (!teamsSnapshot.empty) {
            const team = teamsSnapshot.docs[0];
            const teamData = team.data();
            setTeamId(team.id);
            
            // Get athlete details
            const athleteIds = teamData.athletes || [];
            const athletesList = [];
            
            for (const athleteId of athleteIds) {
              try {
                // FIXED: Use getDoc instead of getDocs with query
                const userDocRef = doc(db, "users", athleteId);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  athletesList.push({
                    id: athleteId,
                    name: userData.displayName || userData.email || "Unknown",
                    email: userData.email
                  });
                }
              } catch (err) {
                console.error("Error loading athlete:", athleteId, err);
              }
            }
            
            setAthletes(athletesList);
          }
        } catch (err) {
          console.error("Error loading team:", err);
        }
      };
    loadTeamAndAthletes();
  }, [user]);

  // Load practices from all athletes
  useEffect(() => {
    if (!teamId || athletes.length === 0) return;

    const allPractices = [];
    const unsubscribers = [];

    athletes.forEach((athlete) => {
      const q = query(
        collection(db, "users", athlete.id, "practices"),
        orderBy("date", "desc")
      );

      const unsub = onSnapshot(q, (snapshot) => {
        // Remove old practices for this athlete
        const filtered = allPractices.filter(p => p.athleteId !== athlete.id);
        
        // Add new practices
        const newPractices = snapshot.docs.map((d) => ({
          id: d.id,
          athleteId: athlete.id,
          athleteName: athlete.name,
          ...d.data()
        }));
        
        setPractices([...filtered, ...newPractices].sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dateB - dateA;
        }));
        
        setLoading(false);
      });

      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [teamId, athletes]);

  // Filter practices
  const filteredPractices = practices.filter(practice => {
    if (selectedAthlete !== "all" && practice.athleteId !== selectedAthlete) {
      return false;
    }
    
    if (selectedIntensity !== "all" && practice.intensity !== selectedIntensity) {
      return false;
    }
    
    if (selectedMonth !== "all") {
      const practiceDate = practice.date?.toDate ? practice.date.toDate() : new Date(practice.date);
      const practiceMonth = practiceDate.getMonth();
      if (practiceMonth !== parseInt(selectedMonth)) {
        return false;
      }
    }
    
    return true;
  });

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

  // Group practices by athlete for summary stats
  const athleteStats = athletes.map(athlete => {
    const athletePractices = practices.filter(p => p.athleteId === athlete.id);
    return {
      ...athlete,
      totalPractices: athletePractices.length,
      lastPractice: athletePractices[0]?.date || null,
      avgIntensity: calculateAvgIntensity(athletePractices)
    };
  });

  function calculateAvgIntensity(practices) {
    if (practices.length === 0) return "N/A";
    const intensityMap = { "Low": 1, "Medium": 2, "High": 3, "Very High": 4 };
    const avg = practices.reduce((sum, p) => sum + (intensityMap[p.intensity] || 0), 0) / practices.length;
    if (avg < 1.5) return "Low";
    if (avg < 2.5) return "Medium";
    if (avg < 3.5) return "High";
    return "Very High";
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Page Header */}
      <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Team Practice Overview
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
        View all practice logs from your athletes.
      </p>

      {/* Athlete Stats Summary */}
      {athletes.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "16px",
          marginBottom: "30px"
        }}>
          {athleteStats.map(athlete => (
            <div
              key={athlete.id}
              style={{
                padding: "20px",
                backgroundColor: "#fff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
                {athlete.name}
              </h3>
              <div style={{ fontSize: "14px", color: "#6b7280" }}>
                <p style={{ margin: "4px 0" }}>
                  <strong>Practices:</strong> {athlete.totalPractices}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Avg Intensity:</strong> {athlete.avgIntensity}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Last Practice:</strong>{" "}
                  {athlete.lastPractice ? formatDate(athlete.lastPractice) : "None"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "30px",
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
      }}>
        <div>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "500",
            color: "#374151",
            fontSize: "14px"
          }}>
            Filter by Athlete
          </label>
          <select
            value={selectedAthlete}
            onChange={(e) => setSelectedAthlete(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#111827",
              fontSize: "14px",
              outline: "none",
            }}
          >
            <option value="all">All Athletes</option>
            {athletes.map(athlete => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "500",
            color: "#374151",
            fontSize: "14px"
          }}>
            Filter by Intensity
          </label>
          <select
            value={selectedIntensity}
            onChange={(e) => setSelectedIntensity(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#111827",
              fontSize: "14px",
              outline: "none",
            }}
          >
            <option value="all">All Intensities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Very High">Very High</option>
          </select>
        </div>

        <div>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "500",
            color: "#374151",
            fontSize: "14px"
          }}>
            Filter by Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#111827",
              fontSize: "14px",
              outline: "none",
            }}
          >
            <option value="all">All Months</option>
            <option value="0">January</option>
            <option value="1">February</option>
            <option value="2">March</option>
            <option value="3">April</option>
            <option value="4">May</option>
            <option value="5">June</option>
            <option value="6">July</option>
            <option value="7">August</option>
            <option value="8">September</option>
            <option value="9">October</option>
            <option value="10">November</option>
            <option value="11">December</option>
          </select>
        </div>
      </div>

      {/* Practice History */}
      <div>
        <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
          All Practice Logs ({filteredPractices.length})
        </h3>
        
        {loading ? (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
          }}>
            <p style={{ color: "#6b7280", fontSize: "15px" }}>Loading practices...</p>
          </div>
        ) : filteredPractices.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
          }}>
            <p style={{ color: "#111827", fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
              No practice entries found
            </p>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
              {athletes.length === 0 
                ? "Add athletes to your team to see their practices."
                : "Athletes haven't logged any practices yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {filteredPractices.map((practice) => (
              <div
                key={`${practice.athleteId}-${practice.id}`}
                style={{
                  padding: "20px",
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderLeft: `4px solid ${getIntensityColor(practice.intensity)}`,
                  borderRadius: "12px",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "12px"
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <span style={{
                        padding: "4px 12px",
                        backgroundColor: "#3b82f6",
                        color: "white",
                        borderRadius: "16px",
                        fontWeight: "600",
                        fontSize: "12px"
                      }}>
                        {practice.athleteName}
                      </span>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                        {formatDate(practice.date)}
                      </h3>
                      <span style={{
                        padding: "4px 12px",
                        backgroundColor: getIntensityColor(practice.intensity),
                        color: "white",
                        borderRadius: "16px",
                        fontWeight: "600",
                        fontSize: "12px"
                      }}>
                        {practice.intensity}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{
                  marginTop: "12px",
                  padding: "14px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb"
                }}>
                  <p style={{ 
                    margin: 0, 
                    fontSize: "14px", 
                    color: "#374151",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap"
                  }}>
                    {practice.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}