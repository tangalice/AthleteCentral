// src/pages/CreateFeedbackPoll.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  doc,
  getDoc,
  updateDoc,
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
  const { pollId } = useParams();          // 从路由拿 pollId
  const isEdit = !!pollId;                 // 有 pollId 就是编辑模式

  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ---------- 编辑模式：载入原来的 poll 数据 ----------
  useEffect(() => {
    if (!isEdit) return;

    async function loadPoll() {
      try {
        const ref = doc(db, "feedbackPolls", pollId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          alert("Poll not found.");
          navigate("/feedback");
          return;
        }
        const data = snap.data();
        setTitle(data.title || "");
        setQuestions(data.questions || DEFAULT_QUESTIONS);

        const d = data.deadline?.toDate() || new Date();
        const iso = d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
        setDeadline(iso);
      } catch (err) {
        console.error("Error loading poll:", err);
        alert("Failed to load poll.");
        navigate("/feedback");
      }
    }

    loadPoll();
  }, [isEdit, pollId, navigate]);

  // ---------- 提交：根据 isEdit 决定是 create 还是 update ----------
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

      if (isEdit) {
        // 📝 编辑模式：只更新必要字段
        await updateDoc(doc(db, "feedbackPolls", pollId), {
          title: title.trim(),
          deadline: deadlineDate,
          questions,
        });
      } else {
        // 🆕 创建模式：保持你原来的逻辑
        const coachUid = auth.currentUser.uid;

        // 找出这个 coach 负责的 team
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

        await addDoc(collection(db, "feedbackPolls"), {
          title: title.trim(),
          questions,
          deadline: deadlineDate,
          createdAt: serverTimestamp(),
          createdBy: coachUid,
          status: "open",
          teamIds: myTeams,
        });
      }

      // 成功后回到 summary，看见更新后的 poll
      navigate("/feedback");
    } catch (err) {
      console.error("Error saving poll:", err);
      setError("Failed to save poll. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "1.5rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>
        {isEdit ? "Edit Feedback Poll" : "Create Feedback Poll"}
      </h2>
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

        {/* 问题预览 */}
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
            {saving
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
              ? "Save Changes"
              : "Create Poll"}
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
