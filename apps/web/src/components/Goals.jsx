import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [user, setUser] = useState(null);
  const [filters, setFilters] = useState({
    Academic: true,
    Practice: true,
    Competition: true,
  });

  const [hasCustomGoal, setHasCustomGoal] = useState(false);

  // Watch auth state and goals in real time
  useEffect(() => {
    let unsubscribeGoals = null;

    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (!u) {
        setGoals([]);
        return;
      }

      const goalsRef = collection(db, "users", u.uid, "goalsList");

      try {
        // Check if subcollection exists or is empty
        const existing = await getDocs(goalsRef);
        if (existing.empty) {
          console.log("No goals found. Creating Welcome Goal Example...");
          await addDoc(goalsRef, {
            title: "Welcome Goal Example",
            category: "Academic",
            completed: false,
            systemGenerated: true,
            createdAt: new Date(),
          });
        }
      } catch (err) {
        console.error("Error checking or creating subcollection:", err);
      }

      // Real-time listener for user’s goals
      unsubscribeGoals = onSnapshot(goalsRef, (snapshot) => {
        const allGoals = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setGoals(allGoals);

        // Track if user has any non-system goals
        const custom = allGoals.some((g) => !g.systemGenerated);
        setHasCustomGoal(custom);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeGoals) unsubscribeGoals();
    };
  }, []);

  // Add a new goal
  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!title || !category || !user) return;

    const goalsRef = collection(db, "users", user.uid, "goalsList");
    try {
      await addDoc(goalsRef, {
        title,
        category,
        completed: false,
        createdAt: new Date(),
      });
      setTitle("");
      setCategory("");

      // Delete Welcome Example if present
      const welcomeSnap = await getDocs(query(goalsRef, where("systemGenerated", "==", true)));
      welcomeSnap.forEach(async (docSnap) => {
        await deleteDoc(doc(db, "users", user.uid, "goalsList", docSnap.id));
      });
    } catch (err) {
      console.error("Error adding goal:", err);
    }
  };

  // Toggle completion
  const handleToggleComplete = async (goalId, current) => {
    if (!user) return;
    try {
      const goalRef = doc(db, "users", user.uid, "goalsList", goalId);
      await updateDoc(goalRef, { completed: !current });
    } catch (err) {
      console.error("Error toggling goal:", err);
    }
  };

  // Delete a goal
  const handleDeleteGoal = async (goalId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "goalsList", goalId));
    } catch (err) {
      console.error("Error deleting goal:", err);
    }
  };

  // Edit goal title
  const handleEditTitle = async (goalId, newTitle) => {
    if (!user) return;
    try {
      const goalRef = doc(db, "users", user.uid, "goalsList", goalId);
      await updateDoc(goalRef, { title: newTitle });
    } catch (err) {
      console.error("Error editing title:", err);
    }
  };

  // Filter
  const toggleFilter = (cat) => {
    setFilters((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const filteredGoals = goals.filter((g) => filters[g.category]);

  /* ---------- Render ---------- */
  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh" }}>
      <div
        className="container"
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "32px 16px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, marginBottom: 20 }}>
          My Goals
        </h1>

        {/* ---------- Add Goal Form ---------- */}
        <form
          onSubmit={handleAddGoal}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 24,
            background: "#fff",
            padding: 16,
            borderRadius: 8,
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          }}
        >
          <input
            type="text"
            placeholder="Enter goal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 16,
            }}
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 16,
            }}
          >
            <option value="">Select Category</option>
            <option value="Academic">Academic</option>
            <option value="Practice">Practice</option>
            <option value="Competition">Competition</option>
          </select>

          <button
            type="submit"
            style={{
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "10px 0",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Add Goal
          </button>
        </form>

        {/* ---------- Filters ---------- */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            marginBottom: 20,
          }}
        >
          {["Academic", "Practice", "Competition"].map((cat) => (
            <label key={cat} style={{ fontSize: 15 }}>
              <input
                type="checkbox"
                checked={filters[cat]}
                onChange={() => toggleFilter(cat)}
                style={{ marginRight: 6 }}
              />
              {cat}
            </label>
          ))}
        </div>

        {/* ---------- Goal List ---------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredGoals.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280" }}>
              No goals yet. Add one above!
            </p>
          ) : (
            filteredGoals.map((goal) => (
              <GoalItem
                key={goal.id}
                goal={goal}
                onToggleComplete={() => handleToggleComplete(goal.id, goal.completed)}
                onDelete={() => handleDeleteGoal(goal.id)}
                onEditTitle={(newTitle) => handleEditTitle(goal.id, newTitle)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Single Goal Component ---------- */
function GoalItem({ goal, onToggleComplete, onDelete, onEditTitle }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);

  const handleSave = () => {
    if (editTitle.trim() !== "" && editTitle !== goal.title) {
      onEditTitle(editTitle);
    }
    setIsEditing(false);
  };

  return (
    <div
      style={{
        background: "#fff",
        padding: "12px 16px",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        <input type="checkbox" checked={goal.completed} onChange={onToggleComplete} />

        {isEditing ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            style={{
              flex: 1,
              border: "1px solid #d1d5db",
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: 16,
            }}
          />
        ) : (
          <div
            style={{
              textDecoration: goal.completed ? "line-through" : "none",
              color: goal.completed ? "#9ca3af" : "#111827",
              cursor: "text",
              flex: 1,
            }}
            onClick={() => setIsEditing(true)}
          >
            {goal.title}
          </div>
        )}

        <span
          style={{
            fontSize: 13,
            color: "#6b7280",
            fontStyle: "italic",
          }}
        >
          {goal.category}
        </span>
      </div>

      <button
        onClick={onDelete}
        style={{
          background: "none",
          border: "none",
          color: "#ef4444",
          fontSize: 18,
          cursor: "pointer",
          marginLeft: 8,
        }}
        title="Delete Goal"
      >
        ✖
      </button>
    </div>
  );
}