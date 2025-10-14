// src/components/Dashboard.jsx
import { useLoaderData } from "react-router-dom";

export default function Dashboard({ userRole, user }) {
  const data = useLoaderData(); // unchanged
  const displayName = data?.displayName || user?.email || "";

  // helpers for tiny color accents
  const brand = "var(--brand-primary)";       // #10b981
  const brandTint = "var(--brand-primary-50)"; // #ecfdf5
  const ink900 = "#111827";

  const cardBase = {
    textAlign: "center",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
    background: "#fff",
    transition: "background .18s ease, border-color .18s ease, transform .18s ease, box-shadow .18s ease",
  };

  const onHover = (e) => {
    e.currentTarget.style.background = brandTint;
    e.currentTarget.style.borderColor = "#a7f3d0"; // emerald-200
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 2px 6px rgba(16,185,129,.12)";
  };
  const offHover = (e) => {
    Object.assign(e.currentTarget.style, cardBase);
  };

  const profileDone = !!data?.raw?.profileComplete;
  const statusColor = profileDone ? brand : "#d97706"; // amber-600 for "Incomplete"
  const statusText = profileDone ? "Complete" : "Incomplete";
  const statusMark = profileDone ? "✓" : "!";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 300 }}>
        {/* Title with subtle brand accent bar */}
        <h2
          style={{
            fontSize: 28,
            marginBottom: 8,
            fontWeight: 800,
            color: ink900,
          }}
        >
          Welcome back, {displayName}!
        </h2>
        <p className="text-muted" style={{ fontSize: 18, marginBottom: 16 }}>
          {userRole === "athlete" ? "Athlete" : userRole === "coach" ? "Coach" : "User"} Dashboard
        </p>
        <div
          style={{
            height: 4,
            width: 120,
            background: brand,
            borderRadius: 999,
            opacity: 0.25,
            marginBottom: 12,
          }}
        />

        {/* Quick Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 16,
            width: "100%",
            maxWidth: 1000,
          }}
        >
          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
          >
            <h3 style={{ marginBottom: 8, color: ink900 }}>Training Sessions</h3>
            <p style={{ fontSize: 36, fontWeight: 800, margin: "6px 0", color: brand }}>0</p>
            <p className="text-muted">This Week</p>
          </div>

          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
          >
            <h3 style={{ marginBottom: 8, color: ink900 }}>Messages</h3>
            <p style={{ fontSize: 36, fontWeight: 800, margin: "6px 0", color: brand }}>0</p>
            <p className="text-muted">Unread</p>
          </div>

          <div
            className="card"
            style={{ ...cardBase }}
            onMouseEnter={onHover}
            onMouseLeave={offHover}
          >
            <h3 style={{ marginBottom: 8, color: ink900 }}>Profile</h3>
            <p style={{ fontSize: 36, fontWeight: 800, margin: "6px 0", color: statusColor }}>{statusMark}</p>
            <p className="text-muted">{statusText}</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ marginTop: 32, width: "100%", maxWidth: 1000 }}>
          <h3 style={{ fontSize: 20, marginBottom: 12, color: ink900, fontWeight: 800 }}>Recent Activity</h3>
          <div className="card" style={{ borderColor: "var(--border)" }}>
            <p className="text-muted" style={{ textAlign: "center" }}>No recent activity to display</p>
          </div>
        </div>
      </div>
    </div>
  );
}
