import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

export default function PracticePerformances({ user }) {
  const [practices, setPractices] = useState([]);
  const [date, setDate] = useState("");
  const [intensity, setIntensity] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIntensity, setSelectedIntensity] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [loading, setLoading] = useState(true);

  // Realtime listener for user's practice entries
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "users", user.uid, "practices"),
      orderBy("date", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPractices(list);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Add new practice entry
  const handleAddPractice = async (e) => {
    e.preventDefault();
    if (!date || !intensity || !description) return;

    try {
      const newPractice = {
        date: new Date(date),
        intensity,
        description,
        athleteName: user.displayName || user.email,
        athleteId: user.uid,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "users", user.uid, "practices"), newPractice);
      
      // Clear form
      setDate("");
      setIntensity("");
      setDescription("");
    } catch (err) {
      console.error("Error adding practice:", err);
      alert("Could not add practice entry.");
    }
  };

  // Delete practice entry
  const handleDelete = async (practiceId) => {
    if (!window.confirm("Delete this practice entry?")) return;
    
    try {
      const ref = doc(db, "users", user.uid, "practices", practiceId);
      await deleteDoc(ref);
    } catch (err) {
      console.error("Error deleting practice:", err);
      alert("Could not delete practice entry.");
    }
  };

  // Filter practices
  const filteredPractices = practices.filter(practice => {
    if (selectedIntensity !== "all" && practice.intensity !== selectedIntensity) {
      return false;
    }
    
    if (selectedMonth !== "all") {
      const practiceDate = practice.date.toDate ? practice.date.toDate() : new Date(practice.date);
      const practiceMonth = practiceDate.getMonth();
      if (practiceMonth !== parseInt(selectedMonth)) {
        return false;
      }
    }
    
    return true;
  });

  const formatDate = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getIntensityColor = (intensity) => {
    switch (intensity) {
      case "Low":
        return "#10b981"; // Green
      case "Medium":
        return "#f59e0b"; // Orange
      case "High":
        return "#ef4444"; // Red
      case "Very High":
        return "#dc2626"; // Dark Red
      default:
        return "#6b7280";
    }
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      {/* Page Header */}
      <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Practice Log
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
        Log your practice sessions. Only you and your coaches can see these entries.
      </p>

      {/* Add Practice Form */}
      <form
        onSubmit={handleAddPractice}
        style={{
          marginBottom: "30px",
          padding: "24px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
      >
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#111827" }}>
          Add New Practice
        </h3>
        
        <div style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={{ 
              display: "block", 
              marginBottom: "6px", 
              fontWeight: "500",
              color: "#374151",
              fontSize: "14px"
            }}>
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                backgroundColor: "#fff",
                color: "#111827",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ 
              display: "block", 
              marginBottom: "6px", 
              fontWeight: "500",
              color: "#374151",
              fontSize: "14px"
            }}>
              Intensity
            </label>
            <select
              value={intensity}
              onChange={(e) => setIntensity(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                backgroundColor: "#fff",
                color: "#111827",
                fontSize: "14px",
                outline: "none",
              }}
            >
              <option value="">Select intensity level</option>
              <option value="Low">Low - Easy/Recovery</option>
              <option value="Medium">Medium - Moderate</option>
              <option value="High">High - Hard Training</option>
              <option value="Very High">Very High - Maximum Effort</option>
            </select>
          </div>

          <div>
            <label style={{ 
              display: "block", 
              marginBottom: "6px", 
              fontWeight: "500",
              color: "#374151",
              fontSize: "14px"
            }}>
              Practice Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you worked on during practice (drills, exercises, focus areas, how you felt, etc.)"
              required
              rows={5}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                backgroundColor: "#fff",
                color: "#111827",
                fontSize: "14px",
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: "600",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.background = "#059669"}
            onMouseLeave={(e) => e.target.style.background = "#10b981"}
          >
            Add Practice Entry
          </button>
        </div>
      </form>

      {/* Filters */}
      <div style={{
        display: "flex",
        gap: "16px",
        marginBottom: "30px",
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
      }}>
        <div style={{ flex: "1" }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "500",
            color: "#374151",
            fontSize: "14px"
          }}>
            Filter by Intensity
          </label>
          <select
            value={selectedIntensity}
            onChange={(e) => setSelectedIntensity(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#111827",
              fontSize: "14px",
              outline: "none",
            }}
          >
            <option value="all">All Intensities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Very High">Very High</option>
          </select>
        </div>

        <div style={{ flex: "1" }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "500",
            color: "#374151",
            fontSize: "14px"
          }}>
            Filter by Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#111827",
              fontSize: "14px",
              outline: "none",
            }}
          >
            <option value="all">All Months</option>
            <option value="0">January</option>
            <option value="1">February</option>
            <option value="2">March</option>
            <option value="3">April</option>
            <option value="4">May</option>
            <option value="5">June</option>
            <option value="6">July</option>
            <option value="7">August</option>
            <option value="8">September</option>
            <option value="9">October</option>
            <option value="10">November</option>
            <option value="11">December</option>
          </select>
        </div>
      </div>

      {/* Practice History */}
      <div>
        <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
          Practice History
        </h3>
        
        {loading ? (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
          }}>
            <p style={{ color: "#6b7280", fontSize: "15px" }}>Loading practices...</p>
          </div>
        ) : filteredPractices.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
          }}>
            <p style={{ color: "#111827", fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
              No practice entries found
            </p>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
              Add your first practice above!
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {filteredPractices.map((practice) => (
              <div
                key={practice.id}
                style={{
                  padding: "20px",
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderLeft: `4px solid ${getIntensityColor(practice.intensity)}`,
                  borderRadius: "12px",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  position: "relative"
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "12px"
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                        {formatDate(practice.date)}
                      </h3>
                      <span style={{
                        padding: "4px 12px",
                        backgroundColor: getIntensityColor(practice.intensity),
                        color: "white",
                        borderRadius: "16px",
                        fontWeight: "600",
                        fontSize: "12px"
                      }}>
                        {practice.intensity}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(practice.id)}
                    title="Delete practice entry"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#9ca3af",
                      cursor: "pointer",
                      fontSize: "18px",
                      padding: "0 5px",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) => e.target.style.color = "#ef4444"}
                    onMouseLeave={(e) => e.target.style.color = "#9ca3af"}
                  >
                    ✖
                  </button>
                </div>

                <div style={{
                  marginTop: "12px",
                  padding: "14px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb"
                }}>
                  <p style={{ 
                    margin: 0, 
                    fontSize: "14px", 
                    color: "#374151",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap"
                  }}>
                    {practice.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

)}