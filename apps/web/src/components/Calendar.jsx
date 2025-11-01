// src/components/Calendar.jsx
import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";

export default function Calendar({ userRole, user }) {
  const [events, setEvents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teamId, setTeamId] = useState(null);
  const [teams, setTeams] = useState([]); 

  const [formData, setFormData] = useState({
    title: "",
    date: "",
    time: "",
    description: "",
    type: "practice", // practice, game, meeting, other
  });
  const [errors, setErrors] = useState({});

  // Fetch user's team
  useEffect(() => {
    const fetchTeams = async () => {
      if (!auth.currentUser) return;
  
      try {
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
          const teamList = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || "Unnamed Team",
          }));
          setTeams(teamList);
          setTeamId(teamList[0].id); // 默认选择第一个
        }
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };
  
    fetchTeams();
  }, [userRole]);

  // Subscribe to events
  useEffect(() => {
    if (!teamId) return;

    const eventsQuery = query(
      collection(db, "teams", teamId, "events"),
      orderBy("datetime", "asc")
    );

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        datetime: doc.data().datetime?.toDate(),
      }));
      setEvents(eventsData);
    });

    return () => unsubscribe();
  }, [teamId]);

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Event title is required";
    }

    if (!formData.date) {
      newErrors.date = "Date is required";
    }

    if (!formData.time) {
      newErrors.time = "Time is required";
    }

    // Check if date is not in the past
    const eventDateTime = new Date(`${formData.date}T${formData.time}`);
    if (eventDateTime < new Date()) {
      newErrors.date = "Cannot create events in the past";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Create event
  const handleCreateEvent = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const eventDateTime = new Date(`${formData.date}T${formData.time}`);

      await addDoc(collection(db, "teams", teamId, "events"), {
        title: formData.title.trim(),
        description: formData.description.trim(),
        datetime: eventDateTime,
        type: formData.type,
        createdBy: auth.currentUser.uid,
        createdByName: user?.displayName || user?.email,
        createdAt: new Date(),
      });

      // Reset form
      setFormData({
        title: "",
        date: "",
        time: "",
        description: "",
        type: "practice",
      });
      setShowCreateForm(false);
      setErrors({});
    } catch (error) {
      console.error("Error creating event:", error);
      setErrors({ general: "Failed to create event. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  // Delete event (coach only)
  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    try {
      await deleteDoc(doc(db, "teams", teamId, "events", eventId));
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };
  // Edit event (coach only)
const handleEditEvent = async (event) => {
  const newTitle = prompt("Edit event title:", event.title);
  if (newTitle === null) return; // user cancelled

  const newDate = prompt(
    "Edit event date (YYYY-MM-DD):",
    event.datetime.toISOString().split("T")[0]
  );
  if (!newDate) return;

  const newTime = prompt(
    "Edit event time (HH:MM):",
    event.datetime.toTimeString().slice(0, 5)
  );
  if (!newTime) return;

  const newDescription = prompt(
    "Edit event description:",
    event.description || ""
  );

  try {
    const eventRef = doc(db, "teams", teamId, "events", event.id);
    const newDatetime = new Date(`${newDate}T${newTime}`);

    await updateDoc(eventRef, {
      title: newTitle.trim(),
      description: newDescription.trim(),
      datetime: newDatetime,
    });

    alert("Event updated successfully!");
  } catch (error) {
    console.error("Error updating event:", error);
    alert("Failed to update event.");
  }
};


  // Format date for display
  const formatEventDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get event type color
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

  // Filter upcoming events (next 30 days)
  const upcomingEvents = events.filter((event) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return event.datetime >= now && event.datetime <= thirtyDaysFromNow;
  });

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#111827",
                marginBottom: 8,
              }}
            >
              Team Calendar
            </h2>
            <p className="text-muted" style={{ fontSize: 16 }}>
              {userRole === "coach"
                ? "Manage your team's events and schedule"
                : "View your team's upcoming events"}
            </p>
          </div>

          {/* 🔹Team selector + Create Event button */}
          {userRole === "coach" && (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* */}
              {teams.length > 1 && (
                <div>
                  <label style={{ fontWeight: 600, marginRight: 8 }}>Select Team:</label>
                  <select
                    value={teamId || ""}
                    onChange={(e) => setTeamId(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                    }}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* */}
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateForm(!showCreateForm)}
                style={{
                  background: "var(--brand-primary)",
                  border: "none",
                  padding: "12px 24px",
                  fontWeight: 600,
                }}
              >
                {showCreateForm ? "Cancel" : "+ Create Event"}
              </button>
            </div>
          )}
        </div>

        {/* Create Event Form (Coach Only) */}
        {userRole === "coach" && showCreateForm && (
          <div
            className="card"
            style={{
              padding: 24,
              marginBottom: 32,
              border: "2px solid var(--brand-primary-50)",
              background: "#f0fdf4",
            }}
          >
            <h3
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 20,
                color: "#111827",
              }}
            >
              Create New Event
            </h3>

            <form onSubmit={handleCreateEvent}>
              <div style={{ display: "grid", gap: 16 }}>
                {/* Event Title */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 8,
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Event Title *
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.title ? "is-invalid" : ""}`}
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="e.g., Team Practice, Game vs. Rivals"
                    style={{ width: "100%" }}
                  />
                  {errors.title && (
                    <div style={{ color: "#ef4444", fontSize: 14, marginTop: 4 }}>
                      {errors.title}
                    </div>
                  )}
                </div>

                {/* Date and Time */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Date *
                    </label>
                    <input
                      type="date"
                      className={`form-control ${errors.date ? "is-invalid" : ""}`}
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      min={new Date().toISOString().split("T")[0]}
                    />
                    {errors.date && (
                      <div style={{ color: "#ef4444", fontSize: 14, marginTop: 4 }}>
                        {errors.date}
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Time *
                    </label>
                    <input
                      type="time"
                      className={`form-control ${errors.time ? "is-invalid" : ""}`}
                      value={formData.time}
                      onChange={(e) =>
                        setFormData({ ...formData, time: e.target.value })
                      }
                    />
                    {errors.time && (
                      <div style={{ color: "#ef4444", fontSize: 14, marginTop: 4 }}>
                        {errors.time}
                      </div>
                    )}
                  </div>
                </div>

                {/* Event Type */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 8,
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Event Type
                  </label>
                  <select
                    className="form-control"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                  >
                    <option value="practice">Practice</option>
                    <option value="game">Game/Competition</option>
                    <option value="meeting">Team Meeting</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 8,
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Description (Optional)
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Add any additional details about the event..."
                    style={{ width: "100%", resize: "vertical" }}
                  />
                </div>

                {/* Error message */}
                {errors.general && (
                  <div
                    style={{
                      color: "#ef4444",
                      fontSize: 14,
                      padding: "8px 12px",
                      background: "#fee2e2",
                      borderRadius: 6,
                    }}
                  >
                    {errors.general}
                  </div>
                )}

                {/* Submit Button */}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                    style={{
                      background: "var(--brand-primary)",
                      border: "none",
                      padding: "10px 24px",
                      fontWeight: 600,
                    }}
                  >
                    {loading ? "Creating..." : "Create Event"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setErrors({});
                      setFormData({
                        title: "",
                        date: "",
                        time: "",
                        description: "",
                        type: "practice",
                      });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {upcomingEvents.map((event) => (
          <div
            key={event.id}
            className="card"
            style={{
              padding: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              borderLeft: `4px solid ${getEventTypeColor(event.type)}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <h4
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#111827",
                    margin: 0,
                  }}
                >
                  {event.title}
                </h4>
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 8px",
                    background: getEventTypeColor(event.type) + "20",
                    color: getEventTypeColor(event.type),
                    borderRadius: 4,
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {event.type}
                </span>
              </div>

              <p
                style={{
                  fontSize: 15,
                  color: "#4b5563",
                  marginBottom: 4,
                }}
              >
                📅 {formatEventDate(event.datetime)}
              </p>

              {event.description && (
                <p
                  style={{
                    fontSize: 14,
                    color: "#6b7280",
                    marginTop: 8,
                  }}
                >
                  {event.description}
                </p>
              )}

              <p
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  marginTop: 8,
                }}
              >
                Created by {event.createdByName}
              </p>
            </div>

            {userRole === "coach" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => handleEditEvent(event)}
                  style={{
                    color: "#3b82f6",
                    borderColor: "#3b82f6",
                    padding: "6px 12px",
                    fontSize: 14,
                  }}
                >
                  Edit
                </button>

                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => handleDeleteEvent(event.id)}
                  style={{
                    color: "#ef4444",
                    borderColor: "#ef4444",
                    padding: "6px 12px",
                    fontSize: 14,
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}


        {/* Past Events Section (optional) */}
        {events.filter((e) => e.datetime < new Date()).length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h3
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 20,
                color: "#6b7280",
              }}
            >
              Past Events
            </h3>
            <div style={{ display: "grid", gap: 12, opacity: 0.7 }}>
              {events
                .filter((e) => e.datetime < new Date())
                .slice(-5)
                .reverse()
                .map((event) => (
                  <div
                    key={event.id}
                    className="card"
                    style={{
                      padding: 16,
                      background: "#f9fafb",
                      borderLeft: `3px solid ${getEventTypeColor(event.type)}40`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <h4
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#6b7280",
                            marginBottom: 4,
                          }}
                        >
                          {event.title}
                        </h4>
                        <p style={{ fontSize: 14, color: "#9ca3af" }}>
                          {formatEventDate(event.datetime)}
                        </p>
                      </div>
                      {userRole === "coach" && (
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDeleteEvent(event.id)}
                          style={{
                            color: "#9ca3af",
                            background: "transparent",
                            border: "none",
                            padding: "4px 8px",
                            fontSize: 12,
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}