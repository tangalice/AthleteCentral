import { useState } from "react";
import { auth } from "../firebase"; 
import { sendPasswordResetEmail } from "firebase/auth";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async () => {
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent!");
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <input placeholder="Enter your email" onChange={(e) => setEmail(e.target.value)} />
      <button onClick={handleReset}>Reset Password</button>
      {message && <p>{message}</p>}
    </div>
  );
}
