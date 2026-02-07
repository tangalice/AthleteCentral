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

/**
 * Build dropdown menu items based on user role and sport.
 * Keeps all menu logic in one place for easy maintenance.
 */
function buildMenuItems(user) {
  const isCoach = user?.role === "coach";
  const isAthlete = user?.role === "athlete";
  const isRowing = user?.sport?.toLowerCase() === "rowing";
  const items = [];

  // ──────────────────────────────────────────────
  // TOP SECTION — Performance (shared priority items)
  // ──────────────────────────────────────────────
  items.push({ type: "header", label: "Performance" });
  items.push({ path: "/3-gun-testing", label: "3-Gun Testing", tab: "3-gun-testing" });

  if (isRowing) {
    items.push({ path: "/overview", label: "Attendance Overview", tab: "overview" });
  }

  // Athletes get Enter Practice; coaches don't
  if (isAthlete) {
    items.push({ path: "/practice-performances", label: "Enter Practice", tab: "practice-performances" });
  }

  items.push({ path: "/group-performance", label: "Group Performance", tab: "group-performance" });
  items.push({ path: "/individual-performance", label: "Individual Performance", tab: "individual-performance" });

  if (isRowing) {
    items.push({ path: "/split-calculator", label: "Split Calculator", tab: "split-calculator" });
  }

  // Coaches get Lineup Builder and Results up top
  if (isCoach) {
    if (isRowing) {
      items.push({ path: "/lineup-builder", label: "Lineup Builder", tab: "lineup-builder" });
    }
    items.push({ path: "/results", label: "Results", tab: "results" });
  }

  // ──────────────────────────────────────────────
  // ATHLETE SECTIONS
  // ──────────────────────────────────────────────
  if (isAthlete) {
    items.push({ type: "header", label: "My Training" });
    items.push({ path: "/log-workout", label: "Log Workout", tab: "log-workout" });
    items.push({ path: "/goals", label: "My Goals", tab: "goals" });
    items.push({ path: "/athlete-feedback", label: "My Feedback", tab: "athlete-feedback" });

    items.push({ type: "header", label: "Analytics" });
    items.push({ path: "/improvement-rates", label: "Improvement Rates", tab: "improvement-rates" });
    items.push({ path: "/team-rankings", label: "Team Rankings", tab: "team-rankings" });
    items.push({ path: "/team-personal-bests", label: "Team Personal Bests", tab: "team-personal-bests" });
    items.push({ path: "/similar-teammates", label: "Similar Teammates", tab: "similar-teammates" });

    items.push({ type: "header", label: "Tools" });
    items.push({ path: "/athlete-tools", label: "Tools", tab: "athlete-tools" });
    items.push({ path: "/predict-results", label: "Predict Results", tab: "predict-results" });
    items.push({ path: "/compare-results", label: "Compare Results", tab: "compare-results" });
    if (isRowing) {
      items.push({ path: "/weight-info", label: "Weight Info", tab: "weight-info" });
    }
  }

  // ──────────────────────────────────────────────
  // COACH SECTIONS
  // ──────────────────────────────────────────────
  if (isCoach) {
    items.push({ type: "header", label: "Team Management" });
    items.push({ path: "/view-athlete-goals", label: "View Athlete Goals", tab: "view-athlete-goals" });
    items.push({ path: "/suggest-goals", label: "Suggest Goals", tab: "suggest-goals" });
    items.push({ path: "/coach-feedback", label: "Give Feedback", tab: "coach-feedback" });
    items.push({ path: "/health-availability", label: "Health & Availability", tab: "health-availability" });
    items.push({ path: "/view-athlete-practices", label: "View Athlete Practices", tab: "view-athlete-practices" });
    if (isRowing) {
      items.push({ path: "/coach-weight-info", label: "Athlete Weights", tab: "coach-weight-info" });
    }

    items.push({ type: "header", label: "Analytics & Reports" });
    items.push({ path: "/coach-team-rankings", label: "Team Rankings", tab: "coach-team-rankings" });
    items.push({ path: "/team-personal-bests", label: "Team Personal Bests", tab: "team-personal-bests" });
    items.push({ path: "/improvement-rates", label: "Improvement Rates", tab: "improvement-rates" });
    items.push({ path: "/data-reports", label: "Data Reports", tab: "data-reports" });
    items.push({ path: "/coach-view-predictions", label: "Analyze Predictions", tab: "coach-view-predictions" });

    items.push({ type: "header", label: "Athlete Views" });
    items.push({ path: "/goals", label: "Goals Page", tab: "goals" });
    items.push({ path: "/practice-performances", label: "Practice Entry", tab: "practice-performances" });
    items.push({ path: "/teammate-comparison", label: "Teammate Comparison", tab: "teammate-comparison" });
    items.push({ path: "/similar-teammates", label: "Similar Teammates", tab: "similar-teammates" });
    items.push({ path: "/athlete-feedback", label: "Athlete Feedback View", tab: "athlete-feedback" });
    items.push({ path: "/predict-results", label: "Predict Results", tab: "predict-results" });
    items.push({ path: "/compare-results", label: "Compare Results", tab: "compare-results" });
    items.push({ path: "/athlete-tools", label: "Athlete Tools", tab: "athlete-tools" });
    items.push({ path: "/log-workout", label: "Log Workout", tab: "log-workout" });
  }

  // ──────────────────────────────────────────────
  // BOTTOM — always-visible extras
  // ──────────────────────────────────────────────
  items.push({ type: "header", label: "Other" });
  items.push({ path: "/activity", label: "Activity", tab: "activity" });
  items.push({ path: "/resources", label: "Resources", tab: "resources" });

  return items;
}

/** Collect all `tab` values so we can highlight the "More" button. */
function getAllDropdownTabs(user) {
  return buildMenuItems(user)
    .filter((i) => i.tab)
    .map((i) => i.tab);
}

function DropdownMenu({ user, activeTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const allTabs = getAllDropdownTabs(user);
  const isAnyActive = allTabs.includes(activeTab);

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
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const sectionHeaderStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: "#9ca3af",
    padding: "8px 16px 4px 16px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const menuItems = buildMenuItems(user);

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <button style={buttonStyle} onClick={() => setIsOpen(!isOpen)}>
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
        {menuItems.map((item, index) => {
          if (item.type === "header") {
            return (
              <div key={`header-${index}`} style={sectionHeaderStyle}>
                {item.label}
              </div>
            );
          }

          const isItemActive = activeTab === item.tab;
          return (
            <Link
              key={`${item.path}-${index}`}
              to={item.path}
              style={{
                ...dropdownItemStyle,
                color: isItemActive ? "#111827" : "#374151",
                fontWeight: isItemActive ? 600 : 400,
                backgroundColor: isItemActive ? "#f3f4f6" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isItemActive) e.target.style.backgroundColor = "#f9fafb";
              }}
              onMouseLeave={(e) => {
                if (!isItemActive) e.target.style.backgroundColor = "transparent";
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
  userSport,
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
          <Link to="/calendar" style={linkStyle(activeTab === "calendar")}>
            Calendar
          </Link>

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