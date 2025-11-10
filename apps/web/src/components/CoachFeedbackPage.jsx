// src/components/CoachFeedbackPage.jsx
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, query, where, getDoc, doc } from "firebase/firestore";
import { sendEmailNotification } from "../services/EmailNotificationService";

export default function CoachFeedbackPage() {
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [category, setCategory] = useState("practice");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [teamAthletes, setTeamAthletes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load coach's team athletes
  useEffect(() => {
    const fetchTeamAthletes = async () => {
      try {
        const coach = auth.currentUser;
        if (!coach) return;

        // Find teams where coach is a member
        const teamsQuery = query(
          collection(db, "teams"),
          where("coaches", "array-contains", coach.uid)
        );
        
        const teamsSnapshot = await getDocs(teamsQuery);
        
        if (teamsSnapshot.empty) {
          // Fallback: try members array
          const teamsQuery2 = query(
            collection(db, "teams"),
            where("members", "array-contains", coach.uid)
          );
          const teamsSnapshot2 = await getDocs(teamsQuery2);
          
          if (!teamsSnapshot2.empty) {
            await loadTeamMembers(teamsSnapshot2.docs[0]);
          }
        } else {
          await loadTeamMembers(teamsSnapshot.docs[0]);
        }
      } catch (e) {
        console.error("Error fetching team athletes:", e);
      }
    };

    const loadTeamMembers = async (teamDoc) => {
      const teamData = teamDoc.data();
      const memberIds = [
        ...(teamData.athletes || []),
        ...(teamData.members || [])
      ];

      const athletesList = [];
      for (const memberId of memberIds) {
        try {
          const userDocRef = doc(db, "users", memberId);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === "athlete") {
              athletesList.push({
                id: memberId,
                displayName: userData.displayName || userData.name || userData.email,
                email: userData.email
              });
            }
          }
        } catch (err) {
          console.error("Error loading athlete:", memberId, err);
        }
      }

      setTeamAthletes(athletesList);
      setAthletes(athletesList);
    };

    fetchTeamAthletes();
  }, []);

  // Handle feedback submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAthlete || !message.trim()) {
      setStatus("Please select an athlete and enter feedback.");
      return;
    }

    setLoading(true);
    setStatus("Sending feedback...");

    try {
      const coach = auth.currentUser;

      // Check if sending to entire team
      if (selectedAthlete === "ALL_TEAM") {
        let successCount = 0;
        let failCount = 0;

        for (const athlete of teamAthletes) {
          try {
            const feedbackRef = collection(db, "users", athlete.id, "feedbackList");

            const newFeedback = {
              coachId: coach.uid,
              coachName: coach.displayName || "Coach",
              category,
              message,
              date: new Date(),
            };

            await addDoc(feedbackRef, newFeedback);
            successCount++;

            // Send email notification (fire and forget)
            sendEmailNotification(athlete.id, 'coachAddedFeedback', {
              category,
              coachName: coach.displayName || coach.email || "Coach",
            }).catch((emailError) => {
              console.error('Error sending email notification:', emailError);
            });
          } catch (err) {
            console.error(`Error sending feedback to ${athlete.displayName}:`, err);
            failCount++;
          }
        }

        setStatus(`Feedback sent to ${successCount} athlete${successCount !== 1 ? 's' : ''}!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
      } else {
        // Send to individual athlete
        const feedbackRef = collection(db, "users", selectedAthlete, "feedbackList");

        const newFeedback = {
          coachId: coach.uid,
          coachName: coach.displayName || "Coach",
          category,
          message,
          date: new Date(),
        };

        await addDoc(feedbackRef, newFeedback);
        setStatus("Feedback successfully submitted!");

        // Send email notification (fire and forget)
        sendEmailNotification(selectedAthlete, 'coachAddedFeedback', {
          category,
          coachName: coach.displayName || coach.email || "Coach",
        }).catch((emailError) => {
          console.error('Error sending email notification:', emailError);
        });
      }

      setMessage("");
      setSelectedAthlete("");
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setStatus("Error submitting feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 20px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 10 }}>
          Give Athlete Feedback
        </h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {/* Athlete Selector */}
          <select
            value={selectedAthlete}
            onChange={(e) => setSelectedAthlete(e.target.value)}
            required
            disabled={loading}
            style={{
              padding: 10,
              fontSize: 16,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              backgroundColor: loading ? "#f3f4f6" : "white",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            <option value="">Select Athlete</option>
            <option value="ALL_TEAM" style={{ fontWeight: "bold", color: "#10b981" }}>
              📢 Send to Entire Team ({teamAthletes.length} athletes)
            </option>
            <option disabled>──────────</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.displayName || athlete.email || athlete.id}
              </option>
            ))}
          </select>

          {/* Category Selector */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            disabled={loading}
            style={{
              padding: 10,
              fontSize: 16,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              backgroundColor: loading ? "#f3f4f6" : "white",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            <option value="practice">Practice</option>
            <option value="competition">Competition</option>
          </select>

          {/* Feedback Message */}
          <textarea
            placeholder="Enter feedback..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            disabled={loading}
            style={{
              padding: 10,
              fontSize: 16,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              minHeight: 100,
              backgroundColor: loading ? "#f3f4f6" : "white",
              cursor: loading ? "not-allowed" : "text"
            }}
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 10,
              fontSize: 16,
              fontWeight: 600,
              background: loading ? "#d1d5db" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? "Sending..." : "Submit Feedback"}
          </button>
        </form>

        {status && (
          <div style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 6,
            backgroundColor: status.includes("Error") ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${status.includes("Error") ? "#fecaca" : "#bbf7d0"}`,
            color: status.includes("Error") ? "#991b1b" : "#166534",
            fontWeight: 500
          }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}