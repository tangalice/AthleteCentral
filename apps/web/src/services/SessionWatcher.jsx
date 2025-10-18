import { useEffect, useRef } from "react";
import { auth, db } from "../../firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";

export default function SessionWatcher() {
  const stopHeartbeatRef = useRef(null);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (stopHeartbeatRef.current) {
        clearInterval(stopHeartbeatRef.current);
        stopHeartbeatRef.current = null;
      }

      if (!user) return;

      const sessionId = localStorage.getItem("currentSessionDocId");
      if (!sessionId) return;

      const ref = doc(db, "users", user.uid, "sessions", sessionId);

      stopHeartbeatRef.current = setInterval(async () => {
        try {
          await updateDoc(ref, {
            isActive: true,
            lastActiveAt: serverTimestamp(),
          });
        } catch {}
      }, 60000);

      const unsubSession = onSnapshot(ref, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.isActive === false) {
          clearInterval(stopHeartbeatRef.current);
          stopHeartbeatRef.current = null;
          localStorage.removeItem("currentSessionDocId");
          auth.signOut();
        }
      });

      return () => {
        if (stopHeartbeatRef.current) clearInterval(stopHeartbeatRef.current);
        unsubSession && unsubSession();
      };
    });

    return () => unsubAuth();
  }, []);

  return null;
}
