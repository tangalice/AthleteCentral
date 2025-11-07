// src/components/CoachFeedbackPage.jsx
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { sendEmailNotification } from "../services/EmailNotificationService";

export default function CoachFeedbackPage() {
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [category, setCategory] = useState("practice");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  // Load all athletes
  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        const snapshot = await getDocs(collection(db, "users"));
        const list = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((u) => (u.role || "").toLowerCase() === "athlete");
        setAthletes(list);
      } catch (e) {
        console.error("Error fetching athletes:", e);
        setStatus("Error loading athletes.");
      }
    };
    fetchAthletes();
  }, []);

  // Handle feedback submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAthlete || !message.trim()) {
      setStatus("Please select an athlete and enter feedback.");
      return;
    }

    try {
      const coach = auth.currentUser;
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
      setMessage("");
      setSelectedAthlete("");
      
      // Send email notification (fire and forget)
      sendEmailNotification(selectedAthlete, 'coachAddedFeedback', {
        category,
        coachName: coach.displayName || coach.email || "Coach",
      }).catch((emailError) => {
        console.error('Error sending email notification:', emailError);
      });
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setStatus("Error submitting feedback.");
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
            style={{
              padding: 10,
              fontSize: 16,
              borderRadius: 6,
              border: "1px solid #d1d5db",
            }}
          >
            <option value="">Select Athlete</option>
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
            style={{
              padding: 10,
              fontSize: 16,
              borderRadius: 6,
              border: "1px solid #d1d5db",
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
            style={{
              padding: 10,
              fontSize: 16,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              minHeight: 100,
            }}
          />

          {/* Submit Button */}
          <button
            type="submit"
            style={{
              padding: 10,
              fontSize: 16,
              fontWeight: 600,
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Submit Feedback
          </button>
        </form>

        {status && (
          <p style={{ marginTop: 16, color: "#374151", fontWeight: 500 }}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}