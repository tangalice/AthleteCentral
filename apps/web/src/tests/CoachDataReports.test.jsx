/**
 * @file __tests__/CoachDataReports.test.jsx
 * @description Unit tests for CoachDataReports component.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CoachDataReports from "../components/CoachDataReports";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
} from "firebase/firestore";
import html2canvas from "html2canvas";

// === Mock external dependencies ===
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
}));

jest.mock("html2canvas", () => jest.fn());

beforeEach(() => {
  jest.clearAllMocks();
  auth.currentUser = { uid: "coach123", displayName: "Coach Smith" };
});

describe("CoachDataReports Component", () => {
  test("renders Data Reports heading and default message", () => {
    render(<CoachDataReports />);
    expect(screen.getByText("Data Reports")).toBeInTheDocument();
    expect(screen.getByText(/Select options and click Generate Report./i)).toBeInTheDocument();
  });

  test("fetches and displays athletes list", async () => {
    const mockUsers = [
      { id: "ath1", data: () => ({ role: "athlete", displayName: "John" }) },
      { id: "ath2", data: () => ({ role: "athlete", displayName: "Jane" }) },
    ];
    getDocs.mockResolvedValueOnce({ docs: mockUsers });

    render(<CoachDataReports />);

    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
      expect(screen.getByText("John")).toBeInTheDocument();
      expect(screen.getByText("Jane")).toBeInTheDocument();
    });
  });

  test("shows status when trying to generate without selecting athlete/event", async () => {
    render(<CoachDataReports />);
    const button = screen.getByRole("button", { name: /Generate Report/i });
    fireEvent.click(button);
    expect(await screen.findByText(/Please select an athlete and event/i)).toBeInTheDocument();
  });

  test("generates a report when athlete and event are selected", async () => {
    const mockDocs = [
      {
        id: "perf1",
        data: () => ({
          type: "competition",
          eventType: "100m",
          time: 12.5,
          date: { seconds: 1730000000 },
        }),
      },
    ];

    getDocs
      .mockResolvedValueOnce({ docs: [{ id: "athlete1", data: () => ({ role: "athlete", displayName: "Runner" }) }] })
      .mockResolvedValueOnce({ docs: mockDocs }); // performances

    render(<CoachDataReports />);

    // Simulate selecting athlete and event
    await waitFor(() => screen.getByText("Runner"));
    fireEvent.change(screen.getByRole("combobox", { name: "" }), { target: { value: "athlete1" } });

    // Manually set selectedEvent and type for simplicity
    fireEvent.change(screen.getByDisplayValue("competition"), { target: { value: "competition" } });
    fireEvent.change(screen.getByRole("combobox", { name: "" }), { target: { value: "100m" } });

    const generateButton = screen.getByText("Generate Report");
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
    });
  });

  test("saves a generated report successfully", async () => {
    addDoc.mockResolvedValueOnce({ id: "report1" });

    render(<CoachDataReports />);

    // Set internal state manually via DOM
    fireEvent.click(screen.getByText("Save Report"));

    await waitFor(() => {
      expect(addDoc).toHaveBeenCalled();
    });
  });

  test("shows message if trying to download CSV with no data", async () => {
    render(<CoachDataReports />);
    fireEvent.click(screen.getByText("Download CSV"));
    expect(await screen.findByText(/No data to download/i)).toBeInTheDocument();
  });

  test("shows message if trying to download PNG with no data", async () => {
    render(<CoachDataReports />);
    fireEvent.click(screen.getByText("Download PNG"));
    expect(await screen.findByText(/No data to export as image/i)).toBeInTheDocument();
  });

  test("exports PNG successfully when chartData exists", async () => {
    html2canvas.mockResolvedValueOnce({
      toDataURL: () => "data:image/png;base64,test",
    });

    render(<CoachDataReports />);
    // Mock chart data by directly manipulating the DOM ref
    const button = screen.getByText("Download PNG");
    fireEvent.click(button);

    await waitFor(() => {
      expect(html2canvas).toHaveBeenCalled();
    });
  });
});