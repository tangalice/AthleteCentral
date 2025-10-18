// src/services/SessionsService.js
import { auth, db } from "../firebase";
import {
  collection,
  setDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  getDoc,
} from "firebase/firestore";

function safeUA() {
  try { return navigator.userAgent || ""; } catch { return ""; }
}
function safePlatform() {
  try { return navigator.userAgentData?.platform || navigator.platform || ""; } catch { return ""; }
}

function getBrowserName() {
  const ua = safeUA();
  try {
    if (/Edg\//.test(ua)) return "Edge";
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
    if (/Firefox\//.test(ua)) return "Firefox";
    return "Unknown";
  } catch { return "Unknown"; }
}
function getOS() {
  const plat = safePlatform().toLowerCase();
  try {
    if (plat.includes("win")) return "Windows";
    if (plat.includes("mac")) return "macOS";
    if (plat.includes("iphone") || plat.includes("ipad") || plat.includes("ios")) return "iOS";
    if (plat.includes("android")) return "Android";
    if (plat) return plat;
    const ua = safeUA().toLowerCase();
    if (ua.includes("android")) return "Android";
    if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
    if (ua.includes("mac")) return "macOS";
    if (ua.includes("win")) return "Windows";
    return "Other";
  } catch { return "Other"; }
}
function getDeviceType() {
  const ua = safeUA().toLowerCase();
  try {
    if (/mobile|iphone|ipod|android.+mobile/.test(ua)) return "Mobile";
    if (/ipad|tablet|android(?!.*mobile)/.test(ua)) return "Tablet";
    return "Desktop";
  } catch { return "Desktop"; }
}
function getDeviceName() {
  return `${getBrowserName()} on ${getOS()}`;
}

function getStableSessionDocId() {
  return `${getOS()}::${getBrowserName()}::${getDeviceType()}`; // e.g. "macOS::Chrome::Desktop"
}

/* --------------------  -------------------- */
const LS_KEY = "currentSessionId";
function setCurrentSessionId(id) {
  try { localStorage.setItem(LS_KEY, id); } catch {}
}
function getCurrentSessionId() {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}
function clearCurrentSession() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

/* --------------------  -------------------- */
async function withRetry(fn, { retries = 3, baseDelay = 200 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i === retries) break;
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

/* ============================ Public API ============================ */


async function createSession(uid, email) {
  const sessionId = getStableSessionDocId();
  const ref = doc(db, "users", uid, "sessions", sessionId);

 
  const snap = await withRetry(() => getDoc(ref), { retries: 1 });

  if (!snap.exists()) {

    const payload = {
      sessionId,
      userId: uid,
      userEmail: email || null,
      deviceName: getDeviceName(),
      browser: getBrowserName(),
      os: getOS(),
      deviceType: getDeviceType(),
      userAgent: safeUA().slice(0, 200),
      isActive: true,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      // terminatedAt: 
    };
    await withRetry(() => setDoc(ref, payload, { merge: false }));
  } else {

    await withRetry(() =>
      updateDoc(ref, {
        isActive: true,
        lastActiveAt: serverTimestamp(),
        terminatedAt: null,
      })
    );
  }

  setCurrentSessionId(sessionId);
  return sessionId;
}


async function isSessionValid(sessionId) {
  const u = auth.currentUser;
  if (!u) return false;
  const id = sessionId || getCurrentSessionId() || getStableSessionDocId();
  const ref = doc(db, "users", u.uid, "sessions", id);
  const snap = await withRetry(() => getDoc(ref), { retries: 1 });
  return snap.exists() && !!snap.data()?.isActive;
}


async function updateSessionActivity(sessionId) {
  const u = auth.currentUser;
  if (!u) return;
  const id = sessionId || getCurrentSessionId() || getStableSessionDocId();
  const ref = doc(db, "users", u.uid, "sessions", id);
  await withRetry(() =>
    updateDoc(ref, { isActive: true, lastActiveAt: serverTimestamp() })
  );
}


async function logoutSession(sessionId) {
  const u = auth.currentUser;
  if (!u || !sessionId) return;
  const ref = doc(db, "users", u.uid, "sessions", sessionId);
  await withRetry(() =>
    updateDoc(ref, { isActive: false, terminatedAt: serverTimestamp() })
  );
  if (sessionId === getCurrentSessionId()) clearCurrentSession();
}


async function logoutAllSessions(uid, keepCurrent = false) {
  const colRef = collection(db, "users", uid, "sessions");
  const qRef = query(colRef, orderBy("lastActiveAt", "desc"));
  const snap = await withRetry(() => getDocs(qRef));

  const currentId = getCurrentSessionId();
  const tasks = [];
  snap.forEach((d) => {
    const id = d.id;
    if (keepCurrent && id === currentId) return;
    tasks.push(updateDoc(d.ref, { isActive: false, terminatedAt: serverTimestamp() }));
  });
  await Promise.allSettled(tasks);
  if (!keepCurrent) clearCurrentSession();
}


async function getUserSessions(uid) {
  const colRef = collection(db, "users", uid, "sessions");
  const qRef = query(colRef, orderBy("lastActiveAt", "desc"));
  const snap = await withRetry(() => getDocs(qRef), { retries: 1 });

  const currentId = getCurrentSessionId();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.isActive)
    .map((s) => ({
      ...s,
      isCurrentSession: s.id === currentId || s.sessionId === currentId,
    }));
}


function formatLastActive(ts) {
  try {
    const date =
      ts?.toDate?.() ||
      (typeof ts?.seconds === "number" ? new Date(ts.seconds * 1000) : null);
    if (!date) return "—";
    const diffMs = Date.now() - date.getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "Active now";
    if (min < 60) return `${min} min${min > 1 ? "s" : ""} ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr${hr > 1 ? "s" : ""} ago`;
    return date.toLocaleString();
  } catch { return "—"; }
}

export default {
  createSession,
  isSessionValid,
  updateSessionActivity,
  getUserSessions,
  logoutSession,
  logoutAllSessions,
  getCurrentSessionId,
  clearCurrentSession,
  formatLastActive,
};
