// src/pages/AthleteToolsPage.jsx
import React from "react";
import TrackField from "../components/TrackField";

export default function AthleteToolsPage() {
  return (
    <div className="container" style={{ padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20 }}>
        Athlete Tools ⚙️
      </h1>
      <p className="text-muted" style={{ marginBottom: 30 }}>
        Access sport-specific performance calculators and prediction tools.
      </p>

      {/* Track & Field Section */}
      <div
        className="card"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
          background: "#fff",
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            fontSize: 22,
            marginBottom: 16,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          Track & Field 🏃
        </h2>
        <TrackField />
      </div>
    </div>
  );
}
