// src/components/settings/SessionsManager.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import SessionsService from "../../services/SessionsService";

export default function SessionsManager() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyOne, setBusyOne] = useState(null); 
  const [busyAll, setBusyAll] = useState(false);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const qRef = query(
      collection(db, "users", uid, "sessions"),
      orderBy("lastActiveAt", "desc")
    );

    unsubRef.current = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRows(list);
        setLoading(false);
        setErr("");
      },
      (e) => {
        console.error("onSnapshot error:", e);
        setErr("Failed to load sessions.");
        setLoading(false);
      }
    );

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, []);

  const getLastActiveDate = (s) => {
    const ts = s?.lastActiveAt || s?.createdAt;
    if (!ts) return null;
    return ts?.toDate?.() || (typeof ts?.seconds === "number" ? new Date(ts.seconds * 1000) : null);
  };

  const sessions = useMemo(() => {
    const seen = new Set(); // key = os|browser|deviceType
    const currentId = SessionsService.getCurrentSessionId?.() || localStorage.getItem("currentSessionId");
    const out = [];

    for (const s of rows) {
      if (!s?.isActive) continue;
      const key = `${s?.os || ""}|${s?.browser || ""}|${s?.deviceType || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        ...s,
        isCurrentSession: s?.id === currentId || s?.sessionId === currentId,
        deviceName: s?.deviceName || `${s?.browser || "Browser"} on ${s?.os || "OS"}`,
        _lastActiveDate: getLastActiveDate(s),
      });
    }
    return out;
  }, [rows]);

  const fmtLastActive = (s) => {
    if (s?.lastActiveAt) return SessionsService.formatLastActive?.(s.lastActiveAt);
    if (s?._lastActiveDate) return s._lastActiveDate.toLocaleString?.() || "—";
    return "—";
  };

  const getDeviceIcon = (deviceType) => {
    const color = "#6b7280";
    if (deviceType === "Mobile" || deviceType === "Phone") {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="2" width="14" height="20" rx="2" stroke={color} strokeWidth="2"/>
          <circle cx="12" cy="18" r="1" fill={color}/>
        </svg>
      );
    }
    if (deviceType === "Tablet") {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="2"/>
          <circle cx="12" cy="18" r="1" fill={color}/>
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="3" width="20" height="14" rx="2" stroke={color} strokeWidth="2"/>
        <path d="M8 21h8" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <path d="M12 17v4" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  };

  const handleLogoutOne = async (sessionId, name) => {
    if (busyAll || busyOne) return;
    setBusyOne(sessionId);
    setErr("");
    try {
      await SessionsService.logoutSession(sessionId);
      if (sessionId === (SessionsService.getCurrentSessionId?.() || localStorage.getItem("currentSessionId"))) {
      } else {
        setMessage(`Signed out: ${name || "device"}`);
        setTimeout(() => setMessage(""), 2500);
      }
    } catch (e) {
      console.error("logout one error:", e);
      setErr("Failed to sign out this session.");
    } finally {
      setBusyOne(null);
    }
  };

  const handleLogoutAll = async () => {
    if (busyAll || busyOne) return;
    if (!auth.currentUser) return;

    if (!window.confirm("Sign out of all sessions? This will log you out on every device.")) {
      return;
    }

    setBusyAll(true);
    setErr("");
    try {
      await SessionsService.logoutAllSessions(auth.currentUser.uid, false);
    } catch (e) {
      console.error("logout all error:", e);
      setErr("Failed to sign out all sessions.");
    } finally {
      setBusyAll(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 20, textAlign: "center" }}>
        <p>Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
      <Link to="/settings" className="text-primary" style={{ display: "inline-block", marginBottom: 16 }}>
        ← Back to Settings
      </Link>

      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2 className="mb-2">Active Sessions</h2>
        <p className="text-muted mb-3">
          Manage where your account is signed in. You can sign out individual devices or all sessions.
        </p>

        {message && (
          <div className="alert alert-success" role="status" style={{ marginBottom: 12 }}>
            {message}
          </div>
        )}
        {err && (
          <div className="alert alert-error" role="status" style={{ marginBottom: 12 }}>
            {err}
          </div>
        )}

        {sessions.length > 0 ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {sessions.map((s) => {
                const isThis = s.isCurrentSession;
                const isBusy = busyOne === s.id;
                return (
                  <div
                    key={s.id}
                    className="card"
                    style={{
                      padding: 16,
                      margin: 0,
                      border: isThis ? "2px solid #10b981" : "1px solid var(--border)",
                      background: isThis ? "#ecfdf5" : "white",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", gap: 12, flex: 1 }}>
                        <div style={{ color: isThis ? "#10b981" : "#6b7280", marginTop: 2 }}>
                          {getDeviceIcon(s.deviceType)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4, wordBreak: "break-word" }}>
                            {s.deviceName}
                            {isThis && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontSize: 12,
                                  color: "#10b981",
                                  background: "#ecfdf5",
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  fontWeight: 500,
                                }}
                              >
                                This device
                              </span>
                            )}
                          </div>
                          <div className="text-muted" style={{ fontSize: 14, marginBottom: 2 }}>
                            Last active: {fmtLastActive(s)}
                          </div>
                          {s.ipAddress && (
                            <div className="text-muted" style={{ fontSize: 12, wordBreak: "break-word" }}>
                              IP: {s.ipAddress}
                            </div>
                          )}
                        </div>
                      </div>

                      {!isThis && (
                        <button
                          className="btn btn-outline"
                          onClick={() => handleLogoutOne(s.id, s.deviceName)}
                          disabled={isBusy || busyAll}
                          style={{ minWidth: 96, opacity: isBusy || busyAll ? 0.6 : 1 }}
                          title={isBusy ? "Processing..." : "Sign out"}
                        >
                          {isBusy ? "..." : "Sign out"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="btn btn-danger"
                onClick={handleLogoutAll}
                disabled={busyAll || !!busyOne}
                style={{ flex: 1, opacity: busyAll || !!busyOne ? 0.7 : 1 }}
                title={busyAll ? "Processing..." : "Sign out of all sessions"}
              >
                {busyAll ? "Signing out..." : "Sign out all sessions"}
              </button>
            </div>
          </>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <div className="text-muted">No active sessions found</div>
          </div>
        )}
      </div>
    </div>
  );
}
