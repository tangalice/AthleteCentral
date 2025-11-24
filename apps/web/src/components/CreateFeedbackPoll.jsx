import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp, 
  Timestamp 
} from "firebase/firestore";

export default function CreateFeedbackPoll() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [options, setOptions] = useState(["", ""]); // Start with 2 empty options
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);

  // Load Coach's Teams
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Query teams where the current user is a coach
        const q = query(
          collection(db, "teams"),
          where("coaches", "array-contains", user.uid)
        );
        
        const snapshot = await getDocs(q);
        const loadedTeams = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        
        setTeams(loadedTeams);
      } catch (error) {
        console.error("Error loading teams:", error);
        setMessage({ type: "error", text: "Failed to load teams." });
      }
    };

    fetchTeams();
  }, []);

  // Handle Option Changes
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, ""]);
  };

  const removeOption = (index) => {
    if (options.length <= 2) {
      setMessage({ type: "error", text: "A poll must have at least 2 options." });
      return;
    }
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
  };

  // Handle Team Selection
  const toggleTeam = (teamId) => {
    setSelectedTeamIds(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    // Validation
    if (!title.trim()) {
      setMessage({ type: "error", text: "Please enter a poll title." });
      return;
    }
    if (!deadline) {
      setMessage({ type: "error", text: "Please set a voting deadline." });
      return;
    }
    if (new Date(deadline) <= new Date()) {
      setMessage({ type: "error", text: "Deadline must be in the future." });
      return;
    }
    if (selectedTeamIds.length === 0) {
      setMessage({ type: "error", text: "Please select at least one team." });
      return;
    }
    
    // Filter out empty options
    const cleanOptions = options.map(o => o.trim()).filter(o => o !== "");
    if (cleanOptions.length < 2) {
      setMessage({ type: "error", text: "Please provide at least 2 valid options." });
      return;
    }

    setLoading(true);

    try {
      const pollData = {
        title: title.trim(),
        description: description.trim(),
        options: cleanOptions,
        deadline: Timestamp.fromDate(new Date(deadline)),
        teamIds: selectedTeamIds, // Critical for Dashboard filtering
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        status: "open",
        totalVotes: 0
      };

      await addDoc(collection(db, "feedbackPolls"), pollData);

      setMessage({ type: "success", text: "Poll created successfully!" });
      
      // Navigate back to dashboard after a short delay
      setTimeout(() => {
        navigate("/");
      }, 1500);

    } catch (error) {
      console.error("Error creating poll:", error);
      setMessage({ type: "error", text: `Error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2>Create New Poll</h2>
          <button className="btn btn-outline" onClick={() => navigate(-1)}>Cancel</button>
        </div>

        {message.text && (
          <div className={`alert ${message.type === "error" ? "alert-danger" : "alert-success"}`} style={{ marginBottom: 20 }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card" style={{ padding: 24 }}>
          
          {/* 1. Basic Info */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>Poll Title *</label>
            <input
              type="text"
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Next Practice Time?"
              style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>Description (Optional)</label>
            <textarea
              className="form-control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context for the athletes..."
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
            />
          </div>

          {/* 2. Options Logic */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>Poll Options *</label>
            {options.map((option, index) => (
              <div key={index} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="btn btn-outline text-danger"
                    style={{ padding: "0 15px" }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="btn btn-secondary"
              style={{ fontSize: 14 }}
            >
              + Add Another Option
            </button>
          </div>

          {/* 3. Deadline */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>Voting Deadline *</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
            />
          </div>

          {/* 4. Target Teams */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>Target Teams *</label>
            <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, maxHeight: 150, overflowY: "auto" }}>
              {teams.length === 0 ? (
                <p className="text-muted">No teams found. You need to create a team first.</p>
              ) : (
                teams.map(team => (
                  <label key={team.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.includes(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      style={{ width: 18, height: 18 }}
                    />
                    {team.name}
                  </label>
                ))
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%", padding: 12, fontWeight: "bold" }}
          >
            {loading ? "Creating..." : "Create Poll"}
          </button>

        </form>
      </div>
    </div>
  );
}