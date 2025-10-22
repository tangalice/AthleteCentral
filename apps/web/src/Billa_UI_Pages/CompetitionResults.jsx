import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

export default function CompetitionResults({ user }) {
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedEventType, setSelectedEventType] = useState("all");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // results from firestore
  useEffect(() => {
    const fetchResults = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const resultsQuery = query(
          collection(db, "users", user.uid, "competitionResults"),
          orderBy("date", "desc")
        );
        const snapshot = await getDocs(resultsQuery);
        const resultsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate() || new Date()
        }));
        setResults(resultsList);
      } catch (error) {
        console.error("Error fetching competition results:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [user]);

  // filter results by month and event type
  const filteredResults = results.filter(result => {
    if (selectedMonth !== "all") {
      const resultMonth = result.date.getMonth();
      if (resultMonth !== parseInt(selectedMonth)) {
        return false;
      }
    }
    
    if (selectedEventType !== "all" && result.eventType !== selectedEventType) {
      return false;
    }
    
    return true;
  });

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const getPlacementColor = (placement) => {
    if (!placement) return "#999";
    const place = parseInt(placement);
    if (place === 1) return "#ffd700"; // gold
    if (place === 2) return "#c0c0c0"; // silver
    if (place === 3) return "#cd7f32"; // bronze
    return "#4caf50"; // default for rest
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      <h2 style={{ color: "#fff" }}>Competition Results</h2>
      <p style={{ color: "#999", marginBottom: "30px" }}>
        View all your competition performance results
      </p>

      {/* Filters */}
      <div style={{
        display: "flex",
        gap: "15px",
        marginBottom: "25px",
        padding: "20px",
        backgroundColor: "#2a2a2a",
        borderRadius: "8px"
      }}>
        <div style={{ flex: "1" }}>
          <label style={{ 
            display: "block", 
            marginBottom: "5px", 
            fontWeight: "bold",
            color: "#fff"
          }}>
            Event Type:
          </label>
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #444",
              backgroundColor: "#1a1a1a",
              color: "#fff"
            }}
          >
            <option value="all">All Events</option>
            <option value="sprint">Sprint</option>
            <option value="distance">Distance</option>
            <option value="relay">Relay</option>
            <option value="field">Field</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ flex: "1" }}>
          <label style={{ 
            display: "block", 
            marginBottom: "5px", 
            fontWeight: "bold",
            color: "#fff"
          }}>
            Filter by Month:
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #444",
              backgroundColor: "#1a1a1a",
              color: "#fff"
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

      {/* Results List */}
      {loading ? (
        <div style={{
          textAlign: "center",
          padding: "40px",
          backgroundColor: "#2a2a2a",
          borderRadius: "8px",
          border: "1px solid #444"
        }}>
          <p style={{ color: "#fff" }}>Loading competition results...</p>
        </div>
      ) : filteredResults.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px",
          backgroundColor: "#2a2a2a",
          borderRadius: "8px",
          border: "1px solid #444"
        }}>
          <p style={{ color: "#fff", fontSize: "16px", marginBottom: "10px" }}>
            No competition results found
          </p>
          <p style={{ fontSize: "14px", color: "#999", margin: 0 }}>
            Competition results will appear here once your coach enters them
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "15px" }}>
          {filteredResults.map((result) => (
            <div
              key={result.id}
              style={{
                padding: "20px",
                backgroundColor: "#2a2a2a",
                border: "1px solid #444",
                borderRadius: "8px"
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "12px"
              }}>
                <div>
                  <h3 style={{ margin: "0 0 5px 0", color: "#fff" }}>
                    {result.competitionName || "Competition"}
                  </h3>
                  <p style={{ margin: "0 0 5px 0", color: "#ccc", fontSize: "15px" }}>
                    {result.eventName || result.eventType}
                  </p>
                  <p style={{ margin: 0, color: "#999", fontSize: "14px" }}>
                    {formatDate(result.date)} • {result.location || "N/A"}
                  </p>
                </div>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  alignItems: "flex-end"
                }}>
                  {result.placement && (
                    <div style={{
                      padding: "8px 16px",
                      backgroundColor: getPlacementColor(result.placement),
                      color: parseInt(result.placement) <= 3 ? "#000" : "white",
                      borderRadius: "20px",
                      fontWeight: "bold",
                      fontSize: "14px"
                    }}>
                      {result.placement === "1" ? "1st Place" :
                       result.placement === "2" ? "2nd Place" :
                       result.placement === "3" ? "3rd Place" :
                       `${result.placement}th Place`}
                    </div>
                  )}
                  <div style={{
                    padding: "8px 16px",
                    backgroundColor: "#4caf50",
                    color: "white",
                    borderRadius: "20px",
                    fontWeight: "bold",
                    fontSize: "14px"
                  }}>
                    {result.result || result.time}
                  </div>
                </div>
              </div>

              {result.notes && (
                <div style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#1a1a1a",
                  borderRadius: "5px"
                }}>
                  <p style={{ margin: 0, fontSize: "14px", fontStyle: "italic", color: "#ccc" }}>
                    {result.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}