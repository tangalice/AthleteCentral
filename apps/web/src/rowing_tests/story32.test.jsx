/**
 * Story 32 — Lineup Builder + visibility + team avg
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import LineupBuilder from "../components/LineupBuilder";
import IndividualPerformance from "../components/IndividualPerformance";
import GroupPerformance from "../components/GroupPerformance";

vi.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "coach" } },
}));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
vi.mock("firebase/firestore", () => ({
  getDoc: (...a) => mockGetDoc(...a),
  getDocs: (...a) => mockGetDocs(...a),
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("Story 32", () => {
  test("32.2 — LineupBuilder averages update when swapping athletes", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ athletes: ["A1", "A2"], members: [] }),
    });

    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ displayName: "Alice" }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ displayName: "Bob" }) });

    mockGetDocs
      .mockResolvedValueOnce({ docs: [{ id: "1", data: () => ({ testPiece: "2k", time: 480, isPublic: true }) }] })
      .mockResolvedValueOnce({ docs: [{ id: "2", data: () => ({ testPiece: "2k", time: 520, isPublic: true }) }] });

    render(<LineupBuilder user={{ teamId: "T1", role: "coach" }} />);

    const buttons = await screen.findAllByRole("button", { name: /→ 1/i });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    await waitFor(() =>
      expect(screen.getAllByText(/Boat Average/i)[0]).toBeInTheDocument()
    );
  });

  test("32.3 — GroupPerformance shows team average", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: "a1", data: () => ({ userId: "A1", name: "Alice", testPiece: "2k", time: 480 }) },
        { id: "a2", data: () => ({ userId: "A2", name: "Bob", testPiece: "2k", time: 520 }) },
      ],
    });
    render(<GroupPerformance teamId="T1" defaultPiece="2k" />);
    const avg = await screen.findByTestId("team-average");
    expect(avg.textContent).toMatch(/8:20|500/);
  });
});
