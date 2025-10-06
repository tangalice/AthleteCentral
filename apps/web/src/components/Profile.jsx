import { useState } from "react";
import { auth, db } from "../firebase";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "firebase/auth";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

export default function Profile() {
  const [activeTab, setActiveTab] = useState("profile"); // "profile", "edit", "delete", or "sessions"
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  
  // Sessions state
  const [sessions, setSessions] = useState([
    { id: "device1", name: "Chrome on Windows" },
    { id: "device2", name: "iPhone Safari" },
  ]);

  // Profile details state
  const [profileDetails, setProfileDetails] = useState({
    bio: "",
    grade: "",
    sport: "",
    sportDetails: "",
    school: "",
    team: "",
    position: "",
    experience: "",
    goals: ""
  });

  const ensureRecentLogin = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");
    if (!currentPassword) {
      throw new Error("Recent login required. Please enter your current password.");
    }
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
  };

  const handleUpdate = async () => {
    setMsg("");
    setBusy(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");

      if (name) {
        try {
          await updateProfile(user, { displayName: name });
        } catch (err) {
          if (err.code === "auth/requires-recent-login") {
            await ensureRecentLogin();
            await updateProfile(user, { displayName: name });
          } else {
            throw err;
          }
        }
        try {
          await updateDoc(doc(db, "users", user.uid), {
            displayName: name,
            updatedAt: serverTimestamp(),
          });
        } catch {}
      }

      if (newPassword) {
        if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
        try {
          await updatePassword(user, newPassword);
        } catch (err) {
          if (err.code === "auth/requires-recent-login") {
            await ensureRecentLogin();
            await updatePassword(user, newPassword);
          } else {
            throw err;
          }
        }
      }

      setMsg("Account updated successfully!");
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!window.confirm("This will permanently delete your account. Continue?")) return;

    setBusy(true);
    setMsg("");
    try {
      // Some sensitive ops require recent login
      try {
        // Try delete directly first
        await deleteUser(user);
      } catch (err) {
        if (err.code === "auth/requires-recent-login") {
          if (!currentPassword) {
            setMsg("Recent login required. Please enter your current password, then try again.");
            setBusy(false);
            return;
          }
          const cred = EmailAuthProvider.credential(user.email, currentPassword);
          await reauthenticateWithCredential(user, cred);
          await deleteUser(user);
        } else {
          throw err;
        }
      }

      // Try remove Firestore profile (best-effort, user may be gone already)
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch {}

      alert("Account deleted. Signing you out.");
      // Auth SDK will signOut implicitly after deleteUser on some platforms,
      // but call signOut for good measure:
      auth.signOut();
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  // Session management functions
  const handleLogoutSession = (id) => {
    alert(`Logged out from ${id}`);
    setSessions(sessions.filter(s => s.id !== id));
  };

  const handleLogoutAllSessions = () => {
    alert("Logged out from all devices");
    setSessions([]);
  };

  // Profile details functions
  const handleProfileDetailsChange = (field, value) => {
    setProfileDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProfileDetails = async () => {
    setBusy(true);
    setMsg("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");

      await updateDoc(doc(db, "users", user.uid), {
        ...profileDetails,
        updatedAt: serverTimestamp()
      });

      setMsg("Profile details saved successfully!");
    } catch (err) {
      setMsg(`Error saving profile: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h2>Profile Management</h2>
      
      {/* Tab Navigation */}
      <div style={{ 
        display: "flex", 
        marginBottom: "20px",
        borderBottom: "1px solid #ddd"
      }}>
        <button
          onClick={() => setActiveTab("profile")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeTab === "profile" ? "#2196F3" : "transparent",
            color: activeTab === "profile" ? "white" : "#2196F3",
            border: "1px solid #2196F3",
            borderBottom: "none",
            cursor: "pointer",
            borderRadius: "5px 5px 0 0"
          }}
        >
          Profile Details
        </button>
        <button
          onClick={() => setActiveTab("edit")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeTab === "edit" ? "#646cff" : "transparent",
            color: activeTab === "edit" ? "white" : "#646cff",
            border: "1px solid #646cff",
            borderBottom: "none",
            cursor: "pointer",
            borderRadius: "5px 5px 0 0"
          }}
        >
          Edit Account
        </button>
        <button
          onClick={() => setActiveTab("delete")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeTab === "delete" ? "#d32f2f" : "transparent",
            color: activeTab === "delete" ? "white" : "#d32f2f",
            border: "1px solid #d32f2f",
            borderBottom: "none",
            cursor: "pointer",
            borderRadius: "5px 5px 0 0"
          }}
        >
          Delete Account
        </button>
        <button
          onClick={() => setActiveTab("sessions")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeTab === "sessions" ? "#4caf50" : "transparent",
            color: activeTab === "sessions" ? "white" : "#4caf50",
            border: "1px solid #4caf50",
            borderBottom: "none",
            cursor: "pointer",
            borderRadius: "5px 5px 0 0"
          }}
        >
          Sessions
        </button>
      </div>

      {/* Profile Details Tab */}
      {activeTab === "profile" && (
        <div>
          <h3 style={{ color: "#2196F3" }}>Personal Information</h3>
          
          {/* Personal Information Section */}
          <div style={{ marginBottom: "30px" }}>
            <h4 style={{ color: "#333", marginBottom: "15px" }}>About You</h4>
            
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Bio/About Me:
              </label>
              <textarea
                placeholder="Tell us about yourself..."
                value={profileDetails.bio}
                onChange={(e) => handleProfileDetailsChange("bio", e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px", 
                  borderRadius: "5px", 
                  border: "1px solid #ddd",
                  minHeight: "80px",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Grade/Year:
              </label>
              <select
                value={profileDetails.grade}
                onChange={(e) => handleProfileDetailsChange("grade", e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px", 
                  borderRadius: "5px", 
                  border: "1px solid #ddd"
                }}
              >
                <option value="">Select Grade</option>
                <option value="9th">9th Grade</option>
                <option value="10th">10th Grade</option>
                <option value="11th">11th Grade</option>
                <option value="12th">12th Grade</option>
                <option value="Freshman">College Freshman</option>
                <option value="Sophomore">College Sophomore</option>
                <option value="Junior">College Junior</option>
                <option value="Senior">College Senior</option>
                <option value="Graduate">Graduate Student</option>
              </select>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                School:
              </label>
              <input
                type="text"
                placeholder="Enter your school name"
                value={profileDetails.school}
                onChange={(e) => handleProfileDetailsChange("school", e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px", 
                  borderRadius: "5px", 
                  border: "1px solid #ddd"
                }}
              />
            </div>
          </div>

          {/* Sports Information Section */}
          <div style={{ marginBottom: "30px" }}>
            <h4 style={{ color: "#333", marginBottom: "15px" }}>Sports Information</h4>
            
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Primary Sport:
              </label>
              <select
                value={profileDetails.sport}
                onChange={(e) => handleProfileDetailsChange("sport", e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px", 
                  borderRadius: "5px", 
                  border: "1px solid #ddd"
                }}
              >
                <option value="">Select Sport</option>
                <option value="Basketball">Basketball</option>
                <option value="Football">Football</option>
                <option value="Soccer">Soccer</option>
                <option value="Baseball">Baseball</option>
                <option value="Softball">Softball</option>
                <option value="Tennis">Tennis</option>
                <option value="Track & Field">Track & Field</option>
                <option value="Swimming">Swimming</option>
                <option value="Volleyball">Volleyball</option>
                <option value="Wrestling">Wrestling</option>
                <option value="Golf">Golf</option>
                <option value="Cross Country">Cross Country</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Position/Role:
              </label>
              <input
                type="text"
                placeholder="e.g., Point Guard, Quarterback, Striker"
                value={profileDetails.position}
                onChange={(e) => handleProfileDetailsChange("position", e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px", 
                  borderRadius: "5px", 
                  border: "1px solid #ddd"
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Team Name:
              </label>
              <input
                type="text"
                placeholder="Enter your team name"
                value={profileDetails.team}
                onChange={(e) => handleProfileDetailsChange("team", e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px", 
                  borderRadius: "5px", 
                  border: "1px solid #ddd"
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Experience Level:
              </label>
              <select
                value={profileDetails.experience}
                onChange={(e) => handleProfileDetailsChange("experience", e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px", 
                  borderRadius: "5px", 
                  border: "1px solid #ddd"
                }}
              >
                <option value="">Select Experience</option>
                <option value="Beginner">Beginner (0-1 years)</option>
                <option value="Intermediate">Intermediate (2-4 years)</option>
                <option value="Advanced">Advanced (5+ years)</option>
                <option value="Elite">Elite/Professional</option>
              </select>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Sport Details:
              </label>
              <textarea
                placeholder="Tell us more about your sport involvement, achievements, training schedule, etc."
                value={profileDetails.sportDetails}
                onChange={(e) => handleProfileDetailsChange("sportDetails", e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px", 
                  borderRadius: "5px", 
                  border: "1px solid #ddd",
                  minHeight: "100px",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Goals & Objectives:
              </label>
              <textarea
                placeholder="What are your athletic goals? What do you want to achieve?"
                value={profileDetails.goals}
                onChange={(e) => handleProfileDetailsChange("goals", e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px", 
                  borderRadius: "5px", 
                  border: "1px solid #ddd",
                  minHeight: "80px",
                  resize: "vertical"
                }}
              />
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveProfileDetails}
            disabled={busy}
            style={{
              padding: "12px 24px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "bold"
            }}
          >
            {busy ? "Saving..." : "Save Profile Details"}
          </button>
        </div>
      )}

      {/* Edit Account Tab */}
      {activeTab === "edit" && (
        <div>
          <h3>Edit Account Information</h3>
          <div style={{ marginBottom: "15px" }}>
            <input
              placeholder="New display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: "10px", margin: "8px 0" }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: "100%", padding: "10px", margin: "8px 0" }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <input
              type="password"
              placeholder="Current password (needed if prompted)"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{ width: "100%", padding: "10px", margin: "8px 0" }}
            />
          </div>

          <button 
            onClick={handleUpdate} 
            disabled={busy} 
            style={{ 
              padding: "10px 16px",
              backgroundColor: "#646cff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: busy ? "not-allowed" : "pointer"
            }}
          >
            {busy ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* Delete Account Tab */}
      {activeTab === "delete" && (
        <div>
          <h3 style={{ color: "#d32f2f" }}>Delete Account</h3>
          <p style={{ color: "#666", marginBottom: "20px" }}>
            This action is permanent and cannot be undone. All your data will be lost.
          </p>
          
          <div style={{ marginBottom: "15px" }}>
            <input
              type="password"
              placeholder="Enter current password (needed if prompted)"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{ width: "100%", padding: "10px", margin: "8px 0" }}
            />
          </div>
          
          <button
            onClick={handleDelete}
            disabled={busy}
            style={{ 
              background: "#d32f2f", 
              color: "#fff", 
              padding: "10px 16px", 
              borderRadius: "6px", 
              border: "none",
              cursor: busy ? "not-allowed" : "pointer"
            }}
          >
            {busy ? "Deleting..." : "Delete My Account"}
          </button>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === "sessions" && (
        <div>
          <h3 style={{ color: "#4caf50" }}>Active Sessions</h3>
          <p style={{ color: "white", marginBottom: "20px" }}>
            Manage your active sessions across different devices.
          </p>
          
          {sessions.length > 0 ? (
            <div>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {sessions.map((session) => (
                  <li key={session.id} style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "5px",
                    marginBottom: "10px",
                    backgroundColor: "#f9f9f9"
                  }}>
                    <span>{session.name}</span>
                    <button
                      onClick={() => handleLogoutSession(session.id)}
                      style={{
                        padding: "5px 10px",
                        backgroundColor: "#ff4444",
                        color: "white",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer"
                      }}
                    >
                      Logout
                    </button>
                  </li>
                ))}
              </ul>
              
              <button
                onClick={handleLogoutAllSessions}
                style={{
                  padding: "10px 16px",
                  backgroundColor: "#d32f2f",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  marginTop: "10px"
                }}
              >
                Logout All Sessions
              </button>
            </div>
          ) : (
            <p style={{ color: "#666", fontStyle: "italic" }}>
              No active sessions found.
            </p>
          )}
        </div>
      )}

      {/* Status Message */}
      {msg && (
        <div style={{ 
          marginTop: "20px", 
          padding: "10px", 
          backgroundColor: msg.includes("success") ? "#e8f5e9" : "#ffebee",
          color: msg.includes("success") ? "#2e7d32" : "#c62828",
          borderRadius: "5px"
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}
