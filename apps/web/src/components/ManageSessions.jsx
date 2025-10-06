import { useState } from "react";

export default function ManageSessions() {
  const [sessions, setSessions] = useState([
    { id: "device1", name: "Chrome on Windows" },
    { id: "device2", name: "iPhone Safari" },
  ]);

  const handleLogout = (id) => {
    alert(`Logged out from ${id}`);
    setSessions(sessions.filter(s => s.id !== id));
  };

  const handleLogoutAll = () => {
    alert("Logged out from all devices");
    setSessions([]);
  };

  return (
    <div>
      <h3>Active Sessions</h3>
      <ul>
        {sessions.map((s) => (
          <li key={s.id}>
            {s.name} <button onClick={() => handleLogout(s.id)}>Logout</button>
          </li>
        ))}
      </ul>
      <button onClick={handleLogoutAll}>Logout All Sessions</button>
    </div>
  );
}
