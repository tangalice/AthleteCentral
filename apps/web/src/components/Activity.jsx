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
  doc,
  getDoc,
} from "firebase/firestore";
import { ATTENDANCE_STATUS } from "../constants/constants";

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
        const teamsData = [];

        const primaryQuery = query(
          collection(db, "teams"),
          where(
            userRole === "coach" ? "coaches" : "athletes",
            "array-contains",
            auth.currentUser.uid
          )
        );
        const primarySnapshot = await getDocs(primaryQuery);
        primarySnapshot.forEach(docSnap => {
          teamsData.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Some teams still use `members` for athlete membership, so check that as well
        if (userRole === "athlete") {
          const membersQuery = query(
            collection(db, "teams"),
            where("members", "array-contains", auth.currentUser.uid)
          );
          const membersSnapshot = await getDocs(membersQuery);
          membersSnapshot.forEach(docSnap => {
            if (!teamsData.find(team => team.id === docSnap.id)) {
              teamsData.push({ id: docSnap.id, ...docSnap.data() });
            }
          });
        }

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

  // Fetch activities from real attendance data
  useEffect(() => {
    const fetchActivities = async () => {
      if (!auth.currentUser || teams.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const activitiesList = [];
        const userCache = {}; // Cache user data to avoid repeated fetches

        // Helper function to get user details
        const getUserDetails = async (userId) => {
          if (userCache[userId]) {
            return userCache[userId];
          }
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const userName = userData.displayName || userData.name || userData.email?.split('@')[0] || `User ${userId.slice(0, 6)}`;
              const userEmail = userData.email || '';
              userCache[userId] = { userName, userEmail };
              return { userName, userEmail };
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
          }
          // Return default if user not found
          const defaultUser = { userName: `User ${userId.slice(0, 6)}`, userEmail: '' };
          userCache[userId] = defaultUser;
          return defaultUser;
        };

        // For each team, fetch events and their attendance records
        for (const team of teams) {
          try {
            const eventsQuery = query(
              collection(db, "teams", team.id, "events"),
              orderBy("datetime", "desc")
            );
            const eventsSnapshot = await getDocs(eventsQuery);

            for (const eventDoc of eventsSnapshot.docs) {
              const eventData = eventDoc.data();
              const attendanceRecords = eventData.attendanceRecords || {};
              const eventDate = eventData.datetime?.toDate?.() || null;
              
              if (!eventDate) continue; // Skip events without dates

              // Process each attendance record
              for (const [userId, attendanceRecord] of Object.entries(attendanceRecords)) {
                const status = attendanceRecord?.status;
                
                // Only include "attended" statuses: present and late (excused means they didn't attend)
                if (status === ATTENDANCE_STATUS.PRESENT || 
                    status === ATTENDANCE_STATUS.LATE) {
                  
                  const userDetails = await getUserDetails(userId);
                  
                  // Format activity name - show event name with status indicator if needed
                  let activityName = eventData.title || 'Event';
                  if (status === ATTENDANCE_STATUS.LATE) {
                    activityName = `${activityName} (Late)`;
                  }

                  activitiesList.push({
                    id: `${eventDoc.id}-${userId}`,
                    userId: userId,
                    userName: userDetails.userName,
                    userEmail: userDetails.userEmail,
                    teamId: team.id,
                    teamName: team.name || 'Team',
                    activityType: "attendance",
                    activityName: activityName,
                    duration: 0, // Duration not available from events, can be calculated if needed
                    date: eventDate,
                    status: status === ATTENDANCE_STATUS.PRESENT ? "attended" : status,
                    notes: attendanceRecord?.note || "",
                    eventId: eventDoc.id,
                    eventTitle: eventData.title || 'Event',
                  });
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching events for team ${team.id}:`, error);
          }
        }

        // Fetch real workout data from Firestore per team to satisfy security rules
        try {
          for (const team of teams) {
            const workoutsQuery = query(
              collection(db, "workouts"),
              where("teamId", "==", team.id)
            );
            const workoutsSnapshot = await getDocs(workoutsQuery);

            for (const workoutDoc of workoutsSnapshot.docs) {
              const workoutData = workoutDoc.data();
              const workoutDate = workoutData.dateTime?.toDate?.() || workoutData.dateTime || null;

              if (!workoutDate) continue; // Skip workouts without dates

              // Get user details (use cached data if available, otherwise fetch)
              const userDetails = await getUserDetails(workoutData.userId);

              activitiesList.push({
                id: `workout-${workoutDoc.id}`,
                userId: workoutData.userId,
                userName: workoutData.userName || userDetails.userName,
                userEmail: workoutData.userEmail || userDetails.userEmail,
                teamId: workoutData.teamId,
                teamName: workoutData.teamName || team.name || 'Team',
                activityType: "workout",
                activityName: workoutData.workoutType || 'Workout',
                duration: workoutData.duration || 0,
                date: workoutDate,
                status: workoutData.status || "completed",
                notes: workoutData.notes || "",
              });
            }
          }
        } catch (error) {
          console.error("Error fetching workouts:", error);
        }

        // Sort by date (most recent first)
        activitiesList.sort((a, b) => new Date(b.date) - new Date(a.date));

        setActivities(activitiesList);
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [teams, userRole, user, users]);

  // Filter activities based on search and filters
  useEffect(() => {
    let filtered = activities;

    // Filter by view mode
    if (viewMode === "user" && auth.currentUser) {
      filtered = filtered.filter(activity => activity.userId === auth.currentUser.uid);
    }
    // "all" mode shows all activities from all teams the user is part of (no additional filtering)

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
  }, [activities, searchTerm, selectedTeam, selectedUser, viewMode]);

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
      case 'present':
        return '#10b981';
      case 'incomplete':
      case 'absent':
        return '#ef4444';
      case 'partial':
      case 'late':
        return '#f59e0b';
      case 'excused':
        return '#6b7280';
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

  const getActivityTitle = (activity) => {
    switch (activity.activityType) {
      case 'attendance':
        return `${activity.userName} attended ${activity.activityName}`;
      case 'workout':
        return `${activity.userName} logged a ${activity.activityName}`;
      default:
        return `${activity.userName} ${activity.activityName}`;
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
              className={`btn ${viewMode === "user" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode("user")}
            >
              My Activity
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
                          {getActivityTitle(activity)}
                        </h4>
                        <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
                          {activity.teamName}
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
                      {activity.duration > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span className="text-muted" style={{ fontSize: 12 }}>Duration:</span>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{activity.duration} min</span>
                        </div>
                      )}
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
                {filteredActivities.filter(a => 
                  a.status === 'completed' || 
                  a.status === 'attended' || 
                  a.status === 'present' ||
                  a.status === 'late'
                ).length}
              </div>
              <div className="text-muted" style={{ fontSize: 14 }}>
                Completed/Attended
              </div>
            </div>
            {filteredActivities.some(a => a.duration > 0) && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>
                  {Math.round(filteredActivities.filter(a => a.duration > 0).reduce((sum, a) => sum + a.duration, 0) / filteredActivities.filter(a => a.duration > 0).length)} min
                </div>
                <div className="text-muted" style={{ fontSize: 14 }}>
                  Avg Duration
                </div>
              </div>
            )}
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
