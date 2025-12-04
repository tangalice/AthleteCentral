// src/components/TeamPollVote.jsx
// User Story #42 - Athlete views poll details and submits vote
// Uses 'teamPolls' collection

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  runTransaction,
} from "firebase/firestore";

export default function TeamPollVote() {
  const { pollId } = useParams();
  const navigate = useNavigate();

  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [myVote, setMyVote] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Load poll data and check if user has already voted
  useEffect(() => {
    if (!pollId || !auth.currentUser) return;

    const pollRef = doc(db, "teamPolls", pollId);

    // Real-time listener for poll data
    const unsubPoll = onSnapshot(pollRef, async (docSnap) => {
      if (docSnap.exists()) {
        const pollData = { id: docSnap.id, ...docSnap.data() };
        setPoll(pollData);

        // Check if user has already voted (stored in poll.voters array)
        const voters = pollData.voters || [];
        const uid = auth.currentUser.uid;
        
        if (voters.includes(uid)) {
          setHasVoted(true);
          // Get user's vote from responses subcollection
          const respRef = doc(db, "teamPolls", pollId, "responses", uid);
          const respSnap = await getDoc(respRef);
          if (respSnap.exists()) {
            setMyVote(respSnap.data().selectedOption);
          }
        }
      } else {
        setMessage({ type: "error", text: "Poll not found." });
      }
      setLoading(false);
    });

    return () => unsubPoll();
  }, [pollId]);

  // Calculate deadline status
  const getDeadlineInfo = () => {
    if (!poll?.deadline) return { isPast: false, isUrgent: false, text: "No deadline" };

    const deadlineDate = poll.deadline.toDate ? poll.deadline.toDate() : new Date(poll.deadline);
    const now = new Date();
    const diffMs = deadlineDate - now;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (poll.status === "closed" || diffMs < 0) {
      return { isPast: true, isUrgent: false, text: "Voting closed" };
    }

    if (diffHours <= 24) {
      const hours = Math.floor(diffHours);
      const minutes = Math.floor((diffHours - hours) * 60);
      return {
        isPast: false,
        isUrgent: true,
        text: `⏰ Urgent: ${hours}h ${minutes}m remaining`,
      };
    }

    return {
      isPast: false,
      isUrgent: false,
      text: `Deadline: ${deadlineDate.toLocaleString()}`,
    };
  };

  // Submit vote handler
  const handleSubmit = async () => {
    if (hasVoted) {
      setMessage({ type: "error", text: "You have already voted on this poll." });
      return;
    }
    
    if (selectedOption === null) {
      setMessage({ type: "error", text: "Please select an option." });
      return;
    }

    const deadlineInfo = getDeadlineInfo();
    if (deadlineInfo.isPast) {
      setMessage({ type: "error", text: "This poll has already closed." });
      return;
    }

    setSubmitting(true);
    setMessage({ type: "", text: "" });

    try {
      const uid = auth.currentUser.uid;
      const pollRef = doc(db, "teamPolls", pollId);
      const responseRef = doc(db, "teamPolls", pollId, "responses", uid);

      await setDoc(responseRef, {
        selectedOption: selectedOption,
        optionText: poll.options[selectedOption],
        votedAt: serverTimestamp(),
        odUserId: uid,
      });

      await runTransaction(db, async (transaction) => {
        const pollSnap = await transaction.get(pollRef);
        if (!pollSnap.exists()) {
          throw new Error("Poll not found when updating vote counts.");
        }

        const pollData = pollSnap.data();
        const optionsArray = pollData.options || [];

        let voteCounts;
        if (Array.isArray(pollData.voteCounts) && pollData.voteCounts.length === optionsArray.length) {
          voteCounts = [...pollData.voteCounts];
        } else {
          voteCounts = optionsArray.map(() => 0);
        }

        voteCounts[selectedOption] = (voteCounts[selectedOption] || 0) + 1;

        transaction.update(pollRef, {
          voteCounts,
          totalVotes: (pollData.totalVotes || 0) + 1,
          voters: arrayUnion(uid),
        });
      });

      setHasVoted(true);
      setMyVote(selectedOption);
      setMessage({ type: "success", text: "Your vote has been submitted!" });

      // Redirect back to dashboard after a short delay
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (error) {
      console.error("Error submitting vote:", error);
      setMessage({ type: "error", text: `Error: ${error.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: 24, textAlign: "center" }}>
        <p>Loading poll...</p>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="container" style={{ padding: 24, textAlign: "center" }}>
        <p>Poll not found.</p>
        <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const deadlineInfo = getDeadlineInfo();

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <button
            className="btn btn-outline"
            onClick={() => navigate("/dashboard")}
            style={{ marginBottom: 16 }}
          >
            ← Back to Dashboard
          </button>
          <h2 style={{ marginBottom: 8 }}>{poll.title}</h2>
          {poll.description && (
            <p className="text-muted" style={{ marginBottom: 12 }}>
              {poll.description}
            </p>
          )}

          {/* Deadline Badge */}
          <div
            style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              background: deadlineInfo.isPast
                ? "#fee2e2"
                : deadlineInfo.isUrgent
                ? "#fef3c7"
                : "#e0f2fe",
              color: deadlineInfo.isPast
                ? "#dc2626"
                : deadlineInfo.isUrgent
                ? "#d97706"
                : "#0369a1",
              border: deadlineInfo.isPast
                ? "1px solid #fca5a5"
                : deadlineInfo.isUrgent
                ? "1px solid #fcd34d"
                : "1px solid #7dd3fc",
            }}
          >
            {deadlineInfo.text}
          </div>
        </div>

        {/* Message Display */}
        {message.text && (
          <div
            className={`alert ${message.type === "error" ? "alert-danger" : "alert-success"}`}
            style={{ marginBottom: 20 }}
          >
            {message.text}
          </div>
        )}

        {/* Already Voted State */}
        {hasVoted && (
          <div
            className="card"
            style={{
              padding: 24,
              background: "#f0fdf4",
              border: "1px solid #86efac",
            }}
          >
            <h3 style={{ color: "#16a34a", marginBottom: 12 }}>✓ You have already voted!</h3>
            <p style={{ marginBottom: 8 }}>
              Your selection: <strong>{poll.options[myVote]}</strong>
            </p>
            <p className="text-muted" style={{ fontSize: 14 }}>
              You cannot change your vote. Thank you for participating!
            </p>
          </div>
        )}

        {/* Voting Form */}
        {!hasVoted && !deadlineInfo.isPast && (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Select your response:</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {poll.options.map((option, index) => (
                <label
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderRadius: 8,
                    border:
                      selectedOption === index
                        ? "2px solid var(--brand-primary)"
                        : "1px solid var(--border)",
                    background: selectedOption === index ? "#f0f9ff" : "white",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="radio"
                    name="poll-option"
                    checked={selectedOption === index}
                    onChange={() => setSelectedOption(index)}
                    style={{ width: 20, height: 20 }}
                  />
                  <span style={{ fontSize: 16 }}>{option}</span>
                </label>
              ))}
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || selectedOption === null}
              style={{ marginTop: 24, width: "100%", padding: 12 }}
            >
              {submitting ? "Submitting..." : "Submit Vote"}
            </button>
          </div>
        )}

        {/* Poll Closed State */}
        {deadlineInfo.isPast && !hasVoted && (
          <div
            className="card"
            style={{
              padding: 24,
              background: "#fef2f2",
              border: "1px solid #fca5a5",
            }}
          >
            <h3 style={{ color: "#dc2626", marginBottom: 12 }}>Poll Closed</h3>
            <p className="text-muted">
              This poll is no longer accepting responses. The voting deadline has passed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}