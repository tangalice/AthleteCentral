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
vi.mock("../firebase", () => {
  return {
    auth: { currentUser: { uid: "user1", displayName: "Current User" } },
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
    onSnapshot: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: Math.floor(Date.now() / 1000) })),
    query: vi.fn((colRef) => ({ __type: "query", collectionPath: colRef.path })),
    where: vi.fn((...args) => ({ __type: "where", args })),
  };

  const collection = (_db, ...path) => ({ __type: "collection", path });
  const doc = (_db, ...path) => ({ __type: "doc", path });

  return {
    collection,
    query: fns.query,
    where: fns.where,
    onSnapshot: fns.onSnapshot,
    doc,
    getDocs: fns.getDocs,
    getDoc: fns.getDoc,
    addDoc: fns.addDoc,
    serverTimestamp: fns.serverTimestamp,
  };
});

// IMPORTANT: import mocked namespace AFTER vi.mock
import * as firestore from "firebase/firestore";

/* -------------------- Component under test -------------------- */
import Teams from "../components/Teams.jsx";

/* -------------------- Test data & helpers -------------------- */
const makeSnapshot = (docs) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
});

const usersList = [
  { id: "user1", data: { displayName: "Current User", email: "user1@example.com", role: "coach" } },
  { id: "user2", data: { displayName: "Team Member", email: "user2@example.com", role: "athlete" } },
  { id: "user3", data: { displayName: "Another Member", email: "user3@example.com", role: "athlete" } },
];

const teamsList = [
  {
    id: "team1",
    data: {
      name: "Test Team",
      description: "A test team",
      joinCode: "ABC123",
      members: ["user1", "user2", "user3"],
      coaches: ["user1"],
      athletes: ["user2", "user3"],
      createdBy: "user1",
    },
  },
];

/** Find a “message-like” button inside the row that shows the given member name.
 * We search up to a container that has any button, then prefer a button whose
 * accessible name (or aria-label) matches /message|chat|dm|send/i; otherwise
 * just return the first button found. */
function findMessageButtonFor(memberName) {
  const nameNode = screen.getByText(memberName);
  let container = nameNode instanceof HTMLElement ? nameNode : nameNode.parentElement;
  const hasButton = (el) => el?.querySelector && el.querySelector('button');

  // ascend until we find a container with any button
  while (container && !hasButton(container)) {
    container = container.parentElement;
  }
  if (!container) return undefined;

  const btns = Array.from(container.querySelectorAll('button'));
  const rx = /message|chat|dm|send/i;

  // prefer role-labelled / accessible-name buttons
  for (const btn of btns) {
    const label = btn.getAttribute('aria-label') || btn.textContent || '';
    if (rx.test(label)) return btn;
  }
  // else just return the first button
  return btns[0];
}

/* -------------------- Lifecycle -------------------- */
beforeEach(() => {
  mockNavigate.mockClear();

  // getDoc for user role & member profiles
  firestore.getDoc.mockReset().mockImplementation(async (docRef) => {
    const path = docRef.path.join("/");
    if (path === "users/user1") {
      return {
        exists: () => true,
        data: () => ({ role: "coach", displayName: "Current User", email: "user1@example.com" }),
      };
    }
    if (path === "users/user2") {
      return {
        exists: () => true,
        data: () => ({ displayName: "Team Member", email: "user2@example.com", role: "athlete" }),
      };
    }
    if (path === "users/user3") {
      return {
        exists: () => true,
        data: () => ({ displayName: "Another Member", email: "user3@example.com", role: "athlete" }),
      };
    }
    return { exists: () => false, data: () => ({}) };
  });

  // onSnapshot for teams list (what Teams.jsx uses to load teams)
  firestore.onSnapshot.mockReset().mockImplementation((queryRef, callback) => {
    // call synchronously for snappy tests
    callback(makeSnapshot(teamsList));
    return () => {};
  });

  // Default getDocs behavior
  firestore.getDocs.mockReset().mockImplementation(async (queryRef) => {
    const path = queryRef?.collectionPath?.join("/") ?? "";
    if (path === "teams") return makeSnapshot(teamsList);
    if (path === "users") return makeSnapshot(usersList);
    if (path === "chats") return makeSnapshot([]); // default: no existing 1:1 chat
    return makeSnapshot([]);
  });

  // addDoc creates a fake chat id
  firestore.addDoc.mockReset().mockImplementation(async (_collectionRef, _data) => {
    return { id: `new-chat-${Date.now()}` };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* -------------------- Tests -------------------- */
describe("<Teams /> direct messaging from team member row", () => {
  it("creates a new 1:1 chat and navigates to it when clicking Message", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    // Team is visible
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    // Expand members (button label could vary; try common variants)
    const toggleBtn =
      screen.queryByRole("button", { name: /show members/i }) ||
      screen.queryByRole("button", { name: /members/i }) ||
      screen.queryByRole("button");
    await user.click(toggleBtn);

    // Member shows
    await waitFor(() => {
      expect(screen.getByText("Team Member")).toBeInTheDocument();
    });

    const msgBtn = findMessageButtonFor("Team Member");
    expect(!!msgBtn).toBe(true); // robust: ensure we found something button-like
    await user.click(msgBtn);

    // chats getDocs called to check existing
    await waitFor(() => {
      expect(firestore.getDocs).toHaveBeenCalled();
    });

    // addDoc called to create new chat
    await waitFor(() => {
      expect(firestore.addDoc).toHaveBeenCalled();
    });

    // navigates to /messages?chat=<new id> (URL may include extras)
    await waitFor(() => {
      const calls = mockNavigate.mock.calls.map((c) => c[0]);
      const to = calls.find((s) => typeof s === 'string' && s.startsWith('/messages?chat='));
      expect(!!to).toBe(true);
    });
  });

  it("navigates to an existing 1:1 chat (no creation) when one already exists", async () => {
    const user = userEvent.setup();

    // Provide an existing chat with participants [user1, user2]
    const existingChat = {
      id: "existing-chat-123",
      data: {
        name: "Team Member",
        participants: ["user1", "user2"],
        createdBy: "user1",
      },
    };

    firestore.getDocs.mockImplementation(async (queryRef) => {
      const path = queryRef?.collectionPath?.join("/") ?? "";
      if (path === "chats") {
        return makeSnapshot([existingChat]);
      }
      if (path === "teams") return makeSnapshot(teamsList);
      if (path === "users") return makeSnapshot(usersList);
      return makeSnapshot([]);
    });

    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    const toggleBtn =
      screen.queryByRole("button", { name: /show members/i }) ||
      screen.queryByRole("button", { name: /members/i }) ||
      screen.queryByRole("button");
    await userEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText("Team Member")).toBeInTheDocument();
    });

    const msgBtn = findMessageButtonFor("Team Member");
    expect(!!msgBtn).toBe(true);
    await user.click(msgBtn);

    // Should NOT create, because it already exists
    await waitFor(() => {
      expect(firestore.addDoc).not.toHaveBeenCalled();
    });

    // Navigate to the existing chat (URL may contain extras; just look for id)
    await waitFor(() => {
      const calls = mockNavigate.mock.calls.map((c) => c[0]);
      const to = calls.find((s) => typeof s === 'string' && s.includes('existing-chat-123'));
      expect(!!to).toBe(true);
    });
  });

  it("does not open a chat when clicking on yourself (button may be hidden or inert)", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeInTheDocument();
    });

    const toggleBtn =
      screen.queryByRole("button", { name: /show members/i }) ||
      screen.queryByRole("button", { name: /members/i }) ||
      screen.queryByRole("button");
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText("Current User")).toBeInTheDocument();
    });

    // Try to find a “message-like” button on the row with "Current User"
    const maybeSelfBtn = (function findMessageButtonFor(memberName) {
      const nameNode = screen.getByText(memberName);
      let container = nameNode instanceof HTMLElement ? nameNode : nameNode.parentElement;
      const hasButton = (el) => el?.querySelector && el.querySelector('button');
      while (container && !hasButton(container)) container = container.parentElement;
      if (!container) return undefined;
      const btns = Array.from(container.querySelectorAll('button'));
      const rx = /message|chat|dm|send/i;
      for (const btn of btns) {
        const label = btn.getAttribute('aria-label') || btn.textContent || '';
        if (rx.test(label)) return btn;
      }
      return undefined;
    })("Current User");

    if (!maybeSelfBtn) {
      // UI hides the button for self — that's fine
      expect(maybeSelfBtn).toBeUndefined();
    } else {
      // UI shows a button on self row — clicking it must NOT create or navigate to a chat
      await user.click(maybeSelfBtn);

      // No chat creation
      await waitFor(() => {
        expect(firestore.addDoc).not.toHaveBeenCalled();
      });

      // No navigation to /messages?chat=...
      const calls = mockNavigate.mock.calls.map((c) => c[0]);
      const navigatedToChat = calls.some(
        (s) => typeof s === "string" && s.includes("/messages?chat=")
      );
      expect(navigatedToChat).toBe(false);
    }
  });

});
