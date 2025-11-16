// src/pages/SimilarTeammatesPage.jsx

import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs
} from "firebase/firestore";

export default function SimilarTeammatesPage() {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [comparisonType, setComparisonType] = useState("actual"); // "actual" or "predicted"
  const [threshold, setThreshold] = useState(0.05); // 5%
  const [similarAthletes, setSimilarAthletes] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ---------------- Load Auth User ---------------- */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  /* ---------------- Load UserDoc (teamId, sport, etc.) ---------------- */
  useEffect(() => {
    if (!user) return;

    const loadUserDoc = async () => {
      const u = await getDoc(doc(db, "users", user.uid));
      if (u.exists()) setUserDoc(u.data());
    };

    loadUserDoc();
  }, [user]);

  /* ---------------- Load Teammates via teamId ---------------- */
  useEffect(() => {
    if (!userDoc?.teamId) {
      setTeamMembers([]);
      setLoading(false);
      return;
    }

    const loadTeam = async () => {
      setLoading(true);

      const teamSnap = await getDoc(doc(db, "teams", userDoc.teamId));
      if (!teamSnap.exists()) {
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      const team = teamSnap.data();
      const memberIds = team.members?.filter((id) => id !== user.uid) || [];

      const members = [];
      for (const id of memberIds) {
        const m = await getDoc(doc(db, "users", id));
        if (m.exists()) {
          members.push({ uid: id, ...m.data() });
        }
      }

      setTeamMembers(members);
      setLoading(false);
    };

    loadTeam();
  }, [userDoc]);

  /* ---------------- Fetch Results for a single user ---------------- */
  async function fetchResults(uid, type) {
    const collName = type === "actual" ? "performances" : "predictions";

    const resultsSnap = await getDocs(
      collection(db, "users", uid, collName)
    );

    return resultsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  /* ---------------- Calculate similarity ---------------- */
  function calculateSimilarity(myResults, theirResults) {
    const matches = [];

    for (const mine of myResults) {
      for (const theirs of theirResults) {
        if (mine.eventType?.trim().toLowerCase() === theirs.eventType?.trim().toLowerCase()) {
          const myVal =
            mine.time ??          // actual results
            mine.value ??         // alternate actual field if used elsewhere
            mine.result ??        // alternate actual field many apps use
            mine.predictedValue;  // predicted results

           const theirVal =
            theirs.time ??
            theirs.value ??
            theirs.result ??
            theirs.predictedValue;


          if (typeof myVal !== "number" || typeof theirVal !== "number") continue;

          const diff = Math.abs(myVal - theirVal) / myVal;

          matches.push({
            event: mine.eventType,
            myVal,
            theirVal,
            diff,
          });
        }
      }
    }

    return matches;
  }

  /* ---------------- Compute Similar Teammates ---------------- */
  useEffect(() => {
    if (!teamMembers.length || !userDoc || !user) return;

    const compute = async () => {
      setLoading(true);

      const myResults = await fetchResults(user.uid, comparisonType);
      const similar = [];

      for (const teammate of teamMembers) {
        const theirResults = await fetchResults(teammate.uid, comparisonType);
        const matches = calculateSimilarity(myResults, theirResults);

        const withinThreshold = matches.filter(
          (m) => m.diff <= threshold
        );

        if (withinThreshold.length > 0) {
          similar.push({
            uid: teammate.uid,
            name: teammate.displayName || teammate.email,
            comparisons: withinThreshold,
          });
        }
      }

      setSimilarAthletes(similar);
      setLoading(false);
    };

    compute();
  }, [teamMembers, comparisonType, threshold, userDoc, user]);

  /* ---------------- Render ---------------- */
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>
        Similar Teammates
      </h1>

      <div style={{ marginTop: 20, marginBottom: 20, display: "flex", gap: 20 }}>
        <div>
          <label style={{ fontWeight: 600 }}>Compare:</label>
          <select
            value={comparisonType}
            onChange={(e) => setComparisonType(e.target.value)}
            style={{ marginLeft: 8, padding: 6 }}
          >
            <option value="actual">Actual Competition Results</option>
            <option value="predicted">Predicted Results</option>
          </select>
        </div>

        <div>
          <label style={{ fontWeight: 600 }}>Similarity Threshold:</label>
          <select
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            style={{ marginLeft: 8, padding: 6 }}
          >
            <option value={0.01}>1%</option>
            <option value={0.03}>3%</option>
            <option value={0.05}>5%</option>
            <option value={0.10}>10%</option>
            <option value={0.20}>20%</option>
          </select>
        </div>
      </div>

      {loading && <p>Loading...</p>}

      {!loading && similarAthletes.length === 0 && (
        <p>No similar teammates found based on your selected settings.</p>
      )}

      {!loading && similarAthletes.length > 0 && (
        <table border="1" cellPadding="8" style={{ width: "100%", marginTop: 20 }}>
          <thead>
            <tr>
              <th>Athlete</th>
              <th>Event</th>
              <th>Your Value</th>
              <th>Their Value</th>
              <th>Difference (%)</th>
            </tr>
          </thead>
          <tbody>
            {similarAthletes.map((ath) =>
              ath.comparisons.map((c, idx) => (
                <tr key={ath.uid + "_" + idx}>
                  <td>{ath.name}</td>
                  <td>{c.event}</td>
                  <td>{c.myVal?.toFixed(2)}</td>
                  <td>{c.theirVal?.toFixed(2)}</td>
                  <td>{(c.diff * 100).toFixed(2)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}