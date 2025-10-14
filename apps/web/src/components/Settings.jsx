// src/components/Settings.jsx
import { Routes, Route, Link } from "react-router-dom";
import DeleteAccount from "./settings/DeleteAccount";
import EditProfile from "./settings/EditProfile";
import ChangePassword from "./settings/ChangePassword";
import SessionsManager from "./settings/SessionsManager";

/** Simple list item with theme-consistent styles */
function MenuLink({ to, children }) {
  const base = {
    display: "block",
    textDecoration: "none",
    color: "#111827",               // gray-900
    fontSize: 18,
    fontWeight: 600,
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid transparent",
    transition: "all .18s ease",
  };
  const hover = {
    background: "#F9FAFB",          // gray-50
    border: "1px solid #E5E7EB",    // gray-200
    transform: "translateY(-1px)",
    boxShadow: "0 1px 2px rgba(0,0,0,.04)",
  };
  const focus = {
    outline: "none",
    boxShadow: "0 0 0 3px rgba(16,185,129,.25)", // emerald-500 @ 25%
  };

  return (
    <Link
      to={to}
      style={base}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, hover)}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, base)}
      onFocus={(e) => Object.assign(e.currentTarget.style, { ...base, ...focus })}
      onBlur={(e) => Object.assign(e.currentTarget.style, base)}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        {children}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 5l7 7-7 7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}

// Settings Menu
function SettingsMenu() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ maxWidth: 640, margin: "28px auto 0" }}>
        <h2 style={{ margin: "0 0 12px", color: "#111827" }}>Settings</h2>
        <p style={{ marginTop: 0, color: "#6B7280" }}>
          Manage your profile, password, sessions, and account preferences.
        </p>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <MenuLink to="/settings/edit-profile">Edit Profile</MenuLink>
          <MenuLink to="/settings/change-password">Change Password</MenuLink>
          <MenuLink to="/settings/manage-sessions">Manage Sessions</MenuLink>

          <div style={{ borderTop: "1px solid #E5E7EB", margin: "8px 0" }} />
          <MenuLink to="/settings/delete-account">Delete Account</MenuLink>
        </div>
      </div>
    </div>
  );
}

// Main Settings Component
export default function Settings({ user }) {
  return (
    <Routes>
      <Route path="/" element={<SettingsMenu />} />
      <Route path="edit-profile" element={<EditProfile />} />
      <Route path="change-password" element={<ChangePassword user={user} />} />
      <Route path="manage-sessions" element={<SessionsManager />} />
      <Route path="delete-account" element={<DeleteAccount />} />
    </Routes>
  );
}
