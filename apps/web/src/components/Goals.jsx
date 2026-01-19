// src/components/Goals.jsx

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
  const [practiceType, setPracticeType] = useState("");
  const [customPiece, setCustomPiece] = useState("");
  const [filters, setFilters] = useState({
    Academic: true,
    Practice: true,
    Competition: true,
    "Coach Suggested": true,
  });
  const [loading, setLoading] = useState(true);
  const [expandedGoal, setExpandedGoal] = useState(null);

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
    
    // Validate practice type if Practice category
    if (category === "Practice" && !practiceType) {
      alert("Please select a practice type");
      return;
    }
    
    // Validate custom piece name if custom is selected
    if (category === "Practice" && practiceType === "Custom" && !customPiece.trim()) {
      alert("Please enter a custom piece name");
      return;
    }

    try {
      const newGoal = {
        title,
        category,
        completed: false,
        createdAt: new Date(),
        coachComments: [],
      };
      
      // Add practice-specific fields
      if (category === "Practice") {
        newGoal.practiceType = practiceType;
        if (practiceType === "Custom") {
          newGoal.customPieceName = customPiece.trim();
        }
      }

      await addDoc(collection(db, "users", user.uid, "goalsList"), newGoal);
      setTitle("");
      setCategory("");
      setPracticeType("");
      setCustomPiece("");
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

  // Helper to display practice type
  const getPracticeTypeLabel = (goal) => {
    if (goal.category !== "Practice") return null;
    if (goal.practiceType === "Custom") {
      return goal.customPieceName || "Custom Piece";
    }
    return goal.practiceType || "General";
  };

  // Format date for comments
  const formatCommentDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

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
            padding: 16,
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
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
            onChange={(e) => {
              setCategory(e.target.value);
              setPracticeType("");
              setCustomPiece("");
            }}
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
          </select>
          
          {/* Practice Type Subcategory */}
          {category === "Practice" && (
            <>
              <select
                value={practiceType}
                onChange={(e) => {
                  setPracticeType(e.target.value);
                  if (e.target.value !== "Custom") {
                    setCustomPiece("");
                  }
                }}
                required
                style={{
                  padding: 10,
                  fontSize: 16,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                }}
              >
                <option value="">Select practice type</option>
                <option value="General">General</option>
                <option value="2k">2k Piece</option>
                <option value="5k">5k Piece</option>
                <option value="6k">6k Piece</option>
                <option value="Custom">Custom Piece</option>
              </select>
              
              {practiceType === "Custom" && (
                <input
                  type="text"
                  placeholder="Enter piece name (e.g., 500m, 10k, etc.)"
                  value={customPiece}
                  onChange={(e) => setCustomPiece(e.target.value)}
                  required
                  style={{
                    padding: 10,
                    fontSize: 16,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                  }}
                />
              )}
            </>
          )}
          
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
              style={{
                background:
                  goal.category === "Coach Suggested"
                    ? "#ecfdf5"
                    : "#fff",
                border: "1px solid #e5e7eb",
                borderLeft:
                  goal.category === "Coach Suggested"
                    ? "5px solid #10b981"
                    : goal.category === "Practice"
                    ? "5px solid #3b82f6"
                    : goal.category === "Competition"
                    ? "5px solid #f59e0b"
                    : goal.category === "Academic"
                    ? "5px solid #8b5cf6"
                    : "5px solid transparent",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={goal.completed}
                    onChange={() => handleToggleComplete(goal)}
                    style={{ marginTop: 5 }}
                  />
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        margin: 0,
                        textDecoration: goal.completed ? "line-through" : "none",
                        color: goal.completed ? "#9ca3af" : "#111827",
                      }}
                    >
                      {goal.title}
                    </h3>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      <span style={{ 
                        padding: "2px 8px", 
                        backgroundColor: goal.category === "Practice" ? "#dbeafe" : 
                                         goal.category === "Competition" ? "#fef3c7" :
                                         goal.category === "Academic" ? "#ede9fe" :
                                         "#d1fae5",
                        color: goal.category === "Practice" ? "#1e40af" : 
                               goal.category === "Competition" ? "#92400e" :
                               goal.category === "Academic" ? "#5b21b6" :
                               "#065f46",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {goal.category}
                      </span>
                      {goal.category === "Practice" && goal.practiceType && (
                        <span style={{ 
                          padding: "2px 8px", 
                          backgroundColor: "#e0e7ff",
                          color: "#3730a3",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          {getPracticeTypeLabel(goal)}
                        </span>
                      )}
                      {/* Coach Comments Indicator */}
                      {goal.coachComments && goal.coachComments.length > 0 && (
                        <span 
                          style={{ 
                            padding: "2px 8px", 
                            backgroundColor: "#fef3c7",
                            color: "#92400e",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                          onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                        >
                          {goal.coachComments.length} comment{goal.coachComments.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {goal.category === "Coach Suggested" && goal.suggestedByName && (
                      <p
                        style={{
                          margin: "4px 0 0",
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

              {/* Coach Comments Section (Expandable) */}
              {goal.coachComments && goal.coachComments.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6b7280",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {expandedGoal === goal.id ? "▼" : "▶"} View Coach Feedback
                  </button>
                  
                  {expandedGoal === goal.id && (
                    <div style={{ 
                      marginTop: 10, 
                      paddingLeft: 12,
                      borderLeft: "3px solid #10b981",
                    }}>
                      {goal.coachComments.map((comment, idx) => (
                        <div 
                          key={idx}
                          style={{
                            padding: "10px 12px",
                            backgroundColor: "#f0fdf4",
                            borderRadius: 6,
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            marginBottom: 6,
                          }}>
                            <span style={{ 
                              fontWeight: 600, 
                              fontSize: 13, 
                              color: "#065f46" 
                            }}>
                              {comment.coachName || "Coach"}
                            </span>
                            <span style={{ 
                              fontSize: 11, 
                              color: "#6b7280" 
                            }}>
                              {formatCommentDate(comment.createdAt)}
                            </span>
                          </div>
                          <p style={{ 
                            margin: 0, 
                            fontSize: 14, 
                            color: "#374151",
                            lineHeight: 1.5,
                          }}>
                            {comment.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}