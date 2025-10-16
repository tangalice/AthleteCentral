// src/App.jsx
import { useEffect, useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  Link,
  useLocation,
} from "react-router-dom";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// Auth Components
import SignUp from "./components/auth/SignUp";
import Login from "./components/auth/Login";
import VerifyEmail from "./components/auth/VerifyEmail";

// Main Components
import Dashboard from "./components/Dashboard";
import Profile from "./components/Profile";
import Messages from "./components/Messages";
import Settings from "./components/Settings";
import TopBar from "./components/TopBar";
import Goals from "./components/Goals";
import SuggestGoals from "./components/SuggestGoals";
import PracticePerformances from './Billa_UI_Pages/PracticePerformances';
import AthleteFeedbackPage from "./components/AthleteFeedbackPage";
import CoachFeedbackPage from "./components/CoachFeedbackPage";

/* ---------------- Protected wrapper ---------------- */
function ProtectedRoute({ children, user, requireVerified = true }) {
  if (!user) return <Navigate to="/login" replace />;
  if (requireVerified && !user.emailVerified)
    return <Navigate to="/verify-email" replace />;
  return children;
}

/* --------- App layout (TopBar + content) ---------- */
function AppLayout({ user, userRole, onLogout }) {
  const { pathname } = useLocation();
  // Use first path segment to decide active tab (so /settings/edit-profile stays on "Settings")
  const root = (pathname.split("/")[1] || "").toLowerCase();
  const activeTab =
    root === "settings" ? "settings" :
    root === "profile"  ? "profile"  :
    root === "messages" ? "messages" : 
    root === "goals"    ? "goals"    :
    "dashboard";

    const mergedUser = user
    ? { ...user, role: userRole }
    : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Unified top bar: BrandMark + Nav + Logout */}
      <TopBar
        showNav={Boolean(user && user.emailVerified)}
        activeTab={activeTab}
        onLogout={onLogout}
        user={mergedUser}
        userRole={userRole}
      />

      {/* Routed content */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>
        <Outlet />
      </main>
    </div>
  );
}

/* ------------- Main App ------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [ready, setReady] = useState(false);

  // Bootstrap: wait for Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);

      if (u && u.emailVerified) {
        try {
          const userDoc = await getDoc(doc(db, "users", u.uid));
          if (userDoc.exists()) setUserRole(userDoc.data().role || null);
          else setUserRole(null);
        } catch (e) {
          console.error("Error fetching user role:", e);
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }

      setReady(true);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setUserRole(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!ready) {
    return (
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh" }}>
        <p>Loading...</p>
      </div>
    );
  }

  /* ------ Data loaders to avoid flicker on first paint ------- */
  async function dashboardLoader() {
    const u = auth.currentUser;
    if (!u || !u.emailVerified) return null;
    const snap = await getDoc(doc(db, "users", u.uid));
    const d = snap.exists() ? snap.data() : {};
    return {
      displayName: d.displayName ?? u.displayName ?? "",
      role: d.role ?? null,
      raw: d,
    };
  }

  async function profileLoader() {
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
    };
  }

  /* ---------------- Router ---------------- */
  const router = createBrowserRouter([
    // Public routes
    {
      path: "/signup",
      element: user ? <Navigate to="/dashboard" replace /> : <SignUp />,
    },
    {
      path: "/login",
      element:
        user && user.emailVerified ? (
          <Navigate to="/dashboard" replace />
        ) : (
          <Login />
        ),
    },
    { path: "/verify-email", element: <VerifyEmail /> },

    // Protected layout and children
    {
      path: "/",
      element: <AppLayout user={user} userRole={userRole} onLogout={handleLogout} />,
      children: [
        {
          index: true,
          element: user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          ),
        },

        // Dashboard — preloaded to avoid flicker
        {
          path: "dashboard",
          loader: dashboardLoader,
          element: (
            <ProtectedRoute user={user}>
              <Dashboard userRole={userRole} user={user} />
            </ProtectedRoute>
          ),
        },

        // Profile — preloaded to avoid flicker
        {
          path: "profile",
          loader: profileLoader,
          element: (
            <ProtectedRoute user={user}>
              <Profile user={user} />
            </ProtectedRoute>
          ),
        },

        {
          path: "messages",
          element: (
            <ProtectedRoute user={user}>
              <Messages />
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
              <PracticePerformances />
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
          path: "coach-feedback",
          element: (
          <ProtectedRoute user={user}>
          {userRole === "coach" ? <CoachFeedbackPage coach={user} /> : <Navigate to="/dashboard" replace />}
          </ProtectedRoute>
          ),
        },


        // Keep other Settings sub-pages under /settings/*
        {
          path: "settings/*",
          element: (
            <ProtectedRoute user={user}>
              <Settings user={user} />
            </ProtectedRoute>
          ),
        },

        { path: "*", element: <Navigate to="/" replace /> },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}
