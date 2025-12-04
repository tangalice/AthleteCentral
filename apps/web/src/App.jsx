// src/App.jsx
import { useEffect, useRef, useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import SessionsService from "./services/SessionsService";

// Auth
import SignUp from "./components/auth/SignUp";
import Login from "./components/auth/Login";
import VerifyEmail from "./components/auth/VerifyEmail";

// Main
import Dashboard from "./components/Dashboard";
import Profile from "./components/Profile";
import Messages from "./components/Messages";
import Settings from "./components/Settings";

import Teams from "./components/Teams";
import TopBar from "./components/TopBar";
import Goals from "./components/Goals";
import SuggestGoals from "./components/SuggestGoals";
import Calendar from "./components/Calendar";
import PracticePerformances from './Billa_UI_Pages/PracticePerformances';
import ViewAthletePractices from "./Billa_UI_Pages/Rowing_Stories/ViewAthletePractices";
import AthleteFeedbackPage from "./components/AthleteFeedbackPage";
import CoachFeedbackPage from "./components/CoachFeedbackPage";
import PredictResultsPage from "./pages/PredictResultsPage";
import CompareResultsPage from "./pages/CompareResultsPage";
import CreateFeedbackPoll from "./pages/CreateFeedbackPoll";
import FeedbackSummaryPage from "./pages/FeedbackSummaryPage";
import AthleteFeedback from "./pages/AthleteFeedback";
import CoachViewPredictions from "./pages/CoachViewPredictions";
import SimilarTeammatesPage from "./components/SimilarTeammatesPage";

import CreatePoll from "./components/CreatePoll";
import Results from './Billa_UI_Pages/Results';
import EnterResults from './Billa_UI_Pages/EnterResults';
import ViewResults from './Billa_UI_Pages/ViewResults';
import SplitCalculator from './Billa_UI_Pages/Rowing_Stories/SplitCalculator';
import CoachGoals from './Billa_UI_Pages/CoachGoals';
import WeightInfo from "./Billa_UI_Pages/Rowing_Stories/WeightInfo";
import CoachWeightInfo from "./Billa_UI_Pages/Rowing_Stories/CoachWeightInfo";
import AthleteToolsPage from "./pages/AthleteToolsPage";
import Activity from "./components/Activity";
import CoachDataReports from "./components/CoachDataReports";
import HealthAndAvailability from "./components/HealthAndAvailability";
import AttendanceHistory from "./components/AttendanceHistory";
import LogWorkout from "./components/LogWorkout";
import TeammateComparison from './Billa_UI_Pages/TeammateComparison';
import GroupPerformance from './Billa_UI_Pages/Rowing_Stories/GroupPerformance';
import ImprovementRates from './Billa_UI_Pages/ImprovementRates';
import TeamRankings from './Billa_UI_Pages/TeamRankings';
import TeamPersonalBests from './Billa_UI_Pages/TeamPersonalBests';
import IndividualPerformance from './Billa_UI_Pages/Rowing_Stories/IndividualPerformance';
import LineupBuilder from './Billa_UI_Pages/Rowing_Stories/LineupBuilder';

/* ---------------- Protected wrapper ---------------- */

// Helper to add timeout to promises
function withTimeout(promise, timeoutMs = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

function ProtectedRoute({ children, user, requireVerified = true }) {
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.warn("ProtectedRoute: Session verification timeout, proceeding anyway");
        setChecking(false);
        setOk(true);
      }
    }, 10000); // 10 second timeout

    const run = async () => {
      if (!user) {
        setChecking(false);
        setOk(false);
        return;
      }
      if (requireVerified && !user.emailVerified) {
        setChecking(false);
        setOk(false);
        return;
      }

      try {
        const sessionId =
          SessionsService.getCurrentSessionId?.() ||
          localStorage.getItem("currentSessionId");
        if (!sessionId) {
          await withTimeout(SessionsService.createSession(user.uid, user.email), 8000);
          setOk(true);
        } else {
          const isValid = await withTimeout(SessionsService.isSessionValid(sessionId), 8000);
          if (!isValid) {
            await withTimeout(SessionsService.createSession(user.uid, user.email), 8000);
          } else {
            await withTimeout(SessionsService.updateSessionActivity(sessionId), 8000);
          }
          setOk(true);
        }
      } catch (e) {
        console.warn("ProtectedRoute session bootstrap error:", e);
        setOk(true); // Proceed anyway to avoid blocking the app
      } finally {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setChecking(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user, requireVerified]);

  if (checking) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <p>Verifying session...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (requireVerified && !user.emailVerified) return <Navigate to="/verify-email" replace />;
  if (!ok) return <Navigate to="/login" replace />;

  return children;
}

/* --------- Layout (TopBar + Outlet) + activity heartbeat ---------- */
function AppLayout({ user, userRole, onLogout, userSport }) {
  const { pathname } = useLocation();
  const activityTimerRef = useRef(null);
  const lastBeatRef = useRef(0);

  useEffect(() => {
    if (!user || !user.emailVerified) return;

    const beat = async () => {
      const sessionId =
        SessionsService.getCurrentSessionId?.() ||
        localStorage.getItem("currentSessionId");
      if (sessionId) {
        try { await SessionsService.updateSessionActivity(sessionId); } catch {}
      }
    };

    beat();

    // 
    activityTimerRef.current = setInterval(beat, 60_000);

    // 
    const onUserActivity = () => {
      const now = Date.now();
      if (now - lastBeatRef.current > 300_000) {
        lastBeatRef.current = now;
        beat();
      }
    };

    window.addEventListener("mousemove", onUserActivity);
    window.addEventListener("keydown", onUserActivity);
    window.addEventListener("click", onUserActivity);

    // 
    const onVisibility = () => {
      if (!document.hidden) beat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (activityTimerRef.current) clearInterval(activityTimerRef.current);
      window.removeEventListener("mousemove", onUserActivity);
      window.removeEventListener("keydown", onUserActivity);
      window.removeEventListener("click", onUserActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  const root = (pathname.split("/")[1] || "").toLowerCase();
  const activeTab =
    root === "settings" ? "settings" :
    root === "profile"  ? "profile"  :
    root === "messages" ? "messages" : 
    root === "teams"    ? "teams"    :
    root === "calendar" ? "calendar" :
    root === "activity" ? "activity" :
    root === "athlete-tools" ? "athlete-tools" :
    root === "results"  ? "results"  :
    root === "goals"    ? "goals"    :
    root === "view-athlete-goals" ? "view-athlete-goals" :
    root === "coach-feedback" ? "coach-feedback" :
    root === "split-calculator" ? "split-calculator" : 
    root === "data-reports" ? "data-reports" :
    root === "coach-view-predictions" ? "coach-view-predictions" :
    root === "athlete-feedback" ? "athlete-feedback" :
    root === "suggest-goals" ? "suggest-goals" :
    root === "health-availability" ? "health-availability" :
    root === "group-performance" ? "group-performance" :
    root === "individual-performance" ? "individual-performance" :
    root === "lineup-builder" ? "lineup-builder" :
    root === "view-athlete-practices" ? "view-athlete-practices" :
    root === "predict-results" ? "predict-results" :
    root === "compare-results" ? "compare-results" :
    root === "teammate-comparison" ? "teammate-comparison" :
    root === "similar-teammates" ? "similar-teammates" :
    root === "weight-info" ? "weight-info" :
    root === "team-rankings" ? "team-rankings" :
    root === "team-personal-bests" ? "team-personal-bests" : 
    root === "improvement-rates" ? "improvement-rates" :
    root === "coach-weight-info" ? "coach-weight-info" :
    root === "log-workout" ? "log-workout" :
    root === "create-poll" ? "dashboard" :
    "dashboard";

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fff",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <TopBar
        showNav={Boolean(user && user.emailVerified)}
        activeTab={activeTab}
        onLogout={onLogout}
        user={user ? { ...user, role: userRole, sport: userSport } : null}
        userRole={userRole}
        userSport={userSport}
      />
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>
        <Outlet />
      </main>
    </div>
  );
}

/* ---------------------------- Main App ---------------------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userSport, setUserSport] = useState(null);
  const [ready, setReady] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const signingOutRef = useRef(false); 
  const sessionUnsubRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const safetyTimer = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 10_000);

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;

      setUser(u || null);
      setUserRole(null);
      setUserSport(null);
      setReady(true);

      if (sessionUnsubRef.current) {
        sessionUnsubRef.current();
        sessionUnsubRef.current = null;
      }

      try {
        if (u && u.emailVerified) {
          try {
            const snap = await getDoc(doc(db, "users", u.uid));
            if (!cancelled && snap.exists()) {
              setUserRole(snap.data().role || null);
              setUserSport(snap.data().sport || null);
            }
          } catch (e) {
            console.error("Fetch role error:", e);
          }

          try {
            const sessionId =
              SessionsService.getCurrentSessionId?.() ||
              localStorage.getItem("currentSessionId");

            if (!sessionId) {
              await SessionsService.createSession(u.uid, u.email);
            } else {
              const ok = await SessionsService.isSessionValid(sessionId);
              if (!ok) await SessionsService.createSession(u.uid, u.email);
              else await SessionsService.updateSessionActivity(sessionId);
            }
          } catch (e) {
            console.warn("Session bootstrap error:", e);
          }

          const currentId =
            SessionsService.getCurrentSessionId?.() ||
            localStorage.getItem("currentSessionId");
          if (currentId) {
            const ref = doc(db, "users", u.uid, "sessions", currentId);
            sessionUnsubRef.current = onSnapshot(ref, (snap) => {
              if (!snap.exists()) return;
              const d = snap.data();
              if (d.isActive === false && !signingOutRef.current) {
                signingOutRef.current = true;
                try {
                  SessionsService.clearCurrentSession?.();
                  localStorage.removeItem("currentSessionId");
                } catch {}
                firebaseSignOut(auth).finally(() => {
                  signingOutRef.current = false;
                });
              }
            });
          }
        }
      } catch (e) {
        console.error("Auth state handler error:", e);
      } finally {
        clearTimeout(safetyTimer);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      unsub();
      if (sessionUnsubRef.current) {
        sessionUnsubRef.current();
        sessionUnsubRef.current = null;
      }
    };
  }, []);

  const handleLogout = async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    try {
      // Save track mode before logout
      const savedMode = localStorage.getItem("trackMode");
      
      const sessionId =
        SessionsService.getCurrentSessionId?.() ||
        localStorage.getItem("currentSessionId");
      if (sessionId) {
        try {
          await SessionsService.logoutSession(sessionId);
        } catch (e) {
          console.warn("logoutSession error:", e);
        }
        SessionsService.clearCurrentSession?.();
        localStorage.removeItem("currentSessionId");
      }
      await firebaseSignOut(auth);
      setUser(null);
      setUserRole(null);
      setUserSport(null);
      
      // Restore track mode after logout
      if (savedMode) {
        localStorage.setItem("trackMode", savedMode);
      }
    } catch (e) {
      console.error("Error signing out:", e);
    } finally {
      signingOutRef.current = false;
    }
  };

  if (!ready) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Loading...</p>
      </div>
    );
  }


  /* ------ Data loaders to avoid flicker on first paint ------- */
  async function dashboardLoader() {
    try {
      const u = auth.currentUser;
      if (!u || !u.emailVerified) return null;
      const snap = await getDoc(doc(db, "users", u.uid));
      const d = snap.exists() ? snap.data() : {};
      
      // Calculate profile completion based on required fields
      const userRole = d.role ?? null;
      let profileComplete = false;
      
      if (userRole === "coach") {
        // Coach required fields: displayName, bio, school, sport, team, sportDetails
        const requiredFields = ['displayName', 'bio', 'school', 'sport', 'team', 'sportDetails'];
        profileComplete = requiredFields.every(field => {
          const value = field === 'displayName' ? (d.displayName ?? u.displayName ?? "") : d[field];
          return value && value.toString().trim() !== "";
        });
      } else if (userRole === "athlete") {
        // Athlete required fields: displayName, bio, school, grade, sport, position, team, experience, sportDetails, goals
        const requiredFields = ['displayName', 'bio', 'school', 'grade', 'sport', 'position', 'team', 'experience', 'sportDetails', 'goals'];
        profileComplete = requiredFields.every(field => {
          const value = field === 'displayName' ? (d.displayName ?? u.displayName ?? "") : d[field];
          return value && value.toString().trim() !== "";
        });
      }
      
      return {
        displayName: d.displayName ?? u.displayName ?? "",
        role: userRole,
        raw: { ...d, profileComplete },
      };
    } catch (error) {
      console.error("Error in dashboardLoader:", error);
      return null;
    }
  }
  async function profileLoader() {
    try {
      const u = auth.currentUser;
      if (!u || !u.emailVerified) return null;
      const snap = await getDoc(doc(db, "users", u.uid));
      const d = snap.exists() ? snap.data() : {};
      return {
        name: d.displayName ?? u.displayName ?? "",
        bio: d.bio ?? "",
        school: d.school ?? "",
        grade: d.grade ?? "",
        sport: d.sport ?? "",
        position: d.position ?? "",
        team: d.team ?? "",
        experience: d.experience ?? "",
        sportDetails: d.sportDetails ?? "",
        goals: d.goals ?? "",
      };
    } catch (error) {
      console.error("Error in profileLoader:", error);
      return {
        name: "",
        bio: "",
        school: "",
        grade: "",
        sport: "",
        position: "",
        team: "",
        experience: "",
        sportDetails: "",
        goals: "",
      };
    }
  }


  // Create merged user object for components that need role information
  const mergedUser = user ? { ...user, role: userRole } : null;

  /* ---------------- Router ---------------- */
const router = createBrowserRouter([
  // Public
  { path: "/signup", element: user ? <Navigate to="/dashboard" replace /> : <SignUp /> },
  {
    path: "/login",
    element: user && user.emailVerified ? <Navigate to="/dashboard" replace /> : <Login />,
  },
  { path: "/verify-email", element: <VerifyEmail /> },

  // App layout + protected routes
  {
    path: "/",
    element: <AppLayout user={user} userRole={userRole} onLogout={handleLogout} userSport={userSport} />,
    children: [
      {
        index: true,
        element: user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />,
      },
      {
        path: "coach-feedback",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? (
              <CoachFeedbackPage coach={user} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "create-poll",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? <CreatePoll /> : <Navigate to="/dashboard" replace />}
          </ProtectedRoute>
        ),
      },
      {
        path: "feedback-summary",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? (
              <FeedbackSummaryPage coach={user} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "create-feedback",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? (
              <CreateFeedbackPoll />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "feedback/submit/:pollId",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "athlete" ? (
              <AthleteFeedback />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "feedback/edit/:pollId",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? (
              <CreateFeedbackPoll />  
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "coach-feedback",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? <FeedbackSummaryPage coach={user} /> : <Navigate to="/dashboard" replace />}
          </ProtectedRoute>
        ),
      },
      {
        path: "coach-view-predictions",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? (<CoachViewPredictions />) : (<Navigate to="/dashboard" replace />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "dashboard",
        loader: dashboardLoader,
        element: (
          <ProtectedRoute user={user}>
            <Dashboard userRole={userRole} user={user} unreadMessageCount={unreadMessageCount} />
          </ProtectedRoute>
        ),
      },
      {
        path: "split-calculator",
        element: (
          <ProtectedRoute user={user}>
            {userSport?.toLowerCase() === "rowing" ? (
              <SplitCalculator user={mergedUser} userRole={userRole} userSport={userSport} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "predict-results",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "athlete" ? (
              <PredictResultsPage />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "compare-results",
        element: (
          <ProtectedRoute user={user}>
            <CompareResultsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "teammate-comparison",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "athlete" ? (
              <TeammateComparison user={mergedUser} userSport={userSport} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "team-rankings",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "athlete" ? (
              <TeamRankings user={mergedUser} userSport={userSport} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "similar-teammates",
        element: (
          <ProtectedRoute user={user}>
          {userRole === "athlete" ? (
          <SimilarTeammatesPage />
          ) : (
          <Navigate to="/dashboard" replace />
        )}
          </ProtectedRoute>
        ),
      },
      {
        path: "athlete-tools",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "athlete" ? (
              <AthleteToolsPage />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "athlete-dashboard",
        loader: dashboardLoader,
        element: (
          <ProtectedRoute user={user}>
            <Dashboard userRole={userRole} user={user} />
          </ProtectedRoute>
        ),
      },
      {
        path: "coach-dashboard",
        loader: dashboardLoader,
        element: (
          <ProtectedRoute user={user}>
            <Dashboard userRole={userRole} user={user} />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile",
        loader: profileLoader,
        element: (
          <ProtectedRoute user={user}>
            <Profile user={mergedUser} />
          </ProtectedRoute>
        ),
      },

      {
        path: "messages",
        element: (
          <ProtectedRoute user={user}>
            <Messages onUnreadCountChange={setUnreadMessageCount} />
          </ProtectedRoute>
        ),
      },

      {
        path: "teams",
        element: (
          <ProtectedRoute user={user}>
            <Teams />
          </ProtectedRoute>
        ),
      },
      {
        path: "group-performance",
        element: (
          <ProtectedRoute user={user}>
            <GroupPerformance user={mergedUser} userRole={userRole} userSport={userSport} />
          </ProtectedRoute>
        ),
      },
      {
        path: "individual-performance",
        element: (
          <ProtectedRoute user={user}>
            <IndividualPerformance user={mergedUser} userRole={userRole} userSport={userSport} />
          </ProtectedRoute>
        ),
      },
      {
        path: "calendar",
        element: (
          <ProtectedRoute user={user}>
            <Calendar userRole={userRole} user={mergedUser} />
          </ProtectedRoute>
        ),
      },
      {
        path: "attendance-history",
        element: (
          <ProtectedRoute user={user}>
            <AttendanceHistory userRole={userRole} />
          </ProtectedRoute>
        ),
      },
      {
        path: "activity",
        element: (
          <ProtectedRoute user={user}>
            <Activity userRole={userRole} user={mergedUser} />
          </ProtectedRoute>
        ),
      },
      {
        path: "log-workout",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "athlete" ? (
              <LogWorkout userRole={userRole} user={mergedUser} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "improvement-rates",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "athlete" ? (
              <ImprovementRates user={mergedUser} userSport={userSport} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "results",
        element: (
          <ProtectedRoute user={user}>
            <Results user={mergedUser} userRole={userRole} userSport={userSport} />
          </ProtectedRoute>
        ),
      },

      {
        path: "goals",
        element: (
          <ProtectedRoute user={user}>
            <Goals user={user} />
          </ProtectedRoute>
        ),
      },
      {
        path: "view-athlete-goals",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? <CoachGoals user={mergedUser} /> : <Navigate to="/goals" replace />}
          </ProtectedRoute>
        ),
      },

      {
        path: "athlete-feedback",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "athlete" ? <AthleteFeedbackPage user={user} /> : <Navigate to="/dashboard" replace />}
          </ProtectedRoute>
        ),
      },

      {
        path: "practice-performances",
        element: (
          <ProtectedRoute user={user}>
            <PracticePerformances user={user} />
          </ProtectedRoute>
        ),
      },
      {
        path: "view-athlete-practices",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? <ViewAthletePractices user={mergedUser} /> : <Navigate to="/dashboard" replace />}
          </ProtectedRoute>
        ),
      },
      {
        path: "suggest-goals",
        element: (
          <ProtectedRoute user={user}>
            {userRole=== "coach" ? <SuggestGoals user={user} /> : <Navigate to="/dashboard" replace />}
          </ProtectedRoute>
        ),
      },
      {
        path: "team-personal-bests",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "athlete" ? (
              <TeamPersonalBests user={mergedUser} userSport={userSport} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },

      {
        path: "coach-feedback",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? <CoachFeedbackPage coach={user} /> : <Navigate to="/dashboard" replace />}
          </ProtectedRoute>
        ),
      },

      {
        path: "data-reports",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? (
              <CoachDataReports coach={user} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },

      {
        path: "health-availability",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? <HealthAndAvailability /> : <Navigate to="/dashboard" replace />}
          </ProtectedRoute>
        ),
      },

      // NEW ROUTES - Group Performance, Individual Performance, Lineup Builder
      {
        path: "group-performance",
        element: (
          <ProtectedRoute user={user}>
            <GroupPerformance user={mergedUser} userRole={userRole} />
          </ProtectedRoute>
        ),
      },
      {
        path: "individual-performance",
        element: (
          <ProtectedRoute user={user}>
            <IndividualPerformance user={mergedUser} userRole={userRole} />
          </ProtectedRoute>
        ),
      },
      {
        path: "lineup-builder",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" && userSport?.toLowerCase() === "rowing" ? (
              <LineupBuilder user={mergedUser} userRole={userRole} userSport={userSport} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "weight-info",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "athlete" ? (
              <WeightInfo user={mergedUser} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },
      {
        path: "coach-weight-info",
        element: (
          <ProtectedRoute user={user}>
            {userRole === "coach" ? (
              <CoachWeightInfo user={mergedUser} />
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </ProtectedRoute>
        ),
      },

      // Keep other Settings sub-pages under /settings/*
      {
        path: "settings/*",
        element: (
          <ProtectedRoute user={user}>
            <Settings user={mergedUser} />
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);


  return <RouterProvider router={router} />;
}