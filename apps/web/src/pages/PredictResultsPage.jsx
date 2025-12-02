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
    return d.toLocaleDateString("en-US", { 
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  /* ------------------- Render UI ------------------- */
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Page Header */}
      <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Predict Future Results
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
        Use your past performance data to predict future competition times with our exponential plateau model.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "24px" }}>
        {/* Left Column: Predictor */}
        <div>
          {/* Input Form */}
          <div style={{
            padding: "20px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            marginBottom: "24px"
          }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#111827" }}>
              Create Prediction
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div>
                <label style={{ 
                  display: "block", 
                  marginBottom: "8px", 
                  fontWeight: "500",
                  color: "#374151",
                  fontSize: "14px"
                }}>
                  Event
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

              <div>
                <label style={{ 
                  display: "block", 
                  marginBottom: "8px", 
                  fontWeight: "500",
                  color: "#374151",
                  fontSize: "14px"
                }}>
                  Competition Date
                </label>
                <input
                  type="date"
                  value={competitionDate}
                  onChange={(e) => setCompetitionDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#fff",
                    color: "#111827",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>
            </div>

            <button
              onClick={handlePredict}
              disabled={!selectedEvent || !competitionDate}
              style={{
                padding: "10px 20px",
                backgroundColor: !selectedEvent || !competitionDate ? "#9ca3af" : "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: !selectedEvent || !competitionDate ? "not-allowed" : "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => {
                if (selectedEvent && competitionDate) {
                  e.currentTarget.style.backgroundColor = "#2563eb";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedEvent && competitionDate) {
                  e.currentTarget.style.backgroundColor = "#3b82f6";
                }
              }}
            >
              Generate Prediction
            </button>
          </div>

          {/* Prediction Result */}
          {prediction && (
            <div style={{
              padding: "24px",
              backgroundColor: "#f0fdf4",
              borderRadius: "12px",
              border: "2px solid #10b981",
            }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
                Predicted Result
              </h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Event</div>
                  <span style={{
                    padding: "4px 12px",
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    borderRadius: "16px",
                    fontSize: "13px",
                    fontWeight: "600"
                  }}>
                    {selectedEvent}
                  </span>
                </div>
                
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Date</div>
                  <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                    {formatDate(competitionDate)}
                  </div>
                </div>
                
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Predicted Time</div>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "#10b981", fontFamily: "monospace" }}>
                    {prediction.toFixed(2)}s
                  </div>
                </div>
              </div>

              <div style={{
                padding: "12px",
                backgroundColor: "#fff",
                borderRadius: "8px",
                border: "1px solid #e5e7eb"
              }}>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>
                  Modeled with an exponential plateau — improvements flatten as you approach your best possible performance (confidence ±5%).
                </p>
              </div>
            </div>
          )}

          {/* Empty State when no prediction yet */}
          {!prediction && (
            <div style={{
              textAlign: "center",
              padding: "48px 24px",
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
            }}>
              <p style={{ color: "#111827", fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
                No Prediction Generated
              </p>
              <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                Select an event and competition date to generate a prediction.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Past Predictions */}
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
          maxHeight: "calc(100vh - 200px)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "2px solid #e5e7eb",
            backgroundColor: "#f9fafb"
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: 0 }}>
              Past Predictions
            </h3>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: "4px 0 0 0" }}>
              {pastPredictions.length} prediction{pastPredictions.length !== 1 ? 's' : ''} saved
            </p>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {pastPredictions.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center" }}>
                <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>
                  No predictions yet.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {pastPredictions.map((p, index) => (
                  <div
                    key={p.id}
                    style={{
                      padding: "16px 20px",
                      borderBottom: index < pastPredictions.length - 1 ? "1px solid #e5e7eb" : "none",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <span style={{
                            padding: "4px 10px",
                            backgroundColor: "#e0f2fe",
                            color: "#0369a1",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}>
                            {p.eventType}
                          </span>
                          <span style={{ fontSize: "13px", color: "#6b7280" }}>
                            {formatDate(p.competitionDate)}
                          </span>
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                          <span style={{ fontSize: "18px", fontWeight: "700", color: "#111827", fontFamily: "monospace" }}>
                            {p.predictedValue?.toFixed(2)}s
                          </span>
                          <span style={{ fontSize: "12px", color: "#6b7280" }}>
                            predicted
                          </span>
                        </div>
                        
                        <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px", margin: "4px 0 0 0" }}>
                          Saved {p.timestamp?.toDate?.().toLocaleDateString?.("en-US", {
                            timeZone: "UTC",
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          }) || ""}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => handleDeletePrediction(p.id)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "transparent",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "500",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#fef2f2";
                          e.currentTarget.style.borderColor = "#dc2626";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.borderColor = "#fecaca";
                        }}
                        title="Delete prediction"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}