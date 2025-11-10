/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import React from "react";
import {
  render,
  screen,
  within,
  cleanup,
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

// ---------------------------------------------------------------------------
// Mock firebase app-layer (what Activity.jsx imports via "../firebase")
// ---------------------------------------------------------------------------
vi.mock("../firebase", () => {
  return {
    auth: { currentUser: { uid: "u1" } },
    db: {},
  };
});

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------
vi.mock("../constants/constants", () => ({
  ATTENDANCE_STATUS: {
    PRESENT: "present",
    LATE: "late",
    ABSENT: "absent",
    EXCUSED: "excused",
  },
}));

// ---------------------------------------------------------------------------
// Hoist-safe Firestore mock (define functions INSIDE the factory).
// We'll program their behavior in beforeEach by importing the namespace.
// ---------------------------------------------------------------------------
vi.mock("firebase/firestore", () => {
  const fns = {
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    onSnapshot: vi.fn(),
  };

  const collection = (_db, ...path) => ({ __type: "collection", path });
  const query = (colRef /*, ...rest */) => ({
    __type: "query",
    collectionPath: colRef.path,
  });
  const where = (...args) => ({ __type: "where", args });
  const orderBy = (...args) => ({ __type: "orderBy", args });
  const doc = (_db, ...path) => ({ __type: "doc", path });

  return {
    collection,
    query,
    where,
    orderBy,
    onSnapshot: fns.onSnapshot,
    doc,
    getDocs: fns.getDocs,
    getDoc: fns.getDoc,
  };
});

// IMPORTANT: import the mocked namespace AFTER vi.mock so we can program it
import * as firestore from "firebase/firestore";

// ---------------------------------------------------------------------------
// Import the component under test
// (tests and components are siblings under src/, so go up one level)
// ---------------------------------------------------------------------------
import Activity from "../components/Activity.jsx";

// ---------------------------------------------------------------------------
// Test data + helpers
// ---------------------------------------------------------------------------

const FIXED_NOW = new Date("2025-11-06T12:00:00.000Z");

const makeSnapshot = (docs) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
});

const ts = (iso) => ({ toDate: () => new Date(iso) });

const usersList = [
  { id: "u1", data: { displayName: "Coach One", email: "coach1@example.com" } },
  { id: "u3", data: { displayName: "Runner Three", email: "runner3@example.com" } },
  // Alice is needed because Activity injects workouts by her email
  { id: "aliceId", data: { displayName: "Alice Tang", email: "tang.alice.000@gmail.com" } },
];

const teamDocs = [
  { id: "t1", data: { name: "Team One" } },
  { id: "tA", data: { name: "Team Alice" } },
];

const eventsByTeam = {
  "teams/t1/events": [
    {
      id: "e1",
      data: {
        title: "Practice",
        datetime: ts("2025-11-01T10:00:00.000Z"),
        attendanceRecords: {
          u1: { status: "present" },
          u2: { status: "excused" }, // ignored
          u3: { status: "late", note: "5 min late" },
        },
      },
    },
  ],
  "teams/tA/events": [],
};

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Keep "now" stable without using fake timers
  vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW.getTime());

  // Program getDocs routing based on collection path
  firestore.getDocs.mockReset().mockImplementation((q) => {
    const p = q?.collectionPath?.join("/") ?? "";
    if (p === "teams") return Promise.resolve(makeSnapshot(teamDocs));
    if (p === "users") return Promise.resolve(makeSnapshot(usersList));
    if (p === "teams/t1/events") {
      return Promise.resolve(makeSnapshot(eventsByTeam["teams/t1/events"]));
    }
    if (p === "teams/tA/events") {
      return Promise.resolve(makeSnapshot(eventsByTeam["teams/tA/events"]));
    }
    return Promise.resolve(makeSnapshot([]));
  });

  // Program getDoc for user lookups
  firestore.getDoc.mockReset().mockImplementation((docRef) => {
    const path = docRef.path.join("/");
    // Expecting "users/<id>"
    const [, userId] = path.split("/").slice(-2);
    const found = usersList.find((u) => u.id === userId);
    return found
      ? Promise.resolve({ exists: () => true, data: () => found.data })
      : Promise.resolve({ exists: () => false, data: () => ({}) });
  });
});

afterEach(() => {
  cleanup();          // unmount previous render
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("<Activity />", () => {
  it("renders activity feed with attendance + injected mock workouts, sorted by date", async () => {
    render(<Activity userRole="coach" user={{ id: "u1" }} />);

    // Header shows up when render completes
    const heading = await screen.findByRole("heading", { name: /activity feed/i });
    expect(heading).toBeInTheDocument();

    // Attendance items
    expect(
      await screen.findByRole("heading", { name: /coach one\s+attended\s+practice/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /runner three\s+attended\s+practice\s+\(late\)/i })
    ).toBeInTheDocument();

    // Injected Alice workouts
    expect(
      await screen.findByRole("heading", { name: /alice tang\s+logged a\s+sprint workout/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /alice tang\s+logged a\s+tempo run/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /alice tang\s+logged a\s+strength session/i })
    ).toBeInTheDocument();

    // Summary stats
    const totalWrap = screen.getByText("Total Activities").parentElement;
    expect(within(totalWrap).getByText(/^\s*5\s*$/)).toBeInTheDocument();

    const completedWrap = screen.getByText("Completed/Attended").parentElement;
    expect(within(completedWrap).getByText(/^\s*5\s*$/)).toBeInTheDocument();

    const avgWrap = screen.getByText("Avg Duration").parentElement;
    expect(within(avgWrap).getByText(/^\s*40\s*min\s*$/)).toBeInTheDocument();

    const activeUsersWrap = screen.getByText("Active Users").parentElement;
    expect(within(activeUsersWrap).getByText(/^\s*3\s*$/)).toBeInTheDocument();
  });

  it("filters by 'My Activity' (viewMode=user) to only current user's items", async () => {
    render(<Activity userRole="coach" user={{ id: "u1" }} />);

    await screen.findByRole("heading", { name: /activity feed/i });

    await userEvent.click(screen.getByRole("button", { name: /my activity/i }));

    // Only u1's attendance remains
    expect(
      await screen.findByRole("heading", { name: /coach one\s+attended\s+practice/i })
    ).toBeInTheDocument();

    // Others should be gone
    expect(screen.queryByRole("heading", { name: /runner three/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /alice tang/i })).not.toBeInTheDocument();
  });

  it("searches by text across name/email/activity/team", async () => {
    render(<Activity userRole="coach" user={{ id: "u1" }} />);

    await screen.findByRole("heading", { name: /activity feed/i });

    const search = screen.getByPlaceholderText(
      /search by name, email, activity, or team/i
    );
    await userEvent.clear(search);
    await userEvent.type(search, "Sprint");

    expect(
      await screen.findByRole("heading", { name: /alice tang\s+logged a\s+sprint workout/i })
    ).toBeInTheDocument();

    // Others filtered out
    expect(screen.queryByRole("heading", { name: /tempo run/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /strength session/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /attended\s+practice/i })).not.toBeInTheDocument();
  });

  it("filters by team via the team select", async () => {
    render(<Activity userRole="coach" user={{ id: "u1" }} />);

    await screen.findByRole("heading", { name: /activity feed/i });

    // Team select appears when teams > 0; default value "All Teams"
    const [teamSelect] = screen.getAllByRole("combobox"); // first select is Teams
    await userEvent.selectOptions(teamSelect, "t1");

    expect(
      await screen.findByRole("heading", { name: /coach one\s+attended\s+practice/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /runner three\s+attended\s+practice\s+\(late\)/i })
    ).toBeInTheDocument();

    // Alice workouts (Team Alice) should not be present
    expect(screen.queryByRole("heading", { name: /alice tang/i })).not.toBeInTheDocument();
  });

  it("filters by a specific user via the user select", async () => {
    render(<Activity userRole="coach" user={{ id: "u1" }} />);

    await screen.findByRole("heading", { name: /activity feed/i });

    // There are two selects: [teamSelect, userSelect]
    const [, userSelect] = screen.getAllByRole("combobox");
    await userEvent.selectOptions(userSelect, "aliceId");

    expect(
      await screen.findByRole("heading", { name: /alice tang\s+logged a\s+sprint workout/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /alice tang\s+logged a\s+tempo run/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /alice tang\s+logged a\s+strength session/i })
    ).toBeInTheDocument();

    // Non-Alice items hidden
    expect(screen.queryByRole("heading", { name: /coach one\s+attended/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /runner three\s+attended/i })).not.toBeInTheDocument();
  });

  it("shows an empty-state message when filters eliminate all items", async () => {
    render(<Activity userRole="coach" user={{ id: "u1" }} />);

    await screen.findByRole("heading", { name: /activity feed/i });

    const search = screen.getByPlaceholderText(
      /search by name, email, activity, or team/i
    );
    await userEvent.type(search, "no-match-whatsoever");

    expect(
      await screen.findByText("No activities match your filters")
    ).toBeInTheDocument();
  });
});
