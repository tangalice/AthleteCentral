// src/components/settings/EditProfile.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { GRADES, SPORTS, EXPERIENCE_LEVELS } from "../../constants/constants";

export default function EditProfile() {
  const navigate = useNavigate();
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [profileData, setProfileData] = useState({
    name: "",
    bio: "",
    school: "",
    grade: "",
    sport: "",
    position: "",
    team: "",
    experience: "",
    sportDetails: "",
    goals: "",
  });

  // fetch profile on mount
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      navigate("/login", { replace: true });
      return;
    }
    setUid(u.uid);

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const d = snap.exists() ? snap.data() : {};
        setProfileData({
          name: d.displayName ?? u.displayName ?? "",
          bio: d.bio ?? "",
          school: d.school ?? "",
          grade: d.grade ?? "",
          sport: d.sport ?? "",
          position: d.position ?? "",
          team: d.team ?? "",
          experience: d.experience ?? "",
          sportDetails: d.sportDetails ?? "",
          goals: d.goals ?? "",
        });
      } catch (e) {
        setMessage(`Error loading profile: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    setMessage("");

    try {
      // sync display name to Firebase Auth
      if (profileData.name) {
        await updateProfile(auth.currentUser, { displayName: profileData.name });
      }

      // upsert to Firestore
      await setDoc(
        doc(db, "users", uid),
        {
          displayName: profileData.name,
          bio: profileData.bio,
          school: profileData.school,
          grade: profileData.grade,
          sport: profileData.sport,
          position: profileData.position,
          team: profileData.team,
          experience: profileData.experience,
          sportDetails: profileData.sportDetails,
          goals: profileData.goals,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMessage("Profile updated successfully! You can continue editing or go back to Settings.");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <Link
        to="/settings"
        style={{
          color: "#646cff",
          textDecoration: "none",
          marginBottom: 20,
          display: "inline-block",
        }}
      >
        ← Back to Settings
      </Link>

      <h2 style={{ color: "#333", marginBottom: "30px" }}>Edit Profile</h2>

      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        {/* Display Name */}
        <label htmlFor="name" style={{ display: "block", marginBottom: 6, color: "#374151", fontWeight: 600 }}>
          Display Name
        </label>
        <input
          id="name"
          type="text"
          placeholder="e.g., Jessie"
          value={profileData.name}
          onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
          style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
        />

        {/* Bio */}
        <label htmlFor="bio" style={{ display: "block", marginBottom: 6, color: "#374151", fontWeight: 600 }}>
          Bio
        </label>
        <textarea
          id="bio"
          placeholder="Introduce yourself to coaches and teammates"
          value={profileData.bio}
          onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
          style={{ width: "100%", padding: 12, marginBottom: 15, minHeight: 100, borderRadius: 8, border: "1px solid #ddd", fontSize: 16, resize: "vertical" }}
        />

        {/* School */}
        <label htmlFor="school" style={{ display: "block", marginBottom: 6, color: "#374151", fontWeight: 600 }}>
          School
        </label>
        <input
          id="school"
          type="text"
          placeholder="e.g., Purdue"
          value={profileData.school}
          onChange={(e) => setProfileData({ ...profileData, school: e.target.value })}
          style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
        />

        {/* Grade */}
        <label htmlFor="grade" style={{ display: "block", marginBottom: 6, color: "#374151", fontWeight: 600 }}>
          Grade
        </label>
        <select
          id="grade"
          value={profileData.grade}
          onChange={(e) => setProfileData({ ...profileData, grade: e.target.value })}
          style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
        >
          <option value="">Select Grade</option>
          {GRADES.map((grade) => (
            <option key={grade.value} value={grade.value}>
              {grade.label}
            </option>
          ))}
        </select>

        {/* Sport */}
        <label htmlFor="sport" style={{ display: "block", marginBottom: 6, color: "#374151", fontWeight: 600 }}>
          Sport
        </label>
        <select
          id="sport"
          value={profileData.sport}
          onChange={(e) => setProfileData({ ...profileData, sport: e.target.value })}
          style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
        >
          <option value="">Select Sport</option>
          {SPORTS.map((sport) => (
            <option key={sport.value} value={sport.value}>
              {sport.label}
            </option>
          ))}
        </select>

        {/* Position/Role */}
        <label htmlFor="position" style={{ display: "block", marginBottom: 6, color: "#374151", fontWeight: 600 }}>
          Position/Role
        </label>
        <input
          id="position"
          type="text"
          placeholder="e.g., Sprinter, Point Guard"
          value={profileData.position}
          onChange={(e) => setProfileData({ ...profileData, position: e.target.value })}
          style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
        />

        {/* Team */}
        <label htmlFor="team" style={{ display: "block", marginBottom: 6, color: "#374151", fontWeight: 600 }}>
          Team
        </label>
        <input
          id="team"
          type="text"
          placeholder="Team/Club name (optional)"
          value={profileData.team}
          onChange={(e) => setProfileData({ ...profileData, team: e.target.value })}
          style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
        />

        {/* Experience Level */}
        <label htmlFor="experience" style={{ display: "block", marginBottom: 6, color: "#374151", fontWeight: 600 }}>
          Experience Level
        </label>
        <select
          id="experience"
          value={profileData.experience}
          onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
          style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
        >
          <option value="">Select Experience Level</option>
          {EXPERIENCE_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>

        {/* Sport Details */}
        <label htmlFor="sportDetails" style={{ display: "block", marginBottom: 6, color: "#374151", fontWeight: 600 }}>
          Sport Details
        </label>
        <textarea
          id="sportDetails"
          placeholder="Optional notes about events, distances, PBs, certifications, etc."
          value={profileData.sportDetails}
          onChange={(e) => setProfileData({ ...profileData, sportDetails: e.target.value })}
          style={{ width: "100%", padding: 12, marginBottom: 15, minHeight: 90, borderRadius: 8, border: "1px solid #ddd", fontSize: 16, resize: "vertical" }}
        />

        {/* Goals & Objectives */}
        <label htmlFor="goals" style={{ display: "block", marginBottom: 6, color: "#374151", fontWeight: 600 }}>
          Goals & Objectives
        </label>
        <textarea
          id="goals"
          placeholder="What are your upcoming goals?"
          value={profileData.goals}
          onChange={(e) => setProfileData({ ...profileData, goals: e.target.value })}
          style={{ width: "100%", padding: 12, marginBottom: 20, minHeight: 100, borderRadius: 8, border: "1px solid #ddd", fontSize: 16, resize: "vertical" }}
        />

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%",
            padding: "12px 20px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {message && (
          <div
            style={{
              marginTop: 20,
              padding: 12,
              backgroundColor: message.startsWith("Error") ? "#ffebee" : "#e8f5e9",
              color: message.startsWith("Error") ? "#c62828" : "#2e7d32",
              borderRadius: 8,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
