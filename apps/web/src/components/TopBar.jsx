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
    activeTab === "practice-performances" ||
    activeTab === "view-athlete-goals" ||
    activeTab === "athlete-feedback" ||
    activeTab === "coach-feedback" ||
    activeTab === "suggest-goals" ||
    activeTab === "health-availability" ||
    activeTab === "group-performance" ||
    activeTab === "individual-performance" ||
    activeTab === "lineup-builder" ||
    activeTab === "split-calculator" || 
    activeTab === "data-reports" ||
    activeTab === "coach-view-predictions" ||
    activeTab === "teammate-comparison" ||
    activeTab === "improvement-rates" ||
    activeTab === "team-rankings" ||
    activeTab === "coach-team-rankings" ||
    activeTab === "similar-teammates" ||
    activeTab === "view-athlete-practices" ||
    activeTab === "weight-info" ||
    activeTab === "coach-weight-info" ||
    activeTab === "log-workout";

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
    minWidth: "220px",
    marginTop: "4px",
    zIndex: 1000,
    display: isOpen ? "flex" : "none",
    flexDirection: "column",
    padding: "4px 0",
    maxHeight: "400px",
    overflowY: "auto",
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
  
  // Log Workout - Athlete only
  if (user?.role === "athlete") {
    menuItems.push({ path: "/log-workout", label: "Log Workout", activeTab: "log-workout" });
  }

  //Athlete only
  if (user?.role === "athlete") {
    menuItems.push({ path: "/improvement-rates", label: "Improvement Rates", activeTab: "improvement-rates" });
  }
  
  // Results - Available to both
  menuItems.push({ path: "/results", label: "Results", activeTab: "results" });

  if (user?.role === "athlete") {
    menuItems.push({ path: "/team-rankings", label: "Team Rankings", activeTab: "team-rankings" });
  } else if (user?.role === "coach") {
    menuItems.push({ path: "/coach-team-rankings", label: "Team Rankings", activeTab: "coach-team-rankings" });
  }

  
  // Goals - Different for coach vs athlete
  if (user?.role === "athlete") {
    menuItems.push({ path: "/goals", label: "Goals", activeTab: "goals" });
    menuItems.push({ path: "/practice-performances", label: "Enter Practice", activeTab: "practice-performances" });
    menuItems.push({ path: "/weight-info", label: "Weight Info", activeTab: "weight-info" });
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

  
  
  // Coach-only management links
  if (user?.role === "coach") {
    menuItems.push({ path: "/health-availability", label: "Health and Availability", activeTab: "health-availability" });
    menuItems.push({ path: "/data-reports", label: "Data Reports", activeTab: "data-reports" });
    menuItems.push({ path: "/view-athlete-practices", label: "View Athlete Practices", activeTab: "view-athlete-practices" });
    menuItems.push({ path: "/coach-weight-info", label: "Athlete Weights", activeTab: "coach-weight-info" });

    menuItems.push({ path: "/coach-view-predictions", label: "Predicted Results", activeTab: "coach-view-predictions" });
    
    // Lineup Builder - Only for rowing coaches
    if (user?.sport?.toLowerCase() === "rowing") {
      menuItems.push({ path: "/lineup-builder", label: "Lineup Builder", activeTab: "lineup-builder" });
    }
  }

  if (user?.role === "athlete") {
    menuItems.push({ path: "/athlete-tools", label: "Tools", activeTab: "athlete-tools" });
    menuItems.push({ path: "/predict-results", label: "Predict Results", activeTab: "predict-results" });
    menuItems.push({ path: "/compare-results", label: "Compare Results", activeTab: "compare-results" });
    menuItems.push({ path: "/similar-teammates", label: "Similar Teammates", activeTab: "similar-teammates" });
    menuItems.push({ path: "/teammate-comparison", label: "Teammate Comparison", activeTab: "teammate-comparison" }); // ADD THIS LINE
  }

  
  
  // Group Performance - Available to both
  menuItems.push({ path: "/group-performance", label: "Group Performance", activeTab: "group-performance" });
  
  // Individual Performance - Available to both
  menuItems.push({ path: "/individual-performance", label: "Individual Performance", activeTab: "individual-performance" });
  
  // Split Calculator - Only for rowing users
  if (user?.sport?.toLowerCase() === "rowing") {
    menuItems.push({ path: "/split-calculator", label: "Split Calculator", activeTab: "split-calculator" });
  }

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

          {/* DROPDOWN MENU - Consolidated more items */}
          <DropdownMenu user={user} activeTab={activeTab} />

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