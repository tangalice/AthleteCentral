import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";

import { setDoc } from "firebase/firestore";


export default function Teams() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showJoinTeam, setShowJoinTeam] = useState(false);
  const [message, setMessage] = useState("");
  const [teamMembers, setTeamMembers] = useState({});
  const [memberSearch, setMemberSearch] = useState({});
  
  // Create team form state
  const [newTeam, setNewTeam] = useState({
    name: "",
    description: "",
    joinCode: "",
    selectedUsers: []
  });
  
  // Join team form state
  const [joinCode, setJoinCode] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Get current user and role
  useEffect(() => {
    const getUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        setUser(currentUser);
        
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      } catch (error) {
        console.error("Error getting user data:", error);
      } finally {
        setLoading(false);
      }
    };

    getUserData();
  }, []);

  // Load user's teams
  useEffect(() => {
    if (!user) return;

    const teamsQuery = query(
      collection(db, "teams"),
      where("members", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(teamsQuery, async (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTeams(teamsData);
      
      // Load team members for coaches
      if (userRole === "coach") {
        await loadTeamMembers(teamsData);
      }
    });

    return () => unsubscribe();
  }, [user, userRole]);

  // Load all users for coach team creation
  useEffect(() => {
    if (userRole !== "coach" || !user) return;

    const loadUsers = async () => {
      try {
        const usersQuery = query(collection(db, "users"));
        const snapshot = await getDocs(usersQuery);
        const usersData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(userData => userData.id !== user.uid); // Exclude current user
        
        setAllUsers(usersData);
      } catch (error) {
        console.error("Error loading users:", error);
      }
    };

    loadUsers();
  }, [user, userRole]);

  // Generate random join code
  const generateJoinCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewTeam(prev => ({ ...prev, joinCode: result }));
  };

  // Create new team (coach only)
  const createTeam = async () => {
    if (!newTeam.name.trim()) {
      setMessage("Team name is required");
      return;
    }

    if (!newTeam.joinCode) {
      generateJoinCode();
      return;
    }

    try {
      const teamData = {
        name: newTeam.name.trim(),
        description: newTeam.description.trim(),
        joinCode: newTeam.joinCode,
        createdBy: user.uid,
        createdAt: new Date(),
        members: [user.uid, ...newTeam.selectedUsers.map(u => u.id)],
        coaches: [user.uid],
        athletes: newTeam.selectedUsers.map(u => u.id)
      };

      //  
      const docRef = await addDoc(collection(db, "teams"), teamData);

      //   athletes 
      for (const athlete of newTeam.selectedUsers) {
        try {
          const athleteRef = doc(db, "teams", docRef.id, "athletes", athlete.id);
          await setDoc(athleteRef, {
            name: athlete.displayName || athlete.email || "Unnamed Athlete",
            email: athlete.email || "",
            healthStatus: "active", //  active
            createdAt: new Date(),
          });
        } catch (error) {
          console.error(`Failed to create athlete doc for ${athlete.id}:`, error);
        }
      }

      setMessage("Team created successfully!");
      setShowCreateTeam(false);
      setNewTeam({ name: "", description: "", joinCode: "", selectedUsers: [] });
    } catch (error) {
      console.error("Error creating team:", error);
      setMessage(`Error creating team: ${error.message}`);
    }
  };

  // Join team by code (both coaches and athletes)
  const joinTeamByCode = async () => {
    if (!joinCode.trim()) {
      setMessage("Please enter a join code");
      return;
    }

    try {
      const teamsQuery = query(
        collection(db, "teams"),
        where("joinCode", "==", joinCode.trim().toUpperCase())
      );
      
      const snapshot = await getDocs(teamsQuery);
      
      if (snapshot.empty) {
        setMessage("Invalid join code");
        return;
      }

      const teamDoc = snapshot.docs[0];
      const teamData = teamDoc.data();
      
      // Check if user is already a member
      if (teamData.members.includes(user.uid)) {
        setMessage("You are already a member of this team");
        return;
      }

      // Add user to team based on their role
      const updateData = {
        members: arrayUnion(user.uid)
      };

      // Add to appropriate role array
      if (userRole === "coach") {
        updateData.coaches = arrayUnion(user.uid);
      } else if (userRole === "athlete") {
        updateData.athletes = arrayUnion(user.uid);
      }

      await updateDoc(doc(db, "teams", teamDoc.id), updateData);

      try {
        const athleteRef = doc(db, "teams", teamDoc.id, "athletes", user.uid);
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
      
        await setDoc(athleteRef, {
          name: userData.displayName || user.displayName || "Unnamed Athlete",
          email: user.email,
          healthStatus: "active",
          createdAt: new Date(),
        }, { merge: true });
      
        console.log("✅ Athlete subdocument created for", user.uid);
      } catch (err) {
        console.error("❌ Failed to create athlete document:", err);
      }

      setMessage("Successfully joined team!");
      setJoinCode("");
      setShowJoinTeam(false);
    } catch (error) {
      console.error("Error joining team:", error);
      setMessage(`Error joining team: ${error.message}`);
    }
  };

  // Load team members with user details
  const loadTeamMembers = async (teamsData) => {
    try {
      const membersData = {};
      
      for (const team of teamsData) {
        if (team.members && team.members.length > 0) {
          const memberPromises = team.members.map(async (memberId) => {
            try {
              const userDoc = await getDoc(doc(db, "users", memberId));
              if (userDoc.exists()) {
                return { id: memberId, ...userDoc.data() };
              }
              return { id: memberId, displayName: "Unknown User", email: "unknown@example.com" };
            } catch (error) {
              console.error("Error fetching user:", memberId, error);
              return { id: memberId, displayName: "Unknown User", email: "unknown@example.com" };
            }
          });
          
          const members = await Promise.all(memberPromises);
          membersData[team.id] = members;
        }
      }
      
      setTeamMembers(membersData);
    } catch (error) {
      console.error("Error loading team members:", error);
    }
  };

  // Remove user from team (coach only)
  const removeUserFromTeam = async (teamId, userId) => {
    if (!window.confirm("Are you sure you want to remove this user from the team?")) {
      return;
    }

    try {
      await updateDoc(doc(db, "teams", teamId), {
        members: arrayRemove(userId),
        athletes: arrayRemove(userId),
        coaches: arrayRemove(userId)
      });
      
      setMessage("User removed from team successfully");
    } catch (error) {
      console.error("Error removing user from team:", error);
      setMessage(`Error removing user: ${error.message}`);
    }
  };

  // Leave team
  const leaveTeam = async (teamId) => {
    try {
      await updateDoc(doc(db, "teams", teamId), {
        members: arrayRemove(user.uid),
        athletes: arrayRemove(user.uid),
        coaches: arrayRemove(user.uid)
      });
      
      setMessage("Left team successfully");
    } catch (error) {
      console.error("Error leaving team:", error);
      setMessage(`Error leaving team: ${error.message}`);
    }
  };

  // Filter users for search
  const filteredUsers = allUsers.filter(userData =>
    userData.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    userData.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Filter team members for search
  const getFilteredTeamMembers = (teamId) => {
    const members = teamMembers[teamId] || [];
    const searchTerm = memberSearch[teamId] || "";
    
    if (!searchTerm) return members;
    
    return members.filter(member =>
      member.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Update member search for specific team
  const updateMemberSearch = (teamId, searchTerm) => {
    setMemberSearch(prev => ({
      ...prev,
      [teamId]: searchTerm
    }));
  };

  // Create team chat with all members
  const createTeamChat = async (team) => {
    if (!team.members || team.members.length === 0) {
      setMessage("No members in this team to message");
      return;
    }

    try {
      // Check if a team chat already exists
      const existingChatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid)
      );
      const existingChats = await getDocs(existingChatsQuery);
      
      // Look for existing team chat with same participants
      const existingTeamChat = existingChats.docs.find(doc => {
        const chatData = doc.data();
        const chatParticipants = chatData.participants || [];
        const teamMembers = team.members || [];
        
        // Check if participants match (same length and all members included)
        if (chatParticipants.length !== teamMembers.length) return false;
        
        return teamMembers.every(memberId => chatParticipants.includes(memberId));
      });

      if (existingTeamChat) {
        // Navigate to existing team chat
        window.location.href = `/messages?chat=${existingTeamChat.id}`;
        return;
      }

      // Create new team chat
      const participants = team.members || [];
      const teamChatData = {
        name: `${team.name} Team Chat`,
        participants: participants,
        createdBy: user.uid,
        createdAt: new Date(),
        lastMessageTime: new Date(),
        lastMessage: '',
        unreadCounts: participants.reduce((acc, id) => { acc[id] = 0; return acc; }, {}),
        readBy: { [user.uid]: new Date() },
        isTeamChat: true,
        teamId: team.id
      };

      const docRef = await addDoc(collection(db, 'chats'), teamChatData);
      
      setMessage("Team chat created successfully!");
      
      // Navigate to the new chat
      setTimeout(() => {
        window.location.href = `/messages?chat=${docRef.id}`;
      }, 1000);
      
    } catch (error) {
      console.error('Error creating team chat:', error);
      setMessage(`Error creating team chat: ${error.message}`);
    }
  };

  // Toggle user selection for team creation
  const toggleUserSelection = (userData) => {
    setNewTeam(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.some(u => u.id === userData.id)
        ? prev.selectedUsers.filter(u => u.id !== userData.id)
        : [...prev.selectedUsers, userData]
    }));
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <div className="spinner" aria-label="Loading teams"></div>
      </div>
    );
  }

  const isCoach = userRole === "coach";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 8 }}>Teams</h1>
        <p className="text-muted" style={{ marginBottom: 24 }}>
          {isCoach ? "Manage your teams, create new ones, and join other teams" : "Join teams and view your current teams"}
        </p>

        {/* Coach Actions */}
        {isCoach && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateTeam(true)}
              >
                Create New Team
              </button>
            </div>
          </div>
        )}

        {/* Join Team Actions (Both Coaches and Athletes) */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowJoinTeam(true)}
            >
              Join Team by Code
            </button>
          </div>
        </div>

        {/* Create Team Modal */}
        {showCreateTeam && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <div className="card" style={{ maxWidth: 600, width: "90%", maxHeight: "80vh", overflowY: "auto" }}>
              <h2 style={{ marginBottom: 16 }}>Create New Team</h2>
              
              <div className="form-group">
                <label style={{ fontWeight: 700 }}>Team Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter team name"
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 700 }}>Description</label>
                <textarea
                  className="form-control"
                  value={newTeam.description}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter team description (optional)"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 700 }}>Join Code</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="form-control"
                    value={newTeam.joinCode}
                    onChange={(e) => setNewTeam(prev => ({ ...prev, joinCode: e.target.value.toUpperCase() }))}
                    placeholder="Enter or generate join code"
                    maxLength={6}
                  />
                  <button
                    className="btn btn-outline"
                    onClick={generateJoinCode}
                    type="button"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 700 }}>Add Members</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search users by name or email"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                
                {userSearch && (
                  <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 4 }}>
                    {filteredUsers.map(userData => {
                      const isSelected = newTeam.selectedUsers.some(u => u.id === userData.id);
                      return (
                        <div
                          key={userData.id}
                          style={{
                            padding: 12,
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            backgroundColor: isSelected ? "#f0f9ff" : "white",
                            display: "flex",
                            alignItems: "center",
                            gap: 12
                          }}
                          onClick={() => toggleUserSelection(userData)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleUserSelection(userData)}
                            style={{ 
                              width: 16, 
                              height: 16, 
                              accentColor: "#10b981",
                              cursor: "pointer"
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{userData.displayName || userData.email}</div>
                            <div className="text-muted" style={{ fontSize: 14 }}>{userData.email}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {newTeam.selectedUsers.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <strong>Selected Members:</strong>
                    {newTeam.selectedUsers.map(userData => (
                      <div key={userData.id} style={{ display: "inline-block", margin: "4px 8px 4px 0", padding: "4px 8px", backgroundColor: "#e0f2fe", borderRadius: 4 }}>
                        {userData.displayName || userData.email}
                        <button
                          type="button"
                          onClick={() => toggleUserSelection(userData)}
                          style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer" }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowCreateTeam(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={createTeam}
                >
                  Create Team
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Join Team Modal */}
        {showJoinTeam && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <div className="card" style={{ maxWidth: 400, width: "90%" }}>
              <h2 style={{ marginBottom: 16 }}>Join Team</h2>
              
              <div className="form-group">
                <label style={{ fontWeight: 700 }}>Join Code</label>
                <input
                  type="text"
                  className="form-control"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-letter join code"
                  maxLength={6}
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowJoinTeam(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={joinTeamByCode}
                >
                  Join Team
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Teams List */}
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>My Teams ({teams.length})</h2>
          
          {teams.length === 0 ? (
            <p className="text-muted">You're not part of any teams yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {teams.map(team => (
                <div key={team.id} style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: "0 0 8px 0" }}>{team.name}</h3>
                      {team.description && (
                        <p className="text-muted" style={{ margin: "0 0 8px 0" }}>{team.description}</p>
                      )}
                      <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
                        <span className="text-muted">Join Code: {team.joinCode}</span>
                        <span className="text-muted">Members: {team.members?.length || 0}</span>
                        {team.createdBy === user.uid && <span className="text-primary">(You created this team)</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => createTeamChat(team)}
                        style={{ fontSize: 14, padding: "6px 12px" }}
                      >
                        Send Message to Team
                      </button>

                      {isCoach && (
                        <button
                        className="btn btn-outline"
                        onClick={() => window.location.href = `/health-status?teamId=${team.id}`}
                        style={{ fontSize: 14, padding: "6px 12px" }}
                      >
                        Manage Health
                      </button>
                      )}

                      <button
                        className="btn btn-outline text-danger"
                        onClick={() => leaveTeam(team.id)}
                        style={{ fontSize: 14, padding: "6px 12px" }}
                      >
                        Leave
                      </button>
                    </div>
                  </div>

                  {/* Team Members Management (Coach only) */}
                  {isCoach && teamMembers[team.id] && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: 16 }}>Team Members</h4>
                      
                      {/* Search Members */}
                      <div style={{ marginBottom: 12 }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search members by name or email"
                          value={memberSearch[team.id] || ""}
                          onChange={(e) => updateMemberSearch(team.id, e.target.value)}
                          style={{ maxWidth: 300 }}
                        />
                      </div>

                      {/* Members List */}
                      <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 4 }}>
                        {getFilteredTeamMembers(team.id).length === 0 ? (
                          <div style={{ padding: 12, textAlign: "center", color: "#6b7280" }}>
                            {memberSearch[team.id] ? "No members found matching your search" : "No members in this team"}
                          </div>
                        ) : (
                          getFilteredTeamMembers(team.id).map(member => (
                            <div
                              key={member.id}
                              style={{
                                padding: 12,
                                borderBottom: "1px solid var(--border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 600 }}>
                                  {member.displayName || member.email}
                                  {member.id === user.uid && <span style={{ marginLeft: 8, color: "#10b981", fontSize: 12 }}>(You)</span>}
                                </div>
                                <div className="text-muted" style={{ fontSize: 14 }}>{member.email}</div>
                                <div className="text-muted" style={{ fontSize: 12 }}>
                                  {member.role === "coach" ? "Coach" : member.role === "athlete" ? "Athlete" : "User"}
                                </div>
                              </div>
                              {member.id !== user.uid && (
                                <button
                                  className="btn btn-outline text-danger"
                                  onClick={() => removeUserFromTeam(team.id, member.id)}
                                  style={{ fontSize: 12, padding: "4px 8px" }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Display */}
        {message && (
          <div className={`alert ${message.includes("Error") ? "alert-error" : "alert-success"}`} role="status" style={{ marginTop: 16 }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
