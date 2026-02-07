// src/pages/ThreeGunTestingPage.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

/* ================================================================
   CALCULATIONS
   ================================================================ */

function wattsToSplitSeconds(watts) {
  if (!watts || watts <= 0) return null;
  return 500 * Math.pow(2.8 / watts, 1 / 3);
}

function formatSplit(totalSeconds) {
  if (totalSeconds == null || totalSeconds <= 0) return "—";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds - mins * 60;
  const wholeSecs = Math.floor(secs);
  const tenths = Math.floor((secs - wholeSecs) * 10);
  return `${mins}:${String(wholeSecs).padStart(2, "0")}.${tenths}`;
}

function projected2kWatt(maxWatt, threeMin, twelveMin) {
  const mw = Number(maxWatt), tm = Number(threeMin), tw = Number(twelveMin);
  if (!mw || !tm || !tw) return null;
  return (0.578 * mw + 0.9 * tm + 1.1 * tw) / 3;
}

function projected2kSplit(maxWatt, threeMin, twelveMin) {
  return wattsToSplitSeconds(projected2kWatt(maxWatt, threeMin, twelveMin));
}

const ZONE_DEFS = [
  {
    name: "Zone 1", color: "#DBEAFE",
    lowerPct: 0.46, upperPct: 0.48,
    rateLower: "", rateUpper: "<18",
    rpeLower: "1-2", rpeUpper: "2-3",
    notes: "Only for recovery or rehab. Limited training benefit.",
  },
  {
    name: "Zone 2", color: "#D1FAE5",
    lowerPct: 0.55, upperPct: 0.59,
    rateLower: "18-19", rateUpper: "19-20",
    rpeLower: "4", rpeUpper: "5",
    notes: "Steady state pace, for baseline fitness. No lactic acid buildup.",
  },
  {
    name: "Zone 3", color: "#FEF9C3",
    lowerPct: 0.68, upperPct: 0.74,
    rateLower: "20-24", rateUpper: "22-26",
    rpeLower: "6", rpeUpper: "7",
    notes: "Threshold pace, anaerobic lactate production. Train body to process lactate more efficiently.",
  },
  {
    name: "Zone 4", color: "#FED7AA",
    lowerPct: 0.85, upperPct: 0.89,
    rateLower: "24-28", rateUpper: "26-30",
    rpeLower: "8", rpeUpper: "8-9",
    notes: "Primarily anaerobic effort. Build lactate tolerance.",
  },
  {
    name: "Zone 5", color: "#FECDD3",
    lowerPct: 0.96, upperPct: 1.04,
    rateLower: "28-36", rateUpper: ">30",
    rpeLower: "8-9", rpeUpper: "9-10",
    notes: "Unsustainable, race pace+. VO2 max increase.",
  },
];

function computeZones(maxWatt, threeMin, twelveMin) {
  const proj = projected2kWatt(maxWatt, threeMin, twelveMin);
  if (!proj) return null;
  return ZONE_DEFS.map((z) => {
    const lowerWatts = Math.round(proj * z.lowerPct);
    const upperWatts = Math.round(proj * z.upperPct);
    return {
      ...z, lowerWatts, upperWatts,
      lowerSplit: wattsToSplitSeconds(lowerWatts),
      upperSplit: wattsToSplitSeconds(upperWatts),
    };
  });
}

/* ================================================================
   FIRESTORE HELPERS
   ================================================================ */

const COLL = "threeGunTests";

async function fbSaveEntry({ teamId, coachUid, date, athleteUid, athleteName, maxWatt, threeMin, twelveMin }) {
  const docId = `${teamId}_${date}_${athleteUid}`;
  const ref = doc(db, COLL, docId);
  const now = Date.now();
  const existing = await getDoc(ref);
  const data = {
    id: docId, teamId, coachUid, date, athleteUid, athleteName,
    maxWatt: Number(maxWatt) || 0, threeMin: Number(threeMin) || 0, twelveMin: Number(twelveMin) || 0,
    updatedAt: now,
  };
  if (!existing.exists()) data.createdAt = now;
  await setDoc(ref, data, { merge: true });
  return data;
}

async function fbSaveBatch({ teamId, coachUid, date, entries }) {
  const results = [];
  for (const e of entries) {
    if (e.maxWatt || e.threeMin || e.twelveMin) {
      results.push(await fbSaveEntry({ teamId, coachUid, date, ...e }));
    }
  }
  return results;
}

async function fbGetByDate(teamId, date) {
  const q = query(collection(db, COLL), where("teamId", "==", teamId), where("date", "==", date));
  return (await getDocs(q)).docs.map((d) => d.data());
}

async function fbGetForAthlete(teamId, athleteUid) {
  const q = query(collection(db, COLL), where("teamId", "==", teamId), where("athleteUid", "==", athleteUid));
  return (await getDocs(q)).docs.map((d) => d.data());
}

async function fbGetDates(teamId) {
  const q = query(collection(db, COLL), where("teamId", "==", teamId));
  const dates = new Set();
  (await getDocs(q)).docs.forEach((d) => dates.add(d.data().date));
  return [...dates].sort().reverse();
}

/* ================================================================
   STYLES
   ================================================================ */

const S = {
  page: { padding: "24px 0", maxWidth: 1100, margin: "0 auto" },
  heading: { fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 4 },
  sub: { fontSize: 14, color: "#6b7280", marginBottom: 24 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" },
  input: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" },
  dateInput: { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none" },
  btn: { padding: "10px 20px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btnG: { background: "#10b981", color: "#fff" },
  btnL: { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" },
  tbl: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e5e7eb", fontWeight: 600, color: "#374151", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer", userSelect: "none" },
  td: { padding: "10px 12px", borderBottom: "1px solid #f3f4f6", color: "#111827" },
  expBtn: { background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#6b7280" },
  empty: { textAlign: "center", padding: "40px 20px", color: "#9ca3af", fontSize: 15 },
  bar: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 },
  chip: { display: "inline-block", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
};

/* ================================================================
   ZONE TABLE (shared)
   ================================================================ */

function ZoneTable({ maxWatt, threeMin, twelveMin }) {
  const zones = computeZones(maxWatt, threeMin, twelveMin);
  const p2kW = projected2kWatt(maxWatt, threeMin, twelveMin);
  const p2kS = projected2kSplit(maxWatt, threeMin, twelveMin);

  if (!zones) {
    return <p style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>Enter all 3 test values to see projections and zones.</p>;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Projected 2k Watt</span>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{Math.round(p2kW)}</div>
        </div>
        <div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Projected 2k Split</span>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{formatSplit(p2kS)}</div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={S.tbl}>
          <thead>
            <tr>
              {["Zone", "", "Rate", "RPE", "Split", "Watts", "Notes"].map((h) => (
                <th key={h} style={{ ...S.th, cursor: "default" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <>
                <tr key={`${z.name}-lo`} style={{ backgroundColor: z.color + "40" }}>
                  <td style={{ ...S.td, fontWeight: 700, fontSize: 13 }}>{z.name}</td>
                  <td style={S.td}>Lower</td>
                  <td style={S.td}>{z.rateLower}</td>
                  <td style={S.td}>{z.rpeLower}</td>
                  <td style={S.td}>{formatSplit(z.lowerSplit)}</td>
                  <td style={S.td}>{z.lowerWatts}</td>
                  <td style={{ ...S.td, fontSize: 12, color: "#6b7280" }} rowSpan={2}>{z.notes}</td>
                </tr>
                <tr key={`${z.name}-hi`} style={{ backgroundColor: z.color + "60" }}>
                  <td style={S.td}></td>
                  <td style={S.td}>Upper</td>
                  <td style={S.td}>{z.rateUpper}</td>
                  <td style={S.td}>{z.rpeUpper}</td>
                  <td style={S.td}>{formatSplit(z.upperSplit)}</td>
                  <td style={S.td}>{z.upperWatts}</td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================
   COACH VIEW
   ================================================================ */

function CoachView({ user }) {
  const [teamId, setTeamId] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [testDates, setTestDates] = useState([]);
  const [entries, setEntries] = useState({});
  const [sortBy, setSortBy] = useState("alpha");
  const [sortDir, setSortDir] = useState("asc");
  const [expandedUid, setExpandedUid] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const u = auth.currentUser;
        if (!u) return;
        const snap = await getDoc(doc(db, "users", u.uid));
        const team = snap.exists() ? (snap.data().teamId || snap.data().team || "") : "";        setTeamId(team);
        if (!team) return;

        const q = query(collection(db, "users"), where("teamId", "==", team), where("role", "==", "athlete"));        const qs = await getDocs(q);
        const list = qs.docs.map((d) => ({ uid: d.id, displayName: d.data().displayName || d.data().email || d.id }));
        list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setAthletes(list);
        setTestDates(await fbGetDates(team));
      } catch (e) { console.error("Load error:", e); }
      finally { setLoading(false); }
    })();
  }, [user]);

  useEffect(() => {
    if (!teamId || !selectedDate) { setEntries({}); return; }
    (async () => {
      try {
        const data = await fbGetByDate(teamId, selectedDate);
        const map = {};
        data.forEach((d) => { map[d.athleteUid] = { maxWatt: d.maxWatt || "", threeMin: d.threeMin || "", twelveMin: d.twelveMin || "" }; });
        setEntries(map);
      } catch (e) { console.error("Load entries error:", e); }
    })();
  }, [teamId, selectedDate]);

  const updateEntry = useCallback((uid, field, val) => {
    setEntries((p) => ({ ...p, [uid]: { ...(p[uid] || { maxWatt: "", threeMin: "", twelveMin: "" }), [field]: val } }));
  }, []);

  const handleSave = async () => {
    if (!teamId || !selectedDate) return;
    setSaving(true);
    try {
      const batch = athletes.filter((a) => entries[a.uid]).map((a) => ({
        athleteUid: a.uid, athleteName: a.displayName,
        maxWatt: entries[a.uid]?.maxWatt || 0, threeMin: entries[a.uid]?.threeMin || 0, twelveMin: entries[a.uid]?.twelveMin || 0,
      }));
      await fbSaveBatch({ teamId, coachUid: auth.currentUser.uid, date: selectedDate, entries: batch });
      setTestDates(await fbGetDates(teamId));
      alert("Saved successfully!");
    } catch (e) { console.error("Save error:", e); alert("Error saving."); }
    finally { setSaving(false); }
  };

  const sorted = useMemo(() => {
    const list = [...athletes];
    list.sort((a, b) => {
      const eA = entries[a.uid] || {}, eB = entries[b.uid] || {};
      if (sortBy === "alpha") return sortDir === "asc" ? a.displayName.localeCompare(b.displayName) : b.displayName.localeCompare(a.displayName);
      const pA = projected2kWatt(eA.maxWatt, eA.threeMin, eA.twelveMin) || 0;
      const pB = projected2kWatt(eB.maxWatt, eB.threeMin, eB.twelveMin) || 0;
      if (sortBy === "watts") return sortDir === "asc" ? pA - pB : pB - pA;
      const sA = pA ? wattsToSplitSeconds(pA) : 9999, sB = pB ? wattsToSplitSeconds(pB) : 9999;
      return sortDir === "asc" ? sA - sB : sB - sA;
    });
    return list;
  }, [athletes, entries, sortBy, sortDir]);

  const toggleSort = (col) => { if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortBy(col); setSortDir("asc"); } };
  const arr = (col) => sortBy === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  if (loading) return <div style={S.empty}>Loading...</div>;
  if (!teamId) return <div style={S.page}><h1 style={S.heading}>3-Gun Testing</h1><div style={S.empty}>You need to be assigned to a team to use this feature.</div></div>;

  return (
    <div style={S.page}>
      <h1 style={S.heading}>3-Gun Testing</h1>
      <p style={S.sub}>Enter Max Watt, 3-minute, and 12-minute test results. Projected 2k and training zones are auto-calculated.</p>

      <div style={S.card}>
        <div style={S.bar}>
          <div>
            <label style={S.label}>Test Date</label>
            <input type="date" style={S.dateInput} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <button style={{ ...S.btn, ...S.btnL, marginTop: 18 }} onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>Today</button>
          {testDates.length > 0 && (
            <div style={{ marginLeft: 16, marginTop: 18 }}>
              <span style={{ fontSize: 13, color: "#6b7280", marginRight: 8 }}>Past dates:</span>
              {testDates.slice(0, 8).map((d) => (
                <button key={d} onClick={() => setSelectedDate(d)} style={{ ...S.chip, background: d === selectedDate ? "#10b981" : "#f3f4f6", color: d === selectedDate ? "#fff" : "#374151", cursor: "pointer", border: "none", marginRight: 6, marginBottom: 4 }}>{d}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedDate ? (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: 0 }}>Results — {selectedDate}</h2>
            <button style={{ ...S.btn, ...S.btnG, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save All"}</button>
          </div>

          {athletes.length === 0 ? <div style={S.empty}>No athletes found on your team.</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.tbl}>
                <thead>
                  <tr>
                    <th style={S.th} onClick={() => toggleSort("alpha")}>Athlete{arr("alpha")}</th>
                    <th style={{ ...S.th, cursor: "default" }}>Max Watt</th>
                    <th style={{ ...S.th, cursor: "default" }}>3′ (watts)</th>
                    <th style={{ ...S.th, cursor: "default" }}>12′ (watts)</th>
                    <th style={S.th} onClick={() => toggleSort("watts")}>Proj 2k Watt{arr("watts")}</th>
                    <th style={S.th} onClick={() => toggleSort("split")}>Proj 2k Split{arr("split")}</th>
                    <th style={{ ...S.th, cursor: "default" }}>Zones</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => {
                    const e = entries[a.uid] || { maxWatt: "", threeMin: "", twelveMin: "" };
                    const proj = projected2kWatt(e.maxWatt, e.threeMin, e.twelveMin);
                    const ps = projected2kSplit(e.maxWatt, e.threeMin, e.twelveMin);
                    const exp = expandedUid === a.uid;
                    return (
                      <>
                        <tr key={a.uid}>
                          <td style={{ ...S.td, fontWeight: 600 }}>{a.displayName}</td>
                          <td style={S.td}><input type="number" style={{ ...S.input, width: 80 }} value={e.maxWatt} onChange={(ev) => updateEntry(a.uid, "maxWatt", ev.target.value)} placeholder="0" /></td>
                          <td style={S.td}><input type="number" style={{ ...S.input, width: 80 }} value={e.threeMin} onChange={(ev) => updateEntry(a.uid, "threeMin", ev.target.value)} placeholder="0" /></td>
                          <td style={S.td}><input type="number" style={{ ...S.input, width: 80 }} value={e.twelveMin} onChange={(ev) => updateEntry(a.uid, "twelveMin", ev.target.value)} placeholder="0" /></td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{proj ? Math.round(proj) : "—"}</td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{ps ? formatSplit(ps) : "—"}</td>
                          <td style={S.td}>{proj ? <button style={S.expBtn} onClick={() => setExpandedUid(exp ? null : a.uid)}>{exp ? "Hide" : "View"}</button> : "—"}</td>
                        </tr>
                        {exp && (
                          <tr key={`${a.uid}-z`}>
                            <td colSpan={7} style={{ padding: "0 12px 16px 12px" }}>
                              <ZoneTable maxWatt={e.maxWatt} threeMin={e.threeMin} twelveMin={e.twelveMin} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div style={S.card}><div style={S.empty}>Select a date or click "Today" to start entering test results.</div></div>
      )}
    </div>
  );
}

/* ================================================================
   ATHLETE VIEW
   ================================================================ */

function AthleteView({ user }) {
  const [teamId, setTeamId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testDates, setTestDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const u = auth.currentUser;
        if (!u) return;
        const snap = await getDoc(doc(db, "users", u.uid));
        const team = snap.exists() ? (snap.data().teamId || snap.data().team || "") : "";        setTeamId(team);
        if (!team) return;

        const all = await fbGetForAthlete(team, u.uid);
        const dates = [...new Set(all.map((e) => e.date))].sort().reverse();
        setTestDates(dates);
        if (dates.length > 0) setSelectedDate(dates[0]);
      } catch (e) { console.error("Load error:", e); }
      finally { setLoading(false); }
    })();
  }, [user]);

  useEffect(() => {
    if (!teamId || !selectedDate) { setEntry(null); return; }
    (async () => {
      try {
        const data = await fbGetByDate(teamId, selectedDate);
        setEntry(data.find((d) => d.athleteUid === auth.currentUser.uid) || null);
      } catch (e) { console.error("Load entry error:", e); }
    })();
  }, [teamId, selectedDate]);

  if (loading) return <div style={S.empty}>Loading...</div>;
  if (!teamId) return <div style={S.page}><h1 style={S.heading}>3-Gun Testing</h1><div style={S.empty}>You need to be assigned to a team to view your test results.</div></div>;

  return (
    <div style={S.page}>
      <h1 style={S.heading}>3-Gun Testing</h1>
      <p style={S.sub}>View your test results and auto-calculated training zones.</p>

      <div style={S.card}>
        <label style={S.label}>Select Test Date</label>
        {testDates.length === 0 ? (
          <p style={{ fontSize: 14, color: "#9ca3af" }}>No test results have been entered for you yet.</p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {testDates.map((d) => (
              <button key={d} onClick={() => setSelectedDate(d)} style={{ ...S.chip, background: d === selectedDate ? "#10b981" : "#f3f4f6", color: d === selectedDate ? "#fff" : "#374151", cursor: "pointer", border: "none", padding: "6px 14px", fontSize: 13 }}>{d}</button>
            ))}
          </div>
        )}
      </div>

      {entry ? (
        <div style={S.card}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 16, marginTop: 0 }}>Results — {selectedDate}</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Max Watt", val: entry.maxWatt },
              { label: "3′ Test", val: entry.threeMin },
              { label: "12′ Test", val: entry.twelveMin },
            ].map((t) => (
              <div key={t.label} style={{ background: "#f9fafb", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{t.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{t.val || "—"}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.val ? formatSplit(wattsToSplitSeconds(t.val)) + " split" : ""}</div>
              </div>
            ))}
          </div>

          <ZoneTable maxWatt={entry.maxWatt} threeMin={entry.threeMin} twelveMin={entry.twelveMin} />
        </div>
      ) : selectedDate ? (
        <div style={S.card}><div style={S.empty}>No test data found for this date.</div></div>
      ) : null}
    </div>
  );
}

/* ================================================================
   MAIN EXPORT
   ================================================================ */

export default function ThreeGunTestingPage({ user, userRole }) {
  if (userRole === "coach") return <CoachView user={user} />;
  return <AthleteView user={user} />;
}