// src/components/settings/SessionsManager.jsx
import { useState } from "react";
import { Link } from "react-router-dom";

export default function SessionsManager() {
  const [sessions, setSessions] = useState([
    { id: "device1", name: "Chrome on Windows", lastActive: "Active now" },
    { id: "device2", name: "iPhone Safari", lastActive: "2 hours ago" },
    { id: "device3", name: "iPad Chrome", lastActive: "Yesterday" },
  ]);
  const [message, setMessage] = useState("");

  const handleLogout = (id) => {
    const target = sessions.find((s) => s.id === id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setMessage(target ? `Signed out: ${target.name}` : "Session signed out");
    setTimeout(() => setMessage(""), 2500);
  };

  const handleLogoutAll = () => {
    setSessions([]);
    setMessage("All sessions have been signed out");
    setTimeout(() => setMessage(""), 2500);
  };

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
      <Link to="/settings" className="text-primary" style={{ display: "inline-block", marginBottom: 16 }}>
        ← Back to Settings
      </Link>

      <div className="card" style={{ maxWidth: 680, margin: "0 auto" }}>
        <h2 className="mb-2">Active Sessions</h2>
        <p className="text-muted mb-3">
          Manage where your account is signed in. You can sign out individual devices or all sessions.
        </p>

        {message && (
          <div className="alert alert-success" role="status" style={{ marginBottom: 16 }}>
            {message}
          </div>
        )}

        {sessions.length > 0 ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="card"
                  style={{
                    padding: 16,
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{session.name}</div>
                    <div className="text-muted" style={{ marginTop: 4, fontSize: 14 }}>
                      {session.lastActive}
                    </div>
                  </div>
                  <button className="btn btn-outline" onClick={() => handleLogout(session.id)}>
                    Sign out
                  </button>
                </div>
              ))}
            </div>

            <button
              className="btn btn-danger"
              onClick={handleLogoutAll}
              style={{ width: "100%", marginTop: 16 }}
            >
              Sign out of all sessions
            </button>
          </>
        ) : (
          <div className="card" style={{ textAlign: "center" }}>
            <div className="text-muted">No active sessions found</div>
          </div>
        )}
      </div>
    </div>
  );
}
