// src/pages/CompareResultsPage.jsx
import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function CompareResultsPage() {
  const [user] = useAuthState(auth);
  const [comparisons, setComparisons] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [events, setEvents] = useState([]);

  // Load available event types
  useEffect(() => {
    const loadEvents = async () => {
      if (!user) return;
      const perfSnap = await getDocs(collection(db, "users", user.uid, "performances"));
      const allEvents = new Set();
      perfSnap.forEach(doc => {
        const data = doc.data();
        if (data.eventType) allEvents.add(data.eventType);
      });
      setEvents([...allEvents]);
    };
    loadEvents();
  }, [user]);

  // Load predictions + compare to performances
  useEffect(() => {
    const loadComparisons = async () => {
      if (!user || !selectedEvent) return;

      const predRef = collection(db, "users", user.uid, "predictions");
      const perfRef = collection(db, "users", user.uid, "performances");

      const predSnap = await getDocs(
        query(predRef, where("eventType", "==", selectedEvent), orderBy("competitionDate", "asc"))
      );

      const comparisonsData = [];

      for (const predDoc of predSnap.docs) {
        const p = predDoc.data();
        const compDate = new Date(p.competitionDate);
        const compDateStr = compDate.toISOString().split("T")[0];

        // Find matching actual result
        const perfSnap = await getDocs(query(perfRef, where("eventType", "==", selectedEvent)));
        let matchingPerformance = null;
        perfSnap.forEach(doc => {
          const d = doc.data();
          if (!d.date) return;
          const perfDateStr = d.date.toDate().toISOString().split("T")[0];
          if (perfDateStr === compDateStr) matchingPerformance = d;
        });

        if (matchingPerformance) {
          const actual = matchingPerformance.time;
          const predicted = p.predictedValue;
          const difference = actual - predicted;
          const percentDiff = (Math.abs(difference) / actual) * 100;

          comparisonsData.push({
            eventType: selectedEvent,
            competitionDate: compDateStr,
            actualTime: actual,
            predictedTime: predicted,
            percentDiff: percentDiff,
          });
        }
      }

      // Sort comparisons chronologically for the chart
      comparisonsData.sort((a, b) => new Date(a.competitionDate) - new Date(b.competitionDate));
      setComparisons(comparisonsData);
    };

    loadComparisons();
  }, [user, selectedEvent]);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Page Header */}
      <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Compare Predicted vs Actual Results
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
        View how your predicted times compare to your actual performance results over time.
      </p>

      {/* Filters */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
            Select Event
          </label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#111827",
              fontSize: "14px",
              outline: "none",
              cursor: "pointer"
            }}
          >
            <option value="">Select Event</option>
            {events.map((event) => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
        </div>

        {/* Summary Stats */}
        {comparisons.length > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backgroundColor: "#f0fdf4",
            borderRadius: "8px",
            border: "2px solid #10b981"
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>
                Comparisons
              </div>
              <div style={{ fontSize: "32px", fontWeight: "800", color: "#10b981" }}>
                {comparisons.length}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                data points
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {comparisons.length > 0 && (
        <div style={{
          marginBottom: "30px",
          padding: "20px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
            Performance Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={comparisons} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="5 5" />
              <XAxis 
                dataKey="competitionDate" 
                tick={{ fontSize: 12, fill: "#6b7280" }}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <YAxis 
                domain={["auto", "auto"]} 
                tick={{ fontSize: 12, fill: "#6b7280" }}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <Tooltip
                formatter={(value, name) =>
                  [`${value.toFixed(2)}s`, name === "predictedTime" ? "Predicted" : "Actual"]
                }
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="predictedTime"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4, fill: "#3b82f6" }}
                name="Predicted"
              />
              <Line
                type="monotone"
                dataKey="actualTime"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4, fill: "#10b981" }}
                name="Actual"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {comparisons.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
        }}>
          <p style={{ color: "#111827", fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
            {selectedEvent ? "No Comparisons Found" : "Select an Event"}
          </p>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
            {selectedEvent
              ? "No comparisons found for this event yet."
              : "Select an event to see comparisons between predicted and actual times."}
          </p>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          overflow: "hidden"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  Date
                </th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  Event
                </th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  Predicted Time
                </th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  Actual Time
                </th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  Difference
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c, idx) => (
                <tr 
                  key={idx}
                  style={{ 
                    borderBottom: idx < comparisons.length - 1 ? "1px solid #e5e7eb" : "none",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                    {c.competitionDate}
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span style={{
                      padding: "4px 12px",
                      backgroundColor: "#e0f2fe",
                      color: "#0369a1",
                      borderRadius: "16px",
                      fontSize: "13px",
                      fontWeight: "600"
                    }}>
                      {c.eventType}
                    </span>
                  </td>
                  <td style={{ padding: "16px", fontSize: "16px", fontWeight: "600", color: "#3b82f6", fontFamily: "monospace" }}>
                    {c.predictedTime.toFixed(2)}s
                  </td>
                  <td style={{ padding: "16px", fontSize: "16px", fontWeight: "600", color: "#10b981", fontFamily: "monospace" }}>
                    {c.actualTime.toFixed(2)}s
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: c.percentDiff < 3 ? "#10b981" : c.percentDiff < 7 ? "#f59e0b" : "#dc2626",
                      fontFamily: "monospace"
                    }}>
                      {c.percentDiff.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}