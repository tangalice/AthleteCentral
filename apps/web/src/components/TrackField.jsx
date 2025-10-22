import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function TrackField() {
  const [mode, setMode] = useState(() => localStorage.getItem("trackMode") || "indoor");
  const [time, setTime] = useState("");
  const [adjustedTime, setAdjustedTime] = useState(null);

  const [knownDistance, setKnownDistance] = useState("");
  const [knownTime, setKnownTime] = useState("");
  const [targetDistance, setTargetDistance] = useState("");
  const [predictedTime, setPredictedTime] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  /* ---------------- Firestore ---------------- */
  useEffect(() => {
    const loadMode = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          if (snap.exists() && snap.data().lastTrackMode) {
            const saved = snap.data().lastTrackMode;
            setMode(saved);
            localStorage.setItem("trackMode", saved);
            return;
          }
        }
        const local = localStorage.getItem("trackMode");
        if (local === "indoor" || local === "outdoor") {
          setMode(local);
        }
      } catch (err) {
        console.warn("Error loading track mode:", err);
      }
    };
    loadMode();
  }, []);

  /* ---------------- Firestore ---------------- */
  useEffect(() => {
    localStorage.setItem("trackMode", mode);

    const saveMode = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { lastTrackMode: mode });

        //
        setSaveMessage("✅ Mode saved to cloud");
        setTimeout(() => setSaveMessage(""), 2000);
      } catch (err) {
        console.warn("Error saving track mode:", err);
      }
    };

    saveMode();
  }, [mode]);

  /* ---------------- tools ---------------- */
  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "N/A";
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1);
    return `${m} min ${s < 10 ? "0" : ""}${s} sec`;
  }

  function isUnrealisticTime(value) {
    return value < 1 || value > 3000; //
  }

  /* ---------------- in/out ---------------- */
  const handleAdjustment = (e) => {
    const value = parseFloat(e.target.value);
    setTime(e.target.value);
    setErrorMessage("");

    if (isNaN(value)) {
      setAdjustedTime(null);
      return;
    }

    if (isUnrealisticTime(value)) {
      setErrorMessage("⚠️ Please enter a realistic time between 1s and 3000s.");
      setAdjustedTime(null);
      return;
    }

    const adjusted = mode === "indoor" ? value * 0.98 : value / 0.98;
    setAdjustedTime(adjusted);
  };

  /* ---------------- prediction ---------------- */
  const handlePredict = () => {
    setErrorMessage("");
    const d1 = parseFloat(knownDistance);
    const t1 = parseFloat(knownTime);
    const d2 = parseFloat(targetDistance);

    if (!d1 || !t1 || !d2) {
      setErrorMessage("⚠️ Please fill all fields with valid numbers.");
      setPredictedTime(null);
      return;
    }

    if (isUnrealisticTime(t1)) {
      setErrorMessage("⚠️ Known time is unrealistic (must be between 1 s and 3000 s).");
      setPredictedTime(null);
      return;
    }

    if (d1 <= 0 || d2 <= 0) {
      setErrorMessage("⚠️ Distances must be positive numbers.");
      setPredictedTime(null);
      return;
    }

    // checking
    const speed = d1 / t1; // m/s
    if (speed > 12 || speed < 1) {
      setErrorMessage(
        `⚠️ Input unrealistic: average speed (${speed.toFixed(
          2
        )} m/s) must be between 1 m/s (walking) and 12 m/s (elite sprint).`
      );
      setPredictedTime(null);
      return;
    }

    const predicted = t1 * Math.pow(d2 / d1, 1.06);

    if (predicted > 50000 || predicted < 1) {
      setErrorMessage("⚠️ Predicted result unrealistic. Please recheck input values.");
      setPredictedTime(null);
      return;
    }

    setPredictedTime(predicted);
  };

  /* ---------------- page ---------------- */
  return (
    <div style={{ padding: "20px", maxWidth: 500, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
        Track & Field 🏃‍♂️
      </h2>

      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Indoor / Outdoor Adjustment
      </h3>

      {/* mode */}
      <label>
        <input
          type="radio"
          name="mode"
          value="indoor"
          checked={mode === "indoor"}
          onChange={() => setMode("indoor")}
        />
        Indoor
      </label>
      <label style={{ marginLeft: 10 }}>
        <input
          type="radio"
          name="mode"
          value="outdoor"
          checked={mode === "outdoor"}
          onChange={() => setMode("outdoor")}
        />
        Outdoor
      </label>

      {/* save */}
      {saveMessage && (
        <div
          style={{
            background: "#d1fae5",
            color: "#065f46",
            padding: "6px 10px",
            borderRadius: 6,
            marginTop: 8,
            fontWeight: 600,
            textAlign: "center",
            transition: "opacity 0.3s",
          }}
        >
          {saveMessage}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <input
          type="number"
          placeholder="e.g., 60 for 400m"
          value={time}
          onChange={handleAdjustment}
          style={{
            width: "100%",
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />
      </div>

      {adjustedTime && (
        <p style={{ marginTop: 10, fontWeight: 500 }}>
          Adjusted {mode === "indoor" ? "Outdoor" : "Indoor"} Time:{" "}
          <b>{formatTime(adjustedTime)}</b>
        </p>
      )}

      {/* message */}
      {errorMessage && (
        <p style={{ color: "red", marginTop: 10, fontWeight: 600 }}>
          {errorMessage}
        </p>
      )}

      <hr style={{ margin: "30px 0" }} />

      {/* prediction */}
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
        Race Time Prediction
      </h3>

      <div>
        <label>Known Distance (m):</label>
        <input
          type="number"
          value={knownDistance}
          onChange={(e) => setKnownDistance(e.target.value)}
          style={{
            width: "100%",
            marginBottom: 10,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />

        <label>Known Time (s):</label>
        <input
          type="number"
          value={knownTime}
          onChange={(e) => setKnownTime(e.target.value)}
          style={{
            width: "100%",
            marginBottom: 10,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />

        <label>Target Distance (m):</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="number"
            value={targetDistance}
            onChange={(e) => setTargetDistance(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />
          <button
            onClick={handlePredict}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #10b981",
              background: "#10b981",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Predict Time
          </button>
        </div>
      </div>

      {predictedTime && (
        <p style={{ marginTop: 16, fontWeight: 600 }}>
          🏁 Predicted Time: <b>{formatTime(predictedTime)}</b>
        </p>
      )}
    </div>
  );
}
