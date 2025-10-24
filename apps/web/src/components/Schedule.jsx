import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore";

export default function Schedule({ userRole }) {
  const [events, setEvents] = useState([]);
  const [teamId, setTeamId] = useState(null);
  const [filter, setFilter] = useState("upcoming"); // upcoming | past | all

  useEffect(() => {
    const fetchTeam = async () => {
      if (!auth.currentUser) return;
      const teamsQuery = query(
        collection(db, "teams"),
        where(
          userRole === "coach" ? "coaches" : "athletes",
          "array-contains",
          auth.currentUser.uid
        )
      );
      const snapshot = await getDocs(teamsQuery);
      if (!snapshot.empty) {
        setTeamId(snapshot.docs[0].id);
      }
    };
    fetchTeam();
  }, [userRole]);

  useEffect(() => {
    if (!teamId) return;

    const eventsQuery = query(
      collection(db, "teams", teamId, "events"),
      orderBy("datetime", "asc")
    );
    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        datetime: doc.data().datetime?.toDate(),
      }));
      setEvents(eventData);
    });

    return () => unsubscribe();
  }, [teamId]);

  const now = new Date();
  const filteredEvents = events.filter((event) => {
    if (filter === "upcoming") return event.datetime >= now;
    if (filter === "past") return event.datetime < now;
    return true;
  });

  const formatDate = (date) =>
    date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ fontSize: 28, fontWeight: 800 }}>Team Schedule</h2>

      {/*  */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, marginBottom: 24 }}>
        {["upcoming", "past", "all"].map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            style={{
              padding: "8px 16px",
              background: filter === option ? "var(--brand-primary)" : "#e5e7eb",
              color: filter === option ? "white" : "#111827",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      {/*  */}
      {filteredEvents.length === 0 ? (
        <p>No events found.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              style={{
                padding: 16,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f9fafb",
              }}
            >
              <h3 style={{ marginBottom: 6 }}>{event.title}</h3>
              <p style={{ color: "#4b5563" }}>{formatDate(event.datetime)}</p>
              {event.description && (
                <p style={{ color: "#6b7280", marginTop: 4 }}>{event.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
