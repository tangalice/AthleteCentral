import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";

export default function Messages() {
  const [searchParams] = useSearchParams();
  const preselectedTeamId = searchParams.get("teamId");
  const preselectedTeamName = searchParams.get("teamName");

  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [userList, setUserList] = useState([]);
  const [participantId, setParticipantId] = useState("");

  // 私聊相关状态
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [privateUserInput, setPrivateUserInput] = useState("");
  const [creatingChat, setCreatingChat] = useState(false);

  const user = auth.currentUser;
  const [userNameMap, setUserNameMap] = useState({}); // ✅ 用来缓存用户ID→名字映射

  /* ===== Load user's threads ===== */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setThreads(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  /* ===== Load all users for chat creation ===== */
    useEffect(() => {
      const fetchUsers = async () => {
        try {
          const snapshot = await getDocs(collection(db, "users"));
          const list = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
          setUserList(list);
        } catch (e) {
          console.error("Error fetching users:", e);
          setStatus("Error loading users.");
        }
      };
      fetchUsers();
    }, []);

  /* ===== Auto-open Team Chat ===== */
  useEffect(() => {
    if (!preselectedTeamId || !user) return;

    const openOrCreateTeamChat = async () => {
      try {
        const chatsSnap = await getDocs(
          query(collection(db, "chats"), where("name", "==", `Team: ${preselectedTeamName}`))
        );
        if (!chatsSnap.empty) {
          setActiveThread({ id: chatsSnap.docs[0].id, ...chatsSnap.docs[0].data() });
          return;
        }

        const teamSnap = await getDocs(
          query(collection(db, "teams"), where("__name__", "==", preselectedTeamId))
        );
        if (teamSnap.empty) return;
        const team = teamSnap.docs[0].data();
        const members = team.members || [];
        const participants = Array.from(new Set([auth.currentUser.uid, ...members]));

        const newChat = await addDoc(collection(db, "chats"), {
          name: `Team: ${preselectedTeamName}`,
          participants,
          createdBy: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        });
        setActiveThread({
          id: newChat.id,
          name: `Team: ${preselectedTeamName}`,
          participants,
        });
      } catch (err) {
        console.error("Error creating team chat:", err);
      }
    };

    openOrCreateTeamChat();
  }, [preselectedTeamId, preselectedTeamName, user]);

  /* ===== Load Messages ===== */
  useEffect(() => {
    if (!activeThread) return;
    const q = query(collection(db, "messages"), where("chatId", "==", activeThread.id));
    const unsub = onSnapshot(q, async (snap) => {
      const messages = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

      // ✅ 动态加载每个发件人的名字
      const newMap = { ...userNameMap };
      for (const msg of messages) {
        if (!msg.senderName && msg.senderId && !newMap[msg.senderId]) {
          const userDoc = await getDoc(doc(db, "users", msg.senderId));
          if (userDoc.exists()) {
            newMap[msg.senderId] = userDoc.data().displayName || userDoc.data().name || "Unknown";
          } else {
            newMap[msg.senderId] = "Unknown";
          }
        } else if (msg.senderName && !newMap[msg.senderId]) {
          newMap[msg.senderId] = msg.senderName;
        }
      }

      setUserNameMap(newMap);
      setChatMessages(messages);
    });
    return () => unsub();
  }, [activeThread]);

  /* ===== Send Message ===== */
  const sendMessage = async () => {
    if (!newMessage.trim() || !activeThread) return;

    await addDoc(collection(db, "messages"), {
      chatId: activeThread.id,
      senderId: user.uid,
      senderName: user.displayName || user.email || "Unknown User",
      text: newMessage.trim(),
      timestamp: serverTimestamp(),
    });

    setNewMessage("");
  };

  /* ===== Create Private Chat ===== */
  const createPrivateChat = async () => {
  

    try {
      setCreatingChat(true);

      const chatData = {
        name: `Chat with ${participantId}`, // ✅ 标题带上对方名字
        participants: [user.uid, participantId],
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      };

      const newChatRef = await addDoc(collection(db, "chats"), chatData);
      alert(`Private chat created!`);
      setShowPrivateModal(false);
      setPrivateUserInput("");
      setActiveThread({ id: newChatRef.id, ...chatData });
    } catch (error) {
      console.error("Error creating private chat:", error);
      alert("Error creating private chat: " + error.message);
    } finally {
      setCreatingChat(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 40 }}>
        <p>Loading messages...</p>
      </div>
    );
  }

  /* ===== UI ===== */
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <h1>Messages</h1>

      {!activeThread ? (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>My Threads ({threads.length})</h2>
            <button className="btn btn-primary" onClick={() => setShowPrivateModal(true)}>
              + Create Private Chat
            </button>
          </div>

          {threads.length === 0 ? (
            <p className="text-muted">No message threads yet.</p>
          ) : (
            threads.map((t) => (
              <div
                key={t.id}
                onClick={() => setActiveThread(t)}
                style={{
                  padding: 12,
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <strong>{t.name}</strong>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  {t.participants?.length || 0} participants
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          {/* ✅ 顶部标题 */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h2>{activeThread.name}</h2>
            <button className="btn btn-outline" onClick={() => setActiveThread(null)}>
              ← Back
            </button>
          </div>

          <div
            style={{
              maxHeight: 320,
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              marginTop: 8,
              marginBottom: 8,
            }}
          >
            {chatMessages.length === 0 ? (
              <p className="text-muted">No messages yet.</p>
            ) : (
              chatMessages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    marginBottom: 8,
                    textAlign: m.senderId === user.uid ? "right" : "left",
                  }}
                >
                  {/* 显示名字 */}
                  {m.senderId !== user.uid && (
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>
                      {userNameMap[m.senderId] || m.senderName || "Unknown"}
                    </div>
                  )}
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: m.senderId === user.uid ? "#d1fae5" : "#e0f2fe",
                      padding: "6px 10px",
                      borderRadius: 6,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button className="btn btn-primary" onClick={sendMessage}>
              Send
            </button>
          </div>
        </div>
      )}

      {/* 🆕 Create Private Chat Modal */}
      {showPrivateModal && (
        <div
          className="card"
          style={{
            position: "fixed",
            top: "30%",
            left: "50%",
            transform: "translate(-50%, -30%)",
            width: 400,
            padding: 20,
            zIndex: 999,
            backgroundColor: "white",
          }}
        >
          <h3>Create Private Chat</h3>
          <select
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            required
            style={{
              padding: 10,
              fontSize: 16,
              borderRadius: 6,
              border: "1px solid #d1d5db",
            }}
          >
            <option value="">Select Recipient</option>
            {userList.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName || user.email || user.id}
              </option>
            ))}
          </select>
          <button
            className="btn btn-success"
            onClick={createPrivateChat}
            disabled={creatingChat}
          >
            {creatingChat ? "Creating..." : "Create Chat"}
          </button>
          <button
            className="btn btn-outline"
            style={{ marginLeft: 10 }}
            onClick={() => setShowPrivateModal(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
