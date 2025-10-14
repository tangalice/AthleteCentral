// src/components/Messages.jsx
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const Messages = () => {
  const [user, authLoading] = useAuthState(auth);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showChatDetails, setShowChatDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  // Loading/auth states (UI only restyled)
  if (authLoading) {
    return (
      <div className="container" style={{ paddingTop: 40, paddingBottom: 40, textAlign: 'center' }}>
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="container" style={{ paddingTop: 40, paddingBottom: 40, textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
          Please log in to access messages
        </div>
      </div>
    );
  }

  // Load user's chats
  useEffect(() => {
    if (!user) return;
    const chatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      const chatsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      chatsData.sort((a, b) => {
        const aTime = a.lastMessageTime?.toDate ? a.lastMessageTime.toDate() : new Date(0);
        const bTime = b.lastMessageTime?.toDate ? b.lastMessageTime.toDate() : new Date(0);
        return bTime - aTime;
      });
      setChats(chatsData);
    });
    return () => unsubscribe();
  }, [user]);

  // Load messages for selected chat
  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      return;
    }
    const messagesQuery = query(collection(db, 'messages'), where('chatId', '==', selectedChat.id));
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
        return aTime - bTime;
      });
      setMessages(data);
    });
    return () => unsubscribe();
  }, [selectedChat]);

  const createNewChat = async () => {
    if (!newChatName.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'chats'), {
        name: newChatName.trim(),
        participants: [user.uid],
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
        lastMessage: ''
      });
      setNewChatName('');
      setShowNewChat(false);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'messages'), {
        chatId: selectedChat.id,
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        text: newMessage.trim(),
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessageTime: serverTimestamp(),
        lastMessage: newMessage.trim()
      });
      setNewMessage('');
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async () => {
    if (!selectedChat) return;
    if (!window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) return;
    setLoading(true);
    try {
      const messagesQuery = query(collection(db, 'messages'), where('chatId', '==', selectedChat.id));
      const snap = await getDocs(messagesQuery);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'chats', selectedChat.id));
      setSelectedChat(null);
      setShowChatDetails(false);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const t = new Date();
    const y = new Date(); y.setDate(t.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  };

  // Layout
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: '#fff' }}>
      {/* Sidebar */}
      <aside style={{ width: 340, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontWeight: 800, color: '#111827' }}>Messages</h2>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => setShowNewChat(true)}
          >
            New Chat
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {chats.length === 0 ? (
            <div className="text-muted" style={{ padding: 20, textAlign: 'center' }}>
              No chats yet. Create your first chat!
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className="card"
                style={{
                  margin: 0,
                  borderRadius: 0,
                  borderLeft: '4px solid transparent',
                  cursor: 'pointer',
                  background:
                    selectedChat?.id === chat.id ? 'var(--brand-primary-50)' : '#fff',
                  borderColor:
                    selectedChat?.id === chat.id ? '#a7f3d0' : 'var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {chat.name}
                    </div>
                    {chat.lastMessage && (
                      <div className="text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chat.lastMessage}
                      </div>
                    )}
                  </div>
                  {chat.lastMessageTime && (
                    <span className="text-muted" style={{ fontSize: 12, flexShrink: 0 }}>
                      {formatTime(chat.lastMessageTime)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="card" style={{ margin: 0, borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: '#111827' }}>{selectedChat.name}</h3>
                <p className="text-muted" style={{ marginTop: 4 }}>
                  {messages.length} message{messages.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button className="btn btn-outline" onClick={() => setShowChatDetails(true)}>
                Details
              </button>
            </div>

            {/* Messages list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.length === 0 ? (
                <div className="text-muted" style={{ textAlign: 'center', marginTop: 40 }}>
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.senderId === user.uid;
                  const prev = index > 0 ? messages[index - 1] : null;
                  const showDate = !prev || formatDate(message.timestamp) !== formatDate(prev.timestamp);

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="text-muted" style={{ textAlign: 'center', margin: '16px 0 8px' }}>
                          {formatDate(message.timestamp)}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                        <div
                          style={{
                            maxWidth: '70%',
                            padding: '10px 14px',
                            borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            lineHeight: 1.5,
                            wordWrap: 'break-word',
                            background: isOwn ? 'var(--brand-primary)' : '#F3F4F6',
                            color: isOwn ? '#fff' : '#111827',
                            boxShadow: '0 1px 2px rgba(0,0,0,.04)',
                          }}
                        >
                          {message.text}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                        <span className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <div className="card" style={{ margin: 0, borderRadius: 0 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message"
                  className="form-control"
                  style={{ resize: 'none', minHeight: 40, maxHeight: 140 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || loading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="card" style={{ margin: 24, textAlign: 'center', color: '#6b7280' }}>
            Select a chat to start messaging
          </div>
        )}
      </main>

      {/* New Chat Modal */}
      {showNewChat && (
        <div style={modalBackdrop}>
          <div className="card" style={modalCard}>
            <h3 style={{ marginTop: 0, marginBottom: 12, textAlign: 'center' }}>New Chat</h3>
            <input
              type="text"
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
              placeholder="Chat name"
              className="form-control"
              style={{ textAlign: 'center', marginBottom: 12 }}
              onKeyDown={(e) => e.key === 'Enter' && createNewChat()}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => { setShowNewChat(false); setNewChatName(''); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={createNewChat} disabled={!newChatName.trim() || loading}>
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Details Modal */}
      {showChatDetails && selectedChat && (
        <div style={modalBackdrop}>
          <div className="card" style={modalCard}>
            <h3 style={{ marginTop: 0, marginBottom: 12, textAlign: 'center' }}>Chat Details</h3>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Chat Name:</p>
              <p style={{ margin: '4px 0 10px' }}>{selectedChat.name}</p>
              <p style={{ margin: 0, fontWeight: 600 }}>Created:</p>
              <p style={{ margin: '4px 0 10px' }}>{selectedChat.createdAt ? formatDate(selectedChat.createdAt) : 'Unknown'}</p>
              <p style={{ margin: 0, fontWeight: 600 }}>Messages:</p>
              <p style={{ margin: '4px 0 0' }}>
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => setShowChatDetails(false)}>
                Close
              </button>
              <button className="btn btn-danger" onClick={deleteChat} disabled={loading}>
                {loading ? 'Deleting...' : 'Delete Chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple modal styles (inline to keep component self-contained)
const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};
const modalCard = {
  width: 420,
  maxWidth: '92vw',
  padding: 20
};

export default Messages;
