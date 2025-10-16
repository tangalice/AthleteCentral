// src/components/AthleteFeedbackPage.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";

export default function AthleteFeedbackPage({ user }) {
  const [feedback, setFeedback] = useState([]);
  const [filter, setFilter] = useState({
    Practice: true,
    Competition: true,
  });
  const [loading, setLoading] = useState(true);

  // Real-time listener for athlete's feedbackList
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "feedbackList"),
      orderBy("date", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFeedback(list);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const filteredFeedback = feedback.filter(
    (f) => filter[f.category.charAt(0).toUpperCase() + f.category.slice(1)]
  );

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 20px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 10 }}>
          My Coach Feedback
        </h2>

        {/* Filter Buttons */}
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
          {Object.keys(filter).map((key) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={filter[key]}
                onChange={() =>
                  setFilter((f) => ({ ...f, [key]: !f[key] }))
                }
              />
              {key}
            </label>
          ))}
        </div>

        {/* Feedback List */}
        {loading ? (
          <p>Loading feedback...</p>
        ) : filteredFeedback.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No feedback available yet.</p>
        ) : (
          filteredFeedback.map((item) => (
            <div
              key={item.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderLeft:
                  item.category === "practice"
                    ? "5px solid #3b82f6"
                    : "5px solid #f59e0b",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0, textTransform: "capitalize" }}>
                {item.category}
              </h3>
              <p style={{ margin: "4px 0", color: "#374151" }}>
                {item.message}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                From: {item.coachName || "Coach"} <br />
                {item.date?.toDate
                  ? new Date(item.date.toDate()).toLocaleString()
                  : new Date(item.date).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}