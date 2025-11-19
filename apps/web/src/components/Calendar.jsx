// src/components/Calendar.jsx
// Final version: Single-entry feedback (Edit mode), False-failure fix, Track Attendance preserved.
// Red dot notification logic removed as requested.
import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { sendEmailNotificationToMultiple } from "../services/EmailNotificationService";
import EventAttendance from "./EventAttendance"; // Preserved Attendance Component

// Import centralized services/constants
import { ATTENDANCE_CONFIG } from "../constants/constants";
import { fetchTeamAthletes } from "../services/teamService";

// --- STUB for In-App Notification ---
// We isolate this call in submitComment so errors here don't break the UI
const sendInAppNotification = (targetUid, type, data) => {
    console.log(`[Notification Stub] Sending ${type} notification to ${targetUid}. Data:`, data);
};

// ---- UI helpers ----
const TYPE_COLORS = {
  practice: "#10b981",
  game: "#3b82f6",
  meeting: "#8b5cf6",
  other: "#6b7280",
};

export default function Calendar({ userRole }) {
  const isCoach = userRole === "coach";
  const me = auth.currentUser?.uid || null;
  const userDisplayName = auth.currentUser?.displayName || "Athlete";

  // --- Core State ---
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [assignables, setAssignables] = useState([]);
  const userCache = useRef(new Map());
  
  // --- Event Management State ---
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState({});
  const [createForm, setCreateForm] = useState({ title: "", date: "", time: "", type: "practice", description: "" });
  const [createAssigned, setCreateAssigned] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", date: "", time: "", type: "practice", description: "" });
  const [editAssigned, setEditAssigned] = useState([]);
  const [editErr, setEditErr] = useState("");
  
  // --- Attendance State (Preserved) ---
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceEvent, setAttendanceEvent] = useState(null);

  // --- Reflection Log & Comment State ---
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionEvent, setReflectionEvent] = useState(null);
  const [reflectionUser, setReflectionUser] = useState(null); 
  const [reflectionForm, setReflectionForm] = useState({ feelings: "", performance: "", improvements: "" });
  const [savingReflection, setSavingReflection] = useState(false);
  const [reflectionMessage, setReflectionMessage] = useState("");
  const [reflectionMode, setReflectionMode] = useState('athlete_edit'); 
  
  // --- Coach Feedback State ---
  const [coachComments, setCoachComments] = useState([]); 
  const [newCommentText, setNewCommentText] = useState(''); 
  const [commenting, setCommenting] = useState(false);
  const [isEditingFeedback, setIsEditingFeedback] = useState(false); // Controls Edit Mode
  let closeReflectionUnsubRef = useRef(() => {}); 
  
  // --- Reflection Overview State ---
  const [showReflectionOverview, setShowReflectionOverview] = useState(false);
  const [reflectionOverviewEvent, setReflectionOverviewEvent] = useState(null);
  const [reflectionsSummary, setReflectionsSummary] = useState([]);
  const [loadingReflectionsSummary, setLoadingReflectionsSummary] = useState(false);
  
  /* ========== useEffect: load my teams ========== */
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    (async () => {
      try {
        const teamsCol = collection(db, "teams");
        const [asCoach, asAth, asMem] = await Promise.all([
          getDocs(query(teamsCol, where("coaches", "array-contains", uid))),
          getDocs(query(teamsCol, where("athletes", "array-contains", uid))),
          getDocs(query(teamsCol, where("members", "array-contains", uid))),
        ]);
        const map = new Map();
        const add = (snap) =>
          snap.forEach((d) => map.set(d.id, { id: d.id, name: d.data()?.name || "Unnamed Team" }));
        add(asCoach);
        add(asAth);
        add(asMem);
        const list = Array.from(map.values());
        setTeams(list);
        if (!teamId && list.length) setTeamId(list[0].id);
      } catch (e) {
        console.error("load teams failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ========== useEffect: subscribe events ========== */
  useEffect(() => {
    if (!teamId) return;
    setLoadingEvents(true);

    const qRef = query(collection(db, "teams", teamId, "events"), orderBy("datetime", "asc"));
    const unsub = onSnapshot(qRef, (snap) => {
      const now = Date.now();
      const dayAgo = now - 24 * 3600_000;
      const all = snap.docs.map((d) => {
        const e = d.data();
        const dt = e?.datetime?.toDate?.() ?? (e.datetime instanceof Date ? e.datetime : null);
        return { id: d.id, ...e, datetime: dt, upcoming: dt ? dt.getTime() >= dayAgo : false };
      });

      let visible = all;
      if (userRole === "athlete" && me) {
        visible = all.filter((ev) => {
          const assigned = Array.isArray(ev.assignedMemberIds) ? ev.assignedMemberIds : [];
          return assigned.length === 0 || assigned.includes(me);
        });
      }

      setEvents(visible);
      setLoadingEvents(false);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, userRole, me]);

  /* ========== useEffect: load assignables ========== */
  useEffect(() => {
    if (!teamId) {
      setAssignables([]);
      return;
    }
    
    (async () => {
      try {
        const athletes = await fetchTeamAthletes(teamId);
        athletes.forEach(ath => {
          if (!userCache.current.has(ath.id)) {
            userCache.current.set(ath.id, { name: ath.name, email: ath.email });
          }
        });
        setAssignables(athletes);
      } catch (e) {
        console.error("load assignables failed", e);
        setAssignables([]);
      }
    })();
  }, [teamId]);
  
  /* ========== Computed Variables ========== */
  const upcoming = useMemo(() => events.filter((e) => e.upcoming), [events]);
  const past = useMemo(() => events.filter((e) => !e.upcoming), [events]);

  /* ========== CRUD operations ========== */
  const openCreate = () => {
    if (!isCoach) return alert("Only coaches can create events");
    setCreateErr({});
    setCreateForm({ title: "", date: "", time: "", type: "practice", description: "" });
    setCreateAssigned([]);
    setShowCreate(true);
  };
  const closeCreate = () => setShowCreate(false);
  const submitCreate = async (e) => {
    e.preventDefault();
    if (!isCoach) return;
    const errs = {};
    if (!createForm.title) errs.title = "Title is required";
    if (!createForm.date) errs.date = "Date is required";
    if (!createForm.time) errs.time = "Time is required";
    setCreateErr(errs);
    if (Object.keys(errs).length) return;

    setCreating(true);
    try {
      const teamDoc = await getDoc(doc(db, "teams", teamId));
      const teamData = teamDoc.data();
      const attendanceTotal = createAssigned.length > 0 ? createAssigned.length : (assignables.length || teamData?.athletes?.length || 0);
      
      const dt = new Date(`${createForm.date}T${createForm.time}`);
      await addDoc(collection(db, "teams", teamId, "events"), {
        title: createForm.title.trim(), description: createForm.description.trim(), type: createForm.type, datetime: Timestamp.fromDate(dt),
        assignedMemberIds: createAssigned.slice(), createdBy: me, createdAt: Timestamp.fromDate(new Date()),
        attendanceSummary: { present: 0, total: attendanceTotal, rate: 0 }, attendanceRecords: {},
      });
      
      closeCreate();
    } catch (e) {
      console.error("create event failed", e);
      setCreateErr({ submit: "Failed to create event" });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (ev) => {
    const dt = ev.datetime instanceof Date ? ev.datetime : (ev.datetime ? new Date(ev.datetime) : new Date());
    const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, "0"); const d = String(dt.getDate()).padStart(2, "0");
    const h = String(dt.getHours()).padStart(2, "0"); const mi = String(dt.getMinutes()).padStart(2, "0");
    setEditForm({ title: ev.title || "", date: `${y}-${m}-${d}`, time: `${h}:${mi}`, type: ev.type || "practice", description: ev.description || "", });
    setEditAssigned(Array.isArray(ev.assignedMemberIds) ? [...ev.assignedMemberIds] : []);
    setEditing(ev); setEditErr("");
  };
  const closeEdit = () => setEditing(null);
  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.title || !editForm.date || !editForm.time) { setEditErr("Title, Date and Time are required."); return; }
    try {
      const dt = new Date(`${editForm.date}T${editForm.time}`);
      await updateDoc(doc(db, "teams", teamId, "events", editing.id), {
        title: editForm.title.trim(), description: editForm.description.trim(), type: editForm.type, datetime: Timestamp.fromDate(dt), assignedMemberIds: editAssigned.slice(),
      });
      closeEdit();
    } catch (e) { console.error("update event failed", e); setEditErr("Failed to update event"); }
  };
  const deleteEvent = async (ev) => {
    if (!confirm("Delete this event?")) return;
    try { await deleteDoc(doc(db, "teams", teamId, "events", ev.id)); } catch (e) { console.error("delete failed", e); alert("Failed to delete"); }
  };
  
  // --- Attendance Functions (Preserved) ---
  const openAttendance = (ev) => { setAttendanceEvent(ev); setShowAttendance(true); };
  const closeAttendance = () => setShowAttendance(false);

  /* ========== Reflection & Feedback Logic ========== */

  // 1. Load Feedback
  const loadCoachFeedbacks = (eventId, athleteId) => {
    const feedbacksCol = collection(db, "teams", teamId, "events", eventId, "reflections", athleteId, "coachFeedback");
    const q = query(feedbacksCol, orderBy("updatedAt", "asc"));
    
    const unsub = onSnapshot(q, (snap) => {
      const loadedFeedbacks = snap.docs.map(d => ({
        id: d.id, 
        ...d.data(),
        updatedAt: d.data().updatedAt?.toDate()?.toLocaleTimeString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'N/A'
      }));
      setCoachComments(loadedFeedbacks);
    });
    return unsub; 
  };
  
  // 2. Close Modal & Reset States
  const closeReflection = () => {
    closeReflectionUnsubRef.current(); 
    setShowReflection(false);
    setReflectionEvent(null);
    setReflectionUser(null);
    setCoachComments([]);
    setReflectionMessage("");
    setIsEditingFeedback(false); // Reset edit mode
    setNewCommentText('');
  };

  // 3. Open Modal
  const openReflectionAndComments = async (ev, athleteId = me) => {
    if (!me || !teamId || !athleteId) return;
    
    setReflectionMode(athleteId === me ? 'athlete_edit' : 'coach_view');
    setReflectionEvent(ev);
    setReflectionUser(athleteId);
    setReflectionMessage("");
    setNewCommentText("");
    setIsEditingFeedback(false); // Ensure edit mode is off
    
    let reflectionExists = false;
    try {
      const refDoc = await getDoc(doc(db, "teams", teamId, "events", ev.id, "reflections", athleteId));
      if (refDoc.exists()) {
        const data = refDoc.data();
        setReflectionForm({
          feelings: data.feelings || "", performance: data.performance || "", improvements: data.improvements || "",
        });
        reflectionExists = true;
      } else {
        if (athleteId !== me) { setReflectionMessage("Athlete has not submitted a reflection yet."); return; }
        setReflectionForm({ feelings: "", performance: "", improvements: "" });
      }
    } catch (error) { console.error("Error fetching reflection:", error); }
    
    if (reflectionExists || athleteId === me) {
      closeReflectionUnsubRef.current = loadCoachFeedbacks(ev.id, athleteId);
    }
    
    setShowReflection(true);
  };

  // 4. Save Reflection (Athlete)
  const saveReflection = async (e) => {
    e.preventDefault();
    if (!me || !teamId || !reflectionEvent || reflectionMode !== 'athlete_edit') return;

    setSavingReflection(true);
    try {
      const reflectionRef = doc(db, "teams", teamId, "events", reflectionEvent.id, "reflections", me);
      await setDoc(reflectionRef, {
        ...reflectionForm,
        athleteId: me,
        updatedAt: Timestamp.now(),
        athleteName: userDisplayName,
      }, { merge: true });

      setReflectionMessage("Reflection saved successfully!");
      setTimeout(() => { closeReflection(); }, 1000);
    } catch (error) { console.error("Error saving reflection:", error); setReflectionMessage("Error saving reflection. Please try again."); } 
    finally { setSavingReflection(false); }
  };

  // 5. Submit Feedback (Coach)
  const submitComment = async (e) => {
    e.preventDefault();
    if (!isCoach || !newCommentText.trim() || !reflectionEvent || !reflectionUser) return;

    setCommenting(true);
    try {
      const coachId = me;
      const coachName = userDisplayName;

      const feedbackRef = doc(db, "teams", teamId, "events", reflectionEvent.id, "reflections", reflectionUser, "coachFeedback", coachId);
      
      // Preserve createdAt if exists
      const existingDoc = await getDoc(feedbackRef);
      const createdAt = existingDoc.exists() ? existingDoc.data().createdAt : Timestamp.now();

      // Write Feedback
      await setDoc(feedbackRef, {
        text: newCommentText.trim(),
        createdBy: coachId,
        createdByName: coachName,
        createdAt: createdAt,
        updatedAt: Timestamp.now(),
      }, { merge: true });
      
      // Send Notification (ISOLATED TRY-CATCH to prevent false failures)
      try {
          sendInAppNotification(reflectionUser, 'coach_comment', {
            eventId: reflectionEvent.id, eventName: reflectionEvent.title, coachName: coachName
          });
      } catch (notificationError) {
          console.warn("Notification stub failed, but Firestore submission was successful:", notificationError);
          // We suppress this error so the UI updates correctly
      }
      
      // Clear state on success
      setNewCommentText('');
      setIsEditingFeedback(false); 
      
    } catch (error) { 
        // Main catch block - only for actual Firestore write failures
        console.error("Error submitting comment:", error); 
        setReflectionMessage("Failed to submit feedback."); 
    } 
    finally { setCommenting(false); }
  };
  
  // 6. Reflection Overview (Coach)
  const openReflectionOverview = async (ev) => {
    if (!isCoach) return;
    setReflectionOverviewEvent(ev);
    setShowReflectionOverview(true);
    setLoadingReflectionsSummary(true);
    setReflectionsSummary([]);

    try {
        const reflectionsCol = collection(db, "teams", teamId, "events", ev.id, "reflections");
        const snapshot = await getDocs(reflectionsCol);
        
        const summary = snapshot.docs.map(doc => {
            const data = doc.data();
            const athleteId = doc.id;
            const athleteInfo = userCache.current.get(athleteId) || { name: data.athleteName || `User ${athleteId.slice(0, 6)}` };
            return {
                id: doc.id, ...data, athleteName: athleteInfo.name, submitted: true,
                updatedAt: data.updatedAt?.toDate()?.toLocaleDateString() || 'N/A'
            };
        });
        setReflectionsSummary(summary);
    } catch (e) { console.error("Error loading reflections summary:", e); } 
    finally { setLoadingReflectionsSummary(false); }
  };

  const closeReflectionOverview = () => {
    setShowReflectionOverview(false);
    setReflectionOverviewEvent(null);
    setReflectionsSummary([]);
  };

  // --- Render Helpers ---
  const AttendanceBadge = ({ s }) => {
    if (!s) return null;
    const rate = s.total ? Math.round((s.present / s.total) * 100) : 0;
    const config = rate >= 80 ? ATTENDANCE_CONFIG.present : rate >= 60 ? ATTENDANCE_CONFIG.late : ATTENDANCE_CONFIG.absent;
    return (
      <span style={{ marginLeft: 8, padding: "2px 8px", fontSize: 12, borderRadius: 4, background: config.backgroundColor, color: config.color, fontWeight: 500 }}>
        {s.present}/{s.total} ({rate}%)
      </span>
    );
  };

  const MyAttendanceStatus = ({ event, me }) => {
    if (!me) return null; 
    const status = event.attendanceRecords?.[me]?.status;
    const config = ATTENDANCE_CONFIG[status] || ATTENDANCE_CONFIG.unset;
    return (
      <span style={{ marginLeft: 8, padding: "2px 8px", fontSize: 12, borderRadius: 4, background: config.backgroundColor, color: config.color, fontWeight: 500 }}>
        {config.label}
      </span>
    );
  };

  // Check if current coach has already submitted feedback
  const myExistingFeedback = coachComments.find(c => c.id === me);
  const hasMyFeedback = !!myExistingFeedback;

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h2 className="mb-1">📅 Team Calendar</h2>
      <p className="text-muted mb-3">
        Manage and track team events, practices, and competitions
      </p>

      <div className="mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 4, minHeight: '60px' }}>
        <div>
          <label className="mb-1" style={{ fontWeight: 600, display: "block" }}>Select Team:</label>
          <select
            value={teamId || ""}
            onChange={(e) => setTeamId(e.target.value)}
            className="form-control"
            style={{ minWidth: 360, maxWidth: 400, borderColor: "var(--brand-primary)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent)" }}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {isCoach && (
          <button className="btn btn-primary" onClick={openCreate} style={{ height: 'fit-content', whiteSpace: 'nowrap' }}>
            ➕ Create New Event
          </button>
        )}
      </div>

      <h3 className="mt-3 mb-2" style={{ fontSize:22, fontWeight:700 }}>🔜 Upcoming Events</h3>
      {loadingEvents ? <p>Loading events…</p> : (
        <div className="mb-4" style={{ display:"grid", gap:12 }}>
          {upcoming.length===0 ? <p className="text-muted">No upcoming events scheduled.</p> :
            upcoming.map((ev)=>(
              <div key={ev.id} className="card"
                   style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", borderLeft:`4px solid ${TYPE_COLORS[ev.type]||"#6b7280"}`, margin: 0 }}>
                <div style={{ flex:1 }}>
                  <strong style={{ fontSize:16 }}>{ev.title}</strong>
                  {isCoach ? <AttendanceBadge s={ev.attendanceSummary} /> : <MyAttendanceStatus event={ev} me={me} />}
                  <p className="text-muted" style={{ margin:"4px 0 0", fontSize:14 }}>
                    📅 {ev.datetime.toLocaleDateString()} {ev.datetime.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
                  </p>
                  {ev.description && <p style={{ margin:0, color:"#4b5563", fontSize:14 }}>{ev.description}</p>}
                </div>
                
                <div style={{ display:"flex", gap:8 }}>
                  {isCoach && (
                    <>
                      <button className="btn" onClick={()=>openAttendance(ev)} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>Track Attendance</button>
                      <button className="btn" onClick={()=>openEdit(ev)} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>Edit</button>
                      <button className="btn" onClick={()=>deleteEvent(ev)} style={{ border:"1px solid #ef4444", color:"#ef4444", background:"var(--surface)" }}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))
          }
        </div>
      )}

      <h3 className="mt-3 mb-2" style={{ fontSize:22, fontWeight:700 }}>📜 Past Events</h3>
      <div style={{ display:"grid", gap:12 }}>
        {past.length===0 ? <p className="text-muted">No past events.</p> :
          past.map((ev)=>(
            <div key={ev.id} className="card"
                 style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", borderLeft:`4px solid ${TYPE_COLORS[ev.type]||"#6b7280"}`, margin: 0 }}>
              <div>
                <strong style={{ fontSize:16 }}>{ev.title}</strong>
                {isCoach ? <AttendanceBadge s={ev.attendanceSummary} /> : <MyAttendanceStatus event={ev} me={me} />}
                {ev.datetime && <p className="text-muted" style={{ margin:"6px 0 0", fontSize:14 }}>{ev.datetime.toLocaleString()}</p>}
              </div>
              
              <div style={{ display:"flex", gap:8 }}>
                {isCoach ? (
                  <>
                    <button className="btn btn-primary" onClick={() => openReflectionOverview(ev)} style={{ fontSize: 14 }}>View Reflections</button>
                    <button className="btn" onClick={()=>openAttendance(ev)} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>View Attendance</button>
                    <button className="btn" onClick={()=>deleteEvent(ev)} style={{ border:"1px solid #ef4444", color:"#ef4444", background:"var(--surface)" }}>Delete</button>
                  </>
                ) : (
                    <button 
                        className="btn btn-primary" 
                        onClick={() => openReflectionAndComments(ev, me)}
                        style={{ fontSize: 14 }}
                    >
                        📝 Reflection Log
                    </button>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* Edit Modal (Hidden in this snippet for brevity, assume standard edit modal implementation) */}
      {editing && (
        <div role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) closeEdit(); }}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 }}>
          <div style={{ width:"100%", maxWidth:760, background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", boxShadow:"0 10px 30px rgba(0,0,0,.15)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
              <strong>Edit Event</strong>
              <button onClick={closeEdit} aria-label="Close" style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <form onSubmit={submitEdit} style={{ padding:18 }}>
              <div style={{ display:"grid", gap:14 }}>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Title *</label><input className="form-control" value={editForm.title} onChange={(e)=>setEditForm(p=>({...p, title:e.target.value}))} /></div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Date *</label><input type="date" className="form-control" value={editForm.date} onChange={(e)=>setEditForm(p=>({...p, date:e.target.value}))} /></div>
                  <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Time *</label><input type="time" className="form-control" value={editForm.time} onChange={(e)=>setEditForm(p=>({...p, time:e.target.value}))} /></div>
                </div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Type</label><select className="form-control" value={editForm.type} onChange={(e)=>setEditForm(p=>({...p, type:e.target.value}))}><option value="practice">Practice</option><option value="game">Game/Competition</option><option value="meeting">Team Meeting</option><option value="other">Other</option></select></div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Description (Optional)</label><textarea rows={3} className="form-control" value={editForm.description} onChange={(e)=>setEditForm(p=>({...p, description:e.target.value}))} /></div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Assign to Athletes</label><div style={{ border:"1px solid var(--border)", borderRadius:8, maxHeight:220, overflowY:"auto", padding:8 }}>{assignables.length===0 ? (<div className="text-muted" style={{ padding:8 }}>No athletes in this team.</div>) : assignables.map((m)=>(<label key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px" }}><input type="checkbox" checked={editAssigned.includes(m.id)} onChange={(e)=>setEditAssigned(prev=> e.target.checked ? [...prev, m.id] : prev.filter(id=>id!==m.id))} /><span>{m.name || m.email || `User ${m.id.slice(0,6)}`}</span></label>))}</div></div>
                {editErr && (<div className="alert alert-error" style={{padding: "8px 12px", margin: 0}}>{editErr}</div>)}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><button type="button" className="btn" onClick={closeEdit} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>Cancel</button><button type="submit" className="btn btn-primary">Save Changes</button></div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal (Hidden in this snippet for brevity) */}
      {showCreate && (
        <div role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) setShowCreate(false); }}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 }}>
          <div style={{ width:"100%", maxWidth:760, background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", boxShadow:"0 10px 30px rgba(0,0,0,.15)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
              <strong>Create New Event</strong>
              <button onClick={closeCreate} aria-label="Close" style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <form onSubmit={submitCreate} style={{ padding:18 }}>
              <div style={{ display:"grid", gap:14 }}>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Title *</label><input className="form-control" value={createForm.title} onChange={(e)=>setCreateForm(p=>({...p, title:e.target.value}))} placeholder="e.g., Morning Practice" />{createErr.title && <small className="text-danger">{createErr.title}</small>}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Date *</label><input type="date" className="form-control" value={createForm.date} onChange={(e)=>setCreateForm(p=>({...p, date:e.target.value}))} />{createErr.date && <small className="text-danger">{createErr.date}</small>}</div>
                  <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Time *</label><input type="time" className="form-control" value={createForm.time} onChange={(e)=>setCreateForm(p=>({...p, time:e.target.value}))} />{createErr.time && <small className="text-danger">{createErr.time}</small>}</div>
                </div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Type</label><select className="form-control" value={createForm.type} onChange={(e)=>setCreateForm(p=>({...p, type:e.target.value}))}><option value="practice">Practice</option><option value="game">Game/Competition</option><option value="meeting">Team Meeting</option><option value="other">Other</option></select></div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Description (Optional)</label><textarea rows={3} className="form-control" value={createForm.description} onChange={(e)=>setCreateForm(p=>({...p, description:e.target.value}))} /></div>
                <div><label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Assign to Athletes</label><div style={{ border:"1px solid var(--border)", borderRadius:8, maxHeight:220, overflowY:"auto", padding:8 }}>{assignables.length===0 ? (<div className="text-muted" style={{ padding:8 }}>No athletes in this team.</div>) : assignables.map((m)=>(<label key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px" }}><input type="checkbox" checked={createAssigned.includes(m.id)} onChange={(e)=>setCreateAssigned(prev=> e.target.checked ? [...prev, m.id] : prev.filter(id=>id!==m.id))} /><span>{m.name || m.email || `User ${m.id.slice(0,6)}`}</span></label>))}</div></div>
                {createErr.submit && (<div className="alert alert-error" style={{padding: "8px 12px", margin: 0}}>{createErr.submit}</div>)}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><button type="button" className="btn" onClick={closeCreate} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>Cancel</button><button type="submit" className="btn btn-primary" disabled={creating}>{creating ? "Creating..." : "Create Event"}</button></div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Drawer (Restored) */}
      {showAttendance && attendanceEvent && (
        <div style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(520px, 100%)", background:"var(--surface)", borderLeft:"1px solid var(--border)", boxShadow:"-8px 0 24px rgba(0,0,0,.08)", zIndex:40, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:12, borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <strong>Event Attendance</strong>
            <button className="btn" onClick={closeAttendance} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>Close</button>
          </div>
          <div style={{ overflow:"auto" }}>
            <EventAttendance isCoach={isCoach} teamId={teamId} eventId={attendanceEvent.id} />
          </div>
        </div>
      )}

      {/* Reflection Overview Modal */}
      {showReflectionOverview && reflectionOverviewEvent && (
          <div role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) closeReflectionOverview(); }}
               style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 }}>
              <div style={{ width:"100%", maxWidth:500, background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", boxShadow:"0 10px 30px rgba(0,0,0,.15)", maxHeight: '80vh', overflowY: 'auto' }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
                      <strong>Reflections for: {reflectionOverviewEvent.title}</strong>
                      <button onClick={closeReflectionOverview} aria-label="Close" style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>×</button>
                  </div>
                  <div style={{ padding: 18 }}>
                      {loadingReflectionsSummary ? (<p>Loading reflections...</p>) : (
                          reflectionsSummary.length === 0 ? (<p className="text-muted">No athletes have submitted a reflection for this event.</p>) : (
                              <div style={{ display: 'grid', gap: 10 }}>
                                  {reflectionsSummary.map(r => (
                                      <div key={r.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <div><strong style={{ display: 'block' }}>{r.athleteName}</strong><span className="text-muted" style={{ fontSize: 12 }}>Last updated: {r.updatedAt}</span></div>
                                          <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => { closeReflectionOverview(); openReflectionAndComments(reflectionOverviewEvent, r.id); }}>View & Comment</button>
                                      </div>
                                  ))}
                              </div>
                          )
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Reflection & Feedback Modal */}
      {showReflection && reflectionEvent && reflectionUser && (
        <div role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) closeReflection(); }}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 }}>
          <div style={{ width:"100%", maxWidth:600, background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", boxShadow:"0 10px 30px rgba(0,0,0,.15)", maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
                <strong>{reflectionMode === 'athlete_edit' ? 'My Reflection' : `Athlete Reflection Log`}{reflectionMode === 'coach_view' && ` (Athlete: ${userCache.current.get(reflectionUser)?.name || 'Unknown'})`}</strong>
                <button onClick={closeReflection} aria-label="Close" style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            
            {/* Athlete Reflection Inputs */}
            <form onSubmit={reflectionMode === 'athlete_edit' ? saveReflection : (e) => e.preventDefault()} style={{ padding:18, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display:"grid", gap:14 }}>
                    <p className="text-muted" style={{fontSize: 14, margin: 0}}>Reflection submitted {reflectionForm.updatedAt ? `on ${reflectionForm.updatedAt}` : 'for this event.'}</p>
                    {['feelings', 'performance', 'improvements'].map(key => (
                        <div key={key}>
                            <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</label>
                            {reflectionMode === 'athlete_edit' ? (
                                <textarea className="form-control" rows={key === 'performance' ? 3 : 2} value={reflectionForm[key]} onChange={(e) => setReflectionForm(prev => ({...prev, [key]: e.target.value}))} />
                            ) : (
                                <div style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, minHeight: key === 'performance' ? 80 : 50, backgroundColor: 'var(--background-light)' }}>{reflectionForm[key] || <span className="text-muted">No entry.</span>}</div>
                            )}
                        </div>
                    ))}
                    {reflectionMode === 'athlete_edit' && (
                        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop: 10 }}>
                            <button type="submit" className="btn btn-primary" disabled={savingReflection}>{savingReflection ? "Saving..." : "Save Reflection"}</button>
                        </div>
                    )}
                </div>
            </form>

            {/* Coach Feedback Section */}
            <div style={{ padding:18, paddingTop: 10 }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 18, fontWeight: 700 }}>Coach Feedback ({coachComments.length})</h4>
                <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 15, paddingRight: 8 }}>
                    {coachComments.length === 0 ? (
                        <p className="text-muted" style={{ fontSize: 14 }}>No feedback yet.</p>
                    ) : (
                        coachComments.map(comment => (
                            <div key={comment.id} style={{ marginBottom: 10, padding: 10, borderRadius: 6, borderLeft: '3px solid var(--brand-primary)', backgroundColor: 'var(--background-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600 }}>{comment.createdByName} (Coach)</span>
                                        <span className="text-muted">{comment.updatedAt}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 14 }}>{comment.text}</p>
                                </div>
                                {/* Edit Button for Coach */}
                                {comment.id === me && !isEditingFeedback && (
                                    <button onClick={() => { setNewCommentText(comment.text); setIsEditingFeedback(true); }}
                                        className="btn btn-outline" style={{ fontSize: 12, padding: '2px 8px', marginLeft: 10, alignSelf: 'center' }}>Edit</button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Feedback Input: Shows if no feedback exists OR if in Edit Mode */}
                {(isCoach && reflectionMode === 'coach_view' && (!hasMyFeedback || isEditingFeedback)) && (
                    <form onSubmit={submitComment}>
                        <textarea className="form-control" rows={3} placeholder="Type your feedback, guidance, or comments here..." value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} style={{ marginBottom: 10 }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            {isEditingFeedback && (
                                <button type="button" onClick={() => { setIsEditingFeedback(false); setNewCommentText(myExistingFeedback?.text || ''); }} className="btn btn-outline">Cancel Edit</button>
                            )}
                            <button type="submit" className="btn btn-primary" disabled={commenting || !newCommentText.trim()}>
                                {isEditingFeedback ? "Update Feedback" : "Submit Feedback"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
            {reflectionMessage && (
                <div className={`alert ${reflectionMessage.includes("Error") || reflectionMessage.includes("Failed") ? "alert-error" : "alert-success"}`} style={{padding: "8px 12px", margin: 18, marginTop: 0}}>
                    {reflectionMessage}
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}