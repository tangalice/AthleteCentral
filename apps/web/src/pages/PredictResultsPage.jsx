// src/pages/PredictResultsPage.jsx
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

export default function PredictResultsPage() {
  const [user] = useAuthState(auth);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [competitionDate, setCompetitionDate] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [pastPredictions, setPastPredictions] = useState([]);

  /* ---------------------- Load Events ---------------------- */
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

  /* ------------------ Listen to Past Predictions ------------------ */
  useEffect(() => {
    if (!user) return;
    const predRef = collection(db, "users", user.uid, "predictions");
    const q = query(predRef, orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, snapshot => {
      const preds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPastPredictions(preds);
    });
    return () => unsub();
  }, [user]);

  /* ------------------- Prediction Algorithm ------------------- */
  const handlePredict = async () => {
    if (!selectedEvent || !competitionDate) return;

    // Get all past performances for this event
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

    // Sort by date
    data.sort((a, b) => a.date - b.date);

    // Define time variables
    const firstDate = data[0].date;
    const lastDate = data[data.length - 1].date;
    const startTime = data[0].time;
    const endTime = data[data.length - 1].time;

    // Estimate a plateau around 97% of best time achieved so far
    const minTime = endTime * 0.97;

    // Determine how much improvement has occurred and estimate rate constant (k)
    const totalDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
    const improvementFraction = (startTime - endTime) / (startTime - minTime);
    const k = Math.max(
      0.0001,
      -Math.log(Math.max(0.01, 1 - improvementFraction)) / Math.max(1, totalDays)
    );

    // Predict performance using exponential plateau model
    const daysSinceStart =
      (new Date(competitionDate) - firstDate) / (1000 * 60 * 60 * 24);
    const predictedTime =
      minTime + (startTime - minTime) * Math.exp(-k * daysSinceStart);

    // Cap prediction so it never goes below minTime
    const safePrediction = Math.max(predictedTime, minTime);
    setPrediction(safePrediction);

    // Save prediction
    await addDoc(collection(db, "users", user.uid, "predictions"), {
      eventType: selectedEvent,
      competitionDate,
      predictedValue: safePrediction,
      confidence: 0.05,
      modelUsed: "exponential_plateau",
      timestamp: serverTimestamp(),
    });
  };

  /* ------------------- Delete Prediction ------------------- */
  const handleDeletePrediction = async (id) => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this prediction?")) return;
    const predDoc = doc(db, "users", user.uid, "predictions", id);
    await deleteDoc(predDoc);
  };

  /* ------------------- Date Formatting ------------------- */
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", { timeZone: "UTC" });
  };

  /* ------------------- Render UI ------------------- */
  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6">
      {/* Left Column: Predictor */}
      <div className="flex-1 max-w-lg">
        <h1 className="text-2xl font-bold mb-4">Predict Future Results</h1>

        <label className="block font-medium">Event:</label>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="border p-2 w-full mb-4 rounded"
        >
          <option value="">Select Event</option>
          {events.map((event) => (
            <option key={event}>{event}</option>
          ))}
        </select>

        <label className="block font-medium">Competition Date:</label>
        <input
          type="date"
          value={competitionDate}
          onChange={(e) => setCompetitionDate(e.target.value)}
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
              <strong>{formatDate(competitionDate)}</strong>, your predicted time
              is <strong>{prediction.toFixed(2)} seconds</strong>.
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Modeled with an exponential plateau — improvements flatten as you
              approach your best possible performance (confidence ±5%).
            </p>
          </div>
        )}
      </div>

      {/* Right Column: Past Predictions */}
      <div className="w-full lg:w-1/3 bg-gray-50 p-4 rounded shadow-sm overflow-y-auto max-h-[70vh]">
        <h2 className="text-lg font-bold mb-2">Past Predictions</h2>
        {pastPredictions.length === 0 ? (
          <p className="text-gray-500 text-sm">No predictions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {pastPredictions.map((p) => (
              <li
                key={p.id}
                className="py-2 flex justify-between items-center hover:bg-gray-100 rounded px-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {p.eventType} – {formatDate(p.competitionDate)}
                  </p>
                  <p className="text-gray-700 text-sm">
                    Predicted:{" "}
                    <strong>{p.predictedValue?.toFixed(2)}s</strong>
                  </p>
                  <p className="text-xs text-gray-500">
                    Saved{" "}
                    {p.timestamp?.toDate?.().toLocaleDateString?.("en-US", {
                      timeZone: "UTC",
                    }) || ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDeletePrediction(p.id)}
                  className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1"
                  title="Delete prediction"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}