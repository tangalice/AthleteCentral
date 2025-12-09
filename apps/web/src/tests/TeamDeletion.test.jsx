/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import React from "react";
import {
  render,
  screen,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  vi,
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
} from "vitest";
import { MemoryRouter } from "react-router-dom";

/* -------------------- Module mocks (hoisted) -------------------- */

// firebase app-layer — inline values (no external vars!)
const mockCurrentUser = { uid: "coach1", displayName: "Coach User" };
vi.mock("../firebase", () => {
  return {
    auth: { get currentUser() { return mockCurrentUser; } },
    db: {},
  };
});

// react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Email service
vi.mock("../services/EmailNotificationService", () => ({
  sendEmailNotification: vi.fn().mockResolvedValue({ success: true }),
}));

// Firestore
vi.mock("firebase/firestore", () => {
  const fns = {
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    addDoc: vi.fn(),
    deleteDoc: vi.fn(),
    onSnapshot: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: Math.floor(Date.now() / 1000) })),
    query: vi.fn((colRef) => ({ __type: "query", collectionPath: colRef?.path || colRef })),
    where: vi.fn((...args) => ({ __type: "where", args })),
  };

  const collection = (_db, ...path) => ({ __type: "collection", path });
  const doc = (_db, ...path) => ({ __type: "doc", path: path.join("/") });

  return {
    collection,
    query: fns.query,
    where: fns.where,
    onSnapshot: fns.onSnapshot,
    doc,
    getDocs: fns.getDocs,
    getDoc: fns.getDoc,
    deleteDoc: fns.deleteDoc,
    addDoc: fns.addDoc,
    serverTimestamp: fns.serverTimestamp,
    arrayUnion: vi.fn((item) => item),
    arrayRemove: vi.fn((item) => item),
  };
});

// IMPORTANT: import mocked namespace AFTER vi.mock
import * as firestore from "firebase/firestore";

/* -------------------- Component under test -------------------- */
import Teams from "../components/Teams.jsx";

/* -------------------- Test data & helpers -------------------- */

const teamsList = [
  {
    id: "team1",
    data: {
      name: "Test Team",
      description: "A test team",
      joinCode: "ABC123",
      members: ["coach1", "athlete1", "athlete2"],
      coaches: ["coach1"],
      athletes: ["athlete1", "athlete2"],
      createdBy: "coach1",
      createdAt: new Date(),
    },
  },
];

const usersList = [
  { id: "coach1", data: { displayName: "Coach User", email: "coach1@example.com", role: "coach", teamId: "team1" } },
  { id: "athlete1", data: { displayName: "Athlete One", email: "athlete1@example.com", role: "athlete", teamId: "team1" } },
  { id: "athlete2", data: { displayName: "Athlete Two", email: "athlete2@example.com", role: "athlete", teamId: "team1" } },
  { id: "coach2", data: { displayName: "Coach Two", email: "coach2@example.com", role: "coach", teamId: "team2" } },
  { id: "athlete3", data: { displayName: "Athlete Three", email: "athlete3@example.com", role: "athlete", teamId: "team2" } },
];

/* -------------------- Lifecycle -------------------- */
beforeEach(() => {
  // Reset mock user to coach
  mockCurrentUser.uid = "coach1";
  mockCurrentUser.displayName = "Coach User";
  
  mockNavigate.mockClear();
  firestore.deleteDoc.mockClear();
  firestore.getDoc.mockClear();
  firestore.getDocs.mockClear();
  firestore.onSnapshot.mockClear();

  // Setup window.confirm mock
  window.confirm = vi.fn();

  // Mock getDoc for user role & member profiles
  firestore.getDoc.mockReset().mockImplementation(async (docRef) => {
    // Handle path as string or array
    let path;
    if (typeof docRef.path === 'string') {
      path = docRef.path;
    } else if (Array.isArray(docRef.path)) {
      path = docRef.path.join("/");
    } else {
      path = docRef.path;
    }
    
    if (path === "users/coach1" || path.includes("users/coach1")) {
      return {
        exists: () => true,
        data: () => ({ role: "coach", displayName: "Coach User", email: "coach1@example.com" }),
      };
    }
    // Handle member profile lookups
    const parts = path.split("/");
    if (parts.length >= 2 && parts[0] === "users") {
      const userId = parts[1];
      const user = usersList.find((u) => u.id === userId);
      if (user) {
        return {
          exists: () => true,
          data: () => user.data,
        };
      }
    }
    return {
      exists: () => false,
      data: () => null,
    };
  });

  // Mock getDocs for loading all users (coach only)
  firestore.getDocs.mockReset().mockImplementation(async (queryRef) => {
    return {
      docs: usersList.map((u) => ({
        id: u.id,
        data: () => u.data,
      })),
    };
  });

  // Mock onSnapshot for teams query
  firestore.onSnapshot.mockReset().mockImplementation((queryRef, callback) => {
    // Simulate initial snapshot
    const snapshot = {
      docs: teamsList.map((team) => ({
        id: team.id,
        data: () => team.data,
      })),
    };
    // Call callback immediately with initial data
    callback(snapshot);
    // Return unsubscribe function
    return () => {};
  });
});

afterEach(() => {
  cleanup();
  // Reset mock user to coach after each test
  mockCurrentUser.uid = "coach1";
  mockCurrentUser.displayName = "Coach User";
});

/* -------------------- Tests -------------------- */
describe("Team Deletion", () => {
  it("displays delete button for coach who is in coaches array", async () => {
    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    // Wait for teams to load
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    // Check that delete button is visible for team where user is a coach
    const deleteButton = screen.getByRole("button", { name: /Delete Team/i });
    expect(deleteButton).toBeInTheDocument();
  });

  it("shows confirmation dialog before deleting team", async () => {
    window.confirm.mockReturnValue(false); // User cancels

    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    // Wait for teams to load
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /Delete Team/i });
    await userEvent.click(deleteButton);

    // Verify confirmation dialog was shown
    expect(window.confirm).toHaveBeenCalledWith(
      "Are you sure you want to delete this team? This action cannot be undone and will remove the team from all members."
    );

    // Verify deleteDoc was NOT called (user cancelled)
    expect(firestore.deleteDoc).not.toHaveBeenCalled();
  });

  it("successfully deletes team when user confirms", async () => {
    window.confirm.mockReturnValue(true); // User confirms
    firestore.deleteDoc.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    // Wait for teams to load
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /Delete Team/i });
    await userEvent.click(deleteButton);

    // Wait for deletion to complete
    await waitFor(() => {
      expect(firestore.deleteDoc).toHaveBeenCalled();
    });

    // Verify deleteDoc was called with correct team document reference
    const deleteCall = firestore.deleteDoc.mock.calls[0][0];
    expect(deleteCall.path).toBe("teams/team1");

    // Verify success message is displayed
    await waitFor(() => {
      expect(screen.getByText(/Team deleted successfully/i)).toBeInTheDocument();
    });
  });

  it("handles deletion error gracefully", async () => {
    window.confirm.mockReturnValue(true); // User confirms
    const errorMessage = "Permission denied";
    firestore.deleteDoc.mockRejectedValue(new Error(errorMessage));

    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    // Wait for teams to load
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /Delete Team/i });
    await userEvent.click(deleteButton);

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(new RegExp(`Error deleting team: ${errorMessage}`, "i"))).toBeInTheDocument();
    });

    // Verify deleteDoc was called
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });

  it("does not show delete button for teams where user is not a coach", async () => {
    // Change current user to an athlete
    mockCurrentUser.uid = "athlete1";

    // Update mock to return athlete role
    firestore.getDoc.mockImplementation(async (docRef) => {
      let path;
      if (typeof docRef.path === 'string') {
        path = docRef.path;
      } else if (Array.isArray(docRef.path)) {
        path = docRef.path.join("/");
      } else {
        path = docRef.path;
      }
      
      if (path === "users/athlete1" || path.includes("users/athlete1")) {
        return {
          exists: () => true,
          data: () => ({ role: "athlete", displayName: "Athlete One", email: "athlete1@example.com" }),
        };
      }
      const parts = path.split("/");
      if (parts.length >= 2 && parts[0] === "users") {
        const userId = parts[1];
        const user = usersList.find((u) => u.id === userId);
        if (user) {
          return {
            exists: () => true,
            data: () => user.data,
          };
        }
      }
      return {
        exists: () => false,
        data: () => null,
      };
    });

    // Update teams list to show athlete is only an athlete, not a coach
    const teamsForAthlete = [
      {
        id: "team1",
        data: {
          name: "Test Team",
          description: "A test team",
          joinCode: "ABC123",
          members: ["coach1", "athlete1", "athlete2"],
          coaches: ["coach1"], // athlete1 is NOT a coach
          athletes: ["athlete1", "athlete2"],
          createdBy: "coach1",
          createdAt: new Date(),
        },
      },
    ];

    firestore.onSnapshot.mockImplementation((queryRef, callback) => {
      const snapshot = {
        docs: teamsForAthlete.map((team) => ({
          id: team.id,
          data: () => team.data,
        })),
      };
      callback(snapshot);
      return () => {};
    });

    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    // Wait for teams to load
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    // Verify delete button is NOT visible for athlete
    expect(screen.queryByRole("button", { name: /Delete Team/i })).not.toBeInTheDocument();
  });

  it("calls deleteDoc with correct team ID when deleting", async () => {
    // Ensure we're reset to coach user (in case previous test modified it)
    mockCurrentUser.uid = "coach1";
    mockCurrentUser.displayName = "Coach User";
    
    // Reset onSnapshot to default teams list
    firestore.onSnapshot.mockReset().mockImplementation((queryRef, callback) => {
      const snapshot = {
        docs: teamsList.map((team) => ({
          id: team.id,
          data: () => team.data,
        })),
      };
      callback(snapshot);
      return () => {};
    });
    
    // Reset getDoc to return coach role
    firestore.getDoc.mockReset().mockImplementation(async (docRef) => {
      let path;
      if (typeof docRef.path === 'string') {
        path = docRef.path;
      } else if (Array.isArray(docRef.path)) {
        path = docRef.path.join("/");
      } else {
        path = docRef.path;
      }
      
      if (path === "users/coach1" || path.includes("users/coach1")) {
        return {
          exists: () => true,
          data: () => ({ role: "coach", displayName: "Coach User", email: "coach1@example.com" }),
        };
      }
      const parts = path.split("/");
      if (parts.length >= 2 && parts[0] === "users") {
        const userId = parts[1];
        const user = usersList.find((u) => u.id === userId);
        if (user) {
          return {
            exists: () => true,
            data: () => user.data,
          };
        }
      }
      return {
        exists: () => false,
        data: () => null,
      };
    });
    
    window.confirm.mockReturnValue(true);
    firestore.deleteDoc.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    // Wait for teams to load
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /Delete Team/i });
    await userEvent.click(deleteButton);

    // Verify deleteDoc was called with team1
    await waitFor(() => {
      expect(firestore.deleteDoc).toHaveBeenCalled();
    });

    // Check that the call was made with the correct document path
    const deleteCall = firestore.deleteDoc.mock.calls[0][0];
    expect(deleteCall.path).toBe("teams/team1");
  });

  it("does not delete team when confirmation is cancelled", async () => {
    window.confirm.mockReturnValue(false); // User cancels

    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    // Wait for teams to load
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /Delete Team/i });
    await userEvent.click(deleteButton);

    // Verify confirmation was called
    expect(window.confirm).toHaveBeenCalled();

    // Verify deleteDoc was NOT called
    expect(firestore.deleteDoc).not.toHaveBeenCalled();

    // Verify no success message
    expect(screen.queryByText(/Team deleted successfully/i)).not.toBeInTheDocument();
  });

  it("shows error message when deletion fails with network error", async () => {
    window.confirm.mockReturnValue(true);
    firestore.deleteDoc.mockRejectedValue(new Error("Network error: Failed to delete"));

    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    // Wait for teams to load
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /Delete Team/i });
    await userEvent.click(deleteButton);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Error deleting team/i)).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });
});

