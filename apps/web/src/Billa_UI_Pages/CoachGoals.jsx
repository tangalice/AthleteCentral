// src/Billa_UI_Pages/CoachGoals.jsx

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

export default function CoachGoals({ user }) {
  const [allGoals, setAllGoals] = useState([]);
  const [athletes, setAthletes] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [practiceTypeFilter, setPracticeTypeFilter] = useState("all");
  const [athleteFilter, setAthleteFilter] = useState("all");
  const [completedFilter, setCompletedFilter] = useState("all");

  // Comment states
  const [commentingGoal, setCommentingGoal] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [expandedComments, setExpandedComments] = useState({});

  // Fetch all athletes and their goals
  useEffect(() => {
    const fetchAllGoals = async () => {
      try {
        setLoading(true);
        
        // Get all athletes
        const athletesQuery = query(
          collection(db, 'users'),
          where('role', '==', 'athlete')
        );
        const athletesSnapshot = await getDocs(athletesQuery);
        
        const athletesMap = {};
        const goalsPromises = [];
        
        athletesSnapshot.docs.forEach(doc => {
          const athleteData = { id: doc.id, ...doc.data() };
          athletesMap[doc.id] = athleteData;
          
          // Queue up goals fetch for each athlete
          goalsPromises.push(
            getDocs(collection(db, 'users', doc.id, 'goalsList')).then(goalsSnapshot => {
              return goalsSnapshot.docs.map(goalDoc => ({
                id: goalDoc.id,
                odId: doc.id,
                athleteId: doc.id,
                athleteName: athleteData.displayName || athleteData.email || 'Unknown',
                ...goalDoc.data(),
                targetDate: goalDoc.data().targetDate?.toDate?.() || null,
                createdAt: goalDoc.data().createdAt?.toDate?.() || null,
                completedAt: goalDoc.data().completedAt?.toDate?.() || null,
              }));
            })
          );
        });
        
        setAthletes(athletesMap);
        
        // Wait for all goals to be fetched
        const goalsArrays = await Promise.all(goalsPromises);
        const allGoalsData = goalsArrays.flat();
        
        // Sort by creation date (newest first)
        allGoalsData.sort((a, b) => {
          const dateA = a.createdAt || new Date(0);
          const dateB = b.createdAt || new Date(0);
          return dateB - dateA;
        });
        
        setAllGoals(allGoalsData);
      } catch (error) {
        console.error('Error fetching goals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllGoals();
  }, []);

  const handleDeleteGoal = async (goal) => {
    if (!confirm(`Delete "${goal.title}" for ${goal.athleteName}?`)) return;

    try {
      await deleteDoc(doc(db, 'users', goal.athleteId, 'goalsList', goal.id));
      setAllGoals(allGoals.filter(g => !(g.id === goal.id && g.athleteId === goal.athleteId)));
      alert('Goal deleted successfully!');
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Failed to delete goal');
    }
  };

  const handleAddComment = async (goal) => {
    if (!commentText.trim()) {
      alert("Please enter a comment");
      return;
    }

    try {
      const goalRef = doc(db, 'users', goal.athleteId, 'goalsList', goal.id);
      
      const newComment = {
        text: commentText.trim(),
        coachId: user.uid,
        coachName: user.displayName || user.email || "Coach",
        createdAt: new Date(),
      };

      await updateDoc(goalRef, {
        coachComments: arrayUnion(newComment)
      });

      // Update local state
      setAllGoals(allGoals.map(g => {
        if (g.id === goal.id && g.athleteId === goal.athleteId) {
          return {
            ...g,
            coachComments: [...(g.coachComments || []), newComment]
          };
        }
        return g;
      }));

      setCommentText("");
      setCommentingGoal(null);
      
      // Auto-expand the comments for this goal
      setExpandedComments(prev => ({ ...prev, [`${goal.athleteId}-${goal.id}`]: true }));
      
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    }
  };

  // Apply filters
  const filteredGoals = allGoals.filter(goal => {
    // Category filter
    if (categoryFilter !== "all" && goal.category !== categoryFilter) return false;
    
    // Practice type filter (only applies when category is Practice or filter is set)
    if (practiceTypeFilter !== "all") {
      if (goal.category !== "Practice") return false;
      if (goal.practiceType !== practiceTypeFilter) return false;
    }
    
    // Athlete filter
    if (athleteFilter !== "all" && goal.athleteId !== athleteFilter) return false;
    
    // Completed filter
    if (completedFilter === "completed" && !goal.completed) return false;
    if (completedFilter === "incomplete" && goal.completed) return false;
    
    return true;
  });

  // Get unique athletes for filter dropdown
  const athleteList = Object.values(athletes).sort((a, b) => 
    (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')
  );

  // Get stats
  const stats = {
    total: allGoals.length,
    completed: allGoals.filter(g => g.completed).length,
    academic: allGoals.filter(g => g.category === "Academic").length,
    practice: allGoals.filter(g => g.category === "Practice").length,
    competition: allGoals.filter(g => g.category === "Competition").length,
    coachSuggested: allGoals.filter(g => g.category === "Coach Suggested").length,
  };

  // Helper to get practice type label
  const getPracticeTypeLabel = (goal) => {
    if (goal.category !== "Practice") return null;
    if (goal.practiceType === "Custom") {
      return goal.customPieceName || "Custom";
    }
    return goal.practiceType || "General";
  };

  // Get category color
  const getCategoryStyle = (category) => {
    switch (category) {
      case "Academic":
        return { bg: "#ede9fe", color: "#5b21b6", border: "#8b5cf6" };
      case "Practice":
        return { bg: "#dbeafe", color: "#1e40af", border: "#3b82f6" };
      case "Competition":
        return { bg: "#fef3c7", color: "#92400e", border: "#f59e0b" };
      case "Coach Suggested":
        return { bg: "#d1fae5", color: "#065f46", border: "#10b981" };
      default:
        return { bg: "#f3f4f6", color: "#374151", border: "#9ca3af" };
    }
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

  // Toggle expanded comments
  const toggleComments = (goalKey) => {
    setExpandedComments(prev => ({
      ...prev,
      [goalKey]: !prev[goalKey]
    }));
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p style={{ color: "#6b7280", fontSize: "18px" }}>Loading all goals...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
          Team Goals
        </h1>
        <p style={{ color: "#6b7280", fontSize: "15px" }}>
          View and manage all athlete goals in one place. Click on a goal to add feedback.
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", 
        gap: "12px",
        marginBottom: "24px"
      }}>
        <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px", textAlign: "center", border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#111827" }}>{stats.total}</div>
          <div style={{ fontSize: "13px", color: "#6b7280" }}>Total Goals</div>
        </div>
        <div style={{ padding: "16px", backgroundColor: "#d1fae5", borderRadius: "8px", textAlign: "center", border: "1px solid #a7f3d0" }}>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#065f46" }}>{stats.completed}</div>
          <div style={{ fontSize: "13px", color: "#065f46" }}>Completed</div>
        </div>
        <div style={{ padding: "16px", backgroundColor: "#ede9fe", borderRadius: "8px", textAlign: "center", border: "1px solid #c4b5fd" }}>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#5b21b6" }}>{stats.academic}</div>
          <div style={{ fontSize: "13px", color: "#5b21b6" }}>Academic</div>
        </div>
        <div style={{ padding: "16px", backgroundColor: "#dbeafe", borderRadius: "8px", textAlign: "center", border: "1px solid #93c5fd" }}>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#1e40af" }}>{stats.practice}</div>
          <div style={{ fontSize: "13px", color: "#1e40af" }}>Practice</div>
        </div>
        <div style={{ padding: "16px", backgroundColor: "#fef3c7", borderRadius: "8px", textAlign: "center", border: "1px solid #fcd34d" }}>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#92400e" }}>{stats.competition}</div>
          <div style={{ fontSize: "13px", color: "#92400e" }}>Competition</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: "flex",
        gap: "12px",
        flexWrap: "wrap",
        padding: "16px",
        backgroundColor: "#f9fafb",
        borderRadius: "8px",
        marginBottom: "24px",
        border: "1px solid #e5e7eb",
      }}>
        {/* Category Filter */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>
            Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              if (e.target.value !== "Practice") {
                setPracticeTypeFilter("all");
              }
            }}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              minWidth: "140px",
            }}
          >
            <option value="all">All Categories</option>
            <option value="Academic">Academic</option>
            <option value="Practice">Practice</option>
            <option value="Competition">Competition</option>
            <option value="Coach Suggested">Coach Suggested</option>
          </select>
        </div>

        {/* Practice Type Filter (only show when Practice is selected) */}
        {(categoryFilter === "Practice" || categoryFilter === "all") && (
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>
              Practice Type
            </label>
            <select
              value={practiceTypeFilter}
              onChange={(e) => setPracticeTypeFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                minWidth: "140px",
              }}
            >
              <option value="all">All Types</option>
              <option value="General">General</option>
              <option value="2k">2k Piece</option>
              <option value="5k">5k Piece</option>
              <option value="6k">6k Piece</option>
              <option value="Custom">Custom Piece</option>
            </select>
          </div>
        )}

        {/* Athlete Filter */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>
            Athlete
          </label>
          <select
            value={athleteFilter}
            onChange={(e) => setAthleteFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              minWidth: "160px",
            }}
          >
            <option value="all">All Athletes</option>
            {athleteList.map(athlete => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.displayName || athlete.email}
              </option>
            ))}
          </select>
        </div>

        {/* Completed Filter */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>
            Status
          </label>
          <select
            value={completedFilter}
            onChange={(e) => setCompletedFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              minWidth: "140px",
            }}
          >
            <option value="all">All Status</option>
            <option value="incomplete">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Clear Filters */}
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            onClick={() => {
              setCategoryFilter("all");
              setPracticeTypeFilter("all");
              setAthleteFilter("all");
              setCompletedFilter("all");
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#fff",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div style={{ marginBottom: "16px", color: "#6b7280", fontSize: "14px" }}>
        Showing {filteredGoals.length} of {allGoals.length} goals
      </div>

      {/* Goals List */}
      {filteredGoals.length === 0 ? (
        <div style={{
          padding: "60px 40px",
          textAlign: "center",
          backgroundColor: "#f9fafb",
          borderRadius: "12px",
          border: "1px solid #e5e7eb"
        }}>
          <p style={{ color: "#6b7280", fontSize: "18px" }}>
            No goals match your filters
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredGoals.map(goal => {
            const catStyle = getCategoryStyle(goal.category);
            const goalKey = `${goal.athleteId}-${goal.id}`;
            const hasComments = goal.coachComments && goal.coachComments.length > 0;
            const isExpanded = expandedComments[goalKey];
            const isCommenting = commentingGoal === goalKey;

            return (
              <div
                key={goalKey}
                style={{
                  padding: "16px 20px",
                  backgroundColor: goal.completed ? "#f9fafb" : "#fff",
                  border: "1px solid #e5e7eb",
                  borderLeft: `4px solid ${catStyle.border}`,
                  borderRadius: "8px",
                  opacity: goal.completed ? 0.8 : 1,
                }}
              >
                {/* Goal Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
                      {/* Goal Title */}
                      <h3 style={{ 
                        fontSize: "16px", 
                        fontWeight: "600", 
                        color: goal.completed ? "#9ca3af" : "#111827",
                        margin: 0,
                        textDecoration: goal.completed ? "line-through" : "none",
                      }}>
                        {goal.title}
                      </h3>
                      
                      {/* Category Badge */}
                      <span style={{
                        padding: "2px 8px",
                        backgroundColor: catStyle.bg,
                        color: catStyle.color,
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}>
                        {goal.category}
                      </span>
                      
                      {/* Practice Type Badge */}
                      {goal.category === "Practice" && goal.practiceType && (
                        <span style={{
                          padding: "2px 8px",
                          backgroundColor: "#e0e7ff",
                          color: "#3730a3",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "600",
                        }}>
                          {getPracticeTypeLabel(goal)}
                        </span>
                      )}
                      
                      {/* Completed Badge */}
                      {goal.completed && (
                        <span style={{
                          padding: "2px 8px",
                          backgroundColor: "#d1fae5",
                          color: "#065f46",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "600",
                        }}>
                          ✓ Completed
                        </span>
                      )}

                      {/* Comments indicator */}
                      {hasComments && (
                        <span style={{
                          padding: "2px 8px",
                          backgroundColor: "#fef3c7",
                          color: "#92400e",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "600",
                        }}>
                          {goal.coachComments.length}
                        </span>
                      )}
                    </div>
                    
                    {/* Athlete Name & Date */}
                    <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#6b7280" }}>
                      <span style={{ fontWeight: "500" }}>
                        {goal.athleteName}
                      </span>
                      {goal.createdAt && (
                        <span>
                          Created: {goal.createdAt.toLocaleDateString()}
                        </span>
                      )}
                      {goal.targetDate && (
                        <span>
                          Target: {goal.targetDate.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => {
                        if (isCommenting) {
                          setCommentingGoal(null);
                          setCommentText("");
                        } else {
                          setCommentingGoal(goalKey);
                          setCommentText("");
                        }
                      }}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: isCommenting ? "#fef3c7" : "#f0fdf4",
                        color: isCommenting ? "#92400e" : "#065f46",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      {isCommenting ? "Cancel" : "Comment"}
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal)}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#fee2e2",
                        color: "#991b1b",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Add Comment Form */}
                {isCommenting && (
                  <div style={{ 
                    marginTop: "16px", 
                    padding: "16px",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "8px",
                    border: "1px solid #a7f3d0",
                  }}>
                    <label style={{ 
                      display: "block", 
                      fontSize: "13px", 
                      fontWeight: "600", 
                      color: "#065f46",
                      marginBottom: "8px",
                    }}>
                      Add feedback for {goal.athleteName}:
                    </label>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Enter your feedback or comment..."
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        resize: "vertical",
                        marginBottom: "12px",
                      }}
                    />
                    <button
                      onClick={() => handleAddComment(goal)}
                      style={{
                        padding: "10px 20px",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      Submit Comment
                    </button>
                  </div>
                )}

                {/* Existing Comments */}
                {hasComments && (
                  <div style={{ marginTop: "12px" }}>
                    <button
                      onClick={() => toggleComments(goalKey)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#6b7280",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "500",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {isExpanded ? "▼" : "▶"} {goal.coachComments.length} Comment{goal.coachComments.length !== 1 ? "s" : ""}
                    </button>

                    {isExpanded && (
                      <div style={{ 
                        marginTop: "10px", 
                        paddingLeft: "12px",
                        borderLeft: "3px solid #10b981",
                      }}>
                        {goal.coachComments.map((comment, idx) => (
                          <div 
                            key={idx}
                            style={{
                              padding: "10px 12px",
                              backgroundColor: "#f0fdf4",
                              borderRadius: "6px",
                              marginBottom: "8px",
                            }}
                          >
                            <div style={{ 
                              display: "flex", 
                              justifyContent: "space-between", 
                              alignItems: "center",
                              marginBottom: "6px",
                            }}>
                              <span style={{ 
                                fontWeight: "600", 
                                fontSize: "13px", 
                                color: "#065f46" 
                              }}>
                                {comment.coachName || "Coach"}
                              </span>
                              <span style={{ 
                                fontSize: "11px", 
                                color: "#6b7280" 
                              }}>
                                {formatCommentDate(comment.createdAt)}
                              </span>
                            </div>
                            <p style={{ 
                              margin: 0, 
                              fontSize: "14px", 
                              color: "#374151",
                              lineHeight: "1.5",
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
            );
          })}
        </div>
      )}
    </div>
  );
}