// src/components/settings/DeleteAccount.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import SessionsService from "../../services/SessionsService";


export default function DeleteAccount() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user) {
      setMsg("No logged-in user found.");
      return;
    }

    if (!window.confirm("This will permanently delete your account and data. Continue?")) {
      return;
    }

    if (!password) {
      setMsg("Please enter your current password to confirm.");
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      if (!user.email) {
        setMsg("Your account has no email. Please sign out and sign in again, then retry.");
        setBusy(false);
        return;
      }
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);

      try {
        const currentSessionId =
          SessionsService.getCurrentSessionId?.() || localStorage.getItem("currentSessionId");
        if (currentSessionId) {
          await SessionsService.logoutSession(currentSessionId);
          SessionsService.clearCurrentSession?.();
          localStorage.removeItem("currentSessionId");
        }
      } catch (e) {
        // 
        console.warn("Failed to close current session before deletion:", e);
      }

      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch (e) {
        console.warn("Failed to delete user profile document:", e);
      }

      await deleteUser(user);

      alert("Your account has been deleted.");
      navigate("/signup", { replace: true });
    } catch (err) {
      console.error("Delete error:", err);
      switch (err?.code) {
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setMsg("Incorrect password. Please try again.");
          break;
        case "auth/requires-recent-login":
          setMsg("Please sign in again, then retry deleting your account.");
          break;
        default:
          setMsg(err?.message || String(err));
      }
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

        <div className="alert alert-error" style={{ marginTop: 12 }}>
          ⚠️ Make sure you have exported any data you need before proceeding.
        </div>

        {/* Password input (now required) */}
        <div className="form-group" style={{ marginTop: 12 }}>
          <label htmlFor="current-password" style={{ fontWeight: 700 }}>
            Current password <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            id="current-password"
            type="password"
            className="form-control"
            placeholder="Enter current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={busy}
          className="btn btn-danger"
          style={{ width: "100%", marginTop: 12 }}
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
