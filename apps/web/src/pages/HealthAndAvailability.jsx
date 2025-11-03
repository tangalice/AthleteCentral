// src/pages/HealthAndAvailability.jsx
import { useState, useMemo } from "react";

export default function HealthAndAvailability() {
  const [searchTerm, setSearchTerm] = useState("");
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Mock data - will be replaced with backend connection later
  // Using useMemo to generate dates dynamically
  const mockAthletes = useMemo(() => {
    const baseDate = new Date();
    const getDateStr = (daysFromToday) => {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + daysFromToday);
      return date.toISOString().split('T')[0];
    };
    
    return [
    {
      id: "1",
      name: "Alice Tang",
      email: "alice@example.com",
      healthStatus: "Healthy",
      availability: {
        [getDateStr(0)]: "Available",
        [getDateStr(1)]: "Unavailable",
        [getDateStr(2)]: "Available",
        [getDateStr(3)]: "Available",
        [getDateStr(4)]: "Partially Available",
        [getDateStr(5)]: "Available",
        [getDateStr(6)]: "Available",
      }
    },
    {
      id: "2",
      name: "Jane Billa",
      email: "jane@example.com",
      healthStatus: "Injured",
      availability: {
        [getDateStr(0)]: "Unavailable",
        [getDateStr(1)]: "Unavailable",
        [getDateStr(2)]: "Unavailable",
        [getDateStr(3)]: "Partially Available",
        [getDateStr(4)]: "Partially Available",
        [getDateStr(5)]: "Available",
        [getDateStr(6)]: "Available",
      }
    },
    {
      id: "3",
      name: "John Smith",
      email: "john@example.com",
      healthStatus: "Healthy",
      availability: {
        [getDateStr(0)]: "Available",
        [getDateStr(1)]: "Available",
        [getDateStr(2)]: "Available",
        [getDateStr(3)]: "Available",
        [getDateStr(4)]: "Unavailable",
        [getDateStr(5)]: "Available",
        [getDateStr(6)]: "Available",
      }
    },
    {
      id: "4",
      name: "Emily Johnson",
      email: "emily@example.com",
      healthStatus: "Recovering",
      availability: {
        [getDateStr(0)]: "Partially Available",
        [getDateStr(1)]: "Partially Available",
        [getDateStr(2)]: "Available",
        [getDateStr(3)]: "Available",
        [getDateStr(4)]: "Available",
        [getDateStr(5)]: "Available",
        [getDateStr(6)]: "Available",
      }
    },
    {
      id: "5",
      name: "Michael Chen",
      email: "michael@example.com",
      healthStatus: "Healthy",
      availability: {
        [getDateStr(0)]: "Available",
        [getDateStr(1)]: "Unavailable",
        [getDateStr(2)]: "Available",
        [getDateStr(3)]: "Available",
        [getDateStr(4)]: "Available",
        [getDateStr(5)]: "Available",
        [getDateStr(6)]: "Unavailable",
      }
    },
    ];
  }, []);

  // Filter athletes based on search term
  const filteredAthletes = useMemo(() => {
    if (!searchTerm.trim()) return mockAthletes;
    const lowerSearch = searchTerm.toLowerCase();
    return mockAthletes.filter(athlete =>
      athlete.name.toLowerCase().includes(lowerSearch) ||
      athlete.email.toLowerCase().includes(lowerSearch)
    );
  }, [searchTerm]);

  // Get availability for selected date
  const athletesForDate = useMemo(() => {
    return filteredAthletes.filter(athlete =>
      athlete.availability[selectedDate] &&
      athlete.availability[selectedDate] !== "Unavailable"
    );
  }, [filteredAthletes, selectedDate]);

  // Calculate availability stats per day (next 7 days)
  const availabilityStats = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      let available = 0;
      let partiallyAvailable = 0;
      let unavailable = 0;

      mockAthletes.forEach(athlete => {
        const status = athlete.availability[dateStr];
        if (status === "Available") available++;
        else if (status === "Partially Available") partiallyAvailable++;
        else unavailable++;
      });

      days.push({
        date: dateStr,
        dateObj: date,
        available,
        partiallyAvailable,
        unavailable,
        total: mockAthletes.length,
      });
    }

    return days.sort((a, b) => b.available - a.available);
  }, []);

  const getHealthStatusColor = (status) => {
    switch (status) {
      case "Healthy":
        return "#10b981"; // green
      case "Injured":
        return "#ef4444"; // red
      case "Recovering":
        return "#f59e0b"; // amber
      default:
        return "#6b7280"; // gray
    }
  };

  const getAvailabilityColor = (status) => {
    switch (status) {
      case "Available":
        return "#10b981"; // green
      case "Partially Available":
        return "#f59e0b"; // amber
      case "Unavailable":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  };

  // Generate next 7 days for date selector
  const getNext7Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      });
    }
    return days;
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px", color: "#111827" }}>
        Health and Availability
      </h1>
      <p style={{ fontSize: "16px", color: "#6b7280", marginBottom: "24px" }}>
        View health status and availability of all athletes
      </p>

      {/* Search Bar */}
      <div style={{ marginBottom: "24px" }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "400px",
            padding: "12px 16px",
            fontSize: "14px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            outline: "none",
          }}
          onFocus={(e) => e.target.style.borderColor = "#10b981"}
          onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
        />
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
        gap: "16px",
        marginBottom: "32px"
      }}>
        <div style={{
          padding: "20px",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>Total Athletes</div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#111827" }}>
            {mockAthletes.length}
          </div>
        </div>
        <div style={{
          padding: "20px",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>Available Today</div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#10b981" }}>
            {athletesForDate.filter(a => a.availability[selectedDate] === "Available").length}
          </div>
        </div>
        <div style={{
          padding: "20px",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>Healthy Athletes</div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#10b981" }}>
            {mockAthletes.filter(a => a.healthStatus === "Healthy").length}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
        {/* Date Selector & Availability for Date */}
        <div style={{
          padding: "20px",
          backgroundColor: "#fff",
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", color: "#111827" }}>
            Availability by Date
          </h2>
          
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: "14px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              marginBottom: "16px",
              backgroundColor: "#fff",
              cursor: "pointer"
            }}
          >
            {getNext7Days().map(day => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>

          <div style={{ marginTop: "16px" }}>
            {filteredAthletes.map(athlete => {
              const availability = athlete.availability[selectedDate] || "Not Set";
              const color = getAvailabilityColor(availability);
              return (
                <div
                  key={athlete.id}
                  style={{
                    padding: "12px",
                    marginBottom: "8px",
                    borderRadius: "6px",
                    backgroundColor: "#f9fafb",
                    borderLeft: `3px solid ${color}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: "#111827" }}>{athlete.name}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>{athlete.email}</div>
                  </div>
                  <span style={{
                    padding: "4px 12px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    backgroundColor: `${color}20`,
                    color: color
                  }}>
                    {availability}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Days with Most Availability */}
        <div style={{
          padding: "20px",
          backgroundColor: "#fff",
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", color: "#111827" }}>
            Best Days for Availability
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>
            Days with the most athletes available (next 7 days)
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {availabilityStats.map((day, index) => {
              const percentage = Math.round((day.available / day.total) * 100);
              return (
                <div
                  key={day.date}
                  style={{
                    padding: "16px",
                    borderRadius: "6px",
                    backgroundColor: "#f9fafb",
                    border: "1px solid #e5e7eb"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 500, color: "#111827" }}>
                      {day.dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#10b981" }}>
                      {day.available}/{day.total} ({percentage}%)
                    </div>
                  </div>
                  <div style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: "#e5e7eb",
                    borderRadius: "4px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: "100%",
                      backgroundColor: "#10b981",
                      transition: "width 0.3s ease"
                    }} />
                  </div>
                  {day.partiallyAvailable > 0 && (
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                      {day.partiallyAvailable} partially available
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Athletes List */}
      <div style={{
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "8px",
        border: "1px solid #e5e7eb"
      }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", color: "#111827" }}>
          All Athletes ({filteredAthletes.length})
        </h2>
        
        <div style={{ display: "grid", gap: "12px" }}>
          {filteredAthletes.map(athlete => (
            <div
              key={athlete.id}
              style={{
                padding: "16px",
                borderRadius: "6px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#fff"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 600, fontSize: "16px", color: "#111827" }}>
                      {athlete.name}
                    </div>
                    <span style={{
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 500,
                      backgroundColor: `${getHealthStatusColor(athlete.healthStatus)}20`,
                      color: getHealthStatusColor(athlete.healthStatus)
                    }}>
                      {athlete.healthStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "12px" }}>
                    {athlete.email}
                  </div>
                  
                  {/* Weekly Availability Summary */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {getNext7Days().map(day => {
                      const status = athlete.availability[day.value] || "Not Set";
                      const color = getAvailabilityColor(status);
                      return (
                        <div
                          key={day.value}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            backgroundColor: `${color}15`,
                            color: color,
                            fontWeight: 500,
                            border: `1px solid ${color}40`
                          }}
                          title={day.label}
                        >
                          {day.label.split(',')[0].substring(0, 3)}: {status === "Available" ? "✓" : status === "Partially Available" ? "~" : "✗"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAthletes.length === 0 && (
          <div style={{ 
            padding: "40px", 
            textAlign: "center", 
            color: "#6b7280",
            fontSize: "14px"
          }}>
            No athletes found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
