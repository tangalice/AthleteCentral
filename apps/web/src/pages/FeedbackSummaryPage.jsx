import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  deleteDoc,
} from "firebase/firestore";

import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import { useNavigate } from "react-router-dom";

export default function FeedbackSummaryPage() {
  const [polls, setPolls] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loadingDelete, setLoadingDelete] = useState(null);
  const navigate = useNavigate();

  // ✅ NEW：当前右侧 panel 选中的 poll
  const [selectedPoll, setSelectedPoll] = useState(null);

  useEffect(() => {
    async function loadPolls() {
      const qPolls = query(
        collection(db, "feedbackPolls"),
        orderBy("deadline", "desc")
      );
      const snap = await getDocs(qPolls);

      const allPolls = [];

      for (const docSnap of snap.docs) {
        const poll = { id: docSnap.id, ...docSnap.data() };

        // Load responses
        const responsesSnap = await getDocs(
          collection(db, "feedbackPolls", poll.id, "responses")
        );

        const ratings = {
          training: [],
          morale: [],
          coaching: [],
        };
        const comments = [];

        responsesSnap.forEach((r) => {
          const ans = r.data().answers;
          if (!ans) return;

          if (ans.trainingQuality) ratings.training.push(ans.trainingQuality);
          if (ans.teamMorale) ratings.morale.push(ans.teamMorale);
          if (ans.coachingEffectiveness)
            ratings.coaching.push(ans.coachingEffectiveness);

          const commentText = ans.additionalComments || ans.openComment;
          if (commentText && commentText.trim() !== "") {
            comments.push({
              text: commentText,
              date: r.data().submittedAt?.toDate() || null,
            });
          }
        });

        function avg(arr) {
          return arr.length === 0
            ? null
            : (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
        }

        allPolls.push({
          ...poll,
          avgTraining: avg(ratings.training),
          avgMorale: avg(ratings.morale),
          avgCoaching: avg(ratings.coaching),
          comments,
          responseCount: responsesSnap.size,
        });
      }

      setPolls(allPolls);
    }

    loadPolls();
  }, []);

  const handleDeletePoll = async (pollId) => {
    const ok = window.confirm(
      "Are you sure you want to delete this poll and all its responses?"
    );
    if (!ok) return;

    try {
      setLoadingDelete(pollId);

      const responsesRef = collection(
        db,
        "feedbackPolls",
        pollId,
        "responses"
      );
      const responsesSnap = await getDocs(responsesRef);
      const deletePromises = [];
      responsesSnap.forEach((r) => {
        deletePromises.push(deleteDoc(r.ref));
      });
      await Promise.all(deletePromises);

      await deleteDoc(doc(db, "feedbackPolls", pollId));

      setPolls((prev) => prev.filter((p) => p.id !== pollId));

      // ✅ NEW：如果删除的是当前选中的 poll，把右侧 panel 清空
      setSelectedPoll((prev) => (prev?.id === pollId ? null : prev));
    } catch (err) {
      console.error("Error deleting poll:", err);
      alert("Failed to delete poll. Please try again.");
    } finally {
      setLoadingDelete(null);
    }
  };

  const handleEditPoll = (pollId) => {
    navigate(`/feedback/edit/${pollId}`);
  };

  const filteredPolls = polls.filter((p) => {
    if (filter === "all") return true;

    const deadline = p.deadline?.toDate();
    if (!deadline) return true;

    const now = new Date();
    const days = {
      week: 7,
      month: 30,
      quarter: 90,
    }[filter];

    return (now - deadline) / (1000 * 60 * 60 * 24) <= days;
  });

  const chartData = {
    labels: filteredPolls.map((p) => p.title),
    datasets: [
      {
        label: "Training Quality",
        data: filteredPolls.map((p) => p.avgTraining),
      },
      {
        label: "Team Morale",
        data: filteredPolls.map((p) => p.avgMorale),
      },
      {
        label: "Coaching Effectiveness",
        data: filteredPolls.map((p) => p.avgCoaching),
      },
    ],
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem" }}>
      {/* 顶部：左边标题 + 右上角返回按钮 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ fontWeight: 800 }}>📊 Feedback Summary</h2>

        <button
          type="button"
          onClick={() => navigate(-1)}   // 从 dashboard 点进来，就会返回 dashboard
          style={{
            padding: "0.4rem 0.9rem",
            borderRadius: "6px",
            border: "1px solid #4b5563",
            background: "#4b5563",
            color: "white",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          ⬅ Back to Dashboard
        </button>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <label style={{ fontWeight: 600 }}>Filter:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            marginLeft: "1rem",
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        >
          <option value="all">All Time</option>
          <option value="week">Past Week</option>
          <option value="month">Past Month</option>
          <option value="quarter">Past 3 Months</option>
        </select>
      </div>

      <div
        style={{
          marginTop: "2rem",
          background: "white",
          padding: "1rem",
          borderRadius: "12px",
        }}
      >
        <Bar data={chartData} />
      </div>

      {/* ✅ NEW：下面开始左右布局 */}
      <div
        style={{
          marginTop: "3rem",
          display: "flex",
          gap: "24px",
          alignItems: "flex-start",
        }}
      >
        {/* 左边：poll 列表 */}
        <div style={{ flex: 2 }}>
          {filteredPolls.length === 0 ? (
            <p>No polls found for this time period.</p>
          ) : (
            filteredPolls.map((poll) => (
              <div
                key={poll.id}
                style={{
                  marginBottom: "2rem",
                  padding: "1rem",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  background: "#fafafa",
                }}
              >
                <h3 style={{ marginBottom: 8 }}>{poll.title}</h3>
                <p>Deadline: {poll.deadline?.toDate().toLocaleString()}</p>
                <p>Responses: {poll.responseCount}</p>

                <h4 style={{ marginTop: "1rem" }}>Averages</h4>
                <ul>
                  <li>Training: {poll.avgTraining ?? "No data"}</li>
                  <li>Morale: {poll.avgMorale ?? "No data"}</li>
                  <li>
                    Coaching Effectiveness: {poll.avgCoaching ?? "No data"}
                  </li>
                </ul>

                {/* ❌ 这里原来是直接显示 comments 的区域 —— 删掉 */}
                {/* ✅ NEW：改成一个按钮，点击后在右侧显示 comments */}
                <div
                  style={{
                    marginTop: "1rem",
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPoll(poll)} // ✅ NEW
                    style={{
                      padding: "0.4rem 0.8rem",
                      borderRadius: "6px",
                      border: "1px solid #28a745",
                      background: "white",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    💬 View Anonymous Comments (
                    {poll.comments?.length || 0})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEditPoll(poll.id)}
                    style={{
                      padding: "0.4rem 0.8rem",
                      borderRadius: "6px",
                      border: "1px solid #007bff",
                      background: "white",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    ✏️ Edit Poll
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePoll(poll.id)}
                    disabled={loadingDelete === poll.id}
                    style={{
                      padding: "0.4rem 0.8rem",
                      borderRadius: "6px",
                      border: "1px solid #dc3545",
                      background:
                        loadingDelete === poll.id ? "#f8d7da" : "white",
                      cursor:
                        loadingDelete === poll.id ? "not-allowed" : "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    {loadingDelete === poll.id ? "Deleting..." : "🗑 Delete Poll"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 右边：选中的 poll comments panel */}
        <div
          style={{
            flex: 1,
            borderLeft: "1px solid #eee",
            paddingLeft: "16px",
            minHeight: "150px",
          }}
        >
          {selectedPoll ? (
            <CommentsPanel poll={selectedPoll} />
          ) : (
            <p style={{ color: "#777" }}>
              Click “View Anonymous Comments” on a poll to see details here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ✅ NEW：右侧评论面板组件
function CommentsPanel({ poll }) {
  const comments = poll.comments || [];

  return (
    <div>
      <h3 style={{ marginBottom: "4px" }}>
        {poll.title} – Anonymous Comments
      </h3>
      <p style={{ fontSize: "13px", color: "#666", marginBottom: "12px" }}>
        Deadline: {poll.deadline?.toDate().toLocaleString()}
      </p>

      {comments.length === 0 ? (
        <p>No anonymous comments for this poll yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {comments.map((c, idx) => (
            <li
              key={idx}
              style={{
                padding: "0.7rem 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontSize: "14px", marginBottom: "4px" }}>
                {c.text}
              </div>
              {c.date && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#999",
                  }}
                >
                  {c.date.toLocaleString()}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
