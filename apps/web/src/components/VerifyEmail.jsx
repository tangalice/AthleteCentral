// src/components/VerifyEmail.jsx
import { useState, useEffect } from "react";
import { auth } from "../firebase";
import { sendEmailVerification } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function VerifyEmail() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
      if (currentUser.emailVerified) {
        navigate("/login");
      }
    } else {
      navigate("/signup");
    }
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    const checkInterval = setInterval(async () => {
      try {
        await user.reload();
        if (user.emailVerified) {
          setMessage("Email verified! Redirecting to login...");
          clearInterval(checkInterval);
          setTimeout(() => {
            navigate("/login");
          }, 2000);
        }
      } catch (error) {
        console.error("Error checking verification:", error);
      }
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [user, navigate]);

  const handleResendEmail = async () => {
    if (!user) return;
    
    setLoading(true);
    setMessage("");
    
    try {
      await sendEmailVerification(user);
      setMessage("Verification email resent! Check your inbox.");
    } catch (error) {
      if (error.code === 'auth/too-many-requests') {
        setMessage("Too many requests. Please wait before trying again.");
      } else {
        setMessage(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await user.reload();
      if (user.emailVerified) {
        setMessage("Email verified! Redirecting...");
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      } else {
        setMessage("Email not verified yet. Please check your inbox.");
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: "500px", 
      margin: "50px auto", 
      padding: "30px",
      textAlign: "center",
      backgroundColor: "#f9f9f9",
      borderRadius: "10px"
    }}>
      <div style={{ fontSize: "60px", marginBottom: "20px" }}>📧</div>
      
      <h2>Verify Your Email</h2>
      
      <p>We've sent a verification email to:</p>
      <p style={{ fontWeight: "bold", fontSize: "18px" }}>
        {user?.email}
      </p>
      
      <div style={{ 
        backgroundColor: "#e3f2fd", 
        padding: "15px", 
        borderRadius: "5px",
        marginBottom: "20px",
        marginTop: "20px"
      }}>
        <p> Check your inbox</p>
        <p> Click the verification link</p>
        <p> Return here and login</p>
      </div>
      
      <button
        onClick={handleCheckVerification}
        disabled={loading}
        style={{
          padding: "12px 24px",
          backgroundColor: "#4caf50",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: loading ? "not-allowed" : "pointer",
          marginRight: "10px"
        }}
      >
        I've Verified My Email
      </button>
      
      <button
        onClick={handleResendEmail}
        disabled={loading}
        style={{
          padding: "12px 24px",
          backgroundColor: "transparent",
          color: "#646cff",
          border: "2px solid #646cff",
          borderRadius: "5px",
          cursor: loading ? "not-allowed" : "pointer"
        }}
      >
        Resend Email
      </button>
      
      {message && (
        <div style={{ 
          marginTop: "20px", 
          padding: "10px", 
          backgroundColor: message.includes("Error") ? "#ffebee" : "#e8f5e9",
          color: message.includes("Error") ? "#c62828" : "#2e7d32",
          borderRadius: "5px"
        }}>
          {message}
        </div>
      )}
    </div>
  );
}