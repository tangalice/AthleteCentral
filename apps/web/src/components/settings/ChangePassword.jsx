// src/components/settings/ChangePassword.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
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
      // Re-authenticate with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
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
    <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
      <Link to="/settings" className="text-primary" style={{ display: "inline-block", marginBottom: 16 }}>
        ← Back to Settings
      </Link>

      <div className="card" style={{ maxWidth: 600, margin: "0 auto" }}>
        <h2 className="mb-2">Change Password</h2>
        <p className="text-muted mb-3">
          Enter your current password and set a new one (minimum 8 characters).
        </p>

        <div className="form-group">
          <label htmlFor="current" style={{ fontWeight: 700 }}>Current Password</label>
          <input
            id="current"
            type="password"
            className="form-control"
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="new" style={{ fontWeight: 700 }}>New Password</label>
          <input
            id="new"
            type="password"
            className="form-control"
            placeholder="New Password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirm" style={{ fontWeight: 700 }}>Confirm New Password</label>
          <input
            id="confirm"
            type="password"
            className="form-control"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button
          onClick={handleChangePassword}
          disabled={loading}
          className="btn btn-primary"
          style={{ width: "100%" }}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>

        {message && (
          <div
            className={`alert ${
              message.startsWith("Error") || message.includes("match")
                ? "alert-error"
                : "alert-success"
            }`}
            role="status"
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
