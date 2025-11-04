// src/components/TopBar.jsx
import { useState, useEffect, useRef } from "react";
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

function DropdownMenu({ user, activeTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Check if any dropdown item is active
  const isAnyActive = 
    activeTab === "activity" ||
    activeTab === "athlete-tools" ||
    activeTab === "results" ||
    activeTab === "goals" ||
    activeTab === "view-athlete-goals" ||
    activeTab === "athlete-feedback" ||
    activeTab === "coach-feedback" ||
    activeTab === "suggest-goals" ||
    activeTab === "health-availability";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const buttonStyle = {
    textDecoration: "none",
    color: isAnyActive ? "#111827" : "#6b7280",
    fontSize: 16,
    fontWeight: isAnyActive ? 700 : 500,
    padding: "8px 10px",
    borderBottom: isAnyActive ? "3px solid #111827" : "3px solid transparent",
    cursor: "pointer",
    background: "none",
    border: "none",
    display: "flex",
    alignItems: "center",
    gap: 4,
  };

  const dropdownMenuStyle = {
    position: "absolute",
    top: "100%",
    left: 0,
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    minWidth: "180px",
    marginTop: "4px",
    zIndex: 1000,
    display: isOpen ? "flex" : "none",
    flexDirection: "column",
    padding: "4px 0",
  };

  const dropdownItemStyle = {
    textDecoration: "none",
    color: "#374151",
    fontSize: 14,
    padding: "10px 16px",
    display: "block",
    transition: "background-color 0.2s",
  };

  // Build menu items based on user role
  const menuItems = [];
  
  // Activity - Available to both
  menuItems.push({ path: "/activity", label: "Activity", activeTab: "activity" });
  
  // Tools - Athlete only
  if (user?.role === "athlete") {
    menuItems.push({ path: "/athlete-tools", label: "Tools", activeTab: "athlete-tools" });
  }
  
  // Results - Available to both
  menuItems.push({ path: "/results", label: "Results", activeTab: "results" });
  
  // Goals - Different for coach vs athlete
  if (user?.role === "athlete") {
    menuItems.push({ path: "/goals", label: "Goals", activeTab: "goals" });
  } else if (user?.role === "coach") {
    menuItems.push({ path: "/view-athlete-goals", label: "View Athlete Goals", activeTab: "view-athlete-goals" });
    menuItems.push({ path: "/suggest-goals", label: "Suggest Goals", activeTab: "suggest-goals" });
  }
  
  // Feedback - Different for coach vs athlete
  if (user?.role === "athlete") {
    menuItems.push({ path: "/athlete-feedback", label: "Feedback", activeTab: "athlete-feedback" });
  } else if (user?.role === "coach") {
    menuItems.push({ path: "/coach-feedback", label: "Give Feedback", activeTab: "coach-feedback" });
  }
  
  // Health and Availability - Available to both
  menuItems.push({ path: "/health-availability", label: "Health and Availability", activeTab: "health-availability" });

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <button
        style={buttonStyle}
        onClick={() => setIsOpen(!isOpen)}
      >
        More
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div style={dropdownMenuStyle}>
        {menuItems.map((item) => {
          const isItemActive = activeTab === item.activeTab;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...dropdownItemStyle,
                color: isItemActive ? "#111827" : "#374151",
                fontWeight: isItemActive ? 600 : 400,
                backgroundColor: isItemActive ? "#f3f4f6" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isItemActive) {
                  e.target.style.backgroundColor = "#f9fafb";
                }
              }}
              onMouseLeave={(e) => {
                if (!isItemActive) {
                  e.target.style.backgroundColor = "transparent";
                }
              }}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function TopBar({ 
  showNav = false, 
  activeTab = "dashboard", 
  onLogout, 
  user,
  userRole,
  userSport
}) {
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

          {/* CALENDAR TAB - Available to BOTH */}
          <Link to="/calendar" style={linkStyle(activeTab === "calendar")}>
            Calendar
          </Link>

          {/* HEALTH STATUS TAB - Coach only */}
          {user?.role === "coach" && (
            <Link to="/health-status" style={linkStyle(activeTab === "health-status")}>
              Health Status
            </Link>
          )}

          {/* DROPDOWN MENU - Replaces Activity, Tools, Results, Goals, and Feedback */}
          <DropdownMenu user={user} activeTab={activeTab} />

          {/* Coach-only tabs */}
          {user?.role === "coach" && (
            <Link to="/data-reports" style={linkStyle(activeTab === "data-reports")}>
              Data Reports
            </Link>
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