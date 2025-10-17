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
  
  // New states for user management
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [chatUsers, setChatUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');

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

  // Load all users for chat creation
  useEffect(() => {
    if (!user) return;
    
    console.log('Loading users for chat creation...');
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      console.log('Users snapshot received:', snapshot.size, 'total users');
      const allUsersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('All users:', allUsersData);
      
      const filteredUsers = allUsersData.filter(u => u.id !== user.uid);
      console.log('Filtered users (excluding current user):', filteredUsers);
      console.log('Current user UID:', user.uid);
      
      setAllUsers(filteredUsers);
    }, (error) => {
      console.error('Error loading users:', error);
      setAllUsers([]);
    });
    
    return () => unsubscribeUsers();
  }, [user]);

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

  // Load messages and participants for selected chat
  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      setChatUsers([]);
      return;
    }
    
    // Load messages
    const messagesQuery = query(collection(db, 'messages'), where('chatId', '==', selectedChat.id));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
        return aTime - bTime;
      });
      setMessages(data);
    });
    
    // Load chat participants
    const loadChatUsers = async () => {
      try {
        const userIds = selectedChat.participants || [];
        if (userIds.length === 0) {
          setChatUsers([]);
          return;
        }
        
        const userPromises = userIds.map(async (userId) => {
          try {
            const userDoc = await getDocs(query(collection(db, 'users')));
            const userData = userDoc.docs.find(d => d.id === userId);
            if (userData) {
              return { id: userId, ...userData.data() };
            }
            return { id: userId, displayName: 'Unknown User', email: 'unknown@example.com' };
          } catch (error) {
            console.error('Error fetching user:', userId, error);
            return { id: userId, displayName: 'Unknown User', email: 'unknown@example.com' };
          }
        });
        
        const users = await Promise.all(userPromises);
        setChatUsers(users);
      } catch (error) {
        console.error('Error loading chat users:', error);
        setChatUsers([]);
      }
    };
    
    loadChatUsers();
    
    return () => unsubscribeMessages();
  }, [selectedChat]);

  const createNewChat = async () => {
    if (!newChatName.trim()) return;
    setLoading(true);
    try {
      // Include current user and selected users
      const participants = [user.uid, ...selectedUsers.map(u => u.id)];
      
      await addDoc(collection(db, 'chats'), {
        name: newChatName.trim(),
        participants: participants,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
        lastMessage: ''
      });
      
      setNewChatName('');
      setSelectedUsers([]);
      setUserSearchTerm('');
      setShowNewChat(false);
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Failed to create chat. Please try again.');
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

  // User selection helpers
  const toggleUserSelection = (userToToggle) => {
    setSelectedUsers(prev => 
      prev.some(u => u.id === userToToggle.id)
        ? prev.filter(u => u.id !== userToToggle.id)
        : [...prev, userToToggle]
    );
  };

  const isUserSelected = (userToCheck) => {
    return selectedUsers.some(u => u.id === userToCheck.id);
  };

  // Filter users based on search term
  const filteredUsers = allUsers.filter(user => {
    const displayName = user.displayName || '';
    const email = user.email || '';
    const searchTerm = userSearchTerm.toLowerCase();
    
    return displayName.toLowerCase().includes(searchTerm) || 
           email.toLowerCase().includes(searchTerm);
  });

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
          <div className="card" style={{...modalCard, maxWidth: 500, maxHeight: '90vh', overflowY: 'auto'}}>
            <h3 style={{ marginTop: 0, marginBottom: 12, textAlign: 'center' }}>New Chat</h3>
            
            {/* Chat Name Input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Chat Name</label>
              <input
                type="text"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                placeholder="Enter chat name"
                className="form-control"
                onKeyDown={(e) => e.key === 'Enter' && createNewChat()}
              />
            </div>

            {/* User Selection */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Add People</label>
              
              {/* Search Bar */}
              <input
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
                className="form-control"
                style={{ marginBottom: 12 }}
              />
              
              <div style={{ 
                maxHeight: 200, 
                overflowY: 'auto', 
                border: '1px solid var(--border)', 
                borderRadius: 8,
                padding: 8
              }}>
                {allUsers.length === 0 ? (
                  <div className="text-muted" style={{ textAlign: 'center', padding: 20 }}>
                    No other users found
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-muted" style={{ textAlign: 'center', padding: 20 }}>
                    No users match your search
                  </div>
                ) : (
                  filteredUsers.map((userOption) => (
                    <div
                      key={userOption.id}
                      onClick={() => toggleUserSelection(userOption)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        backgroundColor: isUserSelected(userOption) ? 'var(--brand-primary-50)' : 'transparent',
                        border: isUserSelected(userOption) ? '1px solid var(--brand-primary)' : '1px solid transparent',
                        marginBottom: 4
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isUserSelected(userOption)}
                        onChange={() => toggleUserSelection(userOption)}
                        style={{ marginRight: 12 }}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {userOption.displayName || userOption.email}
                        </div>
                        <div className="text-muted" style={{ fontSize: 14 }}>
                          {userOption.email}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Selected Users Summary */}
            {selectedUsers.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Selected Users</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedUsers.map((selectedUser) => (
                    <span
                      key={selectedUser.id}
                      style={{
                        backgroundColor: 'var(--brand-primary)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      {selectedUser.displayName || selectedUser.email}
                      <button
                        onClick={() => toggleUserSelection(selectedUser)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: 14,
                          padding: 0,
                          marginLeft: 4
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => { 
                  setShowNewChat(false); 
                  setNewChatName(''); 
                  setSelectedUsers([]); 
                  setUserSearchTerm('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={createNewChat} 
                disabled={!newChatName.trim() || loading}
              >
                {loading ? 'Creating...' : 'Create Chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Details Modal */}
      {showChatDetails && selectedChat && (
        <div style={modalBackdrop}>
          <div className="card" style={{...modalCard, maxWidth: 500}}>
            <h3 style={{ marginTop: 0, marginBottom: 16, textAlign: 'center' }}>Chat Details</h3>
            
            {/* Chat Info */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Chat Name</label>
                <p style={{ margin: 0, padding: 8, backgroundColor: 'var(--surface-alt)', borderRadius: 6 }}>
                  {selectedChat.name}
                </p>
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Created</label>
                <p style={{ margin: 0, padding: 8, backgroundColor: 'var(--surface-alt)', borderRadius: 6 }}>
                  {selectedChat.createdAt ? formatDate(selectedChat.createdAt) : 'Unknown'}
                </p>
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Messages</label>
                <p style={{ margin: 0, padding: 8, backgroundColor: 'var(--surface-alt)', borderRadius: 6 }}>
                  {messages.length} message{messages.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Participants */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Participants</label>
              <div style={{ 
                maxHeight: 200, 
                overflowY: 'auto', 
                border: '1px solid var(--border)', 
                borderRadius: 8,
                padding: 8
              }}>
                {chatUsers.length === 0 ? (
                  <div className="text-muted" style={{ textAlign: 'center', padding: 20 }}>
                    Loading participants...
                  </div>
                ) : (
                  chatUsers.map((participant) => (
                    <div
                      key={participant.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: 6,
                        backgroundColor: participant.id === user.uid ? 'var(--brand-primary-50)' : 'var(--surface-alt)',
                        marginBottom: 4
                      }}
                    >
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: participant.id === user.uid ? 'var(--brand-primary)' : 'var(--ink-500)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: 14,
                        marginRight: 12
                      }}>
                        {(participant.displayName || participant.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {participant.displayName || participant.email}
                          {participant.id === user.uid && (
                            <span style={{ 
                              marginLeft: 8, 
                              fontSize: 12, 
                              color: 'var(--brand-primary)',
                              fontWeight: 600 
                            }}>
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: 14 }}>
                          {participant.email}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
