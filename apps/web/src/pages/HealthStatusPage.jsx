import React from "react";
import { useLocation } from "react-router-dom";
import HealthStatusManager from "../components/HealthStatusManager";

export default function HealthStatusPage() {
  const location = useLocation();
  const teamIdFromState = location.state?.teamId;
  const teamIdFromQuery = new URLSearchParams(location.search).get("teamId");
  const teamId = teamIdFromState || teamIdFromQuery || "";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Athlete Health Status</h1>
      {teamId ? (
        <HealthStatusManager teamId={teamId} />
      ) : (
        <p className="text-gray-500">No team selected.</p>
      )}
    </div>
  );
}
