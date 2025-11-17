// src/components/LogWorkout.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
} from "firebase/firestore";

export default function LogWorkout({ userRole, user }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    teamId: "",
    workoutType: "",
    duration: "",
    date: "",
    time: "",
  });

  // Fetch user's teams
  useEffect(() => {
    if (!auth.currentUser || userRole !== "athlete") {
      setLoading(false);
      return;
    }

    const fetchTeams = async () => {
      try {
        const teamsList = [];
        
        // Query teams where user is in athletes array
        const athletesQuery = query(
          collection(db, "teams"),
          where("athletes", "array-contains", auth.currentUser.uid)
        );
        const athletesSnapshot = await getDocs(athletesQuery);
        athletesSnapshot.forEach((doc) => {
          const data = doc.data();
          if (!teamsList.find(t => t.id === doc.id)) {
            teamsList.push({ id: doc.id, name: data.name || "Unnamed Team" });
          }
        });

        // Query teams where user is in members array
        const membersQuery = query(
          collection(db, "teams"),
          where("members", "array-contains", auth.currentUser.uid)
        );
        const membersSnapshot = await getDocs(membersQuery);
        membersSnapshot.forEach((doc) => {
          const data = doc.data();
          if (!teamsList.find(t => t.id === doc.id)) {
            teamsList.push({ id: doc.id, name: data.name || "Unnamed Team" });
          }
        });

        setTeams(teamsList);
      } catch (error) {
        console.error("Error fetching teams:", error);
        setError("Failed to load teams. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [userRole]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validation
    if (!formData.teamId) {
      setError("Please select a team");
      return;
    }
    if (!formData.workoutType.trim()) {
      setError("Please enter a workout type");
      return;
    }
    if (!formData.duration || parseFloat(formData.duration) <= 0) {
      setError("Please enter a valid duration (in minutes)");
      return;
    }
    if (!formData.date) {
      setError("Please select a date");
      return;
    }
    if (!formData.time) {
      setError("Please select a time");
      return;
    }

    setSubmitting(true);

    try {
      // Combine date and time into a single datetime
      const dateTimeString = `${formData.date}T${formData.time}`;
      const workoutDateTime = new Date(dateTimeString);
      
      if (isNaN(workoutDateTime.getTime())) {
        setError("Invalid date or time");
        setSubmitting(false);
        return;
      }

      // Get team name for reference
      const selectedTeam = teams.find(t => t.id === formData.teamId);
      const teamName = selectedTeam?.name || "Unknown Team";

      // Save workout to Firestore
      const workoutData = {
        userId: auth.currentUser.uid,
        userName: user?.displayName || user?.email || "Unknown User",
        userEmail: user?.email || "",
        teamId: formData.teamId,
        teamName: teamName,
        workoutType: formData.workoutType.trim(),
        duration: parseFloat(formData.duration),
        dateTime: Timestamp.fromDate(workoutDateTime),
        createdAt: Timestamp.now(),
        status: "completed",
      };

      await addDoc(collection(db, "workouts"), workoutData);

      setSuccess(true);
      
      // Reset form
      setFormData({
        teamId: "",
        workoutType: "",
        duration: "",
        date: "",
        time: "",
      });

      // Redirect to activity feed after 2 seconds
      setTimeout(() => {
        navigate("/activity");
      }, 2000);
    } catch (error) {
      console.error("Error saving workout:", error);
      setError("Failed to save workout. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Set default date to today and time to current time
  useEffect(() => {
    if (!formData.date && !formData.time) {
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0].slice(0, 5);
      setFormData((prev) => ({
        ...prev,
        date: dateStr,
        time: timeStr,
      }));
    }
  }, []);

  if (userRole !== "athlete") {
    return (
      <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <div className="card">
          <p>This page is only available for athletes.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <div className="spinner" aria-label="Loading"></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
      <div className="card" style={{ maxWidth: 600, margin: "0 auto" }}>
        <h2 style={{ marginBottom: 24, fontWeight: 800, color: "#111827" }}>
          Log Workout
        </h2>

        {error && (
          <div
            className="alert alert-danger"
            style={{ marginBottom: 16 }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="alert alert-success"
            style={{ marginBottom: 16 }}
          >
            Workout logged successfully! Redirecting to activity feed...
          </div>
        )}

        {teams.length === 0 ? (
          <div className="alert alert-warning">
            <p>You are not part of any teams yet. Please join a team first.</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/teams")}
              style={{ marginTop: 12 }}
            >
              Go to Teams
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="teamId"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Team <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                id="teamId"
                name="teamId"
                value={formData.teamId}
                onChange={handleChange}
                className="form-control"
                required
              >
                <option value="">Select a team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="workoutType"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Workout Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                id="workoutType"
                name="workoutType"
                value={formData.workoutType}
                onChange={handleChange}
                className="form-control"
                placeholder="e.g., Sprint Workout, Tempo Run, Strength Session"
                required
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="duration"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Duration (minutes) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="number"
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="form-control"
                placeholder="e.g., 30"
                min="1"
                step="1"
                required
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="date"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Date <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="form-control"
                required
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                htmlFor="time"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Time <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="time"
                id="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="form-control"
                required
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate("/activity")}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Log Workout"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

