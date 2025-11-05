// src/pages/HealthStatusPage.jsx
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import HealthStatusManager from "../components/HealthStatusManager";
import { useNavigate } from "react-router-dom";


export default function HealthStatusPage() {
  const location = useLocation();
  const teamIdFromState = location.state?.teamId;
  const teamIdFromQuery = new URLSearchParams(location.search).get("teamId");
  const navigate = useNavigate();
  const [teamId, setTeamId] = useState(teamIdFromState || teamIdFromQuery || "");
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]); // {id, name}

  useEffect(() => {
    if (teamId) return;

    const fetchTeamsForCoach = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        const teamsQ = query(
          collection(db, "teams"),
          where("coaches", "array-contains", auth.currentUser.uid)
        );
        const snap = await getDocs(teamsQ);
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));

        if (list.length === 1) {
          setTeamId(list[0].id);
        } else if (list.length > 1) {
          setTeams(list.map(t => ({ id: t.id, name: t.name || t.teamName || t.id })));
        } else {
          setTeams([]); // 
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTeamsForCoach();
  }, [teamId]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
        Manage Athlete Health Status
      </h1>
      <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 16 }}>
        Select a team to view and update athlete health
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {teamId && (
          <button
            onClick={() => setTeamId("")}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              backgroundColor: "#f9fafb",
              color: "#374151",
              fontSize: 14,
              cursor: "pointer"
            }}
          >
            ← Back to team selection
          </button>
        )}

        {loading && (
          <span style={{ alignSelf: "center", fontSize: 14, color: "#6b7280" }}>Loading your teams…</span>
        )}
      </div>

      {teamId && !loading && (
        <div style={{
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          backgroundColor: "#fff",
          marginBottom: 20
        }}>
          <HealthStatusManager teamId={teamId} />
        </div>
      )}

      {!teamId && !loading && teams.length > 1 && (
        <div style={{
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          backgroundColor: "#fff",
        }}>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 10 }}>
            Select a team to manage health status:
          </div>
          <select
            onChange={(e) => setTeamId(e.target.value)}
            defaultValue=""
            style={{
              padding: "10px 12px",
              fontSize: 14,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              backgroundColor: "#fff",
              cursor: "pointer"
            }}
          >
            <option value="" disabled>Choose a team…</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!teamId && !loading && teams.length === 0 && (
        <div style={{
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          backgroundColor: "#fff",
          color: "#6b7280",
          fontSize: 14
        }}>
          No team selected — and no teams found for your coach account.
        </div>
      )}
    </div>
  );
}
