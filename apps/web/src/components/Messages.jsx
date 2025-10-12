import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const Messages = () => {
  const [user, authLoading, error] = useAuthState(auth);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showChatDetails, setShowChatDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#8e8e93'
      }}>
        Loading...
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#8e8e93'
      }}>
        Please log in to access messages
      </div>
    );
  }

  // Load user's chats
  useEffect(() => {
    if (!user) return;

    console.log('Setting up chats listener for user:', user.uid);

    // First try a simple query without orderBy to avoid index issues
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      console.log('Chats snapshot received:', snapshot.size, 'chats');
      const chatsData = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Chat data:', doc.id, data);
        return {
          id: doc.id,
          ...data
        };
      });
      
      // Sort by lastMessageTime in JavaScript instead of Firestore
      chatsData.sort((a, b) => {
        const aTime = a.lastMessageTime?.toDate ? a.lastMessageTime.toDate() : new Date(0);
        const bTime = b.lastMessageTime?.toDate ? b.lastMessageTime.toDate() : new Date(0);
        return bTime - aTime;
      });
      
      setChats(chatsData);
    }, (error) => {
      console.error('Error in chats listener:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Load messages for selected chat
  useEffect(() => {
    if (!selectedChat) {
      console.log('No chat selected, clearing messages');
      setMessages([]);
      return;
    }

    console.log('Setting up messages listener for chat:', selectedChat.id);

    // Try without orderBy first to avoid index issues
    const messagesQuery = query(
      collection(db, 'messages'),
      where('chatId', '==', selectedChat.id)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      console.log('Messages snapshot received:', snapshot.size, 'messages');
      const messagesData = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Message data:', doc.id, data);
        return {
          id: doc.id,
          ...data
        };
      });
      
      // Sort by timestamp in JavaScript instead of Firestore
      messagesData.sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
        return aTime - bTime;
      });
      
      console.log('Sorted messages:', messagesData);
      setMessages(messagesData);
    }, (error) => {
      console.error('Error in messages listener:', error);
      console.error('Error code:', error.code);
      console.error('Error details:', error);
    });

    return () => unsubscribe();
  }, [selectedChat]);

  const createNewChat = async () => {
    if (!newChatName.trim()) return;
    
    // Debug: Check user authentication
    console.log('User:', user);
    console.log('User UID:', user?.uid);
    console.log('User authenticated:', !!user);
    
    setLoading(true);
    try {
      // First, let's try to read from Firestore to test connectivity
      console.log('Testing Firestore read access...');
      const testQuery = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
      const testSnapshot = await getDocs(testQuery);
      console.log('Firestore read test successful:', testSnapshot.size, 'docs found');
      
      const chatData = {
        name: newChatName.trim(),
        participants: [user.uid],
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
        lastMessage: ''
      };

      console.log('Attempting to create chat with data:', chatData);
      const docRef = await addDoc(collection(db, 'chats'), chatData);
      console.log('Chat created with ID:', docRef.id);
      console.log('Chat created successfully! The listener should pick it up soon.');
      
      setNewChatName('');
      setShowNewChat(false);
    } catch (error) {
      console.error('Error creating chat:', error);
      console.error('Error code:', error.code);
      console.error('Error details:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      // More specific error messages
      if (error.code === 'permission-denied') {
        alert(`Permission denied. Error details: ${error.message}\n\nCheck browser console for more details.`);
      } else if (error.code === 'unavailable') {
        alert('Firestore service is unavailable. Please try again later.');
      } else {
        alert(`Failed to create chat: ${error.message}\n\nError code: ${error.code}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    console.log('Sending message:', newMessage.trim(), 'to chat:', selectedChat.id);
    setLoading(true);
    try {
      const messageData = {
        chatId: selectedChat.id,
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        text: newMessage.trim(),
        timestamp: serverTimestamp()
      };

      console.log('Message data to be sent:', messageData);
      const docRef = await addDoc(collection(db, 'messages'), messageData);
      console.log('Message sent successfully with ID:', docRef.id);

      // Update chat's last message time
      console.log('Updating chat last message...');
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessageTime: serverTimestamp(),
        lastMessage: newMessage.trim()
      });
      console.log('Chat updated successfully');

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error code:', error.code);
      console.error('Error details:', error);
      alert(`Failed to send message: ${error.message}\n\nError code: ${error.code}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async () => {
    if (!selectedChat) return;

    if (window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      setLoading(true);
      try {
        // Delete all messages in the chat
        const messagesQuery = query(
          collection(db, 'messages'),
          where('chatId', '==', selectedChat.id)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        
        const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        // Delete the chat
        await deleteDoc(doc(db, 'chats', selectedChat.id));
        
        setSelectedChat(null);
        setShowChatDetails(false);
      } catch (error) {
        console.error('Error deleting chat:', error);
        alert('Failed to delete chat');
      } finally {
        setLoading(false);
      }
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      backgroundColor: '#f2f2f7',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Chat List Sidebar */}
      <div style={{ 
        width: '350px', 
        backgroundColor: '#ffffff', 
        borderRight: '1px solid #e5e5ea',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '20px', 
          borderBottom: '1px solid #e5e5ea',
          backgroundColor: '#ffffff'
        }}>
          <h2 style={{ 
            margin: '0 0 15px 0', 
            fontSize: '24px', 
            fontWeight: '600',
            color: '#1d1d1f'
          }}>
            Messages
          </h2>
          <button
            onClick={() => setShowNewChat(true)}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {chats.length === 0 ? (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#8e8e93' 
            }}>
              No chats yet. Create your first chat!
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #f2f2f7',
                  cursor: 'pointer',
                  backgroundColor: selectedChat?.id === chat.id ? '#e3f2fd' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ 
                      margin: '0 0 4px 0', 
                      fontSize: '16px', 
                      fontWeight: '500',
                      color: '#1d1d1f',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {chat.name}
                    </h3>
                    {chat.lastMessage && (
                      <p style={{ 
                        margin: '0', 
                        fontSize: '14px', 
                        color: '#8e8e93',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {chat.lastMessage}
                      </p>
                    )}
                  </div>
                  {chat.lastMessageTime && (
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#8e8e93',
                      marginLeft: '8px',
                      flexShrink: 0
                    }}>
                      {formatTime(chat.lastMessageTime)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#ffffff'
      }}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid #e5e5ea',
              backgroundColor: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ 
                  margin: '0', 
                  fontSize: '18px', 
                  fontWeight: '600',
                  color: '#1d1d1f'
                }}>
                  {selectedChat.name}
                </h3>
                <p style={{ 
                  margin: '2px 0 0 0', 
                  fontSize: '14px', 
                  color: '#8e8e93' 
                }}>
                  {messages.length} message{messages.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowChatDetails(true)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'transparent',
                  border: '1px solid #d1d1d6',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#007AFF',
                  cursor: 'pointer'
                }}
              >
                Details
              </button>
            </div>

            {/* Messages */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {messages.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#8e8e93',
                  marginTop: '40px'
                }}>
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.senderId === user.uid;
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const showDate = !prevMessage || 
                    formatDate(message.timestamp) !== formatDate(prevMessage.timestamp);

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div style={{ 
                          textAlign: 'center', 
                          margin: '20px 0 12px 0',
                          fontSize: '13px',
                          color: '#8e8e93'
                        }}>
                          {formatDate(message.timestamp)}
                        </div>
                      )}
                      <div style={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        marginBottom: '4px'
                      }}>
                        <div style={{
                          maxWidth: '70%',
                          backgroundColor: isOwn ? '#007AFF' : '#e5e5ea',
                          color: isOwn ? 'white' : '#1d1d1f',
                          padding: '12px 16px',
                          borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          fontSize: '16px',
                          lineHeight: '1.4',
                          wordWrap: 'break-word'
                        }}>
                          {message.text}
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        marginBottom: '8px'
                      }}>
                        <span style={{ 
                          fontSize: '11px', 
                          color: '#8e8e93',
                          margin: '0 8px'
                        }}>
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Input */}
            <div style={{ 
              padding: '16px 20px', 
              borderTop: '1px solid #e5e5ea',
              backgroundColor: '#ffffff'
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message"
                  style={{
                    flex: 1,
                    minHeight: '36px',
                    maxHeight: '120px',
                    padding: '8px 12px',
                    border: '1px solid #d1d1d6',
                    borderRadius: '18px',
                    fontSize: '16px',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || loading}
                  style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: newMessage.trim() ? '#007AFF' : '#d1d1d6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '18px',
                    cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  ↑
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: '#8e8e93',
            fontSize: '18px'
          }}>
            Select a chat to start messaging
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '400px',
            maxWidth: '90vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', textAlign: 'center' }}>
              New Chat
            </h3>
            <input
              type="text"
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
              placeholder="Chat name"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d1d6',
                borderRadius: '8px',
                fontSize: '16px',
                marginBottom: '16px',
                outline: 'none',
                textAlign: 'center',
                boxSizing: 'border-box'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  createNewChat();
                }
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', width: '100%' }}>
              <button
                onClick={() => {
                  setShowNewChat(false);
                  setNewChatName('');
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  border: '1px solid #d1d1d6',
                  borderRadius: '8px',
                  fontSize: '16px',
                  color: '#1d1d1f',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createNewChat}
                disabled={!newChatName.trim() || loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: newChatName.trim() ? '#007AFF' : '#d1d1d6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: newChatName.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Details Modal */}
      {showChatDetails && selectedChat && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '400px',
            maxWidth: '90vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', textAlign: 'center' }}>
              Chat Details
            </h3>
            <div style={{ marginBottom: '16px', width: '100%', textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: '500', color: '#1d1d1f' }}>Chat Name:</p>
              <p style={{ margin: '0 0 16px 0', color: '#1d1d1f', fontSize: '16px' }}>{selectedChat.name}</p>
              
              <p style={{ margin: '0 0 8px 0', fontWeight: '500', color: '#1d1d1f' }}>Created:</p>
              <p style={{ margin: '0 0 16px 0', color: '#1d1d1f', fontSize: '16px' }}>
                {selectedChat.createdAt ? formatDate(selectedChat.createdAt) : 'Unknown'}
              </p>
              
              <p style={{ margin: '0 0 8px 0', fontWeight: '500', color: '#1d1d1f' }}>Messages:</p>
              <p style={{ margin: '0 0 16px 0', color: '#1d1d1f', fontSize: '16px' }}>
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', width: '100%' }}>
              <button
                onClick={() => setShowChatDetails(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  border: '1px solid #d1d1d6',
                  borderRadius: '8px',
                  fontSize: '16px',
                  color: '#1d1d1f',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                onClick={deleteChat}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: loading ? '#d1d1d6' : '#ff3b30',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Deleting...' : 'Delete Chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
