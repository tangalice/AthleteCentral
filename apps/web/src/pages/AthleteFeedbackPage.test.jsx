/**
 * @file __tests__/AthleteFeedbackPage.test.jsx
 * @description Unit tests for the Acknowledge Feedback feature in AthleteFeedbackPage.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AthleteFeedbackPage from "../src/pages/AthleteFeedbackPage";
import { db } from "../src/firebase";
import {
  updateDoc,
  addDoc,
  getDocs,
  query,
  collection,
  doc,
  where,
} from "firebase/firestore";

// === Mock Firebase Firestore methods ===
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  addDoc: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => "mockTimestamp"),
  increment: jest.fn(() => "mockIncrement"),
}));

describe("AthleteFeedbackPage - Acknowledge Feedback", () => {
  const mockUser = {
    uid: "athlete123",
    displayName: "John Doe",
  };

  const mockFeedback = [
    {
      id: "feedback1",
      coachId: "coach123",
      coachName: "Coach Carter",
      message: "Good job in practice today!",
      category: "practice",
      date: { toDate: () => new Date("2025-11-05T12:00:00Z") },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock onSnapshot listener immediately returning our mock feedback
    require("firebase/firestore").onSnapshot.mockImplementation((_q, callback) => {
      callback({
        docs: mockFeedback.map((f) => ({
          id: f.id,
          data: () => f,
        })),
      });
      return jest.fn(); // unsub function
    });

    collection.mockImplementation(() => "mockCollection");
    doc.mockImplementation(() => "mockDoc");
    query.mockImplementation(() => "mockQuery");
    where.mockImplementation(() => "mockWhere");
  });

  test("renders feedback item and shows Acknowledge button", async () => {
    render(<AthleteFeedbackPage user={mockUser} />);

    // Expect feedback message and Acknowledge button to appear
    expect(await screen.findByText(/Good job in practice today!/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acknowledge/i })).toBeInTheDocument();
  });

  test("calls updateDoc and addDoc when Acknowledge button is clicked", async () => {
    getDocs.mockResolvedValueOnce({
      forEach: (cb) => {}, // No existing chat found
    });

    addDoc
      .mockResolvedValueOnce({ id: "newChatId" }) // first addDoc = new chat
      .mockResolvedValueOnce({ id: "newMessageId" }); // second addDoc = message

    render(<AthleteFeedbackPage user={mockUser} />);

    const button = await screen.findByRole("button", { name: /Acknowledge/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalledWith("mockDoc", expect.objectContaining({
        acknowledged: true,
        acknowledgedAt: "mockTimestamp",
        category: "acknowledged",
      }));
    });

    // addDoc should be called twice: once for chat creation, once for message
    expect(addDoc).toHaveBeenCalledTimes(2);
    expect(addDoc).toHaveBeenCalledWith("mockCollection", expect.objectContaining({
      senderName: mockUser.displayName,
      text: expect.stringContaining("acknowledged your feedback"),
    }));
  });

  test("uses existing chat if found instead of creating a new one", async () => {
    getDocs.mockResolvedValueOnce({
      forEach: (cb) =>
        cb({
          id: "existingChatId",
          data: () => ({ participants: ["athlete123", "coach123"] }),
        }),
    });

    addDoc.mockResolvedValueOnce({ id: "msgId" }); // only message addDoc

    render(<AthleteFeedbackPage user={mockUser} />);

    const button = await screen.findByRole("button", { name: /Acknowledge/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
      expect(addDoc).toHaveBeenCalledTimes(1); // only message add
      expect(addDoc).toHaveBeenCalledWith("mockCollection", expect.objectContaining({
        chatId: "existingChatId",
        text: expect.stringContaining("acknowledged your feedback"),
      }));
    });
  });
});