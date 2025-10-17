// src/components/settings/EditProfile.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { GRADES, SPORTS, EXPERIENCE_LEVELS, TWILIO_INFO } from "../../constants/constants";
//import { Twilio } from "twilio";

export default function EditProfile() {
  const navigate = useNavigate();
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  //const client = Twilio(TWILIO_INFO.ACCOUNT_SID, TWILIO_INFO.AUTH_TOKEN);

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
    textNotifications: false,
    phoneNumber: "",
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
          textNotifications: d.textNotifications ?? false,
          phoneNumber: d.phoneNumber ?? "",
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

      if (profileData.textNotifications && (profileData.phoneNumber.trim() === "" )) {
        throw new Error("Phone number is required to enable text notifications.");
      }

      const snap = await getDoc(doc(db, "users", uid));
      const d = snap.exists() ? snap.data() : {};
      if (profileData.textNotifications && (d.textNotifications === false || d.textNotifications === undefined) && profileData.phoneNumber.trim() !== "") {
        // Just enabled text notifications, show alert
        setMessage("You have enabled text notifications. A test message will be sent to your phone shortly. If you do not receive it, please ensure you have entered the correct phone number.");

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
          textNotifications: profileData.textNotifications,
          phoneNumber: profileData.phoneNumber,
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
      <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <div className="spinner" aria-label="Loading profile"></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
      <Link to="/settings" className="text-primary" style={{ display: "inline-block", marginBottom: 16 }}>
        ← Back to Settings
      </Link>

      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2 className="mb-2">Edit Profile</h2>
        <p className="text-muted mb-3">Update your personal and sport information below.</p>

        {/* Display Name */}
        <div className="form-group">
          <label htmlFor="name" style={{ fontWeight: 700 }}>Display Name</label>
          <input
            id="name"
            type="text"
            className="form-control"
            placeholder="e.g., Jessie"
            value={profileData.name}
            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
          />
        </div>

        {/* Bio */}
        <div className="form-group">
          <label htmlFor="bio" style={{ fontWeight: 700 }}>Bio</label>
          <textarea
            id="bio"
            className="form-control"
            placeholder="Introduce yourself to coaches and teammates"
            value={profileData.bio}
            onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
            style={{ minHeight: 100, resize: "vertical" }}
          />
        </div>

        {/* School */}
        <div className="form-group">
          <label htmlFor="school" style={{ fontWeight: 700 }}>School</label>
          <input
            id="school"
            type="text"
            className="form-control"
            placeholder="e.g., Purdue"
            value={profileData.school}
            onChange={(e) => setProfileData({ ...profileData, school: e.target.value })}
          />
        </div>

        {/* Grade */}
        <div className="form-group">
          <label htmlFor="grade" style={{ fontWeight: 700 }}>Grade</label>
          <select
            id="grade"
            className="form-control"
            value={profileData.grade}
            onChange={(e) => setProfileData({ ...profileData, grade: e.target.value })}
          >
            <option value="">Select Grade</option>
            {GRADES.map((grade) => (
              <option key={grade.value} value={grade.value}>
                {grade.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sport */}
        <div className="form-group">
          <label htmlFor="sport" style={{ fontWeight: 700 }}>Sport</label>
          <select
            id="sport"
            className="form-control"
            value={profileData.sport}
            onChange={(e) => setProfileData({ ...profileData, sport: e.target.value })}
          >
            <option value="">Select Sport</option>
            {SPORTS.map((sport) => (
              <option key={sport.value} value={sport.value}>
                {sport.label}
              </option>
            ))}
          </select>
        </div>

        {/* Position/Role */}
        <div className="form-group">
          <label htmlFor="position" style={{ fontWeight: 700 }}>Position/Role</label>
          <input
            id="position"
            type="text"
            className="form-control"
            placeholder="e.g., Sprinter, Point Guard"
            value={profileData.position}
            onChange={(e) => setProfileData({ ...profileData, position: e.target.value })}
          />
        </div>

        {/* Team */}
        <div className="form-group">
          <label htmlFor="team" style={{ fontWeight: 700 }}>Team</label>
          <input
            id="team"
            type="text"
            className="form-control"
            placeholder="Team/Club name (optional)"
            value={profileData.team}
            onChange={(e) => setProfileData({ ...profileData, team: e.target.value })}
          />
        </div>

        {/* Experience Level */}
        <div className="form-group">
          <label htmlFor="experience" style={{ fontWeight: 700 }}>Experience Level</label>
          <select
            id="experience"
            className="form-control"
            value={profileData.experience}
            onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
          >
            <option value="">Select Experience Level</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sport Details */}
        <div className="form-group">
          <label htmlFor="sportDetails" style={{ fontWeight: 700 }}>Sport Details</label>
          <textarea
            id="sportDetails"
            className="form-control"
            placeholder="Optional notes about events, distances, PBs, certifications, etc."
            value={profileData.sportDetails}
            onChange={(e) => setProfileData({ ...profileData, sportDetails: e.target.value })}
            style={{ minHeight: 90, resize: "vertical" }}
          />
        </div>

        {/* Goals & Objectives */}
        <div className="form-group">
          <label htmlFor="goals" style={{ fontWeight: 700 }}>Goals & Objectives</label>
          <textarea
            id="goals"
            className="form-control"
            placeholder="What are your upcoming goals?"
            value={profileData.goals}
            onChange={(e) => setProfileData({ ...profileData, goals: e.target.value })}
            style={{ minHeight: 100, resize: "vertical" }}
          />
        </div>

        {/* Text Notifications */}
        <div className="form-group">
          <label htmlFor="textNotifications" style={{ fontWeight: 700 }}>Text Notifications</label>
          <input
            id="textNotifications"
            type="checkbox"
            className="form-control"
            checked={profileData.textNotifications}
            onChange={(e) => setProfileData({ ...profileData, textNotifications: e.target.checked })}
          />
        </div>

        {/* Phone Number */}
        <div className="form-group">
          <label htmlFor="phoneNumber" style={{ fontWeight: 700 }}>Phone Number</label>
          <input
            id="phoneNumber"
            type="tel"
            className="form-control"
            placeholder="+12345678910"
            value={profileData.phoneNumber}
            onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
          />
        </div>

        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ width: "100%" }}>
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {message && (
          <div className={`alert ${message.startsWith("Error") ? "alert-error" : "alert-success"}`} role="status">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
