// src/components/SignUp.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import AuthShell from "./AuthShell";

export default function SignUp() {
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "athlete",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match!");
      return;
    }
    if (formData.password.length < 6) {
      setMessage("Password must be at least 6 characters!");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      await updateProfile(cred.user, { displayName: formData.displayName });

      // Write user doc
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email: formData.email,
        displayName: formData.displayName,
        role: formData.role,
        emailVerified: false,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      // Send verification email and keep user on page (your original behavior)
      try {
        await cred.user.reload();
        await sendEmailVerification(cred.user, {
          url: window.location.origin + "/login",
          handleCodeInApp: false,
        });
        setMessage(
          "Account created! Please check your email (including spam) for the verification link."
        );
      } catch (emailErr) {
        setMessage(
          `Account created but email failed: ${emailErr.message}`
        );
      }
    } catch (error) {
      switch (error.code) {
        case "auth/email-already-in-use":
          setMessage("This email is already registered.");
          break;
        case "auth/invalid-email":
          setMessage("Invalid email address.");
          break;
        case "auth/weak-password":
          setMessage("Password is too weak.");
          break;
        case "auth/network-request-failed":
          setMessage("Network error. Please check your connection.");
          break;
        default:
          setMessage(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      footer={
        <p style={{ margin: 0, textAlign: "center", color: "#6b7280" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#10b981", textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      }
    >
      <h2 style={{ margin: 0, fontSize: 24, color: "#111827", fontWeight: 700 }}>
        Create your account
      </h2>
      <p style={{ color: "#6b7280", marginTop: 6, marginBottom: 20 }}>
        Join Athlete Hub and get started
      </p>

      <form onSubmit={onSubmit}>
        <label htmlFor="displayName" style={{ display: "block", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Display Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          value={formData.displayName}
          onChange={onChange}
          placeholder="Your Name"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 14, fontSize: 16 }}
          required
        />

        <label htmlFor="email" style={{ display: "block", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={onChange}
          placeholder="you@example.com"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 14, fontSize: 16 }}
          required
        />

        <label htmlFor="password" style={{ display: "block", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={formData.password}
          onChange={onChange}
          placeholder="Min 6 characters"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 14, fontSize: 16 }}
          required
        />

        <label htmlFor="confirmPassword" style={{ display: "block", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={onChange}
          placeholder="Re-enter your password"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 14, fontSize: 16 }}
          required
        />

        <label htmlFor="role" style={{ display: "block", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          I am a
        </label>
        <select
          id="role"
          name="role"
          value={formData.role}
          onChange={onChange}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 20, fontSize: 16 }}
        >
          <option value="athlete">Athlete</option>
          <option value="coach">Coach</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 10,
            background: "#10b981", color: "#fff", fontSize: 16, border: "none",
            cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 6px 20px rgba(16,185,129,0.25)"
          }}
        >
          {loading ? "Creating..." : "Create Account"}
        </button>

        {message && (
          <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: message.startsWith("Account created") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("Account created") ? "#065f46" : "#b91c1c", fontSize: 14 }}>
            {message}
          </div>
        )}
      </form>
    </AuthShell>
  );
}
