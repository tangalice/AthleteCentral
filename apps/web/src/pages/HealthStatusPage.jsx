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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Athlete Health Status</h1>
      <button
        onClick={() => setTeamId("")} 
        className="mb-4 px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
      >
        ← Back to Health Status
      </button>

      {loading && <p className="text-gray-500">Loading your teams…</p>}

      {teamId && !loading && <HealthStatusManager teamId={teamId} />}

      {!teamId && !loading && teams.length > 1 && (
        <div className="space-y-3">
          <p className="text-gray-600">Select a team to manage health status:</p>
          <select
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            onChange={(e) => setTeamId(e.target.value)}
            defaultValue=""
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
        <p className="text-gray-500">No team selected — and no teams found for your coach account.</p>
      )}
    </div>
  );
}
