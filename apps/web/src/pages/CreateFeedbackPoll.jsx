// src/pages/CreateFeedbackPoll.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
    collection,
    addDoc,
    serverTimestamp,
    getDocs
  } from "firebase/firestore";

const DEFAULT_QUESTIONS = [
  {
    id: "trainingQuality",
    label: "Training quality",
    type: "rating", // 1-5
  },
  {
    id: "teamMorale",
    label: "Team morale",
    type: "rating",
  },
  {
    id: "coachingEffectiveness",
    label: "Coaching effectiveness",
    type: "rating",
  },
  {
    id: "openComment",
    label: "Additional comments",
    type: "text",
  },
];

export default function CreateFeedbackPoll() {

  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");



  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
  
    if (!title.trim()) {
      setError("Please enter a poll title.");
      return;
    }
    if (!deadline) {
      setError("Please select a deadline.");
      return;
    }
  
    const deadlineDate = new Date(deadline);
  
    try {
      setSaving(true);
  
      const coachUid = auth.currentUser.uid;
  
      // 取得 coach 所有教的队伍
      const teamsSnap = await getDocs(collection(db, "teams"));
      const myTeams = [];
  
      teamsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          (Array.isArray(data.coaches) && data.coaches.includes(coachUid)) ||
          (Array.isArray(data.coachIds) && data.coachIds.includes(coachUid)) ||
          (Array.isArray(data.members) && data.members.includes(coachUid))
        ) {
          myTeams.push(docSnap.id);
        }
      });
  
      if (myTeams.length === 0) {
        setError("You are not a coach of any team.");
        setSaving(false);
        return;
      }
  
      // ⭐⭐⭐ 最重要：写入 Firestore
      await addDoc(collection(db, "feedbackPolls"), {
        title: title.trim(),
        questions,
        deadline: deadlineDate,
        createdAt: serverTimestamp(),
        createdBy: coachUid,
        status: "open",
        teamIds: myTeams,
      });
  
      // 成功后跳走
      navigate("/dashboard");
    } catch (err) {
      console.error("Error creating poll:", err);
      setError("Failed to create poll. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "1.5rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>Create Feedback Poll</h2>
      <p style={{ marginBottom: "1rem", color: "#555" }}>
        This poll will be visible to all athletes on this team. Their responses
        will be anonymous.
      </p>

      {error && (
        <div
          style={{
            backgroundColor: "#ffe0e0",
            color: "#a00",
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 标题 */}
        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="poll-title"
            style={{ display: "block", marginBottom: "0.25rem" }}
          >
            Poll Title
          </label>
          <input
            id="poll-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly Training Feedback (Week 10)"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        {/* 截止时间 */}
        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="poll-deadline"
            style={{ display: "block", marginBottom: "0.25rem" }}
          >
            Deadline
          </label>
          <input
            id="poll-deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        {/* 问题预览（简单展示，暂时不做编辑逻辑） */}
        <div style={{ marginBottom: "1rem" }}>
          <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
            Questions (preview)
          </p>
          <ul style={{ paddingLeft: "1.2rem" }}>
            {questions.map((q) => (
              <li key={q.id} style={{ marginBottom: "0.25rem" }}>
                {q.label}{" "}
                <span style={{ fontSize: "0.85rem", color: "#888" }}>
                  ({q.type === "rating" ? "rating 1–5" : "text"})
                </span>
              </li>
            ))}
          </ul>
          {/* 如果以后要做自定义问题，就在这里加“Add question” UI */}
        </div>

        {/* 按钮区 */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "6px",
              border: "none",
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
              backgroundColor: "#2563eb",
              color: "white",
              fontWeight: 600,
            }}
          >
            {saving ? "Creating..." : "Create Poll"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "6px",
              border: "1px solid #ccc",
              backgroundColor: "white",
              cursor: "pointer",
            }}
          >
            Cancel / Back to Dashboard
          </button>
        </div>
      </form>
    </div>
  );
}
