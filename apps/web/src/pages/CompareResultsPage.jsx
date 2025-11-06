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
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Compare Predicted vs Actual Results</h1>

      {/* Event Selector */}
      <label className="block font-medium mb-2">Select Event:</label>
      <select
        value={selectedEvent}
        onChange={(e) => setSelectedEvent(e.target.value)}
        className="border p-2 rounded w-full mb-6"
      >
        <option value="">Select Event</option>
        {events.map((event) => (
          <option key={event}>{event}</option>
        ))}
      </select>

      {/* Chart */}
      {comparisons.length > 0 && (
        <div
        className="w-full min-h-[350px] mb-6 bg-white border border-gray-200 rounded-md shadow-sm p-3"
        style={{ display: "block" }}
  >
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={comparisons} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
              <XAxis dataKey="competitionDate" />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip
                formatter={(value, name) =>
                  [`${value.toFixed(2)}s`, name === "predictedTime" ? "Predicted" : "Actual"]
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="predictedTime"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Predicted"
              />
              <Line
                type="monotone"
                dataKey="actualTime"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Actual"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {comparisons.length === 0 ? (
        <p className="text-gray-600">
          {selectedEvent
            ? "No comparisons found for this event yet."
            : "Select an event to see comparisons."}
        </p>
      ) : (
        <table className="min-w-full border border-gray-300 rounded-md">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left border-b">Date</th>
              <th className="p-2 text-left border-b">Event</th>
              <th className="p-2 text-left border-b">Predicted Time (s)</th>
              <th className="p-2 text-left border-b">Actual Time (s)</th>
              <th className="p-2 text-left border-b">Difference (%)</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="p-2 border-b">{c.competitionDate}</td>
                <td className="p-2 border-b">{c.eventType}</td>
                <td className="p-2 border-b">{c.predictedTime.toFixed(2)}</td>
                <td className="p-2 border-b">{c.actualTime.toFixed(2)}</td>
                <td
                  className={`p-2 border-b font-semibold ${
                    c.percentDiff < 3
                      ? "text-green-600"
                      : c.percentDiff < 7
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {c.percentDiff.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}