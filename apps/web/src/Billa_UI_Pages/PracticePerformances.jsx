import { useState } from "react";

export default function PracticePerformances({ user }) {
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");

  // Empty array - will be populated from Firestore later
  const performances = [];

  // Filter performances by event and date
  const filteredPerformances = performances.filter(perf => {
    if (selectedEvent !== "all" && perf.event !== selectedEvent) {
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

  const uniqueEvents = [...new Set(performances.map(p => p.event))];

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      <h2>Practice Performances</h2>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        View all your practice session results
      </p>

      {/* Filters */}
      <div style={{
        display: "flex",
        gap: "15px",
        marginBottom: "25px",
        padding: "20px",
        backgroundColor: "#f5f5f5",
        borderRadius: "8px"
      }}>
        <div style={{ flex: "1" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Filter by Event:
          </label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ddd"
            }}
          >
            <option value="all">All Events</option>
            {uniqueEvents.map(event => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Filter by Month:
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ddd"
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
          backgroundColor: "#f5f5f5",
          borderRadius: "8px"
        }}>
          <p>No practice performances found</p>
          <p style={{ fontSize: "14px", color: "#999", marginTop: "10px" }}>
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
                backgroundColor: "white",
                border: "1px solid #ddd",
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
                  <h3 style={{ margin: "0 0 5px 0" }}>{perf.event}</h3>
                  <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
                    {formatDate(perf.date)}
                  </p>
                </div>
                <div style={{
                  padding: "8px 16px",
                  backgroundColor: "#646cff",
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
                  backgroundColor: "#f9f9f9",
                  borderRadius: "5px"
                }}>
                  <p style={{ margin: 0, fontSize: "14px", fontStyle: "italic" }}>
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