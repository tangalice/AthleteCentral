// src/components/TopBar.jsx
import { Link } from "react-router-dom";

function BrandMark({ size = 28, textSize = 22 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="2" />
        <path d="M4 12c6 0 6-8 16-8" stroke="#10b981" strokeWidth="2" />
        <path d="M4 12c6 0 6 8 16 8" stroke="#10b981" strokeWidth="2" />
      </svg>
      <span
        style={{
          fontSize: textSize,
          fontWeight: 800,
          letterSpacing: 0.2,
          background: "linear-gradient(90deg,#0f172a,#10b981)",
          WebkitBackgroundClip: "text",
          color: "transparent",
          lineHeight: 1,
        }}
      >
        Athlete Hub
      </span>
    </div>
  );
}

export default function TopBar({ 
  showNav = false, 
  activeTab = "dashboard", 
  onLogout, 
  user, 
  userRole, 
}) {
  // keep minimal inline for active underline; colors align with index.css variables
  const linkStyle = (isActive) => ({
    textDecoration: "none",
    color: isActive ? "#111827" : "#6b7280",
    fontSize: 16,
    fontWeight: isActive ? 700 : 500,
    padding: "8px 10px",
    borderBottom: isActive ? "3px solid #111827" : "3px solid transparent",
  });

  return (
    <header
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <BrandMark />
      
      {showNav ? (
        <nav style={{ display: "flex", gap: 24 }}>
          <Link to="/dashboard" style={linkStyle(activeTab === "dashboard")}>
            Dashboard
          </Link>
          <Link to="/profile" style={linkStyle(activeTab === "profile")}>
            Profile
          </Link>
          <Link to="/messages" style={linkStyle(activeTab === "messages")}>
            Messages
          </Link>
          <Link to="/teams" style={linkStyle(activeTab === "teams")}>
            Teams
          </Link>

          {/* RESULTS TAB - Available to BOTH athletes and coaches */}
          <Link to="/results" style={linkStyle(activeTab === "results")}>
            Results
          </Link>

          {/* Athlete-only tabs */}
          {user?.role === "athlete" && (
            <>
              <Link to="/goals" style={linkStyle(activeTab === "goals")}>
                Goals
              </Link>
              <Link to="/athlete-feedback" style={linkStyle(activeTab === "athlete-feedback")}>
                Feedback
              </Link>
            </>
          )}

          {/* Coach-only tabs */}
          {user?.role === "coach" && (
            <>
              <Link to="/suggest-goals" style={linkStyle(activeTab === "suggest-goals")}>
                Suggest Goals
              </Link>
              <Link to="/coach-feedback" style={linkStyle(activeTab === "coach-feedback")}>
                Give Feedback
              </Link>
            </>
          )}

          <Link to="/settings" style={linkStyle(activeTab === "settings")}>
            Settings
          </Link>
        </nav>
      ) : (
        <div />
      )}

      {user && user.emailVerified ? (
        <button
          className="btn btn-outline"
          onClick={onLogout}
          aria-label="Log out"
        >
          Logout
        </button>
      ) : null}
    </header>
  );
}