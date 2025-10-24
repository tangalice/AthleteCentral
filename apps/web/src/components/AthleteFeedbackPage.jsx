import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  where,
  getDocs,
  serverTimestamp,
  increment,
} from "firebase/firestore";

export default function AthleteFeedbackPage({ user }) {
  const [feedback, setFeedback] = useState([]);
  const [filter, setFilter] = useState({
    Practice: true,
    Competition: true,
    Acknowledged: true,
  });
  const [loading, setLoading] = useState(true);

  // === Real-time listener for athlete's feedback ===
  useEffect(() => {
    if (!user?.uid) return;

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

  // === Handle Acknowledge Click ===
  const handleAcknowledge = async (id, item) => {
    try {
      const feedbackRef = doc(db, "users", user.uid, "feedbackList", id);

      // Update Firestore to mark as acknowledged
      await updateDoc(feedbackRef, {
        acknowledged: true,
        acknowledgedAt: serverTimestamp(),
        category: "acknowledged",
      });

      // === Notify coach via existing chat ===
      const chatsRef = collection(db, "chats");
      const chatQuery = query(
        chatsRef,
        where("participants", "array-contains", user.uid)
      );
      const chatSnapshot = await getDocs(chatQuery);

      let chatDoc = null;
      chatSnapshot.forEach((docSnap) => {
        const participants = docSnap.data().participants || [];
        if (participants.includes(item.coachId)) {
          chatDoc = docSnap;
        }
      });

      // If no chat exists, create one
      if (!chatDoc) {
        const newChatRef = await addDoc(chatsRef, {
          name: `Chat with ${item.coachName || "Coach"}`,
          participants: [user.uid, item.coachId],
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          lastMessage: "",
          lastMessageTime: serverTimestamp(),
          unreadCounts: {
            [user.uid]: 0,
            [item.coachId]: 0,
          },
          readBy: {
            [user.uid]: serverTimestamp(),
          },
        });
        chatDoc = { id: newChatRef.id, data: () => ({ participants: [user.uid, item.coachId] }) };
      }

      // Send automatic message
      const text = `${user.displayName || "Athlete"} acknowledged your feedback: "${item.message}"`;
      await addDoc(collection(db, "messages"), {
        chatId: chatDoc.id,
        senderId: user.uid,
        senderName: user.displayName || "Athlete",
        text,
        timestamp: serverTimestamp(),
      });

      await updateDoc(doc(db, "chats", chatDoc.id), {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: user.uid,
        [`unreadCounts.${item.coachId}`]: increment(1),
      });
    } catch (err) {
      console.error("Error acknowledging feedback:", err);
    }
  };

  // === Apply filters ===
  const filteredFeedback = feedback.filter((f) => {
    const cat =
      f.category?.charAt(0).toUpperCase() + f.category?.slice(1).toLowerCase();
    return filter[cat];
  });

  // === Render ===
  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 20px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 10 }}>
          My Feedback
        </h2>

        {/* Filter Checkboxes */}
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
                  setFilter((prev) => ({ ...prev, [key]: !prev[key] }))
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
                    : item.category === "competition"
                    ? "5px solid #f59e0b"
                    : "5px solid #10b981",
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
              </div>

              <div style={{ marginLeft: 10 }}>
                {item.category === "acknowledged" ? (
                  <span
                    style={{ color: "green", fontWeight: 600, fontSize: 14 }}
                  >
                    Acknowledged
                  </span>
                ) : (
                  <button
                    onClick={() => handleAcknowledge(item.id, item)}
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
          ))
        )}
      </div>
    </div>
  );
}