// src/components/Settings.jsx
import { Routes, Route, Link } from "react-router-dom";
import DeleteAccount from "./settings/DeleteAccount";
import EditProfile from "./settings/EditProfile";
import ChangePassword from "./settings/ChangePassword";
import SessionsManager from "./settings/SessionsManager";
import Notifications from "./settings/Notifications";

/** Reusable settings link styled with index.css helpers */
function MenuItem({ to, label }) {
  return (
    <Link to={to} className="card" style={{ padding: 14, display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 5l7 7-7 7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  );
}

function SettingsMenu({ user }) {
  const userRole = user?.role;
  const isCoach = userRole === "coach";
  
  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
      <div style={{ maxWidth: 640, margin: "28px auto 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Settings</h2>
          <div 
            style={{ 
              padding: "4px 12px", 
              borderRadius: "20px", 
              fontSize: "12px", 
              fontWeight: "600", 
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              background: isCoach ? "#3b82f6" : "#10b981",
              color: "white"
            }}
          >
            {isCoach ? "Coach" : "Athlete"}
          </div>
        </div>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          Manage your profile, password, sessions, and account preferences.
        </p>

                 <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                   <MenuItem to="/settings/edit-profile" label="Edit Profile" />
                   <MenuItem to="/settings/change-password" label="Change Password" />
                   <MenuItem to="/settings/manage-sessions" label="Manage Sessions" />
                   <MenuItem to="/settings/notifications" label="Notifications" />

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

          {/* Keep danger action neutral here; emphasize danger on the page itself */}
          <Link to="/settings/delete-account" className="card" style={{ padding: 14, display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontWeight: 700 }} className="text-danger">Delete Account</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 5l7 7-7 7" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Settings({ user }) {
  return (
             <Routes>
               <Route path="/" element={<SettingsMenu user={user} />} />
               <Route path="edit-profile" element={<EditProfile user={user} />} />
               <Route path="change-password" element={<ChangePassword user={user} />} />
               <Route path="manage-sessions" element={<SessionsManager />} />
               <Route path="notifications" element={<Notifications />} />
               <Route path="delete-account" element={<DeleteAccount />} />
             </Routes>
  );
}
