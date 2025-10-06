// src/components/Login.jsx
import { useState } from "react";
import { auth, db } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  sendEmailVerification,
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    try {
      // Log in users
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Check if the email has been verified
      if (!user.emailVerified) {
        setMessage("Please verify your email before logging in.");
        await auth.signOut();
        return;
      }
      
      // Access user info from firebase
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role;
        
        // Update last logged in time
        await updateDoc(doc(db, "users", user.uid), {
          lastLoginAt: serverTimestamp(),
          emailVerified: true
        });
        
        setMessage(`Login successful! Welcome back!`);
        
        // Jump based on roles
        setTimeout(() => {
          if (role === "athlete") {
            navigate("/athlete-dashboard");
          } else if (role === "coach") {
            navigate("/coach-dashboard");
          } else {
            navigate("/dashboard");
          }
        }, 1000);
        
      } else {
        setMessage("User profile not found.");
        await auth.signOut();
      }
      
    } catch (error) {
      switch (error.code) {
        case 'auth/invalid-email':
          setMessage("Invalid email address.");
          break;
        case 'auth/user-not-found':
          setMessage("No account found with this email.");
          break;
        case 'auth/wrong-password':
          setMessage("Incorrect password.");
          break;
        case 'auth/invalid-credential':
          setMessage("Invalid email or password.");
          break;
        default:
          setMessage(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleForgotPassword = async () => {
    if (!email) {
      setMessage("Please enter your email address first.");
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent!");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "20px" }}>
      <h2>Login</h2>
      
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: "15px" }}>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "10px" }}
          />
        </div>
        
        <div style={{ marginBottom: "15px" }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "10px" }}
          />
        </div>
        
        <button 
          type="submit"
          disabled={loading}
          style={{ 
            width: "100%", 
            padding: "10px", 
            backgroundColor: loading ? "#ccc" : "#646cff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
        
        <button
          type="button"
          onClick={handleForgotPassword}
          style={{
            width: "100%",
            padding: "10px",
            marginTop: "10px",
            backgroundColor: "transparent",
            color: "#646cff",
            border: "1px solid #646cff",
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          Forgot Password?
        </button>
      </form>
      
      {message && (
        <div style={{ 
          marginTop: "15px", 
          padding: "10px", 
          backgroundColor: message.includes("Error") || message.includes("verify") 
            ? "#ffebee" 
            : "#e8f5e9",
          color: message.includes("Error") || message.includes("verify") 
            ? "#c62828" 
            : "#2e7d32",
          borderRadius: "5px"
        }}>
          {message}
        </div>
      )}
      
      <p style={{ marginTop: "20px", textAlign: "center" }}>
        Don't have an account? <a href="/signup">Sign up here</a>
      </p>
    </div>
  );
}