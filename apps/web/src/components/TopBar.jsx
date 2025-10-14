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

export default function TopBar({ showNav = false, activeTab = "dashboard", onLogout, user }) {
  const linkStyle = (isActive) => ({
    textDecoration: "none",
    color: isActive ? "#111827" : "#6b7280",
    fontSize: 16,
    fontWeight: isActive ? 700 : 500,
    padding: "8px 10px",
    borderBottom: isActive ? "3px solid #111827" : "3px solid transparent",
  });

  const btnBase = {
    padding: "8px 12px",
    backgroundColor: "#ffffff",
    color: "#111827",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "all .16s ease",
  };

  const btnHover = {
    backgroundColor: "#F3F4F6", // gray-100
    borderColor: "#D1D5DB",     // gray-300
  };

  const btnFocus = {
    outline: "none",
    boxShadow: "0 0 0 3px rgba(16,185,129,.25)", // emerald ring
  };

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
          <Link to="/dashboard" style={linkStyle(activeTab === "dashboard")}>Dashboard</Link>
          <Link to="/profile"   style={linkStyle(activeTab === "profile")}>Profile</Link>
          <Link to="/messages"  style={linkStyle(activeTab === "messages")}>Messages</Link>
          <Link to="/settings"  style={linkStyle(activeTab === "settings")}>Settings</Link>
        </nav>
      ) : <div />}

      {user && user.emailVerified ? (
        <button
          onClick={onLogout}
          style={btnBase}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...btnBase, ...btnHover })}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, btnBase)}
          onFocus={(e) => Object.assign(e.currentTarget.style, { ...btnBase, ...btnFocus })}
          onBlur={(e) => Object.assign(e.currentTarget.style, btnBase)}
          aria-label="Log out"
        >
          Logout
        </button>
      ) : null}
    </header>
  );
}
