import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  addDoc,
  setDoc,
  collection,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";

export default function AthleteFeedback() {
  const { pollId } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [closed, setClosed] = useState(false);

  // Load poll
  useEffect(() => {
    async function loadPoll() {
      const ref = doc(db, "feedbackPolls", pollId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      setPoll({ id: snap.id, ...snap.data() });
    }

    loadPoll();
  }, [pollId]);
  useEffect(() => {
    async function loadPoll() {
      const ref = doc(db, "feedbackPolls", pollId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
  
      const data = snap.data();
      setPoll({ id: snap.id, ...data });
  
      // deadline check
      if (data.deadline?.toDate() < new Date()) {
        setClosed(true);
      }
    }
  
    loadPoll();
  }, [pollId]);

  // Already submitted? (by checking responses count)
  // Already submitted? (by checking real answers)
  useEffect(() => {
    async function checkSubmission() {
      if (!auth.currentUser) return;

      const respRef = doc(
        db,
        "feedbackPolls",
        pollId,
        "responses",
        auth.currentUser.uid
      );

      const respSnap = await getDoc(respRef);

      if (respSnap.exists()) {
        const data = respSnap.data() || {};
        const hasAnswers =
          data.answers &&
          typeof data.answers === "object" &&
          Object.keys(data.answers).length > 0;

        // 只有真正提交过答案才算 submitted
        if (hasAnswers) {
          setSubmitted(true);
        } else {
          setSubmitted(false); // 例如只存了 dismissed:true 的情况
        }
      } else {
        setSubmitted(false);
      }
    }

    checkSubmission();
  }, [pollId]);

  if (!poll) return <p>Loading poll...</p>;

  async function handleSubmit(e) {
    e.preventDefault();

    await setDoc(
        doc(db, "feedbackPolls", pollId, "responses", auth.currentUser.uid),
        {
          answers,
          submittedAt: serverTimestamp(),
        }
      );

    setSubmitted(true);
    setTimeout(() => navigate("/dashboard"), 1500);
  }

  if (submitted)
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Thank you!</h2>
        <p>Your feedback has been submitted anonymously.</p>
      </div>
    );

  return (
    <div style={{ maxWidth: "650px", margin: "0 auto", padding: "1.5rem" }}>
      <h2>{poll.title}</h2>

      <form onSubmit={handleSubmit}>
        {poll.questions.map((q) => (
          <div key={q.id} style={{ marginBottom: "1.5rem" }}>
            <label style={{ fontWeight: 600 }}>{q.label}</label>

            {q.type === "rating" ? (
              <select
                value={answers[q.id] || ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [q.id]: Number(e.target.value) })
                }
                style={{
                  width: "100%",
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  borderRadius: "6px",
                }}
              >
                <option value="">Select rating</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                value={answers[q.id] || ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [q.id]: e.target.value })
                }
                rows={3}
                style={{
                  width: "100%",
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                }}
              />
            )}
          </div>
        ))}

        <button
          type="submit"
          style={{
            background: "#2563eb",
            color: "white",
            padding: "0.6rem 1.2rem",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Submit Feedback
        </button>
      </form>
    </div>
  );
}
