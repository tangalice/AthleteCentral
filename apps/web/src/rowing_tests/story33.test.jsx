/**
 * Story 33 — Split Calculator & Goals
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SplitCalculator from "../components/SplitCalculator";
import Goals from "../components/Goals";

const mockSetDoc = vi.fn(() => Promise.resolve());
const mockGetDocs = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  setDoc: (...a) => mockSetDoc(...a),
  getDocs: (...a) => mockGetDocs(...a),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

describe("Story 33 — Split Calculator & Goals", () => {
  test("33.1 — My Splits tab shows /500m split", async () => {
    render(<SplitCalculator activeTab="my" />);
    fireEvent.change(screen.getByLabelText(/total time/i), { target: { value: "8:00.0" } });
    fireEvent.change(screen.getByLabelText(/distance/i), { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: /calculate/i }));
    const split = await screen.findByTestId("split-500m");
    expect(split.textContent).toMatch(/2:00/);
  });

  test("33.3 — Split from Goal tab saves goal", async () => {
    render(<SplitCalculator activeTab="splitFromGoal" user={{ uid: "A1", teamId: "T1" }} />);
    fireEvent.change(screen.getByLabelText(/goal time/i), { target: { value: "7:20.0" } });
    fireEvent.change(screen.getByLabelText(/distance/i), { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: /save this goal/i }));
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
  });

  test("33.3.5 — Coach sees athlete goal on Goals page", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: "g1",
          data: () => ({
            athleteId: "A1",
            athleteName: "Alice",
            distance: 2000,
            split: "1:50.0",
          }),
        },
      ],
    });
    render(<Goals teamId="T1" isCoach />);
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/1:50\.0/)).toBeInTheDocument();
  });
});
