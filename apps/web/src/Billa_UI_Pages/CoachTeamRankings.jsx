import { useEffect, useState } from "react";
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  where,
  orderBy,
  addDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";

// Sport-specific events
const TEST_PIECE_TYPES = {
  rowing: ["2k", "6k", "500m", "5k", "10k", "30min"],
  swimming: [
    "50-fr-scy", "100-fr-scy", "200-fr-scy", "500-fr-scy",
    "1000-fr-scy", "1650-fr-scy",
    "50-fl-scy", "100-fl-scy", "200-fl-scy",
    "50-bk-scy", "100-bk-scy", "200-bk-scy",
    "50-br-scy", "100-br-scy", "200-br-scy",
    "200-im-scy", "400-im-scy"
  ],
  running: ["100m", "200m", "400m", "800m", "1500m", "Mile", "3000m", "5k", "10k"],
  default: ["Test 1", "Test 2", "Test 3", "Test 4"],
};

export default function CoachTeamRankings({ user, userSport }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamMembers, setTeamMembers] = useState([]);

  const [selectedTestType, setSelectedTestType] = useState("all");
  const [selectedCompetitionDate, setSelectedCompetitionDate] = useState("all");

  const [competitionDates, setCompetitionDates] = useState([]);

  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  const sportTestTypes =
    TEST_PIECE_TYPES[userSport?.toLowerCase()] || TEST_PIECE_TYPES.default;

  // -------- Load teams for this coach --------
  useEffect(() => {
    if (!user) return;

    const loadTeams = async () => {
      setLoading(true);
      try {
        const teamsQuery = query(
          collection(db, "teams"),
          where("coaches", "array-contains", user.uid)
        );
        const snap = await getDocs(teamsQuery);

        const foundTeams = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setTeams(foundTeams);
        if (foundTeams.length > 0 && !selectedTeamId) {
          setSelectedTeamId(foundTeams[0].id);
        }
      } catch (err) {
        console.error("Error loading coach teams:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [user, selectedTeamId]);

  // -------- Load team members --------
  useEffect(() => {
    if (!selectedTeamId || !user) return;

    const loadMembers = async () => {
      setLoading(true);
      try {
        const teamRef = doc(db, "teams", selectedTeamId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
          setTeamMembers([]);
          setTeamName("");
          return;
        }

        const teamData = teamSnap.data();
        setTeamName(teamData.name || teamData.teamName || "Team");

        const memberIds = teamData.members || [];
        const membersList = [];

        for (const memberId of memberIds) {
          try {
            const userDocRef = doc(db, "users", memberId);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData.role === "athlete") {
                membersList.push({
                  id: memberId,
                  name: userData.displayName || userData.email || "Unknown",
                  email: userData.email || "",
                });
              }
            }
          } catch (err) {
            console.error("Error loading member:", memberId, err);
          }
        }

        setTeamMembers(membersList);
      } catch (err) {
        console.error("Error loading team members:", err);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [selectedTeamId, user]);

  // -------- Load performances + competition dates + rankings --------
  useEffect(() => {
    if (teamMembers.length === 0) {
      setRankings([]);
      setCompetitionDates([]);
      return;
    }

    const loadPerformancesAndRank = async () => {
      setLoading(true);

      try {
        const allPerformances = [];
        const compDates = new Set();

        for (const member of teamMembers) {
          const performancesQuery = query(
            collection(db, "users", member.id, "performances"),
            orderBy("date", "desc")
          );

          const snapshot = await getDocs(performancesQuery);
          const performances = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              athleteId: member.id,
              athleteName: member.name,
              testType: data.eventType,
              time: data.time,
              type: data.type,
              date: data.date,
              split: data.split || null,
            };
          });

          // Collect competition dates for dropdown
          performances.forEach((p) => {
            if (p.type === "competition" && p.date) {
              const d = p.date.toDate ? p.date.toDate() : new Date(p.date);
              const formatted = d.toISOString().split("T")[0];
              compDates.add(formatted);
            }
          });

          allPerformances.push({
            athleteId: member.id,
            athleteName: member.name,
            email: member.email,
            performances,
          });
        }

        setCompetitionDates(["all", ...Array.from(compDates).sort().reverse()]);

        const filteredPerformances = applyFilters(
          allPerformances,
          selectedTestType,
          selectedCompetitionDate
        );

        const calculated = calculateRankings(
          filteredPerformances,
          selectedTestType
        );

        setRankings(calculated);
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPerformancesAndRank();
  }, [teamMembers, selectedTestType, selectedCompetitionDate]);

  // -------- Helper: Apply filters (event + competition date) --------
  const applyFilters = (allPerformances, testType, competitionDate) => {
    return allPerformances.map((athlete) => {
      let perfs = athlete.performances;

      // Filter by competition date
      if (competitionDate !== "all") {
        perfs = perfs.filter((p) => {
          if (p.type !== "competition" || !p.date) return false;
          const real = p.date.toDate ? p.date.toDate() : new Date(p.date);
          return real.toISOString().startsWith(competitionDate);
        });
      }

      // Filter by event type
      if (testType !== "all") {
        perfs = perfs.filter((p) => p.testType === testType);
      }

      return { ...athlete, performances: perfs };
    });
  };

  // -------- Helper: Ranking logic --------
  const parseTime = (timeValue) => {
    if (!timeValue) return Infinity;
    if (typeof timeValue === "number") return timeValue;

    const parts = timeValue.split(":");
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseFloat(parts[1]) || 0;
      return mins * 60 + secs;
    }
    if (parts.length === 3) {
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      const s = parseFloat(parts[2]) || 0;
      return h * 3600 + m * 60 + s;
    }
    return Infinity;
  };

  const isValidTime = (t) => t && parseTime(t) !== Infinity;

  const getPersonalBest = (performances, testType) => {
    const tests = performances.filter((p) => p.testType === testType);
    if (tests.length === 0) return null;
    return tests.reduce((best, cur) =>
      parseTime(cur.time) < parseTime(best.time) ? cur : best
    );
  };

  const calculateOverallRanking = (allPerformances) => {
    const allTypes = new Set();
    allPerformances.forEach((athlete) =>
      athlete.performances.forEach((p) => {
        if (isValidTime(p.time)) allTypes.add(p.testType);
      })
    );

    const types = [...allTypes];
    const scores = allPerformances.map((athlete) => {
      let total = 0;
      let count = 0;

      types.forEach((t) => {
        const best = getPersonalBest(athlete.performances, t);
        if (!best) return;

        const allBests = allPerformances
          .map((a) => getPersonalBest(a.performances, t))
          .filter((b) => b && isValidTime(b.time))
          .map((b) => parseTime(b.time))
          .sort((a, b) => a - b);

        const rank = allBests.indexOf(parseTime(best.time));
        const percentile =
          allBests.length === 1
            ? 0
            : (rank / (allBests.length - 1)) * 100;

        total += percentile;
        count++;
      });

      return {
        athleteId: athlete.athleteId,
        athleteName: athlete.athleteName,
        email: athlete.email,
        averagePercentile: count > 0 ? total / count : 100,
        testsCompleted: count,
      };
    });

    return scores
      .filter((a) => a.testsCompleted > 0)
      .sort((a, b) => a.averagePercentile - b.averagePercentile);
  };

  const calculateTestTypeRanking = (allPerformances, testType) => {
    const vals = allPerformances
      .map((a) => {
        const best = getPersonalBest(a.performances, testType);
        if (!best) return null;

        return {
          athleteId: a.athleteId,
          athleteName: a.athleteName,
          email: a.email,
          bestTime: best.time,
          bestTimeSeconds: parseTime(best.time),
          date: best.date,
          split: best.split,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.bestTimeSeconds - b.bestTimeSeconds);

    return vals;
  };

  const calculateRankings = (allPerformances, testType) =>
    testType === "all"
      ? calculateOverallRanking(allPerformances)
      : calculateTestTypeRanking(allPerformances, testType);

  // -------- SEND RANKINGS TO TEAM --------
  const sendRankingsToTeam = async () => {
    if (!user || rankings.length === 0) return;

    try {
      for (const member of teamMembers) {
        // Find or create chat
        const chatsRef = collection(db, "chats");
        const chatQuery = query(
          chatsRef,
          where("participants", "array-contains", user.uid)
        );
        const chatSnapshot = await getDocs(chatQuery);

        let chatDoc = null;

        chatSnapshot.forEach((docSnap) => {
          const participants = docSnap.data().participants || [];
          if (participants.includes(member.id)) {
            chatDoc = { id: docSnap.id };
          }
        });

        if (!chatDoc) {
          const newChatRef = await addDoc(chatsRef, {
            name: `Chat with ${member.name}`,
            participants: [user.uid, member.id],
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            lastMessage: "",
            lastMessageTime: serverTimestamp(),
            unreadCounts: {
              [user.uid]: 0,
              [member.id]: 0,
            },
            readBy: {
              [user.uid]: serverTimestamp(),
            },
          });
          chatDoc = { id: newChatRef.id };
        }

        // Build rankings message
        const eventLabel =
  selectedTestType === "all"
    ? `Overall Team Rankings`
    : `Rankings for Competition ${selectedCompetitionDate || "All Time"}`;

const rankingsHeader =
  selectedTestType === "all"
    ? `${eventLabel}\n`
    : `${eventLabel}\nEvent: ${selectedTestType}\n`;

const rankingsText =
  rankingsHeader +
  rankings
    .map(
      (r, index) =>
        `${index + 1}. ${r.athleteName} — ${
          selectedTestType === "all"
            ? `${r.averagePercentile.toFixed(1)}%`
            : r.bestTime
        }`
    )
    .join("\n");

        // Send message
        await addDoc(collection(db, "messages"), {
          chatId: chatDoc.id,
          senderId: user.uid,
          senderName: user.displayName || "Coach",
          text: rankingsText,
          timestamp: serverTimestamp(),
        });

        // Update chat
        await updateDoc(doc(db, "chats", chatDoc.id), {
          lastMessage: rankingsText,
          lastMessageTime: serverTimestamp(),
          lastMessageSenderId: user.uid,
          [`unreadCounts.${member.id}`]: increment(1),
        });
      }

      alert("Rankings sent to all athletes!");
    } catch (err) {
      console.error("Error sending rankings:", err);
    }
  };

  // -------- Render --------
  const totalAthletes = teamMembers.length;
  const totalRanked = rankings.length;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      <h2 style={{ fontSize: 28, fontWeight: 700 }}>Team Rankings (Coach View)</h2>

      {/* Team + Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label>Team</label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.teamName || t.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div>Summary</div>
          <div>
            {teamName} · {totalAthletes} athletes · {totalRanked} ranked
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <label>Event</label>
          <select
            value={selectedTestType}
            onChange={(e) => setSelectedTestType(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            <option value="all">Overall</option>
            {sportTestTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Competition Date</label>
          <select
            value={selectedCompetitionDate}
            onChange={(e) => setSelectedCompetitionDate(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            {competitionDates.map((d) => (
              <option key={d} value={d}>
                {d === "all" ? "All Time" : d}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "end" }}>
          <button
            onClick={sendRankingsToTeam}
            disabled={rankings.length === 0}
            style={{
              padding: "10px 16px",
              backgroundColor: rankings.length === 0 ? "#ccc" : "#3b82f6",
              color: "white",
              borderRadius: 8,
              border: "none",
              cursor: rankings.length === 0 ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            Send Rankings to Team
          </button>
        </div>
      </div>

      {/* Rankings Table */}
      <div style={{ marginTop: 20 }}>
        {loading ? (
          <p>Loading...</p>
        ) : rankings.length === 0 ? (
          <p>No rankings available.</p>
        ) : selectedTestType === "all" ? (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Athlete</th>
                <th>Email</th>
                <th>Tests Completed</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r, i) => (
                <tr key={r.athleteId}>
                  <td>{i + 1}</td>
                  <td>{r.athleteName}</td>
                  <td>{r.email || "-"}</td>
                  <td>{r.testsCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{textAlign: "center"}}>Rank</th>
                <th style={{textAlign: "center"}}>Athlete</th>
                <th style={{textAlign: "center"}}>Email</th>
                <th style={{textAlign: "center"}}>Best Time</th>
                <th style={{textAlign: "center"}}>Date</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r, i) => {
                const d = r.date?.toDate
                  ? r.date.toDate()
                  : r.date
                  ? new Date(r.date)
                  : null;

                return (
                  <tr key={r.athleteId}>
                    <td style={{textAlign: "center"}}>{i + 1}</td>
                    <td style={{textAlign: "center"}}>{r.athleteName}</td>
                    <td style={{textAlign: "center"}}>{r.email || "-"}</td>
                    <td style={{textAlign: "center"}}>{r.bestTime}</td>
                    <td style={{textAlign: "center"}}>{d ? d.toISOString().split("T")[0] : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}