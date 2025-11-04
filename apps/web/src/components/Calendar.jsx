// src/components/Calendar.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  documentId,
  Timestamp,
} from "firebase/firestore";

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
  { value: "unknown", label: "Unknown" },
];

// 小工具：安全地从事件里读写 attendanceByMember
const getAttendanceFor = (event, uid) =>
  (event?.attendanceByMember && event.attendanceByMember[uid]) || "unknown";

export default function Calendar({ userRole, user }) {
  const isCoach = userRole === "coach";

  // Events + team selection
  const [events, setEvents] = useState([]);
  const [teamId, setTeamId] = useState(null);
  const [teams, setTeams] = useState([]);

  // Create form UI state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Create form data
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    time: "",
    description: "",
    type: "practice",
  });
  const [assignedMemberIds, setAssignedMemberIds] = useState([]);

  // Edit panel
  const [editingEvent, setEditingEvent] = useState(null);
  const [editData, setEditData] = useState({
    title: "",
    date: "",
    time: "",
    description: "",
    type: "practice",
  });
  const [editAssignedIds, setEditAssignedIds] = useState([]);
  const [editError, setEditError] = useState("");

  // Attendance panel（coach）
  const [attendanceEvent, setAttendanceEvent] = useState(null);
  const [attendanceDraft, setAttendanceDraft] = useState({}); // uid -> status
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  // Team members（仅在需要时加载）
  const [teamMembers, setTeamMembers] = useState([]); // [{id, name, email}]
  const userCacheRef = useRef(new Map()); // uid -> {name,email}

  /* -------- 取我所在的 teams：兼容 coaches/athletes/members 三字段，合并去重 -------- */
  useEffect(() => {
    const fetchTeams = async () => {
      const me = auth.currentUser?.uid;
      if (!me) return;

      try {
        const teamsCol = collection(db, "teams");
        const [s1, s2, s3] = await Promise.allSettled([
          getDocs(query(teamsCol, where("coaches", "array-contains", me))),
          getDocs(query(teamsCol, where("athletes", "array-contains", me))),
          getDocs(query(teamsCol, where("members", "array-contains", me))),
        ]);

        const dedup = new Map();
        const collect = (snap) => {
          if (!snap || snap.empty) return;
          snap.docs.forEach((d) =>
            dedup.set(d.id, { id: d.id, name: d.data().name || "Unnamed Team" })
          );
        };
        if (s1.status === "fulfilled") collect(s1.value);
        if (s2.status === "fulfilled") collect(s2.value);
        if (s3.status === "fulfilled") collect(s3.value);

        const list = Array.from(dedup.values());
        setTeams(list);
        setTeamId((prev) => prev ?? (list[0]?.id ?? null));
      } catch (err) {
        console.error("Error fetching teams:", err);
        setTeams([]);
        setTeamId(null);
      }
    };
    fetchTeams();
  }, []);

  /* -------- 订阅选中 team 的 events -------- */
  useEffect(() => {
    if (!teamId) return;
    const qRef = query(
      collection(db, "teams", teamId, "events"),
      orderBy("datetime", "asc")
    );
    const unsub = onSnapshot(qRef, (snapshot) => {
      let rows = snapshot.docs.map((d) => {
        const raw = d.data();
        const dt =
          raw.datetime?.toDate?.() ??
          (raw.datetime instanceof Date ? raw.datetime : null);
        return { id: d.id, ...raw, datetime: dt };
      });

      // athlete 端：只显示 team-wide 或 assigned 给自己的（UI 过滤；若要规则层限制，见你的 rules 修改）
      if (!isCoach && auth.currentUser) {
        const me = auth.currentUser.uid;
        rows = rows.filter((e) => {
          const ids = Array.isArray(e.assignedMemberIds) ? e.assignedMemberIds : [];
          return ids.length === 0 || ids.includes(me);
        });
      }

      setEvents(rows);
    });
    return () => unsub();
  }, [teamId, isCoach]);

  /* -------- 按需加载 team 的所有 athletes 的名字（打开创建/编辑/出勤面板时才拉） -------- */
  const loadTeamMembers = async (tid) => {
    try {
      const tSnap = await getDoc(doc(db, "teams", tid));
      if (!tSnap.exists()) {
        setTeamMembers([]);
        return;
      }
      const athleteUids = Array.isArray(tSnap.data().athletes)
        ? tSnap.data().athletes
        : [];

      if (athleteUids.length === 0) {
        setTeamMembers([]);
        return;
      }

      const toFetch = athleteUids.filter((uid) => !userCacheRef.current.has(uid));
      for (let i = 0; i < toFetch.length; i += 10) {
        const batch = toFetch.slice(i, i + 10);
        const qUsers = query(
          collection(db, "users"),
          where(documentId(), "in", batch)
        );
        const uSnap = await getDocs(qUsers);
        uSnap.forEach((udoc) => {
          const u = udoc.data() || {};
          userCacheRef.current.set(udoc.id, {
            name: u.displayName || u.name || "",
            email: u.email || "",
          });
        });
      }

      const members = athleteUids.map((uid) => {
        const meta = userCacheRef.current.get(uid) || {};
        const label = meta.name?.trim() || meta.email?.trim() || uid;
        return { id: uid, name: label, email: meta.email || "" };
      });
      setTeamMembers(members);
    } catch (e) {
      console.error("load team athletes error:", e);
      setTeamMembers([]);
    }
  };

  // 打开创建/编辑/出勤面板时加载
  useEffect(() => {
    if (isCoach && teamId && (showCreateForm || editingEvent || attendanceEvent)) {
      loadTeamMembers(teamId);
    }
    if (!showCreateForm && !editingEvent && !attendanceEvent) {
      setTeamMembers([]);
    }
  }, [isCoach, teamId, showCreateForm, editingEvent, attendanceEvent]);

  /* -------- 辅助函数 -------- */
  const formatEventDate = (date) =>
    date
      ? date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      : "";

  const getEventTypeColor = (type) => {
    switch (type) {
      case "practice":
        return "#10b981";
      case "game":
        return "#ef4444";
      case "meeting":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  const validate = (data) => {
    const errs = {};
    if (!data.title.trim()) errs.title = "Event title is required";
    if (!data.date) errs.date = "Date is required";
    if (!data.time) errs.time = "Time is required";
    const when = new Date(`${data.date}T${data.time}`);
    if (isFinite(when) && when < new Date()) errs.date = "Cannot set events in the past";
    return errs;
  };

  /* -------- 创建 -------- */
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    const v = validate(formData);
    setErrors(v);
    if (Object.keys(v).length) return;

    setLoading(true);
    try {
      const when = Timestamp.fromDate(new Date(`${formData.date}T${formData.time}`));
      await addDoc(collection(db, "teams", teamId, "events"), {
        title: formData.title.trim(),
        description: formData.description.trim(),
        datetime: when,
        type: formData.type,
        createdBy: auth.currentUser.uid,
        createdByName: user?.displayName || user?.email,
        createdAt: Timestamp.fromDate(new Date()),
        assignedMemberIds: assignedMemberIds,   // [] => team-wide
        attendanceByMember: {},                // 初始化为空
      });
      setFormData({ title: "", date: "", time: "", description: "", type: "practice" });
      setAssignedMemberIds([]);
      setShowCreateForm(false);
      setErrors({});
    } catch (error) {
      console.error("Error creating event:", error);
      setErrors({ general: `${error.code || "error"}: ${error.message || "Failed to create event"}` });
    } finally {
      setLoading(false);
    }
  };

  /* -------- 删除（任意该队教练都能删；规则需放宽，见文末） -------- */
  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      await deleteDoc(doc(db, "teams", teamId, "events", eventId));
    } catch (error) {
      console.error("Error deleting event:", error);
      alert(`${error.code || "error"}: ${error.message || "Delete failed"}`);
    }
  };

  /* -------- 打开编辑 -------- */
  const openEdit = (event) => {
    setEditingEvent(event);
    setEditError("");
    setEditData({
      title: event.title || "",
      date: event.datetime ? event.datetime.toISOString().split("T")[0] : "",
      time: event.datetime ? event.datetime.toTimeString().slice(0, 5) : "",
      description: event.description || "",
      type: event.type || "practice",
    });
    setEditAssignedIds(Array.isArray(event.assignedMemberIds) ? [...event.assignedMemberIds] : []);
  };

  /* -------- 保存编辑 -------- */
  const saveEdit = async () => {
    if (!editingEvent) return;
    const v = validate(editData);
    setEditError(Object.values(v)[0] || "");
    if (Object.keys(v).length) return;

    try {
      const when = Timestamp.fromDate(new Date(`${editData.date}T${editData.time}`));
      await updateDoc(doc(db, "teams", teamId, "events", editingEvent.id), {
        title: editData.title.trim(),
        description: editData.description.trim(),
        datetime: when,
        type: editData.type,
        assignedMemberIds: editAssignedIds, // [] => team-wide
      });
      setEditingEvent(null);
    } catch (error) {
      console.error("Error updating event:", error);
      setEditError(`${error.code || "error"}: ${error.message || "Update failed"}`);
    }
  };
  const cancelEdit = () => { setEditingEvent(null); setEditError(""); };

  /* -------- 打开出勤面板（仅教练） -------- */
  const openAttendance = (event) => {
    setAttendanceEvent(event);

    // 如果是“已分配”事件，先按已分配的人初始化草稿
    const draft = {};
    const ids = Array.isArray(event.assignedMemberIds) ? event.assignedMemberIds : [];
    ids.forEach((uid) => {
      draft[uid] = getAttendanceFor(event, uid);
    });
    setAttendanceDraft(draft);
  };

  // team-wide 时，等 teamMembers 加载好后，把全队员拉进草稿（仅在打开面板且事件为 team-wide 时）
  useEffect(() => {
    if (!attendanceEvent) return;
    const assigned = Array.isArray(attendanceEvent.assignedMemberIds)
      ? attendanceEvent.assignedMemberIds
      : [];
    const isTeamWide = assigned.length === 0;

    if (isCoach && teamId && isTeamWide && teamMembers.length > 0) {
      setAttendanceDraft((prev) => {
        // 已有草稿就不重复覆盖，让用户的改动生效
        if (Object.keys(prev).length > 0) return prev;
        const draftAll = {};
        teamMembers.forEach(({ id }) => {
          draftAll[id] = getAttendanceFor(attendanceEvent, id);
        });
        return draftAll;
      });
    }
  }, [attendanceEvent, isCoach, teamId, teamMembers]);

  /* -------- 保存出勤 -------- */
  const saveAttendance = async () => {
    if (!attendanceEvent) return;
    setAttendanceSaving(true);
    try {
      const ref = doc(db, "teams", teamId, "events", attendanceEvent.id);

      // 与原有 attendanceByMember 合并，避免覆盖未列出成员的状态
      const merged = {
        ...(attendanceEvent.attendanceByMember || {}),
        ...attendanceDraft,
      };

      await updateDoc(ref, { attendanceByMember: merged });

      setAttendanceEvent(null);
      setAttendanceDraft({});
    } catch (e) {
      console.error("save attendance error:", e);
      alert(`${e.code || "error"}: ${e.message || "Save attendance failed"}`);
    } finally {
      setAttendanceSaving(false);
    }
  };
  const cancelAttendance = () => { setAttendanceEvent(null); setAttendanceDraft({}); };

  /* -------- 30 天内的未来事件 -------- */
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return events.filter((e) => e.datetime && e.datetime >= now && e.datetime <= in30);
  }, [events]);

  /* -------- UI -------- */
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Team Calendar</h2>
            <p className="text-muted" style={{ fontSize: 16 }}>
              {isCoach ? "Manage your team's events, assignments and attendance" : "View team events and your attendance"}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {teams.length > 0 && (
              <div>
                <label style={{ fontWeight: 600, marginRight: 8 }}>Select Team:</label>
                <select
                  value={teamId || ""}
                  onChange={(e) => setTeamId(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db" }}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            {isCoach && (
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateForm((s) => !s)}
                style={{ background: "var(--brand-primary)", border: "none", padding: "12px 24px", fontWeight: 600 }}
              >
                {showCreateForm ? "Cancel" : "+ Create Event"}
              </button>
            )}
          </div>
        </div>

        {/* Create Form */}
        {isCoach && showCreateForm && (
          <div className="card" style={{ padding: 24, marginBottom: 32, border: "2px solid var(--brand-primary-50)", background: "#f0fdf4" }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Create New Event</h3>
            <form onSubmit={handleCreateEvent}>
              <div style={{ display: "grid", gap: 16 }}>
                {/* Title */}
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" }}>Event Title *</label>
                  <input
                    type="text"
                    className={`form-control ${errors.title ? "is-invalid" : ""}`}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Team Practice, Game vs. Rivals"
                  />
                  {errors.title && <div style={{ color: "#ef4444", fontSize: 14, marginTop: 4 }}>{errors.title}</div>}
                </div>

                {/* Date & Time */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" }}>Date *</label>
                    <input
                      type="date"
                      className={`form-control ${errors.date ? "is-invalid" : ""}`}
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      min={new Date().toISOString().split("T")[0]}
                    />
                    {errors.date && <div style={{ color: "#ef4444", fontSize: 14, marginTop: 4 }}>{errors.date}</div>}
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" }}>Time *</label>
                    <input
                      type="time"
                      className={`form-control ${errors.time ? "is-invalid" : ""}`}
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    />
                    {errors.time && <div style={{ color: "#ef4444", fontSize: 14, marginTop: 4 }}>{errors.time}</div>}
                  </div>
                </div>

                {/* Type */}
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" }}>Event Type</label>
                  <select
                    className="form-control"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="practice">Practice</option>
                    <option value="game">Game/Competition</option>
                    <option value="meeting">Team Meeting</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" }}>Description (Optional)</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Add details..."
                  />
                </div>

                {/* Assign athletes */}
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" }}>Assign to Athletes (optional)</label>
                  <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: 8, maxHeight: 220, overflowY: "auto", background: "#fff" }}>
                    {teamId == null ? (
                      <div className="text-muted" style={{ padding: 8 }}>Please select a team first.</div>
                    ) : teamMembers.length === 0 ? (
                      <div className="text-muted" style={{ padding: 8 }}>No athletes in this team yet.</div>
                    ) : (
                      teamMembers.map((m) => {
                        const checked = assignedMemberIds.includes(m.id);
                        return (
                          <label key={m.id} title={m.email || m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setAssignedMemberIds((prev) =>
                                  e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                                )
                              }
                            />
                            <span>{m.name} <span style={{ color: "#9ca3af", fontSize: 12 }}>({m.id.slice(0, 6)}…)</span></span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <p className="text-muted" style={{ marginTop: 6, fontSize: 13 }}>
                    Leave empty to make this a team-wide event.
                  </p>
                </div>

                {errors.general && (
                  <div style={{ color: "#ef4444", fontSize: 14, padding: "8px 12px", background: "#fee2e2", borderRadius: 6 }}>
                    {errors.general}
                  </div>
                )}

                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button type="submit" className="btn btn-primary" disabled={loading}
                    style={{ background: "var(--brand-primary)", border: "none", padding: "10px 24px", fontWeight: 600 }}>
                    {loading ? "Creating..." : "Create Event"}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => {
                    setShowCreateForm(false);
                    setErrors({});
                    setFormData({ title: "", date: "", time: "", description: "", type: "practice" });
                    setAssignedMemberIds([]);
                  }}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Event List（未来 30 天） */}
        {upcomingEvents.map((event) => {
          const myAttendance =
            !isCoach && auth.currentUser
              ? getAttendanceFor(event, auth.currentUser.uid)
              : null;

          return (
            <div key={event.id} className="card"
              style={{
                padding: 20, display: "flex", justifyContent: "space-between", alignItems: "start",
                borderLeft: `4px solid ${getEventTypeColor(event.type)}`
              }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <h4 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>{event.title}</h4>
                  <span style={{
                    fontSize: 12, padding: "4px 8px", background: getEventTypeColor(event.type) + "20",
                    color: getEventTypeColor(event.type), borderRadius: 4, fontWeight: 600, textTransform: "uppercase"
                  }}>
                    {event.type}
                  </span>
                </div>
                <p style={{ fontSize: 15, color: "#4b5563", marginBottom: 4 }}>📅 {formatEventDate(event.datetime)}</p>

                {Array.isArray(event.assignedMemberIds) && event.assignedMemberIds.length > 0 && (
                  <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                    Assigned Count: {event.assignedMemberIds.length}
                  </p>
                )}

                {event.description && (
                  <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>{event.description}</p>
                )}

                {/* athlete 看到自己的出勤 */}
                {!isCoach && myAttendance && (
                  <p style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>
                    Your attendance: <strong style={{ textTransform: "capitalize" }}>{myAttendance}</strong>
                  </p>
                )}

                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
                  Created by {event.createdByName}
                </p>
              </div>

              {/* coach 的操作：Edit / Attendance / Delete —— 注意权限由 rules 决定 */}
              {isCoach && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-sm btn-outline"
                    onClick={() => openEdit(event)}
                    style={{ color: "#3b82f6", borderColor: "#3b82f6", padding: "6px 12px", fontSize: 14 }}>
                    Edit
                  </button>
                  <button className="btn btn-sm btn-outline"
                    onClick={() => openAttendance(event)}
                    style={{ color: "#10b981", borderColor: "#10b981", padding: "6px 12px", fontSize: 14 }}>
                    Attendance
                  </button>
                  <button className="btn btn-sm btn-outline"
                    onClick={() => handleDeleteEvent(event.id)}
                    style={{ color: "#ef4444", borderColor: "#ef4444", padding: "6px 12px", fontSize: 14 }}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* ===== Edit Panel ===== */}
        {isCoach && editingEvent && (
          <div role="dialog" aria-modal="true"
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex",
              alignItems: "flex-start", justifyContent: "center", paddingTop: 60, zIndex: 50
            }}
            onClick={() => setEditingEvent(null)}>
            <div className="card" style={{ width: "min(860px, 92vw)", padding: 24, background: "#fff" }}
              onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Edit Event</h3>
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Event Title *</label>
                  <input type="text" className="form-control" value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Date *</label>
                    <input type="date" className="form-control" value={editData.date}
                      onChange={(e) => setEditData({ ...editData, date: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Time *</label>
                    <input type="time" className="form-control" value={editData.time}
                      onChange={(e) => setEditData({ ...editData, time: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Event Type</label>
                  <select className="form-control" value={editData.type}
                    onChange={(e) => setEditData({ ...editData, type: e.target.value })}>
                    <option value="practice">Practice</option>
                    <option value="game">Game/Competition</option>
                    <option value="meeting">Team Meeting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Description (Optional)</label>
                  <textarea className="form-control" rows={3} value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })} />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Assign to Athletes</label>
                  <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: 8, maxHeight: 240, overflowY: "auto" }}>
                    {teamMembers.length === 0 ? (
                      <div className="text-muted" style={{ padding: 8 }}>No athletes in this team.</div>
                    ) : (
                      teamMembers.map((m) => {
                        const checked = editAssignedIds.includes(m.id);
                        return (
                          <label key={m.id} title={m.email || m.id}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setEditAssignedIds((prev) =>
                                  e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id)
                                )
                              }
                            />
                            <span>{m.name} <span style={{ color: "#9ca3af", fontSize: 12 }}>({m.id.slice(0, 6)}…)</span></span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {editError && (
                  <div style={{ color: "#ef4444", fontSize: 14, padding: "8px 12px", background: "#fee2e2", borderRadius: 6 }}>
                    {editError}
                  </div>
                )}

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
                  <button className="btn btn-outline" onClick={() => setEditingEvent(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveEdit}
                    style={{ background: "var(--brand-primary)", border: "none" }}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Attendance Panel（coach） ===== */}
        {isCoach && attendanceEvent && (
          <div role="dialog" aria-modal="true"
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex",
              alignItems: "flex-start", justifyContent: "center", paddingTop: 60, zIndex: 50
            }}
            onClick={cancelAttendance}>
            <div className="card" style={{ width: "min(860px, 92vw)", padding: 24, background: "#fff" }}
              onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
                Attendance — {attendanceEvent.title}
              </h3>
              <p className="text-muted" style={{ marginTop: -8, marginBottom: 12 }}>
                Only assigned athletes are listed. Team-wide events will show all team athletes.
              </p>

              {(() => {
                const assigned = Array.isArray(attendanceEvent.assignedMemberIds)
                  ? attendanceEvent.assignedMemberIds
                  : [];
                const isTeamWide = assigned.length === 0;

                // 决定展示哪些 UID：已分配 -> assigned；team-wide -> 全队员
                const listUids = isTeamWide
                  ? teamMembers.map((m) => m.id)
                  : assigned;

                if (listUids.length === 0) {
                  return (
                    <div className="text-muted" style={{ padding: 8 }}>
                      {isTeamWide
                        ? "No athletes in this team yet."
                        : "No assigned athletes for this event."}
                    </div>
                  );
                }

                return (
                  <div style={{ display: "grid", gap: 8, maxHeight: 420, overflowY: "auto" }}>
                    {listUids.map((uid) => {
                      const meta = userCacheRef.current.get(uid) || {};
                      const label = meta.name?.trim() || meta.email?.trim() || uid;
                      const value = attendanceDraft[uid] || "unknown";
                      return (
                        <div key={uid}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8
                          }}>
                          <div style={{ fontWeight: 600 }}>
                            {label} <span style={{ color: "#9ca3af", fontSize: 12 }}>({uid.slice(0, 6)}…)</span>
                          </div>
                          <select
                            value={value}
                            onChange={(e) =>
                              setAttendanceDraft((prev) => ({ ...prev, [uid]: e.target.value }))
                            }
                            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
                          >
                            {ATTENDANCE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-outline" onClick={cancelAttendance}>Cancel</button>
                <button className="btn btn-primary" onClick={saveAttendance} disabled={attendanceSaving}
                  style={{ background: "var(--brand-primary)", border: "none" }}>
                  {attendanceSaving ? "Saving..." : "Save Attendance"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== End Attendance Panel ===== */}
      </div>
    </div>
  );
}
