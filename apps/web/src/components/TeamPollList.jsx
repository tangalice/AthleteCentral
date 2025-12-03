// src/components/TeamPollList.jsx
// User Story #68 - Coach views all polls with real-time results
// Uses 'teamPolls' collection

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

export default function TeamPollList() {
  const navigate = useNavigate();

  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [teams, setTeams] = useState([]);
  const [filter, setFilter] = useState("all"); // all, open, closed
  const [expandedPoll, setExpandedPoll] = useState(null);

  // Check user role and load teams
  useEffect(() => {
    const init = async () => {
      if (!auth.currentUser) return;

      // Get user role
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserRole(userDoc.data().role);
      }

      // Get coach's teams
      const teamsQuery = query(
        collection(db, "teams"),
        where("coaches", "array-contains", auth.currentUser.uid)
      );
      const teamsSnap = await getDocs(teamsQuery);
      const teamsData = teamsSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
      }));
      setTeams(teamsData);
    };

    init();
  }, []);

  // Load polls in real-time
  useEffect(() => {
    if (!auth.currentUser) return;

    // Query polls created by this coach from 'teamPolls' collection
    const pollsRef = collection(db, "teamPolls");
    const pollsQuery = query(
      pollsRef, 
      where("createdBy", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(pollsQuery, async (snapshot) => {
      const pollsData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // Auto-close expired polls
      const now = new Date();
      for (const poll of pollsData) {
        const deadline = poll.deadline?.toDate ? poll.deadline.toDate() : null;
        if (deadline && deadline < now && poll.status === "open") {
          // Auto close
          try {
            await updateDoc(doc(db, "teamPolls", poll.id), { status: "closed" });
          } catch (e) {
            console.error("Failed to auto-close poll:", e);
          }
        }
      }

      setPolls(pollsData);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Filter polls
  const filteredPolls = polls.filter((poll) => {
    if (filter === "all") return true;

    const deadline = poll.deadline?.toDate ? poll.deadline.toDate() : null;
    const isPast = deadline ? deadline < new Date() : false;
    const isClosed = poll.status === "closed" || isPast;

    if (filter === "open") return !isClosed;
    if (filter === "closed") return isClosed;
    return true;
  });

  // Get team name by ID
  const getTeamNames = (teamIds) => {
    if (!Array.isArray(teamIds)) return "Unknown";
    return teamIds
      .map((id) => {
        const team = teams.find((t) => t.id === id);
        return team ? team.name : id.slice(0, 6) + "...";
      })
      .join(", ");
  };

  // Get status info
  const getStatusInfo = (poll) => {
    const deadline = poll.deadline?.toDate ? poll.deadline.toDate() : null;
    const now = new Date();

    if (poll.status === "closed") {
      return { text: "Closed", bg: "#fee2e2", color: "#dc2626" };
    }

    if (deadline && deadline < now) {
      return { text: "Ended", bg: "#fee2e2", color: "#dc2626" };
    }

    if (deadline) {
      const diffMs = deadline - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours <= 24) {
        return { text: "Closing Soon", bg: "#fef3c7", color: "#d97706" };
      }
    }

    return { text: "Open", bg: "#dcfce7", color: "#16a34a" };
  };

  // Format deadline
  const formatDeadline = (deadline) => {
    if (!deadline) return "No deadline";
    const date = deadline.toDate ? deadline.toDate() : new Date(deadline);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Close poll manually
  const handleClosePoll = async (pollId, e) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "teamPolls", pollId), { status: "closed" });
    } catch (error) {
      console.error("Error closing poll:", error);
    }
  };

  if (userRole !== "coach") {
    return (
      <div className="container" style={{ padding: 24, textAlign: "center" }}>
        <p>Only coaches can manage team polls.</p>
        <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h2 style={{ marginBottom: 4 }}>🗳️ Team Polls</h2>
            <p className="text-muted">Create and manage team voting activities</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/create-team-poll")}
          >
            ➕ Create New Poll
          </button>
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            borderBottom: "1px solid var(--border)",
            paddingBottom: 12,
          }}
        >
          {["all", "open", "closed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: filter === f ? "var(--brand-primary)" : "transparent",
                color: filter === f ? "white" : "var(--ink-600)",
                fontWeight: filter === f ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Polls List */}
        {loading ? (
          <p className="text-muted" style={{ textAlign: "center", padding: 40 }}>
            Loading polls...
          </p>
        ) : filteredPolls.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <p className="text-muted">
              {filter === "all"
                ? "No polls created yet."
                : `No ${filter} polls.`}
            </p>
            {filter === "all" && (
              <button
                className="btn btn-primary"
                onClick={() => navigate("/create-team-poll")}
                style={{ marginTop: 16 }}
              >
                Create Your First Poll
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filteredPolls.map((poll) => {
              const status = getStatusInfo(poll);
              const isExpanded = expandedPoll === poll.id;

              return (
                <div
                  key={poll.id}
                  className="card"
                  style={{ padding: 20, cursor: "pointer" }}
                  onClick={() => setExpandedPoll(isExpanded ? null : poll.id)}
                >
                  {/* Poll Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <h3 style={{ margin: 0 }}>{poll.title}</h3>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            background: status.bg,
                            color: status.color,
                          }}
                        >
                          {status.text}
                        </span>
                      </div>

                      {poll.description && (
                        <p className="text-muted" style={{ margin: "8px 0", fontSize: 14 }}>
                          {poll.description}
                        </p>
                      )}

                      <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--ink-500)", marginTop: 8 }}>
                        <span>🗳️ {poll.totalVotes || 0} votes</span>
                        <span>📋 {poll.options?.length || 0} options</span>
                        <span>⏰ {formatDeadline(poll.deadline)}</span>
                        <span>👥 {getTeamNames(poll.teamIds)}</span>
                      </div>
                    </div>

                    {/* Vote Count Badge */}
                    <div
                      style={{
                        textAlign: "center",
                        padding: "8px 16px",
                        background: "#f3f4f6",
                        borderRadius: 8,
                        minWidth: 80,
                      }}
                    >
                      <p style={{ fontSize: 24, fontWeight: 700, color: "var(--brand-primary)", margin: 0 }}>
                        {poll.totalVotes || 0}
                      </p>
                      <p className="text-muted" style={{ fontSize: 11, margin: 0 }}>votes</p>
                    </div>
                  </div>

                  {/* Expanded Results */}
                  {isExpanded && (
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                      <h4 style={{ marginBottom: 16 }}>📊 Real-time Results</h4>

                      {poll.options?.map((option, idx) => {
                        const voteCount = poll.voteCounts?.[idx] || 0;
                        const total = poll.totalVotes || 0;
                        const percentage = total > 0 ? Math.round((voteCount / total) * 100) : 0;
                        const isLeading = voteCount > 0 && voteCount === Math.max(...(poll.voteCounts || []));

                        return (
                          <div key={idx} style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontWeight: isLeading ? 700 : 400 }}>
                                {option} {isLeading && voteCount > 0 && "🏆"}
                              </span>
                              <span style={{ color: "var(--ink-500)" }}>
                                {voteCount} ({percentage}%)
                              </span>
                            </div>
                            <div
                              style={{
                                height: 20,
                                background: "#e5e7eb",
                                borderRadius: 4,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${percentage}%`,
                                  background: isLeading ? "var(--brand-primary)" : "#93c5fd",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {/* Actions */}
                      {poll.status === "open" && (
                        <button
                          className="btn btn-outline"
                          onClick={(e) => handleClosePoll(poll.id, e)}
                          style={{ marginTop: 8, color: "#dc2626", borderColor: "#dc2626" }}
                        >
                          Close Poll Early
                        </button>
                      )}
                    </div>
                  )}

                  {/* Expand hint */}
                  <div style={{ textAlign: "center", marginTop: 12, color: "var(--ink-400)", fontSize: 12 }}>
                    {isExpanded ? "▲ Click to collapse" : "▼ Click to see results"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}