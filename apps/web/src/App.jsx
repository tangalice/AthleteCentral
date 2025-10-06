// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// Import all components
import SignUp from "./components/SignUp";
import Login from "./components/Login";
import DeleteAccount from "./components/DeleteAccount";
import EditAccount from "./components/EditAccount";
import ResetPassword from "./components/ResetPassword";
import VerifyEmail from "./components/VerifyEmail";
import Profile from "./components/Profile";

// Protected Route Component
function ProtectedRoute({ children, user, requireVerified = true }) {
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (requireVerified && !user.emailVerified) {
    return <Navigate to="/verify-email" />;
  }
  
  return children;
}

// Athlete Dashboard
function AthleteDashboard({ user }) {
  return (
    <div>
      <h2>Athlete Dashboard</h2>
      <p>Welcome, {user?.displayName || user?.email}!</p>
      <p>This is your athlete dashboard.</p>
    </div>
  );
}

// Coach Dashboard
function CoachDashboard({ user }) {
  return (
    <div>
      <h2>Coach Dashboard</h2>
      <p>Welcome, {user?.displayName || user?.email}!</p>
      <p>This is your coach dashboard.</p>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u && u.emailVerified) {
        try {
          const userDoc = await getDoc(doc(db, "users", u.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUserRole(null);
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setUserRole(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh" 
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <div style={{ padding: 20 }}>
        <h1>Athlete Central</h1>

        <nav style={{ 
          marginBottom: 20, 
          display: "flex", 
          gap: "10px",
          padding: "10px",
          backgroundColor: "#f5f5f5",
          borderRadius: "5px"
        }}>
          {!user ? (
            <>
              <Link to="/signup">Sign Up</Link>
              <Link to="/login">Login</Link>
              <Link to="/reset">Reset Password</Link>
            </>
          ) : (
            <>
              {user.emailVerified ? (
                <>
                  <Link to="/dashboard">Dashboard</Link>
                  <Link to="/profile">Profile</Link>
                </>
              ) : (
                <Link to="/verify-email">Verify Email</Link>
              )}
              
              <button onClick={handleLogout} style={{ 
                backgroundColor: "#ff4444",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: "4px",
                cursor: "pointer",
                marginLeft: "auto"
              }}>
                Logout
              </button>
            </>
          )}
        </nav>

        <Routes>
          {/* Public routes */}
          <Route path="/signup" element={
            user ? <Navigate to="/dashboard" /> : <SignUp />
          } />
          <Route path="/login" element={
            user && user.emailVerified ? <Navigate to="/dashboard" /> : <Login />
          } />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          
          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute user={user}>
              {userRole === "athlete" ? (
                <AthleteDashboard user={user} />
              ) : userRole === "coach" ? (
                <CoachDashboard user={user} />
              ) : (
                <div>
                  <h2>Dashboard</h2>
                  <p>Welcome, {user?.displayName || user?.email}!</p>
                </div>
              )}
            </ProtectedRoute>
          } />
          
          <Route path="/athlete-dashboard" element={
            <ProtectedRoute user={user}>
              <AthleteDashboard user={user} />
            </ProtectedRoute>
          } />
          
          <Route path="/coach-dashboard" element={
            <ProtectedRoute user={user}>
              <CoachDashboard user={user} />
            </ProtectedRoute>
          } />
          
          <Route path="/profile" element={
            <ProtectedRoute user={user}>
              <Profile />
            </ProtectedRoute>
          } />
          
          <Route path="/edit" element={
            <ProtectedRoute user={user}>
              <EditAccount />
            </ProtectedRoute>
          } />
          
          <Route path="/delete" element={
            <ProtectedRoute user={user}>
              <DeleteAccount />
            </ProtectedRoute>
          } />
          

          {/* Default route */}
          <Route path="/" element={
            user ? (
              <Navigate to="/dashboard" />
            ) : (
              <div style={{ textAlign: "center", marginTop: "50px" }}>
                <h2>Welcome to Athlete Central</h2>
                <p>Please sign up or login to continue.</p>
                <div style={{ marginTop: "30px" }}>
                  <Link to="/signup" style={{ 
                    padding: "10px 20px", 
                    margin: "0 10px",
                    backgroundColor: "#646cff",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "5px",
                    display: "inline-block"
                  }}>
                    Get Started
                  </Link>
                  <Link to="/login" style={{ 
                    padding: "10px 20px", 
                    margin: "0 10px",
                    border: "2px solid #646cff",
                    color: "#646cff",
                    textDecoration: "none",
                    borderRadius: "5px",
                    display: "inline-block"
                  }}>
                    Login
                  </Link>
                </div>
              </div>
            )
          } />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;