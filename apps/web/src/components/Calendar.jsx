// src/components/Calendar.jsx
// Refactored to use CSS classes from index.css for spacing and buttons.
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
  Timestamp,
} from "firebase/firestore";
import EventAttendance from "./EventAttendance";

// Import centralized services/constants
import { ATTENDANCE_CONFIG } from "../constants/constants";
import { fetchTeamAthletes } from "../services/teamService";

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

  // ... (All state definitions remain the same) ...
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [assignables, setAssignables] = useState([]);
  const userCache = useRef(new Map());
  const teamCoaches = useRef([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState({});
  const [createForm, setCreateForm] = useState({
    title: "",
    date: "",
    time: "",
    type: "practice",
    description: "",
  });
  const [createAssigned, setCreateAssigned] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    date: "",
    time: "",
    type: "practice",
    description: "",
  });
  const [editAssigned, setEditAssigned] = useState([]);
  const [editErr, setEditErr] = useState("");
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceEvent, setAttendanceEvent] = useState(null);


  /* ========== load my teams (unchanged) ========== */
  useEffect(() => {
    // ... (logic unchanged)
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

  /* ========== subscribe events (unchanged) ========== */
  useEffect(() => {
    // ... (logic unchanged)
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

  /* ========== load assignables (using teamService) ========== */
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

  /* ========== create (unchanged) ========== */
  const openCreate = () => {
    // ... (logic unchanged)
    if (!isCoach) return alert("Only coaches can create events");
    setCreateErr({});
    setCreateForm({ title: "", date: "", time: "", type: "practice", description: "" });
    setCreateAssigned([]);
    setShowCreate(true);
  };
  const closeCreate = () => setShowCreate(false);
  const submitCreate = async (e) => {
    // ... (logic unchanged)
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
      const dt = new Date(`${createForm.date}T${createForm.time}`);
      await addDoc(collection(db, "teams", teamId, "events"), {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        type: createForm.type,
        datetime: Timestamp.fromDate(dt),
        assignedMemberIds: createAssigned.slice(), 
        createdBy: me,
        createdAt: new Date(),
        attendanceSummary: { present: 0, total: createAssigned.length, rate: 0 },
        attendanceRecords: {}, // Initialize empty records
      });
      closeCreate();
    } catch (e) {
      console.error("create event failed", e);
      setCreateErr({ submit: "Failed to create event" });
    } finally {
      setCreating(false);
    }
  };


  /* ========== edit (unchanged) ========== */
  const openEdit = (ev) => {
    // ... (logic unchanged)
    const dt = ev.datetime instanceof Date ? ev.datetime : (ev.datetime ? new Date(ev.datetime) : new Date());
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    const h = String(dt.getHours()).padStart(2, "0");
    const mi = String(dt.getMinutes()).padStart(2, "0");
    setEditForm({
      title: ev.title || "",
      date: `${y}-${m}-${d}`,
      time: `${h}:${mi}`,
      type: ev.type || "practice",
      description: ev.description || "",
    });
    setEditAssigned(Array.isArray(ev.assignedMemberIds) ? [...ev.assignedMemberIds] : []);
    setEditing(ev);
    setEditErr("");
  };
  const closeEdit = () => setEditing(null);
  const submitEdit = async (e) => {
    // ... (logic unchanged)
    e.preventDefault();
    if (!editing) return;
    if (!editForm.title || !editForm.date || !editForm.time) {
      setEditErr("Title, Date and Time are required.");
      return;
    }
    try {
      const dt = new Date(`${editForm.date}T${editForm.time}`);
      await updateDoc(doc(db, "teams", teamId, "events", editing.id), {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        type: editForm.type,
        datetime: Timestamp.fromDate(dt),
        assignedMemberIds: editAssigned.slice(),
      });
      closeEdit();
    } catch (e) {
      console.error("update event failed", e);
      setEditErr("Failed to update event");
    }
  };

  /* ========== delete (unchanged) ========== */
  const deleteEvent = async (ev) => {
    // ... (logic unchanged)
    if (!confirm("Delete this event?")) return;
    try {
      await deleteDoc(doc(db, "teams", teamId, "events", ev.id));
    } catch (e) {
      console.error("delete failed", e);
      alert("Failed to delete");
    }
  };

  /* ========== attendance drawer (unchanged) ========== */
  const openAttendance = (ev) => {
    // ... (logic unchanged)
    setAttendanceEvent(ev);
    setShowAttendance(true);
  };
  const closeAttendance = () => setShowAttendance(false);

  /* ========== render helpers (using ATTENDANCE_CONFIG) ========== */
  const upcoming = useMemo(() => events.filter((e) => e.upcoming), [events]);
  const past = useMemo(() => events.filter((e) => !e.upcoming), [events]);

  const AttendanceBadge = ({ s }) => {
    if (!s) return null;
    const rate = s.total ? Math.round((s.present / s.total) * 100) : 0;
    
    // Use config colors for consistency
    const config = 
      rate >= 80 ? ATTENDANCE_CONFIG.present :
      rate >= 60 ? ATTENDANCE_CONFIG.late :
      ATTENDANCE_CONFIG.absent;

    return (
      <span style={{ 
        marginLeft: 8, 
        padding: "2px 8px", 
        fontSize: 12, 
        borderRadius: 4, 
        background: config.backgroundColor, 
        color: config.color, 
        fontWeight: 500 
      }}>
        {s.present}/{s.total} ({rate}%)
      </span>
    );
  };

  // Cleaned up MyAttendanceStatus to use shared config
  const MyAttendanceStatus = ({ event, me }) => {
    if (!me) return null; 
    const status = event.attendanceRecords?.[me]?.status;
    const config = ATTENDANCE_CONFIG[status] || ATTENDANCE_CONFIG.unset;

    return (
      <span style={{ 
        marginLeft: 8, 
        padding: "2px 8px", 
        fontSize: 12, 
        borderRadius: 4, 
        background: config.backgroundColor, 
        color: config.color, 
        fontWeight: 500 
      }}>
        {config.label}
      </span>
    );
  };

  return (
    // --- REFACTOR: Replaced inline margins with CSS classes ---
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h2 className="mb-1">📅 Team Calendar</h2>
      <p className="text-muted mb-3">
        Manage and track team events, practices, and competitions
      </p>

      {/* --- REFACTOR: Kept layout styles, but added CSS margin class --- */}
      <div className="mb-3" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end', 
        paddingBottom: 4, 
        minHeight: '60px'
      }}>
        
        {/* Team selector (with consistent styling) */}
        <div>
          <label className="mb-1" style={{ fontWeight: 600, display: "block" }}>Select Team:</label>
          <select
            value={teamId || ""}
            onChange={(e) => setTeamId(e.target.value)}
            className="form-control" // Uses .form-control styles
            style={{ 
              minWidth: 360, 
              maxWidth: 400,
              borderColor: "var(--brand-primary)", // User request
              boxShadow: "0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent)", // User request
            }}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* --- REFACTOR: Replaced inline styles with CSS classes --- */}
        {isCoach && (
          <button 
            className="btn btn-primary" // Use .btn and .btn-primary classes
            onClick={openCreate} 
            style={{ height: 'fit-content', whiteSpace: 'nowrap' }} // Keep layout tweaks
          >
            ➕ Create New Event
          </button>
        )}
      </div>
      {/* --- END REFACTOR --- */}


      {/* Create Modal (Modal styles are complex, left as-is) */}
      {showCreate && (
        <div role="dialog" aria-modal="true"
             onClick={(e)=>{ if(e.target===e.currentTarget) setShowCreate(false); }}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 }}>
          <div style={{ width:"100%", maxWidth:760, background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", boxShadow:"0 10px 30px rgba(0,0,0,.15)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
              <strong>Create New Event</strong>
              <button onClick={()=>setShowCreate(false)} aria-label="Close" style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <form onSubmit={submitCreate} style={{ padding:18 }}>
              <div style={{ display:"grid", gap:14 }}>
                {/* ... (form inputs unchanged) ... */}
                <div>
                  <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Title *</label>
                  <input className="form-control" value={createForm.title}
                         onChange={(e)=>setCreateForm(p=>({...p, title:e.target.value}))}
                         placeholder="e.g., Morning Practice" />
                  {createErr.title && <small className="text-danger">{createErr.title}</small>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Date *</label>
                    <input type="date" className="form-control" value={createForm.date}
                           onChange={(e)=>setCreateForm(p=>({...p, date:e.target.value}))} />
                    {createErr.date && <small className="text-danger">{createErr.date}</small>}
                  </div>
                  <div>
                    <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Time *</label>
                    <input type="time" className="form-control" value={createForm.time}
                           onChange={(e)=>setCreateForm(p=>({...p, time:e.target.value}))} />
                    {createErr.time && <small className="text-danger">{createErr.time}</small>}
                  </div>
                </div>
                <div>
                  <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Type</label>
                  <select className="form-control" value={createForm.type}
                          onChange={(e)=>setCreateForm(p=>({...p, type:e.target.value}))}>
                    <option value="practice">Practice</option>
                    <option value="game">Game/Competition</option>
                    <option value="meeting">Team Meeting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Description (Optional)</label>
                  <textarea rows={3} className="form-control" value={createForm.description}
                            onChange={(e)=>setCreateForm(p=>({...p, description:e.target.value}))} />
                </div>
                <div>
                  <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Assign to Athletes</label>
                  <div style={{ border:"1px solid var(--border)", borderRadius:8, maxHeight:220, overflowY:"auto", padding:8 }}>
                    {assignables.length===0 ? (
                      <div className="text-muted" style={{ padding:8 }}>No athletes in this team.</div>
                    ) : assignables.map((m)=>(
                      <label key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px" }}>
                        <input type="checkbox"
                               checked={createAssigned.includes(m.id)}
                               onChange={(e)=>setCreateAssigned(prev=> e.target.checked ? [...prev, m.id] : prev.filter(id=>id!==m.id))} />
                        <span>{m.name || m.email || `User ${m.id.slice(0,6)}`}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* --- REFACTOR: Use .alert-error class --- */}
                {createErr.submit && (
                  <div className="alert alert-error" style={{padding: "8px 12px", margin: 0}}>
                    {createErr.submit}
                  </div>
                )}
                
                {/* --- REFACTOR: Use .btn classes --- */}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                  <button type="button" className="btn" onClick={closeCreate} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? "Creating..." : "Create Event"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- REFACTOR: Use CSS margin classes --- */}
      <h3 className="mt-3 mb-2" style={{ fontSize:22, fontWeight:700 }}>🔜 Upcoming Events</h3>
      {loadingEvents ? <p>Loading events…</p> : (
        <div className="mb-4" style={{ display:"grid", gap:12 }}>
          {upcoming.length===0 ? <p className="text-muted">No upcoming events scheduled.</p> :
            upcoming.map((ev)=>(
              <div key={ev.id} 
                   className="card" // Use .card class
                   // Keep override styles for padding, layout, and data-driven border
                   style={{ 
                     padding:"14px 18px", 
                     display:"flex", 
                     justifyContent:"space-between", 
                     alignItems:"center",
                     borderLeft:`4px solid ${TYPE_COLORS[ev.type]||"#6b7280"}`,
                     margin: 0 // Override .card's default margin-bottom
                   }}>
                <div style={{ flex:1 }}>
                  <strong style={{ fontSize:16 }}>{ev.title}</strong>
                  
                  {isCoach ? (
                    <AttendanceBadge s={ev.attendanceSummary} />
                  ) : (
                    <MyAttendanceStatus event={ev} me={me} />
                  )}

                  <p className="text-muted" style={{ margin:"4px 0 0", fontSize:14 }}>
                    📅 {ev.datetime.toLocaleDateString()} {ev.datetime.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
                  </p>
                  {ev.description && <p style={{ margin:0, color:"#4b5563", fontSize:14 }}>{ev.description}</p>}
                </div>
                
                {/* --- REFACTOR: Use .btn class for cleaner buttons --- */}
                <div style={{ display:"flex", gap:8 }}>
                  {isCoach && (
                    <button className="btn" onClick={()=>openAttendance(ev)} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>
                      Track Attendance
                    </button>
                  )}
                  {isCoach && (
                    <button className="btn" onClick={()=>openEdit(ev)} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>
                      Edit
                    </button>
                  )}
                  {isCoach && (
                    <button className="btn" onClick={()=>deleteEvent(ev)} style={{ border:"1px solid #ef4444", color:"#ef4444", background:"var(--surface)" }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* --- REFACTOR: Use CSS margin classes --- */}
      <h3 className="mt-3 mb-2" style={{ fontSize:22, fontWeight:700 }}>📜 Past Events</h3>
      <div style={{ display:"grid", gap:12 }}>
        {past.length===0 ? <p className="text-muted">No past events.</p> :
          past.map((ev)=>(
            <div key={ev.id} 
                 className="card" // Use .card class
                 style={{ 
                   padding:"14px 18px", 
                   display:"flex", 
                   justifyContent:"space-between", 
                   alignItems:"center",
                   borderLeft:`4px solid ${TYPE_COLORS[ev.type]||"#6b7280"}`,
                   margin: 0 // Override .card's default margin-bottom
                 }}>
              <div>
                <strong style={{ fontSize:16 }}>{ev.title}</strong>
                
                {isCoach ? (
                  <AttendanceBadge s={ev.attendanceSummary} />
                ) : (
                  <MyAttendanceStatus event={ev} me={me} />
                )}

                {ev.datetime && <p className="text-muted" style={{ margin:"6px 0 0", fontSize:14 }}>{ev.datetime.toLocaleString()}</p>}
              </div>
              
              {/* --- REFACTOR: Use .btn class for cleaner buttons --- */}
              <div style={{ display:"flex", gap:8 }}>
                {isCoach && (
                  <button className="btn" onClick={()=>openAttendance(ev)} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>
                    View Attendance
                  </button>
                )}
                {isCoach && (
                  <button className="btn" onClick={()=>deleteEvent(ev)} style={{ border:"1px solid #ef4444", color:"#ef4444", background:"var(--surface)" }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* Edit Modal (Modal styles are complex, left as-is) */}
      {editing && (
        <div role="dialog" aria-modal="true"
             onClick={(e)=>{ if(e.target===e.currentTarget) closeEdit(); }}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 }}>
          <div style={{ width:"100%", maxWidth:760, background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", boxShadow:"0 10px 30px rgba(0,0,0,.15)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
              <strong>Edit Event</strong>
              <button onClick={closeEdit} aria-label="Close" style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <form onSubmit={submitEdit} style={{ padding:18 }}>
              <div style={{ display:"grid", gap:14 }}>
                {/* ... (form inputs unchanged) ... */}
                <div>
                  <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Title *</label>
                  <input className="form-control" value={editForm.title} onChange={(e)=>setEditForm(p=>({...p, title:e.target.value}))} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Date *</label>
                    <input type="date" className="form-control" value={editForm.date} onChange={(e)=>setEditForm(p=>({...p, date:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Time *</label>
                    <input type="time" className="form-control" value={editForm.time} onChange={(e)=>setEditForm(p=>({...p, time:e.target.value}))} />
                  </div>
                </div>
                <div>
                  <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Event Type</label>
                  <select className="form-control" value={editForm.type} onChange={(e)=>setEditForm(p=>({...p, type:e.target.value}))}>
                    <option value="practice">Practice</option>
                    <option value="game">Game/Competition</option>
                    <option value="meeting">Team Meeting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Description (Optional)</label>
                  <textarea rows={3} className="form-control" value={editForm.description} onChange={(e)=>setEditForm(p=>({...p, description:e.target.value}))} />
                </div>
                <div>
                  <label style={{ display:"block", marginBottom:6, fontWeight:600 }}>Assign to Athletes</label>
                  <div style={{ border:"1px solid var(--border)", borderRadius:8, maxHeight:220, overflowY:"auto", padding:8 }}>
                    {assignables.length===0 ? (
                      <div className="text-muted" style={{ padding:8 }}>No athletes in this team.</div>
                    ) : assignables.map((m)=>(
                      <label key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px" }}>
                        <input type="checkbox"
                               checked={editAssigned.includes(m.id)}
                               onChange={(e)=>setEditAssigned(prev=> e.target.checked ? [...prev, m.id] : prev.filter(id=>id!==m.id))} />
                        <span>{m.name || m.email || `User ${m.id.slice(0,6)}`}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* --- REFACTOR: Use .alert-error class --- */}
                {editErr && (
                  <div className="alert alert-error" style={{padding: "8px 12px", margin: 0}}>
                    {editErr}
                  </div>
                )}
                
                {/* --- REFACTOR: Use .btn classes --- */}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                  <button type="button" className="btn" onClick={closeEdit} style={{ border:"1px solid var(--border)", background:"var(--surface)" }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Drawer (Complex component, styles left as-is) */}
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
    </div>
  );
}