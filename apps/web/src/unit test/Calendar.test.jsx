/**
 * ✅ Vitest version of Calendar.test.jsx
 */
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Calendar from "../components/Calendar";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
} from "vitest";

// ---- ✅ Mock Firebase ----
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve()),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })), // no events
  orderBy: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  updateDoc: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(() => () => {}),
}));

// ---- ✅ Mock localStorage ----
beforeAll(() => {
  const store = {};

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(store, key)
          ? store[key]
          : null;
      },
      setItem(key, value) {
        store[key] = value.toString();
      },
      clear() {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      removeItem(key) {
        delete store[key];
      },
    },
  });
});

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

// ---- ✅ Tests ----
describe("📅 Calendar Component", () => {
  it("renders calendar header and sections", () => {
    render(<Calendar userRole="coach" />);

    expect(screen.getByText(/Team Calendar/i)).toBeInTheDocument();

    const upcomingSections = screen.getAllByText(/Upcoming Events/i);
    expect(upcomingSections.length).toBeGreaterThan(0);

    // 避免“Past Events”重复导致精确匹配失败，用 includes
    const pastSections = screen.getAllByText((_, el) =>
      el.textContent && el.textContent.includes("Past Events")
    );
    expect(pastSections.length).toBeGreaterThan(0);
  });

  it("coach sees 'Create New Event' button", () => {
    render(<Calendar userRole="coach" />);
    expect(screen.getByText(/Create New Event/i)).toBeInTheDocument();
  });

  it("athlete should not see 'Create New Event' button", () => {
    render(<Calendar userRole="athlete" />);
    expect(
      screen.queryByText(/Create New Event/i)
    ).not.toBeInTheDocument();
  });

  it("clicking 'Create New Event' opens modal", async () => {
    render(<Calendar userRole="coach" />);
    const buttons = screen.getAllByText(/Create New Event/i);

    await act(async () => {
      fireEvent.click(buttons[0]);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Event Title/i)).toBeInTheDocument();
  });

  it("shows validation error when creating empty event", async () => {
    render(<Calendar userRole="coach" />);
    const buttons = screen.getAllByText(/Create New Event/i);

    await act(async () => {
      fireEvent.click(buttons[0]);
    });

    const submit = screen.getByText(/Create Event/i);

    await act(async () => {
      fireEvent.click(submit);
    });

    // 用更宽松的大小写无关匹配
    await waitFor(() => {
      expect(
        screen.queryByText((content) =>
          content.toLowerCase().includes("title is required")
        )
      ).toBeTruthy();
      expect(
        screen.queryByText((content) =>
          content.toLowerCase().includes("date is required")
        )
      ).toBeTruthy();
      expect(
        screen.queryByText((content) =>
          content.toLowerCase().includes("time is required")
        )
      ).toBeTruthy();
    });
  });

  it("shows 'No upcoming events scheduled' when event list empty", () => {
    render(<Calendar userRole="coach" />);

    expect(
      screen.getByText(/No upcoming events scheduled/i)
    ).toBeInTheDocument();
  });
});
