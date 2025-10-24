import { useState } from "react";

export default function PracticePerformances({ user }) {
  const [selectedIntensity, setSelectedIntensity] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");

  //needs to be populated by firestore
  const performances = [];

  // Filter performances by intensity and date
  const filteredPerformances = performances.filter(perf => {
    if (selectedIntensity !== "all" && perf.intensity !== selectedIntensity) {
      return false;
    }
    
    if (selectedMonth !== "all") {
      const perfMonth = perf.date.getMonth();
      if (perfMonth !== parseInt(selectedMonth)) {
        return false;
      }
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

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      <h2 style={{ color: "#fff" }}>Practice Performances</h2>
      <p style={{ color: "#999", marginBottom: "30px" }}>
        View all your practice session results
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
            Workout Intensity:
          </label>
          <select
            value={selectedIntensity}
            onChange={(e) => setSelectedIntensity(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #444",
              backgroundColor: "#1a1a1a",
              color: "#fff"
            }}
          >
            <option value="all">All Intensities</option>
            <option value="easy">Easy</option>
            <option value="moderate">Moderate</option>
            <option value="hard">Hard</option>
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

      {/* Performance List */}
      {filteredPerformances.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px",
          backgroundColor: "#2a2a2a",
          borderRadius: "8px",
          border: "1px solid #444"
        }}>
          <p style={{ color: "#fff", fontSize: "16px", marginBottom: "10px" }}>
            No practice performances found
          </p>
          <p style={{ fontSize: "14px", color: "#999", margin: 0 }}>
            Performance data will appear here once your coach enters results
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "15px" }}>
          {filteredPerformances.map((perf) => (
            <div
              key={perf.id}
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
                  <h3 style={{ margin: "0 0 5px 0", color: "#fff" }}>{perf.workoutType}</h3>
                  <p style={{ margin: 0, color: "#999", fontSize: "14px" }}>
                    {formatDate(perf.date)} • {perf.intensity}
                  </p>
                </div>
                <div style={{
                  padding: "8px 16px",
                  backgroundColor: 
                    perf.intensity === "easy" ? "#4caf50" : 
                    perf.intensity === "moderate" ? "#ff9800" : 
                    "#f44336",
                  color: "white",
                  borderRadius: "20px",
                  fontWeight: "bold"
                }}>
                  {perf.result}
                </div>
              </div>

              {perf.notes && (
                <div style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#1a1a1a",
                  borderRadius: "5px"
                }}>
                  <p style={{ margin: 0, fontSize: "14px", fontStyle: "italic", color: "#ccc" }}>
                    {perf.notes}
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