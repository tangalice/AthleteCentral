// src/components/settings/ChangePassword.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../../firebase";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

export default function ChangePassword({ user }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setMessage("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <Link
        to="/settings"
        style={{
          color: "#646cff",
          textDecoration: "none",
          marginBottom: 20,
          display: "inline-block",
        }}
      >
        ← Back to Settings
      </Link>

      <h2 style={{ color: "#333", marginBottom: "30px" }}>Change Password</h2>

      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <input
          type="password"
          placeholder="Current Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 15,
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 16,
          }}
        />
        <input
          type="password"
          placeholder="New Password (min 8 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 15,
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 16,
          }}
        />
        <input
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 20,
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 16,
          }}
        />

        <button
          onClick={handleChangePassword}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 20px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>

        {message && (
          <div
            style={{
              marginTop: 20,
              padding: 12,
              backgroundColor:
                message.includes("Error") || message.includes("match")
                  ? "#ffebee"
                  : "#e8f5e9",
              color:
                message.includes("Error") || message.includes("match")
                  ? "#c62828"
                  : "#2e7d32",
              borderRadius: 8,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}