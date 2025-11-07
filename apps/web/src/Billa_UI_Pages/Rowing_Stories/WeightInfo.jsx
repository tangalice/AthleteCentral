import React, { useState, useEffect } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";

function WeightInfo({ user }) {
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [weightHistory, setWeightHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // Subscribe to weight data
    const q = query(
      collection(db, "users", user.uid, "weightData"),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const weights = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setWeightHistory(weights);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching weight data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleAddWeight = async (e) => {
    e.preventDefault();
    
    if (!weight || !date) {
      alert("Please enter both weight and date");
      return;
    }

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      alert("Please enter a valid weight");
      return;
    }

    try {
      await addDoc(collection(db, "users", user.uid, "weightData"), {
        weight: weightNum,
        date: date,
        athleteId: user.uid,
        athleteName: user.displayName || user.name || "Unknown",
        createdAt: new Date(),
      });
      
      setWeight("");
      setDate(new Date().toISOString().split('T')[0]);
      alert("Weight recorded successfully!");
    } catch (error) {
      console.error("Error adding weight:", error);
      alert("Error recording weight: " + error.message);
    }
  };

  const handleDelete = async (weightId) => {
    if (!window.confirm("Are you sure you want to delete this weight entry?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", user.uid, "weightData", weightId));
    } catch (error) {
      console.error("Error deleting weight:", error);
      alert("Error deleting weight: " + error.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading weight data...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ 
        fontSize: "28px", 
        fontWeight: "bold", 
        marginBottom: "20px",
        color: "#1f2937"
      }}>
        Weight Tracking
      </h1>

      {/* Add Weight Form */}
      <div style={{
        backgroundColor: "white",
        padding: "24px",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        marginBottom: "24px",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
      }}>
        <h2 style={{
          fontSize: "20px",
          fontWeight: "600",
          marginBottom: "16px",
          color: "#374151"
        }}>
          Record Weight
        </h2>
        
        <form onSubmit={handleAddWeight}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "500",
              marginBottom: "8px",
              color: "#374151"
            }}>
              Weight (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Enter weight in kg"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
                outline: "none"
              }}
              onFocus={(e) => e.target.style.borderColor = "#10b981"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "500",
              marginBottom: "8px",
              color: "#374151"
            }}>
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
                outline: "none"
              }}
              onFocus={(e) => e.target.style.borderColor = "#10b981"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
          </div>

          <button
            type="submit"
            style={{
              backgroundColor: "#10b981",
              color: "white",
              padding: "10px 20px",
              borderRadius: "6px",
              border: "none",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              width: "100%"
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = "#059669"}
            onMouseOut={(e) => e.target.style.backgroundColor = "#10b981"}
          >
            Add Weight Entry
          </button>
        </form>
      </div>

      {/* Weight History */}
      <div style={{
        backgroundColor: "white",
        padding: "24px",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
      }}>
        <h2 style={{
          fontSize: "20px",
          fontWeight: "600",
          marginBottom: "16px",
          color: "#374151"
        }}>
          Weight History
        </h2>

        {weightHistory.length === 0 ? (
          <p style={{ 
            textAlign: "center", 
            color: "#6b7280", 
            padding: "20px" 
          }}>
            No weight entries yet. Add your first entry above!
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse"
            }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{
                    padding: "12px",
                    textAlign: "left",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#374151"
                  }}>
                    Date
                  </th>
                  <th style={{
                    padding: "12px",
                    textAlign: "left",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#374151"
                  }}>
                    Weight (kg)
                  </th>
                  <th style={{
                    padding: "12px",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#374151"
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {weightHistory.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{
                      padding: "12px",
                      fontSize: "14px",
                      color: "#374151"
                    }}>
                      {new Date(entry.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td style={{
                      padding: "12px",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#374151"
                    }}>
                      {entry.weight.toFixed(1)} kg
                    </td>
                    <td style={{
                      padding: "12px",
                      textAlign: "center"
                    }}>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        style={{
                          backgroundColor: "#ef4444",
                          color: "white",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          border: "none",
                          fontSize: "12px",
                          fontWeight: "500",
                          cursor: "pointer"
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = "#dc2626"}
                        onMouseOut={(e) => e.target.style.backgroundColor = "#ef4444"}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Privacy Note */}
      <div style={{
        marginTop: "16px",
        padding: "12px",
        backgroundColor: "#f0fdf4",
        border: "1px solid #bbf7d0",
        borderRadius: "6px",
        fontSize: "13px",
        color: "#166534"
      }}>
        <strong></strong> Your weight data is only visible to you and your coach.
      </div>
    </div>
  );
}

export default WeightInfo;