// src/components/CoachDataReports.jsx
import { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import html2canvas from "html2canvas";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ---------------- Helper: Download CSV ---------------- */
function downloadCSV(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","), // header row
    ...data.map((row) =>
      headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
    ),
  ];
  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export default function CoachDataReports() {
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [selectedType, setSelectedType] = useState("competition");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [events, setEvents] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [status, setStatus] = useState("");

  // new: saved reports
  const [savedReports, setSavedReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // chart ref for PNG download
  const chartRef = useRef(null);

  /* ---------------- Fetch All Athletes ---------------- */
  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        const snapshot = await getDocs(collection(db, "users"));
        const list = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((u) => (u.role || "").toLowerCase() === "athlete");
        setAthletes(list);
      } catch (e) {
        console.error("Error fetching athletes:", e);
        setStatus("Error loading athletes.");
      }
    };
    fetchAthletes();
  }, []);

  /* ---------------- Fetch Events for Athlete + Type ---------------- */
  useEffect(() => {
    const fetchEvents = async () => {
      if (!selectedAthlete) {
        setEvents([]);
        return;
      }
      try {
        const perfRef = collection(db, "users", selectedAthlete, "performances");
        const snapshot = await getDocs(perfRef);
        const eventSet = new Set();
        snapshot.forEach((doc) => {
          const d = doc.data();
          if (d.type === selectedType && d.eventType) {
            eventSet.add(d.eventType);
          }
        });
        setEvents([...eventSet]);
      } catch (err) {
        console.error("Error fetching events:", err);
        setStatus("Error loading events.");
      }
    };
    fetchEvents();
  }, [selectedAthlete, selectedType]);

  /* ---------------- Fetch Saved Reports ---------------- */
  useEffect(() => {
    const fetchReports = async () => {
      const coach = auth.currentUser;
      if (!coach) return;
      setLoadingReports(true);
      try {
        const reportsRef = collection(db, "users", coach.uid, "savedReports");
        const snapshot = await getDocs(reportsRef);
        const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setSavedReports(list);
      } catch (err) {
        console.error("Error loading saved reports:", err);
      } finally {
        setLoadingReports(false);
      }
    };
    fetchReports();
  }, []);

  /* ---------------- Generate Report ---------------- */
  const generateReport = async () => {
    if (!selectedAthlete || !selectedEvent) {
      setStatus("Please select an athlete and event.");
      return;
    }

    try {
      const perfRef = collection(db, "users", selectedAthlete, "performances");
      const snapshot = await getDocs(perfRef);
      const filteredData = [];

      snapshot.forEach((doc) => {
        const d = doc.data();
        if (d.type === selectedType && d.eventType === selectedEvent) {
          filteredData.push({
            date: new Date(d.date.seconds * 1000).toLocaleDateString(),
            time: d.time,
          });
        }
      });

      filteredData.sort((a, b) => new Date(a.date) - new Date(b.date));
      setChartData(filteredData);
      setStatus(filteredData.length ? "" : "No data found for selection.");
    } catch (err) {
      console.error("Error generating report:", err);
      setStatus("Error loading data.");
    }
  };

  /* ---------------- Save Report ---------------- */
  const saveReport = async () => {
    const coach = auth.currentUser;
    if (!coach || !chartData.length) {
      setStatus("Generate a report before saving.");
      return;
    }

    try {
      const reportsRef = collection(db, "users", coach.uid, "savedReports");
      const newReport = {
        athleteId: selectedAthlete,
        type: selectedType,
        event: selectedEvent,
        data: chartData,
        createdAt: new Date(),
      };
      const docRef = await addDoc(reportsRef, newReport);
      setStatus("Report saved successfully.");
      setSavedReports((prev) => [...prev, { id: docRef.id, ...newReport }]);
    } catch (err) {
      console.error("Error saving report:", err);
      setStatus("Error saving report.");
    }
  };

  /* ---------------- Load Saved Report ---------------- */
  const loadSavedReport = (report) => {
    setSelectedAthlete(report.athleteId);
    setSelectedType(report.type);
    setSelectedEvent(report.event);
    setChartData(report.data || []);
    setStatus("");
  };

  /* ---------------- Download CSV ---------------- */
  const handleDownload = () => {
    if (!chartData.length) {
      setStatus("No data to download.");
      return;
    }
    const filename = `${selectedEvent}_${selectedType}_${new Date()
      .toISOString()
      .split("T")[0]}.csv`;
    downloadCSV(chartData, filename);
  };

  /* ---------------- Download PNG ---------------- */
  const handleDownloadPNG = async () => {
    if (!chartData.length) {
      setStatus("No data to export as image.");
      return;
    }

    try {
      const element = chartRef.current;
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `${selectedEvent}_${selectedType}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Error exporting PNG:", err);
      setStatus("Error exporting PNG.");
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div style={{ display: "flex", background: "#fff", minHeight: "100vh" }}>
      {/* Sidebar for saved reports */}
      <aside
        style={{
          width: 260,
          borderRight: "1px solid #e5e7eb",
          padding: "20px",
          background: "#f9fafb",
        }}
      >
        <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>
          Saved Reports
        </h3>
        {loadingReports ? (
          <p>Loading...</p>
        ) : savedReports.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {savedReports.map((r) => (
              <li
                key={r.id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid #e5e7eb",
                  cursor: "pointer",
                }}
                onClick={() => loadSavedReport(r)}
              >
                <span style={{ fontWeight: 600 }}>{r.event}</span>{" "}
                <small>({r.type})</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>No saved reports yet.</p>
        )}
      </aside>

      {/* Main Content */}
      <div
        style={{ flex: 1, maxWidth: 800, margin: "40px auto", padding: "0 20px" }}
      >
        <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 20 }}>
          Data Reports
        </h2>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <select
            value={selectedAthlete}
            onChange={(e) => setSelectedAthlete(e.target.value)}
            style={{ padding: 10, borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            <option value="">Select Athlete</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName || a.email}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ padding: 10, borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            <option value="practice">Practice</option>
            <option value="competition">Competition</option>
          </select>

          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            style={{ padding: 10, borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            <option value="">Select Event</option>
            {events.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>

          {/* Buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              onClick={generateReport}
              style={{
                flex: 1,
                padding: 10,
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Generate Report
            </button>

            <button
              onClick={saveReport}
              style={{
                flex: 1,
                padding: 10,
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Save Report
            </button>

            <button
              onClick={handleDownload}
              style={{
                flex: 1,
                padding: 10,
                background: "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Download CSV
            </button>

            <button
              onClick={handleDownloadPNG}
              style={{
                flex: 1,
                padding: 10,
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Download PNG
            </button>
          </div>
        </div>

        {/* Chart */}
        <div ref={chartRef}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis
                  label={{
                    value: "Time (s)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip />
                <Line type="monotone" dataKey="time" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#6b7280" }}>
              {status || "Select options and click Generate Report."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}