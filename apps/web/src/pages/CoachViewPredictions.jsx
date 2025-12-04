import { useState, useEffect } from "react";
import { db } from "../firebase";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function CoachViewPredictions() {
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  /* ---------------- Load All Athletes ---------------- */
  useEffect(() => {
    const loadAthletes = async () => {
      const q = query(collection(db, "users"), where("role", "==", "athlete"));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setAthletes(list);
    };

    loadAthletes();
  }, []);

  /* ---------------- Load Predictions for Selected Athlete ---------------- */
  const loadPredictions = async (athleteId) => {
    if (!athleteId) return;

    setLoadingPredictions(true);
    setPredictions([]);

    const q = query(
      collection(db, "users", athleteId, "predictions"),
      orderBy("competitionDate", "asc")
    );

    const snap = await getDocs(q);

    let list = snap.docs.map((doc) => {
      const data = doc.data();

      // Ensure predictedValue is always a clean number
      const cleanPredicted = parseFloat(
        String(data.predictedValue).replace(/[^\d.-]/g, "")
      );

      return {
        id: doc.id,

        // Convert competitionDate string → timestamp
        competitionDate: new Date(data.competitionDate).getTime(),

        eventType: data.eventType,

        predictedValue: isNaN(cleanPredicted) ? 0 : cleanPredicted,

        timestamp: data.timestamp?.toDate().toLocaleString(),
      };
    });

    // Sort safely after parsing timestamps
    list.sort((a, b) => a.competitionDate - b.competitionDate);

    setPredictions(list);
    setLoadingPredictions(false);
  };

  /* ---------------- Render ---------------- */
  return (
    <div style={{ padding: "25px" }}>
      <h1>Predicted Results (Coach View)</h1>

       {/* NEW BUTTON HERE */}
    <div style={{ marginBottom: "20px" }}>
      <Link to="/calendar">
        <button
          style={{
            padding: "10px 16px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Add Training
        </button>
      </Link>
    </div>

      {/* Athlete dropdown */}
      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <label>Select Athlete: </label>
        <select
          value={selectedAthlete}
          onChange={(e) => {
            setSelectedAthlete(e.target.value);
            loadPredictions(e.target.value);
          }}
        >
          <option value="">-- Select Athlete --</option>

          {athletes.map((ath) => (
            <option key={ath.id} value={ath.id}>
              {ath.displayName || ath.email}
            </option>
          ))}
        </select>
      </div>

      {/* Loading state */}
      {loadingPredictions && <p>Loading predictions...</p>}

      {/* No athlete selected */}
      {!loadingPredictions && !selectedAthlete && (
        <p>Please select an athlete to view predictions.</p>
      )}

      {/* If selected athlete has no predictions */}
      {selectedAthlete && predictions.length === 0 && !loadingPredictions && (
        <p>No predictions found for this athlete.</p>
      )}

      {/* Graph */}
      {predictions.length > 0 && (
        <ResponsiveContainer width="100%" height={350} minWidth={0}>
          <LineChart data={predictions}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="competitionDate"
              tickFormatter={(ts) =>
                new Date(ts).toISOString().split("T")[0]
              }
            />
            <YAxis domain={["dataMin - 2", "dataMax + 2"]} />
            <Tooltip
              formatter={(value) => Number(value).toFixed(2)}
              labelFormatter={(ts) =>
                new Date(ts).toISOString().split("T")[0]
              }
            />
            <Line
              type="monotone"
              dataKey="predictedValue"
              stroke="#007bff"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Table */}
      {predictions.length > 0 && (
        <table
          style={{
            width: "100%",
            marginTop: "30px",
            borderCollapse: "collapse",
            textAlign: "center",
          }}
        >
          <thead>
            <tr>
              <th style={{ padding: "8px" }}>Date</th>
              <th style={{ padding: "8px" }}>Event</th>
              <th style={{ padding: "8px" }}>Predicted Time</th>
              <th style={{ padding: "8px" }}>Created At</th>
            </tr>
          </thead>

          <tbody>
            {predictions.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: "8px" }}>
                  {new Date(p.competitionDate)
                    .toISOString()
                    .split("T")[0]}
                </td>
                <td style={{ padding: "8px" }}>{p.eventType}</td>
                <td style={{ padding: "8px" }}>
                  {p.predictedValue.toFixed(2)}
                </td>
                <td style={{ padding: "8px" }}>{p.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}