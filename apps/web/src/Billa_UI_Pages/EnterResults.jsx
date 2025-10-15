import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";

export default function EnterResults({ user }) {
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [resultType, setResultType] = useState("practice"); // practice or competition
  const [formData, setFormData] = useState({
    date: "",
    eventName: "",
    result: "",
    notes: "",
    // for practice
    workoutType: "",
    intensity: "moderate",
    // for competition
    competitionName: "",
    location: "",
    placement: "",
    eventType: ""
  });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // fetch all athletes
  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        const athletesQuery = query(
          collection(db, "users"),
          where("role", "==", "athlete")
        );
        const snapshot = await getDocs(athletesQuery);
        const athletesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAthletes(athletesList);
      } catch (error) {
        console.error("Error fetching athletes:", error);
      }
    };
    fetchAthletes();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedAthlete) {
      setStatus("Please select an athlete");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const collectionName = resultType === "competition" 
        ? "competitionResults" 
        : "practiceResults";

      const resultData = {
        date: Timestamp.fromDate(new Date(formData.date)),
        result: formData.result,
        notes: formData.notes,
        coachId: user.uid,
        coachName: user.displayName || "Coach",
        createdAt: Timestamp.now()
      };

      // Add type-specific fields
      if (resultType === "competition") {
        resultData.competitionName = formData.competitionName;
        resultData.eventName = formData.eventName;
        resultData.location = formData.location;
        resultData.placement = formData.placement;
        resultData.eventType = formData.eventType;
      } else {
        resultData.workoutType = formData.workoutType;
        resultData.intensity = formData.intensity;
      }

      await addDoc(
        collection(db, "users", selectedAthlete, collectionName),
        resultData
      );

      setStatus(`${resultType === "competition" ? "Competition" : "Practice"} result added successfully!`);
      
      // Reset form
      setFormData({
        date: "",
        eventName: "",
        result: "",
        notes: "",
        workoutType: "",
        intensity: "moderate",
        competitionName: "",
        location: "",
        placement: "",
        eventType: ""
      });
      setSelectedAthlete("");
    } catch (error) {
      console.error("Error adding result:", error);
      setStatus("Error adding result. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h2 style={{ color: "#fff" }}>Enter Results</h2>
      <p style={{ color: "#999", marginBottom: "30px" }}>
        Add competition or practice results for your athletes
      </p>

      <form onSubmit={handleSubmit}>
        {/* Select Athlete */}
        <div style={{
          marginBottom: "20px",
          padding: "20px",
          backgroundColor: "#2a2a2a",
          borderRadius: "8px",
          border: "1px solid #444"
        }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "bold",
            color: "#fff"
          }}>
            Select Athlete: *
          </label>
          <select
            value={selectedAthlete}
            onChange={(e) => setSelectedAthlete(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #444",
              backgroundColor: "#1a1a1a",
              color: "#fff",
              fontSize: "14px"
            }}
          >
            <option value="">-- Select an athlete --</option>
            {athletes.map(athlete => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.displayName || athlete.email}
              </option>
            ))}
          </select>
        </div>

        {/* Result Type Toggle */}
        <div style={{
          marginBottom: "20px",
          padding: "20px",
          backgroundColor: "#2a2a2a",
          borderRadius: "8px",
          border: "1px solid #444"
        }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "bold",
            color: "#fff"
          }}>
            Result Type: *
          </label>
          <div style={{ display: "flex", gap: "15px" }}>
            <label style={{ display: "flex", alignItems: "center", color: "#fff", cursor: "pointer" }}>
              <input
                type="radio"
                name="resultType"
                value="practice"
                checked={resultType === "practice"}
                onChange={(e) => setResultType(e.target.value)}
                style={{ marginRight: "8px" }}
              />
              Practice
            </label>
            <label style={{ display: "flex", alignItems: "center", color: "#fff", cursor: "pointer" }}>
              <input
                type="radio"
                name="resultType"
                value="competition"
                checked={resultType === "competition"}
                onChange={(e) => setResultType(e.target.value)}
                style={{ marginRight: "8px" }}
              />
              Competition
            </label>
          </div>
        </div>

        {/* Common Fields */}
        <div style={{
          marginBottom: "20px",
          padding: "20px",
          backgroundColor: "#2a2a2a",
          borderRadius: "8px",
          border: "1px solid #444"
        }}>
          <h3 style={{ color: "#fff", marginBottom: "15px", fontSize: "18px" }}>
            {resultType === "competition" ? "Competition" : "Practice"} Details
          </h3>

          {/* Date */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "5px", 
              fontWeight: "bold",
              color: "#fff"
            }}>
              Date: *
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              required
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #444",
                backgroundColor: "#1a1a1a",
                color: "#fff"
              }}
            />
          </div>

          {/* Competition-specific fields */}
          {resultType === "competition" && (
            <>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "5px", 
                  fontWeight: "bold",
                  color: "#fff"
                }}>
                  Competition Name: *
                </label>
                <input
                  type="text"
                  name="competitionName"
                  value={formData.competitionName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., State Championships"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "5px",
                    border: "1px solid #444",
                    backgroundColor: "#1a1a1a",
                    color: "#fff"
                  }}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "5px", 
                  fontWeight: "bold",
                  color: "#fff"
                }}>
                  Event Name: *
                </label>
                <input
                  type="text"
                  name="eventName"
                  value={formData.eventName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., 100m Freestyle"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "5px",
                    border: "1px solid #444",
                    backgroundColor: "#1a1a1a",
                    color: "#fff"
                  }}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "5px", 
                  fontWeight: "bold",
                  color: "#fff"
                }}>
                  Location:
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g., City Arena"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "5px",
                    border: "1px solid #444",
                    backgroundColor: "#1a1a1a",
                    color: "#fff"
                  }}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "5px", 
                  fontWeight: "bold",
                  color: "#fff"
                }}>
                  Event Type:
                </label>
                <select
                  name="eventType"
                  value={formData.eventType}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "5px",
                    border: "1px solid #444",
                    backgroundColor: "#1a1a1a",
                    color: "#fff"
                  }}
                >
                  <option value="">Select type</option>
                  <option value="sprint">Sprint</option>
                  <option value="distance">Distance</option>
                  <option value="relay">Relay</option>
                  <option value="field">Field</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "5px", 
                  fontWeight: "bold",
                  color: "#fff"
                }}>
                  Placement:
                </label>
                <input
                  type="text"
                  name="placement"
                  value={formData.placement}
                  onChange={handleInputChange}
                  placeholder="e.g., 1, 2, 3"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "5px",
                    border: "1px solid #444",
                    backgroundColor: "#1a1a1a",
                    color: "#fff"
                  }}
                />
              </div>
            </>
          )}

          {/* Practice-specific fields */}
          {resultType === "practice" && (
            <>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "5px", 
                  fontWeight: "bold",
                  color: "#fff"
                }}>
                  Workout Type: *
                </label>
                <input
                  type="text"
                  name="workoutType"
                  value={formData.workoutType}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Endurance Training, Speed Work"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "5px",
                    border: "1px solid #444",
                    backgroundColor: "#1a1a1a",
                    color: "#fff"
                  }}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "5px", 
                  fontWeight: "bold",
                  color: "#fff"
                }}>
                  Intensity: *
                </label>
                <select
                  name="intensity"
                  value={formData.intensity}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "5px",
                    border: "1px solid #444",
                    backgroundColor: "#1a1a1a",
                    color: "#fff"
                  }}
                >
                  <option value="easy">Easy</option>
                  <option value="moderate">Moderate</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </>
          )}

          {/* Result/Time */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "5px", 
              fontWeight: "bold",
              color: "#fff"
            }}>
              Result/Time: *
            </label>
            <input
              type="text"
              name="result"
              value={formData.result}
              onChange={handleInputChange}
              required
              placeholder="e.g., 52.3s, 5:23.1"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #444",
                backgroundColor: "#1a1a1a",
                color: "#fff"
              }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "5px", 
              fontWeight: "bold",
              color: "#fff"
            }}>
              Notes:
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Additional comments or observations"
              rows="4"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #444",
                backgroundColor: "#1a1a1a",
                color: "#fff",
                resize: "vertical",
                fontFamily: "inherit"
              }}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            fontSize: "16px",
            fontWeight: "bold",
            backgroundColor: loading ? "#666" : "#10b981",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => {
            if (!loading) e.target.style.backgroundColor = "#059669";
          }}
          onMouseLeave={(e) => {
            if (!loading) e.target.style.backgroundColor = "#10b981";
          }}
        >
          {loading ? "Adding Result..." : "Add Result"}
        </button>

        {/* Status Message */}
        {status && (
          <div style={{
            marginTop: "20px",
            padding: "12px",
            backgroundColor: status.includes("Error") ? "#7f1d1d" : "#065f46",
            color: "#fff",
            borderRadius: "6px",
            textAlign: "center"
          }}>
            {status}
          </div>
        )}
      </form>
    </div>
  );
}