// src/components/settings/DeleteAccount.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { auth, db } from "../../firebase";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";

/**
 * DeleteAccount — themed with index.css classes
 * - Back to Settings link
 * - Danger card + alert
 * - Re-auth on requires-recent-login
 */
export default function DeleteAccount() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!window.confirm("This will permanently delete your account and data. Continue?")) return;

    setBusy(true);
    setMsg("");
    try {
      // Try direct delete first
      try {
        await deleteUser(user);
      } catch (err) {
        if (err.code === "auth/requires-recent-login") {
          if (!user.email) {
            setMsg("Recent login required but no email is associated. Please sign out and sign in again, then retry.");
            setBusy(false);
            return;
          }
          if (!password) {
            setMsg("Recent login required. Enter your current password, then click Delete again.");
            setBusy(false);
            return;
          }
          const cred = EmailAuthProvider.credential(user.email, password);
          await reauthenticateWithCredential(user, cred);
          await deleteUser(user);
        } else {
          throw err;
        }
      }

      // Best-effort: remove Firestore user profile
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch {
        /* ignore */
      }

      await auth.signOut();
      alert("Your account has been deleted.");
    } catch (err) {
      setMsg(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
      {/* Back link */}
      <Link to="/settings" className="text-primary" style={{ display: "inline-block", marginBottom: 16 }}>
        ← Back to Settings
      </Link>

      {/* Danger card */}
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <h2 className="mb-2">Delete Account</h2>
        <p className="text-muted">
          This action is <b>permanent</b> and cannot be undone. Your profile and related data will be removed.
        </p>

        {/* Warning */}
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          ⚠️ Please make sure you have exported any data you need before proceeding.
        </div>

        {/* Password input (only if prompted) */}
        <div className="form-group">
          <label htmlFor="current-password" style={{ fontWeight: 700 }}>Current password (only if prompted)</label>
          <input
            id="current-password"
            type="password"
            className="form-control"
            placeholder="Enter current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={busy}
          className="btn btn-danger"
          style={{ width: "100%" }}
        >
          {busy ? "Deleting…" : "Delete My Account"}
        </button>

        {/* Error / info message */}
        {msg && (
          <div className="alert alert-error" role="status" style={{ marginTop: 12 }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
