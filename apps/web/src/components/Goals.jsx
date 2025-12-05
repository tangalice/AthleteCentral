import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

export default function Goals({ user }) {
  const [goals, setGoals] = useState([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [filters, setFilters] = useState({
    Academic: true,
    Practice: true,
    Competition: true,
    "Coach Suggested": true,
  });
  const [loading, setLoading] = useState(true);

  // Realtime listener for user's goals
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "goalsList"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGoals(list);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Add new goal (by the athlete)
  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!title || !category) return;

    try {
      const newGoal = {
        title,
        category,
        completed: false,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "users", user.uid, "goalsList"), newGoal);
      setTitle("");
      setCategory("");
    } catch (err) {
      console.error("Error adding goal:", err);
      alert("Could not add goal.");
    }
  };

  const handleToggleComplete = async (goal) => {
    try {
      const newCompleted = !goal.completed;
      const ref = doc(db, "users", user.uid, "goalsList", goal.id);
      await updateDoc(ref, { completed: newCompleted });

      // If this is a coach-suggested goal being marked as completed,
      // create an in-app notification for the coach.
      if (
        newCompleted &&
        goal.category === "Coach Suggested" &&
        goal.suggestedBy
      ) {
        try {
          const coachNotificationsRef = collection(
            db,
            "users",
            goal.suggestedBy,
            "notifications"
          );

          await addDoc(coachNotificationsRef, {
            type: "goalCompleted",
            goalId: goal.id,
            goalTitle: goal.title || "Goal",
            athleteId: user.uid,
            athleteName:
              user.displayName || user.name || user.email || "Your athlete",
            createdAt: new Date(),
          });
        } catch (notifyErr) {
          // Don't block the user if notification write fails
          console.error(
            "Error creating coach goal-completed notification:",
            notifyErr
          );
        }
      }
    } catch (err) {
      console.error("Error updating goal:", err);
    }
  };

  const handleDelete = async (goalId) => {
    try {
      const ref = doc(db, "users", user.uid, "goalsList", goalId);
      await deleteDoc(ref);
    } catch (err) {
      console.error("Error deleting goal:", err);
    }
  };

  const filteredGoals = goals.filter((g) => filters[g.category]);

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 20px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 10 }}>
          My Goals
        </h2>

        {/* Filter Bar */}
        <div
          style={{
            display: "flex",
            gap: 12,
            background: "#f9fafb",
            borderRadius: 8,
            padding: 10,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          {Object.keys(filters).map((key) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={() =>
                  setFilters((f) => ({ ...f, [key]: !f[key] }))
                }
              />
              {key}
            </label>
          ))}
        </div>

        {/* Add Goal Form */}
        <form
          onSubmit={handleAddGoal}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 20,
          }}
        >
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
            <option value="">Select category</option>
            <option value="Academic">Academic</option>
            <option value="Practice">Practice</option>
            <option value="Competition">Competition</option>
            <option value="Coach Suggested">Coach Suggested</option>
          </select>
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
            Add Goal
          </button>
        </form>

        {/* Goal List */}
        {loading ? (
          <p>Loading goals...</p>
        ) : filteredGoals.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No goals to display.</p>
        ) : (
          filteredGoals.map((goal) => (
            <div
              key={goal.id}
              className="goal-item"
              style={{
                background:
                  goal.category === "Coach Suggested"
                    ? "#ecfdf5"
                    : "#fff",
                border: "1px solid #e5e7eb",
                borderLeft:
                  goal.category === "Coach Suggested"
                    ? "5px solid #10b981"
                    : "5px solid transparent",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={goal.completed}
                  onChange={() => handleToggleComplete(goal)}
                  style={{ marginTop: 5 }}
                />
                <div>
                  <h3
                    style={{
                      margin: 0,
                      textDecoration: goal.completed ? "line-through" : "none",
                      color: goal.completed ? "#9ca3af" : "#111827",
                    }}
                  >
                    {goal.title}
                  </h3>
                  <p style={{ margin: "4px 0", color: "#6b7280", fontSize: 14 }}>
                    Category: {goal.category}
                  </p>
                  {goal.category === "Coach Suggested" && goal.suggestedByName && (
                    <p
                      style={{
                        margin: "2px 0 0",
                        color: "#059669",
                        fontSize: 13,
                        fontStyle: "italic",
                      }}
                    >
                      Suggested by {goal.suggestedByName}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(goal.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ✖
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}