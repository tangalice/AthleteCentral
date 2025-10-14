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
 * DeleteAccount (polished UI)
 * - Adds "Back to Settings" link on the top-left
 * - Keeps original delete & re-auth logic
 * - Shows helpful messages and a clear danger card
 */
export default function DeleteAccount() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (
      !window.confirm(
        "This will permanently delete your account and data. Continue?"
      )
    )
      return;

    setBusy(true);
    setMsg("");
    try {
      // Try direct delete first
      try {
        await deleteUser(user);
      } catch (err) {
        // Some sensitive operations require a recent login
        if (err.code === "auth/requires-recent-login") {
          if (!user.email) {
            setMsg(
              "Recent login required but no email is associated. Please sign out and sign in again, then retry."
            );
            setBusy(false);
            return;
          }
          if (!password) {
            setMsg(
              "Recent login required. Enter your current password, then click Delete again."
            );
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

      // Sign out just in case (some platforms auto-signout on delete)
      await auth.signOut();
      alert("Your account has been deleted.");
    } catch (err) {
      setMsg(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Top bar with Back link */}
      <div style={{ marginBottom: 12 }}>
        <Link
          to="/settings"
          style={{
            color: "#4F46E5", // indigo-600
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Back to Settings
        </Link>
      </div>

      {/* Centered danger card */}
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #e5e7eb", // gray-200
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 8,
            color: "#111827", // gray-900
          }}
        >
          Delete Account
        </h2>
        <p style={{ marginTop: 0, color: "#6b7280" }}>
          This action is <b>permanent</b> and cannot be undone. Your profile and
          related data will be removed.
        </p>

        {/* Warning box */}
        <div
          style={{
            background: "#FEF2F2", // red-50
            border: "1px solid #FECACA", // red-200
            color: "#991B1B", // red-800
            borderRadius: 8,
            padding: 12,
            margin: "12px 0 16px",
          }}
        >
          ⚠️ Please make sure you have exported any data you need before
          proceeding.
        </div>

        {/* Password input (only needed if re-auth is required) */}
        <label
          htmlFor="current-password"
          style={{ display: "block", fontWeight: 700, color: "#374151" }}
        >
          Current password (only if prompted)
        </label>
        <input
          id="current-password"
          type="password"
          placeholder="Enter current password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginTop: 6,
            marginBottom: 14,
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            fontSize: 16,
          }}
        />

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={busy}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: busy ? "#EF4444" : "#B91C1C", // red-500 / red-700
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Deleting…" : "Delete My Account"}
        </button>

        {/* Error / info message */}
        {msg && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              borderRadius: 8,
            }}
          >
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
