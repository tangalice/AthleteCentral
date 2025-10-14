// src/components/VerifyEmail.jsx
import { useState, useEffect } from "react";
import { auth } from "../../firebase";
import { sendEmailVerification } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import AuthShell from "./AuthShell";

export default function VerifyEmail() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Bootstrap current user and early redirects
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

  // Polling to detect verification (every 3s)
  useEffect(() => {
    if (!user) return;

    const checkInterval = setInterval(async () => {
      try {
        await user.reload();
        if (user.emailVerified) {
          setMessage("Email verified! Redirecting to login...");
          clearInterval(checkInterval);
          setTimeout(() => navigate("/login"), 1500);
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
      if (error.code === "auth/too-many-requests") {
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
        setTimeout(() => navigate("/login"), 1200);
      } else {
        setMessage("Email not verified yet. Please check your inbox (and spam).");
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
        <h2 style={{ margin: 0, fontSize: 24, color: "#111827", fontWeight: 700 }}>
          Verify your email
        </h2>
        <p style={{ color: "#6b7280", marginTop: 6, marginBottom: 20 }}>
          We’ve sent a verification link to:
        </p>

        <div
          style={{
            fontWeight: 700,
            fontSize: 18,
            color: "#111827",
            marginBottom: 16,
            wordBreak: "break-all",
          }}
        >
          {user?.email || "—"}
        </div>

        <div
          style={{
            backgroundColor: "#f1f5f9",
            border: "1px solid #e2e8f0",
            padding: 14,
            borderRadius: 10,
            marginBottom: 18,
          }}
        >
          <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", lineHeight: 1.6 }}>
            <li>Open your inbox and find the email from Athlete Hub</li>
            <li>Click the verification link inside the email</li>
            <li>Return here and tap “I’ve Verified”</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <button
            onClick={handleCheckVerification}
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 10,
              background: "#10b981",
              color: "#fff",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 6px 20px rgba(16,185,129,0.25)",
            }}
          >
            {loading ? "Checking..." : "I’ve Verified"}
          </button>

          <button
            onClick={handleResendEmail}
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 10,
              background: "transparent",
              color: "#10b981",
              border: "2px solid #10b981",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Resend Email
          </button>
        </div>

        {message && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 8,
              background: message.startsWith("Error") ? "#fef2f2" : "#ecfdf5",
              color: message.startsWith("Error") ? "#b91c1c" : "#065f46",
              fontSize: 14,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </AuthShell>
  );
}
