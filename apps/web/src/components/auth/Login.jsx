// src/components/auth/Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import AuthShell from "./AuthShell";
import SessionsService from "../../services/SessionsService";

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
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      if (!user.emailVerified) {
        setMessage("Please verify your email before logging in.");
        await auth.signOut();
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        setMessage("User profile not found.");
        await auth.signOut();
        return;
      }

      const data = snap.data();
      const role = data.role;

      try {
        const created = await SessionsService.createSession(user.uid, user.email);
        // 
        const sessionId =
          typeof created === "string"
            ? created
            : created?.sessionId || SessionsService.getCurrentSessionId?.();

        if (sessionId) {
          localStorage.setItem("currentSessionId", sessionId);
        }
        console.log("Session created successfully:", sessionId);
      } catch (sessionError) {
        console.error("Error creating session:", sessionError);
      }

      await updateDoc(doc(db, "users", user.uid), {
        lastLoginAt: serverTimestamp(),
        emailVerified: true,
      });

      setMessage("Login successful! Welcome back!");

      setTimeout(() => {
        if (role === "athlete") navigate("/athlete-dashboard");
        else if (role === "coach") navigate("/coach-dashboard");
        else navigate("/dashboard");
      }, 800);
    } catch (error) {
      switch (error.code) {
        case "auth/invalid-email":
          setMessage("Invalid email address.");
          break;
        case "auth/user-not-found":
          setMessage("No account found with this email.");
          break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setMessage("Invalid email or password.");
          break;
        case "auth/network-request-failed":
          setMessage("Network error. Please check your connection.");
          break;
        case "auth/too-many-requests":
          setMessage("Too many failed login attempts. Please try again later.");
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
      setMessage("Password reset email sent! Check your inbox.");
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        setMessage("No account found with this email.");
      } else {
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  return (
    <AuthShell
      footer={
        <p style={{ margin: 0, textAlign: "center", color: "#6b7280" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "#10b981", textDecoration: "none" }}>
            Create one
          </Link>
        </p>
      }
    >
      <h2 style={{ margin: 0, fontSize: 24, color: "#111827", fontWeight: 700 }}>
        Welcome back
      </h2>
      <p style={{ color: "#6b7280", marginTop: 6, marginBottom: 20 }}>
        Sign in to continue to Athlete Hub
      </p>

      <form onSubmit={handleLogin}>
        <label htmlFor="email" style={{ display: "block", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ 
            width: "100%", 
            padding: 12, 
            borderRadius: 10, 
            border: "1px solid #e5e7eb", 
            marginBottom: 14, 
            fontSize: 16 
          }}
          required
        />

        <label htmlFor="password" style={{ display: "block", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{ 
            width: "100%", 
            padding: 12, 
            borderRadius: 10, 
            border: "1px solid #e5e7eb", 
            marginBottom: 6, 
            fontSize: 16 
          }}
          required
        />

        <div style={{ textAlign: "right", marginBottom: 16 }}>
          <button
            type="button"
            onClick={handleForgotPassword}
            style={{ 
              background: "none", 
              border: "none", 
              color: "#10b981", 
              cursor: "pointer", 
              padding: 0, 
              fontSize: 14 
            }}
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", 
            padding: "12px 16px", 
            borderRadius: 10,
            background: loading ? "#9ca3af" : "#10b981", 
            color: "#fff", 
            fontSize: 16, 
            border: "none",
            cursor: loading ? "not-allowed" : "pointer", 
            boxShadow: loading ? "none" : "0 6px 20px rgba(16,185,129,0.25)",
            transition: "all 0.2s"
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        {message && (
          <div style={{ 
            marginTop: 14, 
            padding: 10, 
            borderRadius: 8, 
            background: message.includes("Error") || message.includes("verify") || message.includes("No account") || message.includes("Invalid") ? "#fef2f2" : "#ecfdf5", 
            color: message.includes("Error") || message.includes("verify") || message.includes("No account") || message.includes("Invalid") ? "#b91c1c" : "#065f46", 
            fontSize: 14 
          }}>
            {message}
          </div>
        )}
      </form>
    </AuthShell>
  );
}
