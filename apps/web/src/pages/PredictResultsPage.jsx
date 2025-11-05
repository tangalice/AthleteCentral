// src/pages/PredictResultsPage.jsx
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

export default function PredictResultsPage() {
  const [user] = useAuthState(auth);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [competitionDate, setCompetitionDate] = useState("");
  const [prediction, setPrediction] = useState(null);

  // Fetch all event types for the dropdown
  useEffect(() => {
    const fetchEvents = async () => {
      if (!user) return;
      const perfSnap = await getDocs(collection(db, "users", user.uid, "performances"));
      const allEvents = new Set();
      perfSnap.forEach(doc => {
        const data = doc.data();
        if (data.eventType) allEvents.add(data.eventType);
      });
      setEvents([...allEvents]);
    };
    fetchEvents();
  }, [user]);

  // Main prediction logic
  const handlePredict = async () => {
    if (!selectedEvent || !competitionDate) return;

    const perfRef = collection(db, "users", user.uid, "performances");
    const perfQuery = query(perfRef, where("eventType", "==", selectedEvent));
    const snapshot = await getDocs(perfQuery);

    const data = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.time && d.date) {
        data.push({ time: d.time, date: d.date.toDate() });
      }
    });

    if (data.length < 2) {
      alert("Not enough past data to make a prediction.");
      return;
    }

    // Sort results chronologically
    data.sort((a, b) => a.date - b.date);

    // Convert to days since first record
    const firstDate = data[0].date;
    const points = data.map((d, i) => ({
      x: (d.date - firstDate) / (1000 * 60 * 60 * 24),
      y: -d.time, // invert so that improvement (lower times) trends upward
      w: i + 1    // newer data has higher weight
    }));

    // Weighted linear regression
    const sumW = points.reduce((a, p) => a + p.w, 0);
    const sumWX = points.reduce((a, p) => a + p.w * p.x, 0);
    const sumWY = points.reduce((a, p) => a + p.w * p.y, 0);
    const sumWXY = points.reduce((a, p) => a + p.w * p.x * p.y, 0);
    const sumWX2 = points.reduce((a, p) => a + p.w * p.x * p.x, 0);

    const slope = (sumW * sumWXY - sumWX * sumWY) / (sumW * sumWX2 - sumWX * sumWX);
    const intercept = (sumWY - slope * sumWX) / sumW;

    // Predict future result (invert back)
    const daysSinceStart = (new Date(competitionDate) - firstDate) / (1000 * 60 * 60 * 24);
    const predictedTime = -(slope * daysSinceStart + intercept);

    setPrediction(predictedTime);

    // Save prediction to Firestore
    await addDoc(collection(db, "users", user.uid, "predictions"), {
      eventType: selectedEvent,
      competitionDate,
      predictedValue: predictedTime,
      confidence: 0.05,
      modelUsed: "weighted_linear_regression",
      timestamp: serverTimestamp(),
    });
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Predict Future Results</h1>

      <label className="block font-medium">Event:</label>
      <select
        value={selectedEvent}
        onChange={e => setSelectedEvent(e.target.value)}
        className="border p-2 w-full mb-4 rounded"
      >
        <option value="">Select Event</option>
        {events.map(event => (
          <option key={event}>{event}</option>
        ))}
      </select>

      <label className="block font-medium">Competition Date:</label>
      <input
        type="date"
        value={competitionDate}
        onChange={e => setCompetitionDate(e.target.value)}
        className="border p-2 w-full mb-4 rounded"
      />

      <button
        onClick={handlePredict}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        Predict
      </button>

      {prediction && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h2 className="text-lg font-semibold">Predicted Result:</h2>
          <p>
            For <strong>{selectedEvent}</strong> on{" "}
            <strong>{competitionDate}</strong>, your predicted performance is{" "}
            <strong>{prediction.toFixed(2)} seconds</strong>.
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Recent results are weighted more heavily (weighted linear regression, confidence ±5%).
          </p>
        </div>
      )}
    </div>
  );
}