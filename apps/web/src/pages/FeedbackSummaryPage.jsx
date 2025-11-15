import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";

import { Bar } from "react-chartjs-2";
import "chart.js/auto";

export default function FeedbackSummaryPage() {
  const [polls, setPolls] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function loadPolls() {
      const qPolls = query(collection(db, "feedbackPolls"), orderBy("deadline", "desc"));
      const snap = await getDocs(qPolls);

      const allPolls = [];

      for (const docSnap of snap.docs) {
        const poll = { id: docSnap.id, ...docSnap.data() };

        // Load responses
        const responses = await getDocs(
          collection(db, "feedbackPolls", poll.id, "responses")
        );

        const ratings = {
          training: [],
          morale: [],
          coaching: [],
        };
        const comments = [];

        responses.forEach((r) => {
          const ans = r.data().answers;
          if (!ans) return;

          if (ans.trainingQuality) ratings.training.push(ans.trainingQuality);
          if (ans.teamMorale) ratings.morale.push(ans.teamMorale);
          if (ans.coachingEffectiveness) ratings.coaching.push(ans.coachingEffectiveness);

          if (ans.additionalComments) {
            comments.push({
              text: ans.additionalComments,
              date: r.data().submittedAt?.toDate() || null
            });
          }
        });

        // compute avg
        function avg(arr) {
          return arr.length === 0 ? null : (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
        }

        allPolls.push({
          ...poll,
          avgTraining: avg(ratings.training),
          avgMorale: avg(ratings.morale),
          avgCoaching: avg(ratings.coaching),
          comments,
          responseCount: responses.size
        });
      }

      setPolls(allPolls);
    }

    loadPolls();
  }, []);

  // 过滤
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

  // 图表数据
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
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem" }}>
      <h2 style={{ fontWeight: 800 }}>📊 Feedback Summary</h2>

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

      <div style={{ marginTop: "2rem", background: "white", padding: "1rem", borderRadius: "12px" }}>
        <Bar data={chartData} />
      </div>

      {/* Poll Detail List */}
      <div style={{ marginTop: "3rem" }}>
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
                <li>Coaching Effectiveness: {poll.avgCoaching ?? "No data"}</li>
              </ul>

              {poll.comments.length > 0 && (
                <>
                  <h4 style={{ marginTop: "1rem" }}>Anonymous Comments</h4>
                  {poll.comments.map((c, idx) => (
                    <div
                      key={idx}
                      style={{ padding: "0.7rem", background: "white", borderRadius: "6px", marginTop: "0.5rem" }}
                    >
                      <p>{c.text}</p>
                      {c.date && (
                        <p style={{ fontSize: "12px", color: "#666" }}>
                          {c.date.toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
