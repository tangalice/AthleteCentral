import { useState } from "react";
import { auth, db } from "../firebase";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function EditAccount() {
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const ensureRecentLogin = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");
    if (!currentPassword) {
      throw new Error("Recent login required. Please enter your current password.");
    }
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
  };

  const handleUpdate = async () => {
    setMsg("");
    setBusy(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");

      if (name) {
        try {
          await updateProfile(user, { displayName: name });
        } catch (err) {
          if (err.code === "auth/requires-recent-login") {
            await ensureRecentLogin();
            await updateProfile(user, { displayName: name });
          } else {
            throw err;
          }
        }
        try {
          await updateDoc(doc(db, "users", user.uid), {
            displayName: name,
            updatedAt: serverTimestamp(),
          });
        } catch {}
      }

      if (newPassword) {
        if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
        try {
          await updatePassword(user, newPassword);
        } catch (err) {
          if (err.code === "auth/requires-recent-login") {
            await ensureRecentLogin();
            await updatePassword(user, newPassword);
          } else {
            throw err;
          }
        }
      }

      setMsg("Account updated successfully!");
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <h3>Edit Account</h3>

      <input
        placeholder="New display name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "8px 0" }}
      />

      <input
        type="password"
        placeholder="New password (min 8 chars)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "8px 0" }}
      />

      <input
        type="password"
        placeholder="Current password (needed if prompted)"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "8px 0" }}
      />

      <button onClick={handleUpdate} disabled={busy} style={{ padding: "10px 16px" }}>
        {busy ? "Saving..." : "Save Changes"}
      </button>

      {msg && <p style={{ color: msg.includes("success") ? "#2e7d32" : "#c62828" }}>{msg}</p>}
    </div>
  );
}
