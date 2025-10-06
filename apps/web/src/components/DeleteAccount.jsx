import { useState } from "react";
import { auth, db } from "../firebase";
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";

export default function DeleteAccount() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!window.confirm("This will permanently delete your account. Continue?")) return;

    setBusy(true);
    setMsg("");
    try {
      // Some sensitive ops require recent login
      try {
        // Try delete directly first
        await deleteUser(user);
      } catch (err) {
        if (err.code === "auth/requires-recent-login") {
          if (!password) {
            setMsg("Recent login required. Please enter your current password, then try again.");
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

      // Try remove Firestore profile (best-effort, user may be gone already)
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch {}

      alert("Account deleted. Signing you out.");
      // Auth SDK will signOut implicitly after deleteUser on some platforms,
      // but call signOut for good measure:
      auth.signOut();
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <h3>Delete Account</h3>
      <p>This action is permanent and cannot be undone.</p>
      <input
        type="password"
        placeholder="Enter current password (needed if prompted)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "10px 0" }}
      />
      <button
        onClick={handleDelete}
        disabled={busy}
        style={{ background: "#d32f2f", color: "#fff", padding: "10px 16px", borderRadius: 6, border: "none" }}
      >
        {busy ? "Deleting..." : "Delete My Account"}
      </button>
      {msg && <p style={{ color: "#c62828" }}>{msg}</p>}
    </div>
  );
}
