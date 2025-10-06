// src/components/SignUp.jsx
import { useState } from "react";
import { auth, db } from "../firebase";
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  updateProfile 
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function SignUp() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    role: "athlete"
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    
    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match!");
      return;
    }
    
    // Validate password length
    if (formData.password.length < 6) {
      setMessage("Password must be at least 6 characters!");
      return;
    }
    
    setLoading(true);
    setMessage("");
    
    try {
      console.log("Starting signup process for:", formData.email);
      
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      
      const user = userCredential.user;
      console.log("User created with UID:", user.uid);
      
      // Update user display name
      await updateProfile(user, {
        displayName: formData.displayName
      });
      console.log("Profile updated with display name:", formData.displayName);
      
      // Send verification email with configuration
      try {
        // Make sure we have the latest user object
        await auth.currentUser.reload();
        
        const actionCodeSettings = {
          url: window.location.origin + '/login', // Where to redirect after verification
          handleCodeInApp: false,
        };
        
        await sendEmailVerification(auth.currentUser, actionCodeSettings);
        console.log("Verification email sent successfully to:", user.email);
        console.log("Check spam folder if not in inbox");
        
      } catch (emailError) {
        console.error("Error sending verification email:", emailError);
        setMessage(`Account created but email failed: ${emailError.message}`);
      }
      
      // Save user info to Firestore
      try {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: formData.email,
          displayName: formData.displayName,
          role: formData.role,
          emailVerified: false,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        });
        console.log("User data saved to Firestore");
      } catch (firestoreError) {
        console.error("Error saving to Firestore:", firestoreError);
      }
      
      setMessage("Account created! Check your email (including spam folder) for verification link.");
      
      // Don't automatically redirect - let user see the message
      // setTimeout(() => {
      //   navigate("/verify-email");
      // }, 2000);
      
    } catch (error) {
      console.error("Signup error:", error);
      
      // Handle errors
      switch (error.code) {
        case 'auth/email-already-in-use':
          setMessage("This email is already registered.");
          break;
        case 'auth/invalid-email':
          setMessage("Invalid email address.");
          break;
        case 'auth/weak-password':
          setMessage("Password is too weak.");
          break;
        case 'auth/operation-not-allowed':
          setMessage("Email/password accounts are not enabled. Please check Firebase Console.");
          break;
        case 'auth/network-request-failed':
          setMessage("Network error. Please check your internet connection.");
          break;
        default:
          setMessage(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual email resend function for testing
  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        setMessage("Verification email resent! Check your spam folder.");
      } catch (error) {
        setMessage(`Resend failed: ${error.message}`);
      }
    } else {
      setMessage("No user logged in");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "20px" }}>
      <h2>Create Account</h2>
      
      <form onSubmit={handleSignUp}>
        <div style={{ marginBottom: "15px" }}>
          <input
            type="text"
            name="displayName"
            placeholder="Full Name"
            value={formData.displayName}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: "10px" }}
          />
        </div>
        
        <div style={{ marginBottom: "15px" }}>
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: "10px" }}
          />
        </div>
        
        <div style={{ marginBottom: "15px" }}>
          <input
            type="password"
            name="password"
            placeholder="Password (min 6 characters)"
            value={formData.password}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: "10px" }}
          />
        </div>
        
        <div style={{ marginBottom: "15px" }}>
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: "10px" }}
          />
        </div>
        
        <div style={{ marginBottom: "15px" }}>
          <label>I am a:</label>
          <select 
            name="role"
            value={formData.role} 
            onChange={handleChange}
            style={{ width: "100%", padding: "10px", marginTop: "5px" }}
          >
            <option value="athlete">Athlete</option>
            <option value="coach">Coach</option>
          </select>
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
          {loading ? "Creating Account..." : "Sign Up"}
        </button>
      </form>
      
      {message && (
        <div style={{ 
          marginTop: "15px", 
          padding: "10px", 
          backgroundColor: message.includes("Error") || message.includes("failed") ? "#ffebee" : "#e8f5e9",
          color: message.includes("Error") || message.includes("failed") ? "#c62828" : "#2e7d32",
          borderRadius: "5px"
        }}>
          {message}
          
          {/* Debug button for resending email */}
          {message.includes("created") && (
            <button 
              onClick={resendVerificationEmail}
              style={{
                marginTop: "10px",
                padding: "5px 10px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                display: "block",
                width: "100%"
              }}
            >
              Resend Verification Email
            </button>
          )}
        </div>
      )}
      
      <p style={{ marginTop: "20px", textAlign: "center" }}>
        Already have an account? <a href="/login">Login here</a>
      </p>
      
      {/* Debug information */}
      <div style={{ 
        marginTop: "20px", 
        padding: "10px", 
        backgroundColor: "#f5f5f5",
        fontSize: "12px",
        borderRadius: "5px"
      }}>
        <p><strong>Debug Info:</strong></p>
        <p>Check browser console (F12) for detailed logs</p>
        <p>Firebase Project: athletecentralapp</p>
        <p>Current User: {auth.currentUser?.email || "None"}</p>
      </div>
    </div>
  );
}