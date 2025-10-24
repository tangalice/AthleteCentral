import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";

export default function AthleteFeedbackPage({ user }) {
  const [feedback, setFeedback] = useState([]);
  const [filter, setFilter] = useState({
    Practice: true,
    Competition: true,
    Acknowledged: true,
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

  // Acknowledge feedback handler
  const handleAcknowledge = async (id) => {
    try {
      const ref = doc(db, "users", user.uid, "feedbackList", id);
      await updateDoc(ref, {
        acknowledged: true,
        category: "acknowledged", // move to new category
        acknowledgedAt: new Date(),
      });
    } catch (err) {
      console.error("Error acknowledging feedback:", err);
    }
  };

  // Filter based on checkbox selection
  const filteredFeedback = feedback.filter((f) => {
    const categoryName =
      f.category.charAt(0).toUpperCase() + f.category.slice(1);
    return filter[categoryName];
  });

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 20px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 10 }}>
          My Feedback
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
            <label
              key={key}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={filter[key]}
                onChange={() =>
                  setFilter((f) => ({
                    ...f,
                    [key]: !f[key],
                  }))
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
          filteredFeedback.map((item) => {
            // color-coding by category
            let borderColor = "#e5e7eb";
            if (item.category === "practice") borderColor = "#3b82f6";
            else if (item.category === "competition") borderColor = "#f59e0b";
            else if (item.category === "acknowledged") borderColor = "#10b981"; // ✅ green

            return (
              <div
                key={item.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderLeft: `5px solid ${borderColor}`,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
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

                  {item.acknowledgedAt && (
                    <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      Acknowledged on{" "}
                      {new Date(
                        item.acknowledgedAt?.toDate?.() ||
                          item.acknowledgedAt
                      ).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Button or Acknowledged Label */}
                <div style={{ marginLeft: 10 }}>
                  {item.category === "acknowledged" ? (
                    <span
                      style={{
                        color: "green",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      ✓ Acknowledged
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(item.id)}
                      style={{
                        backgroundColor: "#3b82f6",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 10px",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}