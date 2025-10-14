// src/components/settings/SessionsManager.jsx
import { useState } from "react";
import { Link } from "react-router-dom";

export default function SessionsManager() {
  const [sessions, setSessions] = useState([
    { id: "device1", name: "Chrome on Windows", lastActive: "Active now" },
    { id: "device2", name: "iPhone Safari", lastActive: "2 hours ago" },
    { id: "device3", name: "iPad Chrome", lastActive: "Yesterday" },
  ]);

  const handleLogout = (id) => {
    setSessions(sessions.filter((s) => s.id !== id));
    alert(`Session ${id} logged out`);
  };

  const handleLogoutAll = () => {
    setSessions([]);
    alert("All sessions logged out");
  };

  return (
    <div style={{ padding: "20px" }}>
      <Link
        to="/settings"
        style={{
          color: "#646cff",
          textDecoration: "none",
          marginBottom: "20px",
          display: "inline-block",
        }}
      >
        ← Back to Settings
      </Link>

      <h2 style={{ color: "#333", marginBottom: "30px" }}>Active Sessions</h2>

      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        {sessions.length > 0 ? (
          <>
            {sessions.map((session) => (
              <div
                key={session.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "15px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  marginBottom: "15px",
                  backgroundColor: "#f9f9f9",
                }}
              >
                <div>
                  <p
                    style={{
                      margin: "0",
                      fontWeight: "bold",
                      color: "#333",
                    }}
                  >
                    {session.name}
                  </p>
                  <p
                    style={{
                      margin: "5px 0 0 0",
                      color: "#666",
                      fontSize: "14px",
                    }}
                  >
                    {session.lastActive}
                  </p>
                </div>
                <button
                  onClick={() => handleLogout(session.id)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#ff4444",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                >
                  Logout
                </button>
              </div>
            ))}

            <button
              onClick={handleLogoutAll}
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "20px",
                backgroundColor: "#d32f2f",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              Logout All Sessions
            </button>
          </>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: "#999",
            }}
          >
            No active sessions found
          </div>
        )}
      </div>
    </div>
  );
}