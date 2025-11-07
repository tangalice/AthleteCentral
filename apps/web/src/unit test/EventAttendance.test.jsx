/**
 * ✅ Comprehensive Unit Test for EventAttendance.jsx (matches your full component)
 * Covers:
 *   - Snapshot & live updates
 *   - Loading & error state
 *   - Member fetching via fetchTeamAthletes
 *   - Coach interaction (status change, note change)
 *   - Attendance stats rendering
 *   - Firestore update & alert on save
 */

import React from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import EventAttendance from "../components/EventAttendance";

// ---------- 🧩 Global mocks ----------
Object.defineProperty(window, "alert", {
  writable: true,
  value: jest.fn(),
});

// ---------- 🔧 Mock firebase + Firestore ----------
jest.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "U1", email: "coach@example.com" } },
}));

const mockOnSnapshot = jest.fn((ref, cb) => {
  // simulate one event doc snapshot
  cb({
    exists: () => true,
    data: () => ({
      title: "Morning Practice",
      datetime: { toDate: () => new Date("2025-11-06T08:00:00") },
      assignedMemberIds: ["A1", "A2"],
      attendanceRecords: {
        A1: { status: "present", note: "On time" },
        A2: { status: "late", note: "" },
      },
    }),
  });
  return () => {};
});

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  collection: jest.fn(),
  updateDoc: jest.fn(() => Promise.resolve()),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}));

// ---------- 👥 Mock teamService ----------
jest.mock("../services/teamService", () => ({
  fetchTeamAthletes: jest.fn(() =>
    Promise.resolve([
      { id: "A1", name: "Alice", email: "alice@example.com" },
      { id: "A2", name: "Bob", email: "bob@example.com" },
    ])
  ),
}));

// ---------- 📊 Mock constants ----------
jest.mock("../constants/constants", () => ({
  ATTENDANCE_STATUS: {
    PRESENT: "present",
    ABSENT: "absent",
    LATE: "late",
    EXCUSED: "excused",
  },
  ATTENDANCE_CONFIG: {
    present: { color: "#10b981", label: "Present", emoji: "✅" },
    absent: { color: "#ef4444", label: "Absent", emoji: "❌" },
    late: { color: "#f59e0b", label: "Late", emoji: "⏰" },
    excused: { color: "#3b82f6", label: "Excused", emoji: "📘" },
    unset: { color: "#9ca3af", label: "Unset", emoji: "⬜" },
  },
}));

// ---------- 🧼 beforeEach ----------
beforeEach(() => {
  jest.clearAllMocks();
  window.alert.mockClear();
});

// ---------- 🧪 Tests ----------
describe("📋 EventAttendance Component", () => {
  test("renders loading state", () => {
    render(<EventAttendance />);
    expect(screen.getByText(/Loading event and member details/i)).toBeInTheDocument();
  });

  test("renders event details and attendance stats", async () => {
    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    await waitFor(() => {
      expect(screen.getByText("Morning Practice")).toBeInTheDocument();
      expect(screen.getByText(/Assigned Athletes/)).toBeInTheDocument();
      expect(screen.getByText("Present")).toBeInTheDocument();
      expect(screen.getByText("Late")).toBeInTheDocument();
    });
  });

  test("fetches team athletes through fetchTeamAthletes", async () => {
    const { fetchTeamAthletes } = require("../services/teamService");
    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    await waitFor(() => {
      expect(fetchTeamAthletes).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  test("coach can change athlete status and add note", async () => {
    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    await waitFor(() => screen.getByText("Bob"));

    const lateBtn = screen.getAllByTitle("Late")[1];
    act(() => fireEvent.click(lateBtn));

    const noteInput = screen.getAllByPlaceholderText("Note...")[1];
    act(() => fireEvent.change(noteInput, { target: { value: "Traffic" } }));

    expect(noteInput.value).toBe("Traffic");
  });

  test("calls updateDoc when saving attendance", async () => {
    const { updateDoc } = require("firebase/firestore");
    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    await waitFor(() => screen.getByText("Save Attendance"));
    const saveBtn = screen.getByText("Save Attendance");

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => expect(updateDoc).toHaveBeenCalledTimes(1));
  });

  test("shows alert when attendance saved successfully", async () => {
    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    await waitFor(() => screen.getByText("Save Attendance"));
    const saveBtn = screen.getByText("Save Attendance");

    await act(async () => fireEvent.click(saveBtn));

    expect(window.alert).toHaveBeenCalledWith("Attendance saved successfully!");
  });

  test("renders error state if event not found", async () => {
    // Override the default mock manually — works even if onSnapshot isn't jest.fn()
    const firestore = require("firebase/firestore");
    const originalOnSnapshot = firestore.onSnapshot;
  
    // Temporarily replace implementation
    firestore.onSnapshot = (ref, cb) => {
      cb({ exists: () => false });
      return () => {};
    };
  
    render(<EventAttendance eventId="bad" teamId="T1" />);
  
    await waitFor(() => {
      expect(screen.getByText(/Error: Event not found/i)).toBeInTheDocument();
    });
  
    // Restore original after test
    firestore.onSnapshot = originalOnSnapshot;
  });
});
