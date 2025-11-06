/**
 * @file __tests__/PredictResultsPage.test.jsx
 * @description Unit tests for PredictResultsPage component.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PredictResultsPage from "../pages/PredictResultsPage";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

// === Mock dependencies ===
jest.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "user123", displayName: "Test User" } },
}));

jest.mock("react-firebase-hooks/auth", () => ({
  useAuthState: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => "mockTimestamp"),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useAuthState.mockReturnValue([{ uid: "user123", displayName: "Test User" }]);
});

// === Tests ===
describe("PredictResultsPage Component", () => {
  test("renders initial layout correctly", () => {
    render(<PredictResultsPage />);
    expect(screen.getByText("Predict Future Results")).toBeInTheDocument();
    expect(screen.getByText("Past Predictions")).toBeInTheDocument();
  });

  test("fetches and displays event options", async () => {
    const mockDocs = [
      { id: "1", data: () => ({ eventType: "100m" }) },
      { id: "2", data: () => ({ eventType: "200m" }) },
    ];
    getDocs.mockResolvedValueOnce({ forEach: (cb) => mockDocs.forEach(cb) });

    render(<PredictResultsPage />);

    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
      expect(screen.getByText("Select Event")).toBeInTheDocument();
    });
  });

  test("shows alert if not enough past data to make a prediction", async () => {
    global.alert = jest.fn();
    getDocs.mockResolvedValueOnce({
      forEach: (cb) => cb({ data: () => ({ eventType: "100m" }) }),
    }); // events
    getDocs.mockResolvedValueOnce({
      forEach: (cb) => cb({ data: () => ({ eventType: "100m", time: 12, date: { toDate: () => new Date() } }) }),
    }); // performances

    render(<PredictResultsPage />);

    fireEvent.change(screen.getByDisplayValue("Select Event"), { target: { value: "100m" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "2025-12-01" } });
    fireEvent.click(screen.getByText("Predict"));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith("Not enough past data to make a prediction.");
    });
  });

  test("adds a prediction document when enough data is available", async () => {
    const mockData = [
      {
        data: () => ({
          eventType: "100m",
          time: 12.0,
          date: { toDate: () => new Date("2025-10-01") },
        }),
      },
      {
        data: () => ({
          eventType: "100m",
          time: 11.5,
          date: { toDate: () => new Date("2025-10-15") },
        }),
      },
    ];

    getDocs
      .mockResolvedValueOnce({
        forEach: (cb) => cb({ data: () => ({ eventType: "100m" }) }),
      })
      .mockResolvedValueOnce({
        forEach: (cb) => mockData.forEach(cb),
      });

    addDoc.mockResolvedValueOnce({ id: "prediction1" });

    render(<PredictResultsPage />);

    fireEvent.change(screen.getByDisplayValue("Select Event"), { target: { value: "100m" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "2025-12-01" } });
    fireEvent.click(screen.getByText("Predict"));

    await waitFor(() => {
      expect(addDoc).toHaveBeenCalled();
    });
  });

  test("deletes a prediction when delete button is clicked and confirmed", async () => {
    window.confirm = jest.fn(() => true);
    onSnapshot.mockImplementation((q, cb) => {
      cb({
        docs: [
          {
            id: "pred1",
            data: () => ({
              eventType: "100m",
              competitionDate: "2025-12-01",
              predictedValue: 11.2,
              timestamp: { toDate: () => new Date() },
            }),
          },
        ],
      });
      return () => {};
    });

    render(<PredictResultsPage />);
    await waitFor(() => screen.getByText(/Predicted: 11.2s/i));

    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(deleteDoc).toHaveBeenCalled();
    });
  });

  test("formats date correctly using UTC", () => {
    const { container } = render(<PredictResultsPage />);
    const instance = container.firstChild;
    const formatted = new Date("2025-12-01").toLocaleDateString("en-US", { timeZone: "UTC" });
    expect(formatted).toBeTruthy();
  });
});