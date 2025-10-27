// src/components/Activity.jsx
import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

export default function Activity({ userRole, user }) {
  const [activities, setActivities] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [viewMode, setViewMode] = useState("all"); // all, team, user

  // Fetch user's teams
  useEffect(() => {
    const fetchTeams = async () => {
      if (!auth.currentUser) return;

      try {
        const teamsQuery = query(
          collection(db, "teams"),
          where(
            userRole === "coach" ? "coaches" : "athletes",
            "array-contains",
            auth.currentUser.uid
          )
        );
        const snapshot = await getDocs(teamsQuery);
        const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTeams(teamsData);
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };

    fetchTeams();
  }, [userRole]);

  // Fetch all users (for search functionality)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersQuery = query(collection(db, "users"));
        const snapshot = await getDocs(usersQuery);
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, []);

  // Fetch activities
  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      try {
        // For now, we'll simulate activity data since we don't have a specific activities collection
        // In a real implementation, you'd query your activities/attendance collection
        const mockActivities = [
          {
            id: "1",
            userId: "user1",
            userName: "Alice Tang",
            userEmail: "alice@example.com",
            teamId: "team1",
            teamName: "Track & Field",
            activityType: "workout",
            activityName: "Morning Run",
            duration: 45,
            date: new Date("2024-01-15"),
            status: "completed",
            notes: "Great pace maintained throughout"
          },
          {
            id: "2",
            userId: "user2",
            userName: "Jane Billa",
            userEmail: "jane@example.com",
            teamId: "team1",
            teamName: "Track & Field",
            activityType: "attendance",
            activityName: "Team Practice",
            duration: 90,
            date: new Date("2024-01-15"),
            status: "attended",
            notes: "Full participation"
          },
          {
            id: "3",
            userId: "user3",
            userName: "Ethan Whiteman",
            userEmail: "ethan@example.com",
            teamId: "team2",
            teamName: "Swimming",
            activityType: "workout",
            activityName: "Swim Training",
            duration: 60,
            date: new Date("2024-01-14"),
            status: "completed",
            notes: "Improved lap times"
          },
          {
            id: "4",
            userId: "user1",
            userName: "Elijah Shiffer",
            userEmail: "elijah@example.com",
            teamId: "team1",
            teamName: "Track & Field",
            activityType: "attendance",
            activityName: "Competition",
            duration: 120,
            date: new Date("2024-01-13"),
            status: "attended",
            notes: "Personal best achieved"
          }
        ];

        setActivities(mockActivities);
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  // Filter activities based on search and filters
  useEffect(() => {
    let filtered = activities;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(activity =>
        activity.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.activityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.teamName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by team
    if (selectedTeam) {
      filtered = filtered.filter(activity => activity.teamId === selectedTeam);
    }

    // Filter by user
    if (selectedUser) {
      filtered = filtered.filter(activity => activity.userId === selectedUser);
    }

    // Sort by date (most recent first)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    setFilteredActivities(filtered);
  }, [activities, searchTerm, selectedTeam, selectedUser]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'attended':
        return '#10b981';
      case 'incomplete':
      case 'absent':
        return '#ef4444';
      case 'partial':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getActivityTypeIcon = (type) => {
    switch (type) {
      case 'workout':
        return '💪';
      case 'attendance':
        return '📅';
      case 'competition':
        return '🏆';
      default:
        return '📝';
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <div className="spinner" aria-label="Loading activities"></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
      <div className="card" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 800, color: "#111827" }}>Activity Feed</h2>
            <p className="text-muted" style={{ marginTop: 4 }}>
              Track workout and attendance activity across teams
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              className={`btn ${viewMode === "all" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode("all")}
            >
              All Activity
            </button>
            <button
              className={`btn ${viewMode === "team" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode("team")}
            >
              Team Activity
            </button>
            <button
              className={`btn ${viewMode === "user" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode("user")}
            >
              User Activity
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div style={{ 
          display: "flex", 
          gap: 16, 
          marginBottom: 24, 
          flexWrap: "wrap",
          alignItems: "center"
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              placeholder="Search by name, email, activity, or team..."
              className="form-control"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {teams.length > 0 && (
            <select
              className="form-control"
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              style={{ minWidth: 150 }}
            >
              <option value="">All Teams</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          )}

          <select
            className="form-control"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="">All Users</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.displayName || user.email}
              </option>
            ))}
          </select>
        </div>

        {/* Activity List */}
        <div style={{ maxHeight: 600, overflowY: "auto" }}>
          {filteredActivities.length === 0 ? (
            <div className="text-muted" style={{ textAlign: "center", padding: 40 }}>
              {searchTerm || selectedTeam || selectedUser 
                ? "No activities match your filters" 
                : "No activities found"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="card"
                  style={{
                    margin: 0,
                    padding: 16,
                    borderLeft: `4px solid ${getStatusColor(activity.status)}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 16
                  }}
                >
                  {/* Activity Icon */}
                  <div style={{ fontSize: 24 }}>
                    {getActivityTypeIcon(activity.activityType)}
                  </div>

                  {/* Activity Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111827" }}>
                          {activity.activityName}
                        </h4>
                        <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
                          {activity.userName} • {activity.teamName}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                          {formatDate(activity.date)}
                        </div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {formatTime(activity.date)}
                        </div>
                      </div>
                    </div>

                    {/* Activity Info */}
                    <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span className="text-muted" style={{ fontSize: 12 }}>Duration:</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{activity.duration} min</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span className="text-muted" style={{ fontSize: 12 }}>Status:</span>
                        <span 
                          style={{ 
                            fontSize: 12, 
                            fontWeight: 600, 
                            color: getStatusColor(activity.status),
                            textTransform: "capitalize"
                          }}
                        >
                          {activity.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span className="text-muted" style={{ fontSize: 12 }}>Type:</span>
                        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>
                          {activity.activityType}
                        </span>
                      </div>
                    </div>

                    {/* Notes */}
                    {activity.notes && (
                      <div style={{ marginTop: 8 }}>
                        <p className="text-muted" style={{ margin: 0, fontSize: 14, fontStyle: "italic" }}>
                          "{activity.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {filteredActivities.length > 0 && (
          <div style={{ 
            marginTop: 24, 
            padding: 16, 
            backgroundColor: "#f9fafb", 
            borderRadius: 8,
            display: "flex",
            justifyContent: "space-around",
            flexWrap: "wrap",
            gap: 16
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>
                {filteredActivities.length}
              </div>
              <div className="text-muted" style={{ fontSize: 14 }}>
                Total Activities
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>
                {filteredActivities.filter(a => a.status === 'completed' || a.status === 'attended').length}
              </div>
              <div className="text-muted" style={{ fontSize: 14 }}>
                Completed/Attended
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>
                {Math.round(filteredActivities.reduce((sum, a) => sum + a.duration, 0) / filteredActivities.length)} min
              </div>
              <div className="text-muted" style={{ fontSize: 14 }}>
                Avg Duration
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#6366f1" }}>
                {new Set(filteredActivities.map(a => a.userId)).size}
              </div>
              <div className="text-muted" style={{ fontSize: 14 }}>
                Active Users
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
