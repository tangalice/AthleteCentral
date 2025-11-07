/**
 * @file SplitCalculator.jsx
 * @description Split calculator for rowers - Story #33
 * Calculate splits, predict times, and set goals
 */

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

export default function SplitCalculator({ user, userRole, userSport }) {
  const [activeTab, setActiveTab] = useState("view-splits"); // view-splits, time-from-split, split-from-time
  const [testPerformances, setTestPerformances] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Time from Split calculator
  const [selectedDistance, setSelectedDistance] = useState("2000");
  const [targetSplit, setTargetSplit] = useState("");
  const [predictedTime, setPredictedTime] = useState(null);
  
  // Split from Time calculator
  const [goalDistance, setGoalDistance] = useState("2000");
  const [goalTime, setGoalTime] = useState("");
  const [neededSplit, setNeededSplit] = useState(null);
  const [saveGoal, setSaveGoal] = useState(false);

  const DISTANCES = [
    { value: "500", label: "500m" },
    { value: "2000", label: "2k" },
    { value: "5000", label: "5k" },
    { value: "6000", label: "6k" },
    { value: "10000", label: "10k" },
  ];

  // Load user's test performances
  useEffect(() => {
    if (!user) return;

    const loadPerformances = async () => {
      setLoading(true);
      try {
        const performancesQuery = query(
          collection(db, "users", user.uid, "testPerformances"),
          orderBy("date", "desc")
        );
        
        const snapshot = await getDocs(performancesQuery);
        const performances = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        
        setTestPerformances(performances);
      } catch (err) {
        console.error("Error loading performances:", err);
        setTestPerformances([]);
      } finally {
        setLoading(false);
      }
    };

    loadPerformances();
  }, [user]);

  // Calculate /500m split from total time and distance
  const calculateSplit = (totalSeconds, distanceMeters) => {
    if (!totalSeconds || !distanceMeters) return null;
    const splitSeconds = (totalSeconds / distanceMeters) * 500;
    return splitSeconds;
  };

  // Format seconds to MM:SS.D
  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  // Parse time string MM:SS.D to seconds
  const parseTimeToSeconds = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(":");
    if (parts.length !== 2) return null;
    const mins = parseInt(parts[0]);
    const secs = parseFloat(parts[1]);
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs;
  };

  // Calculate performances with splits
  const performancesWithSplits = testPerformances.map(perf => {
    // Extract distance from test type (e.g., "2k" -> 2000)
    let distance = null;
    if (perf.testType) {
      const match = perf.testType.match(/(\d+)k?/i);
      if (match) {
        distance = parseInt(match[1]);
        // If it's in format like "2k", multiply by 1000
        if (perf.testType.toLowerCase().includes('k')) {
          distance *= 1000;
        }
      }
    }
    
    const split = distance ? calculateSplit(perf.time, distance) : null;
    
    return {
      ...perf,
      distance,
      split
    };
  }).filter(p => p.split !== null);

  // Calculate predicted time from split
  const handleCalculateTime = () => {
    const splitSeconds = parseTimeToSeconds(targetSplit);
    if (!splitSeconds || !selectedDistance) {
      alert("Please enter a valid split time (MM:SS.D)");
      return;
    }
    
    const distance = parseInt(selectedDistance);
    const totalSeconds = (splitSeconds / 500) * distance;
    setPredictedTime(totalSeconds);
  };

  // Calculate needed split from goal time
  const handleCalculateSplit = async () => {
    const timeSeconds = parseTimeToSeconds(goalTime);
    if (!timeSeconds || !goalDistance) {
      alert("Please enter a valid goal time (MM:SS.D)");
      return;
    }
    
    const distance = parseInt(goalDistance);
    const splitSeconds = (timeSeconds / distance) * 500;
    setNeededSplit(splitSeconds);

    // Save goal if checkbox is checked
    if (saveGoal) {
      try {
        await addDoc(collection(db, "users", user.uid, "goals"), {
          type: "split-goal",
          distance: parseInt(goalDistance),
          goalTime: timeSeconds,
          neededSplit: splitSeconds,
          createdAt: serverTimestamp(),
          sharedWithCoach: true
        });
        alert("Goal saved and shared with coach!");
      } catch (err) {
        console.error("Error saving goal:", err);
        alert("Error saving goal");
      }
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Header */}
      <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Split Calculator
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
        Calculate splits, predict times, and set performance goals.
      </p>

      {/* Tabs */}
      <div style={{ 
        display: "flex", 
        gap: "8px", 
        marginBottom: "24px",
        borderBottom: "2px solid #e5e7eb"
      }}>
        <button
          onClick={() => setActiveTab("view-splits")}
          style={{
            padding: "12px 24px",
            backgroundColor: activeTab === "view-splits" ? "#3b82f6" : "transparent",
            color: activeTab === "view-splits" ? "#fff" : "#6b7280",
            border: "none",
            borderBottom: activeTab === "view-splits" ? "2px solid #3b82f6" : "none",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
            marginBottom: "-2px"
          }}
        >
          My Splits
        </button>
        <button
          onClick={() => setActiveTab("time-from-split")}
          style={{
            padding: "12px 24px",
            backgroundColor: activeTab === "time-from-split" ? "#3b82f6" : "transparent",
            color: activeTab === "time-from-split" ? "#fff" : "#6b7280",
            border: "none",
            borderBottom: activeTab === "time-from-split" ? "2px solid #3b82f6" : "none",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
            marginBottom: "-2px"
          }}
        >
          Time from Split
        </button>
        <button
          onClick={() => setActiveTab("split-from-time")}
          style={{
            padding: "12px 24px",
            backgroundColor: activeTab === "split-from-time" ? "#3b82f6" : "transparent",
            color: activeTab === "split-from-time" ? "#fff" : "#6b7280",
            border: "none",
            borderBottom: activeTab === "split-from-time" ? "2px solid #3b82f6" : "none",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
            marginBottom: "-2px"
          }}
        >
          Split from Goal
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "view-splits" && (
        <div>
          <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
            Your Average /500m Splits
          </h3>
          
          {loading ? (
            <div style={{
              textAlign: "center",
              padding: "48px 24px",
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
            }}>
              <p style={{ color: "#6b7280", fontSize: "15px" }}>Loading splits...</p>
            </div>
          ) : performancesWithSplits.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "48px 24px",
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
            }}>
              <p style={{ color: "#111827", fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
                No test results found
              </p>
              <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                Complete some test pieces to see your splits here.
              </p>
            </div>
          ) : (
            <div style={{ 
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              overflow: "hidden"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Test Type
                    </th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Total Time
                    </th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      /500m Split
                    </th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {performancesWithSplits.map((perf, index) => (
                    <tr 
                      key={perf.id} 
                      style={{ 
                        borderBottom: index < performancesWithSplits.length - 1 ? "1px solid #e5e7eb" : "none",
                      }}
                    >
                      <td style={{ padding: "16px" }}>
                        <span style={{
                          padding: "4px 12px",
                          backgroundColor: "#e0f2fe",
                          color: "#0369a1",
                          borderRadius: "16px",
                          fontSize: "13px",
                          fontWeight: "600"
                        }}>
                          {perf.testType}
                        </span>
                      </td>
                      <td style={{ padding: "16px", fontSize: "16px", fontWeight: "600", color: "#111827", fontFamily: "monospace" }}>
                        {formatTime(perf.time)}
                      </td>
                      <td style={{ padding: "16px", fontSize: "18px", fontWeight: "700", color: "#10b981", fontFamily: "monospace" }}>
                        {formatTime(perf.split)}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                        {perf.date?.toDate ? perf.date.toDate().toLocaleDateString() : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "time-from-split" && (
        <div style={{
          backgroundColor: "#fff",
          padding: "32px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb"
        }}>
          <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px", color: "#111827" }}>
            Calculate Time from Split
          </h3>
          <p style={{ color: "#6b7280", marginBottom: "24px", fontSize: "14px" }}>
            Enter your target /500m split to see how long it will take to complete a distance.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                Distance
              </label>
              <select
                value={selectedDistance}
                onChange={(e) => setSelectedDistance(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              >
                {DISTANCES.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                Target Split (MM:SS.D)
              </label>
              <input
                type="text"
                placeholder="1:45.0"
                value={targetSplit}
                onChange={(e) => setTargetSplit(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>

          <button
            onClick={handleCalculateTime}
            style={{
              padding: "12px 24px",
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              marginBottom: "24px"
            }}
          >
            Calculate
          </button>

          {predictedTime !== null && (
            <div style={{
              padding: "24px",
              backgroundColor: "#f0fdf4",
              borderRadius: "12px",
              border: "2px solid #10b981"
            }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#047857", fontWeight: "500" }}>
                Predicted Time
              </p>
              <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: "#047857", fontFamily: "monospace" }}>
                {formatTime(predictedTime)}
              </p>
              <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#047857" }}>
                for {DISTANCES.find(d => d.value === selectedDistance)?.label} at {targetSplit}/500m
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "split-from-time" && (
        <div style={{
          backgroundColor: "#fff",
          padding: "32px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb"
        }}>
          <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px", color: "#111827" }}>
            Calculate Split from Goal Time
          </h3>
          <p style={{ color: "#6b7280", marginBottom: "24px", fontSize: "14px" }}>
            Enter your goal time to see what /500m split you need to maintain.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                Distance
              </label>
              <select
                value={goalDistance}
                onChange={(e) => setGoalDistance(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              >
                {DISTANCES.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#374151", fontSize: "14px" }}>
                Goal Time (MM:SS.D)
              </label>
              <input
                type="text"
                placeholder="7:00.0"
                value={goalTime}
                onChange={(e) => setGoalTime(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={saveGoal}
                onChange={(e) => setSaveGoal(e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              <span style={{ fontSize: "14px", color: "#374151" }}>
                Save this goal and share with my coach
              </span>
            </label>
          </div>

          <button
            onClick={handleCalculateSplit}
            style={{
              padding: "12px 24px",
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              marginBottom: "24px"
            }}
          >
            Calculate
          </button>

          {neededSplit !== null && (
            <div style={{
              padding: "24px",
              backgroundColor: "#fef3c7",
              borderRadius: "12px",
              border: "2px solid #f59e0b"
            }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#92400e", fontWeight: "500" }}>
                Target Split
              </p>
              <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: "#92400e", fontFamily: "monospace" }}>
                {formatTime(neededSplit)}/500m
              </p>
              <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#92400e" }}>
                to achieve {goalTime} for {DISTANCES.find(d => d.value === goalDistance)?.label}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}