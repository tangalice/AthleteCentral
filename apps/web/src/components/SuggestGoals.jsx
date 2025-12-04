import { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { sendEmailNotification } from "../services/EmailNotificationService";

export default function SuggestGoals({ user }) {
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");

  // Fetch all athletes from the users collection
  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "athlete"));
        const snapshot = await getDocs(q);
        setAthletes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error fetching athletes:", e);
      }
    };
    fetchAthletes();
  }, []);

  // Handle coach suggestion submission
  const handleSuggestGoal = async (e) => {
    e.preventDefault();
    if (!selectedAthlete || !title) {
      setStatus("Please select an athlete and enter a goal title.");
      return;
    }

    try {
      const coach = auth.currentUser;
      const athleteRef = collection(db, "users", selectedAthlete, "goalsList");

      // Automatically assign the "Coach Suggested" category
      const newGoal = {
        title,
        category: "Coach Suggested",
        completed: false,
        suggestedBy: coach.uid,
        suggestedByName: coach.displayName || "Coach",
        suggested: true,
        createdAt: new Date(),
      };

      await addDoc(athleteRef, newGoal);

      // In-app notification for the athlete
      try {
        const athleteNotificationsRef = collection(
          db,
          "users",
          selectedAthlete,
          "notifications"
        );
        await addDoc(athleteNotificationsRef, {
          type: "coachSuggestedGoal",
          goalTitle: title,
          coachId: coach.uid,
          coachName: coach.displayName || coach.email || "Coach",
          athleteId: selectedAthlete,
          createdAt: new Date(),
        });
      } catch (notifyErr) {
        console.error(
          "Error creating athlete goal suggestion notification:",
          notifyErr
        );
      }
      setStatus("Goal successfully suggested!");
      setTitle("");
      setSelectedAthlete("");
      
      // Send email notification (fire and forget)
      sendEmailNotification(selectedAthlete, 'coachSuggestedGoals', {
        goalTitle: title,
        coachName: coach.displayName || coach.email || "Coach",
      }).catch((emailError) => {
        console.error('Error sending email notification:', emailError);
      });
    } catch (err) {
      console.error("Error suggesting goal:", err);
      setStatus("Error suggesting goal.");
    }
  };

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 20px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 10 }}>
          Suggest a Goal
        </h2>

        {/* Suggestion form */}
        <form
          onSubmit={handleSuggestGoal}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {/* Choose athlete */}
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

          {/* Goal title */}
          <input
            type="text"
            placeholder="Goal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              padding: 10,
              fontSize: 16,
              borderRadius: 6,
              border: "1px solid #d1d5db",
            }}
          />

          {/* Add button */}
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
            Suggest Goal
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