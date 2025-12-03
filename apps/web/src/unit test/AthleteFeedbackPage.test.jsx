/**
 * @file src/unit test/AthleteFeedbackPage.test.jsx
 * @description Unit tests for athlete feedback submission page (AthleteFeedback.jsx)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// mock useParams & useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useParams: () => ({ pollId: "poll123" }),
  useNavigate: () => mockNavigate,
}));

// mock firebase config
vi.mock("../firebase", () => ({
  db: "mockDb",
  auth: {
    currentUser: { uid: "athlete123" },
  },
}));

// mock Firestore functions
import {
  getDoc,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => "mockDb"),

  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => "mockTimestamp"),
}));

// Import tested component AFTER mock
import AthleteFeedback from "../pages/AthleteFeedback";

describe("AthleteFeedback (athlete submits feedback poll)", () => {
  const pollSnap = {
    exists: () => true,
    id: "poll123",
    data: () => ({
      title: "Wellbeing Check",
      deadline: {
        toDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      questions: [
        {
          id: "q1",
          label: "How was practice today?",
          type: "rating",
        },
        {
          id: "q2",
          label: "Any comments?",
          type: "text",
        },
      ],
    }),
  };

  const noResponseSnap = {
    exists: () => false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // doc stub
    doc.mockImplementation((...args) => ({
      __ref: args, // debugging only
    }));
  });

  it("loads poll and shows title + questions", async () => {
    getDoc
      .mockResolvedValueOnce(pollSnap)     // loadPoll #1
      .mockResolvedValueOnce(pollSnap)     // loadPoll #2
      .mockResolvedValueOnce(noResponseSnap); // checkSubmission

    render(<AthleteFeedback />);

    expect(await screen.findByText("Wellbeing Check")).toBeInTheDocument();

    expect(screen.getByText("How was practice today?")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    expect(screen.getByText("Any comments?")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("submits answers and shows Thank you message", async () => {
    getDoc
      .mockResolvedValueOnce(pollSnap)
      .mockResolvedValueOnce(pollSnap)
      .mockResolvedValueOnce(noResponseSnap);

    render(<AthleteFeedback />);

    await screen.findByText("Wellbeing Check");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "4" },
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Felt good today." },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /submit feedback/i })
    );

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalledTimes(1);
    });

    expect(setDoc.mock.calls[0][1]).toEqual({
      answers: {
        q1: 4,
        q2: "Felt good today.",
      },
      submittedAt: "mockTimestamp",
    });

    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
  });
});
