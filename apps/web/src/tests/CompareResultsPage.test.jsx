/**
 * @file __tests__/CompareResultsPage.test.jsx
 * @description Unit tests for CompareResultsPage component.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompareResultsPage from "../pages/CompareResultsPage";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
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
}));

beforeEach(() => {
  jest.clearAllMocks();
  useAuthState.mockReturnValue([{ uid: "user123", displayName: "Test User" }]);
});

describe("CompareResultsPage Component", () => {
  test("renders page heading and prompt text", () => {
    render(<CompareResultsPage />);
    expect(screen.getByText(/Compare Predicted vs Actual Results/i)).toBeInTheDocument();
    expect(screen.getByText(/Select an event to see comparisons/i)).toBeInTheDocument();
  });

  test("fetches and displays event list from performances", async () => {
    const mockPerfDocs = [
      { id: "p1", data: () => ({ eventType: "100m" }) },
      { id: "p2", data: () => ({ eventType: "200m" }) },
    ];
    getDocs.mockResolvedValueOnce({ forEach: (cb) => mockPerfDocs.forEach(cb) });

    render(<CompareResultsPage />);

    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
      expect(screen.getByText("Select Event")).toBeInTheDocument();
    });
  });

  test("displays message if no comparisons found after selecting an event", async () => {
    const mockPerfDocs = [
      { id: "p1", data: () => ({ eventType: "100m" }) },
    ];
    getDocs
      .mockResolvedValueOnce({ forEach: (cb) => mockPerfDocs.forEach(cb) }) // loadEvents
      .mockResolvedValueOnce({ docs: [] }) // predictions
      .mockResolvedValueOnce({ docs: [] }); // performances

    render(<CompareResultsPage />);

    await waitFor(() => screen.getByText("Select Event"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "100m" } });

    await waitFor(() => {
      expect(screen.getByText(/No comparisons found for this event yet/i)).toBeInTheDocument();
    });
  });

  test("shows table of comparisons when predictions and performances match", async () => {
    const mockPredDocs = [
      {
        id: "pred1",
        data: () => ({
          eventType: "100m",
          predictedValue: 11.2,
          competitionDate: "2025-11-05",
        }),
      },
    ];

    const mockPerfDocs = [
      {
        id: "perf1",
        data: () => ({
          eventType: "100m",
          time: 11.4,
          date: { toDate: () => new Date("2025-11-05T00:00:00Z") },
        }),
      },
    ];

    getDocs
      // loadEvents
      .mockResolvedValueOnce({ forEach: (cb) => mockPerfDocs.forEach(cb) })
      // predictions
      .mockResolvedValueOnce({ docs: mockPredDocs })
      // performances
      .mockResolvedValueOnce({ docs: mockPerfDocs });

    render(<CompareResultsPage />);

    await waitFor(() => screen.getByText("Select Event"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "100m" } });

    await waitFor(() => {
      expect(getDocs).toHaveBeenCalledTimes(3);
      expect(screen.getByText(/Predicted Time/i)).toBeInTheDocument();
      expect(screen.getByText(/Actual Time/i)).toBeInTheDocument();
      expect(screen.getByText(/Difference/i)).toBeInTheDocument();
      expect(screen.getByText("100m")).toBeInTheDocument();
      expect(screen.getByText("11.20")).toBeInTheDocument();
      expect(screen.getByText("11.40")).toBeInTheDocument();
    });
  });

  test("calculates percent difference correctly and assigns color classes", async () => {
    const mockPredDocs = [
      {
        id: "pred1",
        data: () => ({
          eventType: "100m",
          predictedValue: 10.0,
          competitionDate: "2025-11-05",
        }),
      },
    ];

    const mockPerfDocs = [
      {
        id: "perf1",
        data: () => ({
          eventType: "100m",
          time: 10.5,
          date: { toDate: () => new Date("2025-11-05T00:00:00Z") },
        }),
      },
    ];

    getDocs
      .mockResolvedValueOnce({ forEach: (cb) => mockPerfDocs.forEach(cb) }) // loadEvents
      .mockResolvedValueOnce({ docs: mockPredDocs }) // predictions
      .mockResolvedValueOnce({ docs: mockPerfDocs }); // performances

    render(<CompareResultsPage />);

    await waitFor(() => screen.getByText("Select Event"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "100m" } });

    await waitFor(() => {
      const diffCell = screen.getByText(/4.76%/i);
      expect(diffCell).toBeInTheDocument();
      expect(
        diffCell.classList.contains("text-yellow-600") ||
        diffCell.classList.contains("text-green-600") ||
        diffCell.classList.contains("text-red-600")
      ).toBe(true);
    });
  });
});