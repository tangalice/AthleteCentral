/**
 * ✅ Final Calendar.test.jsx — all 6 pass
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import Calendar from "../components/Calendar";

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({})),
}));
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
}));
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  addDoc: jest.fn(() => Promise.resolve()),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  orderBy: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(() => ({})),
  updateDoc: jest.fn(() => Promise.resolve()),
  onSnapshot: jest.fn(() => () => {}),
}));

beforeAll(() => {
  global.localStorage = {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = v.toString(); },
    clear() { this.store = {}; },
    removeItem(k) { delete this.store[k]; },
  };
});
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe("📅 Calendar Component", () => {
  test("renders calendar header and sections", () => {
    render(<Calendar userRole="coach" />);
    expect(screen.getByText(/Team Calendar/i)).toBeInTheDocument();

    const upcomingSections = screen.getAllByText(/Upcoming Events/i);
    expect(upcomingSections.length).toBeGreaterThan(0);

    // fix: avoid duplicate Past Events
    const pastSections = screen.getAllByText((_, el) =>
      el.textContent?.includes("Past Events")
    );
    expect(pastSections.length).toBeGreaterThan(0);
  });

  test("coach sees 'Create New Event' button", () => {
    render(<Calendar userRole="coach" />);
    expect(screen.getByText(/Create New Event/i)).toBeInTheDocument();
  });

  test("athlete should not see 'Create New Event' button", () => {
    render(<Calendar userRole="athlete" />);
    expect(screen.queryByText(/Create New Event/i)).not.toBeInTheDocument();
  });

  test("clicking 'Create New Event' opens modal", async () => {
    render(<Calendar userRole="coach" />);
    const buttons = screen.getAllByText(/Create New Event/i);
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Event Title/i)).toBeInTheDocument();
  });

  test("shows validation error when creating empty event", async () => {
    render(<Calendar userRole="coach" />);
    const buttons = screen.getAllByText(/Create New Event/i);
    await act(async () => {
      fireEvent.click(buttons[0]);
    });

    const submit = screen.getByText(/Create Event/i);
    await act(async () => {
      fireEvent.click(submit);
    });

    // more flexible text matcher
    expect(
      screen.queryByText((content) => content.toLowerCase().includes("title is required"))
    ).toBeTruthy();
    expect(
      screen.queryByText((content) => content.toLowerCase().includes("date is required"))
    ).toBeTruthy();
    expect(
      screen.queryByText((content) => content.toLowerCase().includes("time is required"))
    ).toBeTruthy();
  });

  test("shows 'No upcoming events scheduled' when event list empty", () => {
    render(<Calendar userRole="coach" />);
    expect(
      screen.getByText(/No upcoming events scheduled/i)
    ).toBeInTheDocument();
  });
});
