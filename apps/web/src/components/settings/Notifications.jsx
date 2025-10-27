import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
//import twilio from "twilio";
//import { TWILIO_INFO } from "../../constants/constants";

export default function Notifications() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  //const client = Twilio(TWILIO_INFO.ACCOUNT_SID, TWILIO_INFO.AUTH_TOKEN);
  
  const [notificationSettings, setNotificationSettings] = useState({
    textNotifications: false,
    phoneNumber: "",
    emailNotifications: true, // Default to true since they have an email account
    // Notification preferences
    unreadMessages: true,
    incompleteProfile: true,
    addToTeam: true,
    upcomingEvent: true,
    predictionReady: true,
    newPerformanceResult: true,
    coachSuggestedGoals: true,
    coachAddedFeedback: true,
  });

  // Fetch notification settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setNotificationSettings({
            textNotifications: userData.textNotifications ?? false,
            phoneNumber: userData.phoneNumber ?? "",
            emailNotifications: userData.emailNotifications ?? true,
            // Notification preferences
            unreadMessages: userData.unreadMessages ?? true,
            incompleteProfile: userData.incompleteProfile ?? true,
            addToTeam: userData.addToTeam ?? true,
            upcomingEvent: userData.upcomingEvent ?? true,
            predictionReady: userData.predictionReady ?? true,
            newPerformanceResult: userData.newPerformanceResult ?? true,
            coachSuggestedGoals: userData.coachSuggestedGoals ?? true,
            coachAddedFeedback: userData.coachAddedFeedback ?? true,
          });
        }
      } catch (error) {
        console.error("Error fetching notification settings:", error);
        setMessage("Error loading notification settings");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    
    setSaving(true);
    setMessage("");

    if (notificationSettings.textNotifications && (notificationSettings.phoneNumber.trim() === "" )) {
      throw new Error("Phone number is required to enable text notifications.");
    }

    const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
    const d = snap.exists() ? snap.data() : {};
    if (notificationSettings.textNotifications && (d.textNotifications === false || d.textNotifications === undefined) && notificationSettings.phoneNumber.trim() !== "") {
      // Just enabled text notifications, show alert
      setMessage("You have enabled text notifications. A test message will be sent to your phone shortly. If you do not receive it, please ensure you have entered the correct phone number.");
      /*const message = await client.messages.create({
        body: "You have successfully enabled text notifications for AthleteHub",
        from: TWILIO_INFO.FROM_PHONE,
        to: notificationSettings.phoneNumber,
      });*/
    }

    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          textNotifications: notificationSettings.textNotifications,
          phoneNumber: notificationSettings.phoneNumber,
          emailNotifications: notificationSettings.emailNotifications,
          // Notification preferences
          unreadMessages: notificationSettings.unreadMessages,
          incompleteProfile: notificationSettings.incompleteProfile,
          addToTeam: notificationSettings.addToTeam,
          upcomingEvent: notificationSettings.upcomingEvent,
          predictionReady: notificationSettings.predictionReady,
          newPerformanceResult: notificationSettings.newPerformanceResult,
          coachSuggestedGoals: notificationSettings.coachSuggestedGoals,
          coachAddedFeedback: notificationSettings.coachAddedFeedback,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMessage("Notification settings saved successfully!");
    } catch (error) {
      console.error("Error saving notification settings:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (setting) => {
    setNotificationSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleInputChange = (field, value) => {
    setNotificationSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <div className="spinner" aria-label="Loading notification settings"></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 20 }}>
      <Link to="/settings" className="text-primary" style={{ display: "inline-block", marginBottom: 16 }}>
        ← Back to Settings
      </Link>

      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2 className="mb-2">Notification Settings</h2>
        <p className="text-muted mb-3">
          Choose how you'd like to receive notifications about messages, goals, and updates.
        </p>

        {/* Text Notifications */}
        <div className="form-group">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <label style={{ fontWeight: 700, margin: 0 }}>Text Notifications</label>
            <button
              type="button"
              onClick={() => handleToggle('textNotifications')}
              style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                border: "none",
                background: notificationSettings.textNotifications ? "#10b981" : "#d1d5db",
                position: "relative",
                cursor: "pointer",
                transition: "background-color 0.2s ease",
              }}
              aria-label={`${notificationSettings.textNotifications ? 'Disable' : 'Enable'} text notifications`}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: 2,
                  left: notificationSettings.textNotifications ? 24 : 2,
                  transition: "left 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              />
            </button>
          </div>
          <p className="text-muted" style={{ fontSize: 14, marginBottom: 16 }}>
            Receive text messages for important updates and messages.
          </p>
          
          {notificationSettings.textNotifications && (
            <div className="form-group">
              <label htmlFor="phoneNumber" style={{ fontWeight: 700 }}>Phone Number</label>
              <input
                id="phoneNumber"
                type="tel"
                className="form-control"
                placeholder="e.g., (555) 123-4567"
                value={notificationSettings.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                style={{ marginTop: 8 }}
              />
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--border)", margin: "24px 0" }} />

        {/* Email Notifications */}
        <div className="form-group">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <label style={{ fontWeight: 700, margin: 0 }}>Email Notifications</label>
            <button
              type="button"
              onClick={() => handleToggle('emailNotifications')}
              style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                border: "none",
                background: notificationSettings.emailNotifications ? "#10b981" : "#d1d5db",
                position: "relative",
                cursor: "pointer",
                transition: "background-color 0.2s ease",
              }}
              aria-label={`${notificationSettings.emailNotifications ? 'Disable' : 'Enable'} email notifications`}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: 2,
                  left: notificationSettings.emailNotifications ? 24 : 2,
                  transition: "left 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              />
            </button>
          </div>
          <p className="text-muted" style={{ fontSize: 14, marginBottom: 16 }}>
            Receive email notifications for important updates and messages at {auth.currentUser?.email}.
          </p>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--border)", margin: "24px 0" }} />

        {/* Notification Preferences */}
        <div className="form-group">
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
            Notification Preferences
          </h3>
          <p className="text-muted" style={{ fontSize: 14, marginBottom: 20 }}>
            Choose what types of notifications you'd like to receive.
          </p>

          {/* Notification preference items */}
          {[
            {
              key: 'unreadMessages',
              label: 'Unread Messages',
              description: 'Get notified when you receive new messages'
            },
            {
              key: 'incompleteProfile',
              label: 'Incomplete Profile',
              description: 'Reminders to complete your profile information'
            },
            {
              key: 'addToTeam',
              label: 'Added to Team',
              description: 'Notifications when you\'re added to a team'
            },
            {
              key: 'upcomingEvent',
              label: 'Upcoming Event in Schedule',
              description: 'Reminders about upcoming events in your schedule'
            },
            {
              key: 'predictionReady',
              label: 'Prediction Ready',
              description: 'When performance predictions are available'
            },
            {
              key: 'newPerformanceResult',
              label: 'New Performance Result',
              description: 'When new performance results are recorded'
            },
            {
              key: 'coachSuggestedGoals',
              label: 'Coach Suggested Goals',
              description: 'When your coach suggests new goals for you'
            },
            {
              key: 'coachAddedFeedback',
              label: 'Coach Added Feedback',
              description: 'When your coach provides feedback on your performance'
            }
          ].map((item) => (
            <div key={item.key} style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between", 
              padding: "12px 0",
              borderBottom: "1px solid #f3f4f6"
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "#111827", marginBottom: 2 }}>
                  {item.label}
                </div>
                <div className="text-muted" style={{ fontSize: 14 }}>
                  {item.description}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(item.key)}
                style={{
                  width: 50,
                  height: 28,
                  borderRadius: 14,
                  border: "none",
                  background: notificationSettings[item.key] ? "#10b981" : "#d1d5db",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                  marginLeft: 16,
                }}
                aria-label={`${notificationSettings[item.key] ? 'Disable' : 'Enable'} ${item.label.toLowerCase()} notifications`}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#fff",
                    position: "absolute",
                    top: 2,
                    left: notificationSettings[item.key] ? 24 : 2,
                    transition: "left 0.2s ease",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                />
              </button>
            </div>
          ))}
        </div>

        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="btn btn-primary" 
          style={{ width: "100%", marginTop: 24 }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>

        {message && (
          <div className={`alert ${message.startsWith("Error") ? "alert-error" : "alert-success"}`} role="status" style={{ marginTop: 16 }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
