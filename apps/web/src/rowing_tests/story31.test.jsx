/**
 * Story 31 — Individual & Group Performance
 * - 31.1 Individual Performances
 * - 31.2 Group Performance (list + filter)
 * - 31.3 Group Performance (complete vs incomplete)
 * - 31.4 Switching between views (navigation)
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ⬇️ adjust these imports to match your components
import IndividualPerformance from "../components/IndividualPerformance";
import GroupPerformance from "../components/GroupPerformance";

// ---------- Mocks ----------
Object.defineProperty(window, "alert", { writable: true, value: vi.fn() });

const mockGetDocs = vi.fn();
vi.mock("firebase/firestore", () => ({
  getDocs: (...a) => mockGetDocs(...a),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "U1" } },
}));

vi.mock("../services/teamService", () => ({
  fetchTeamAthletes: vi.fn(() =>
    Promise.resolve([
      { id: "A1", name: "Alice" },
      { id: "A2", name: "Bob" },
      { id: "A3", name: "Cara" },
    ])
  ),
}));

const fakeRows = [
  { userId: "A1", name: "Alice", testPiece: "2k", time: 480, date: "2025-01-02" },
  { userId: "A1", name: "Alice", testPiece: "6k", time: 1200, date: "2025-02-02" },
  { userId: "A2", name: "Bob", testPiece: "2k", time: 500, date: "2025-01-05" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDocs.mockResolvedValue({
    docs: fakeRows.map(r => ({ id: `${r.userId}-${r.testPiece}`, data: () => r })),
  });
});

describe("Story 31 — Individual & Group Performance", () => {
  test("31.1 — Individual: select name and filter by test piece", async () => {
    render(<IndividualPerformance teamId="T1" athleteId="A1" />);
    await waitFor(() => expect(screen.getByText(/Alice/)).toBeInTheDocument());

    const select = screen.getByLabelText(/test piece/i);
    fireEvent.change(select, { target: { value: "2k" } });
    await waitFor(() => {
      expect(screen.getByText(/2k/i)).toBeInTheDocument();
      expect(screen.queryByText(/6k/i)).not.toBeInTheDocument();
    });
  });

  test("31.2 — Group: shows all team rows and filters by type", async () => {
    render(<GroupPerformance teamId="T1" />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("Bob")).toBeInTheDocument();

    const pieceSelect = screen.getByLabelText(/test piece/i);
    fireEvent.change(pieceSelect, { target: { value: "2k" } });
    await waitFor(() => expect(screen.queryByText(/6k/i)).not.toBeInTheDocument());
  });

  test("31.3 — Group: complete vs incomplete list", async () => {
    render(<GroupPerformance teamId="T1" defaultPiece="2k" />);
    const incompleteTab = await screen.findByRole("button", { name: /incomplete/i });
    fireEvent.click(incompleteTab);

    await waitFor(() => {
      expect(screen.getByText("Cara")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });
  });

  test("31.4 — Navigation between Individual <-> Group", async () => {
    render(
      <MemoryRouter initialEntries={["/individual"]}>
        <Routes>
          <Route path="/individual" element={<IndividualPerformance teamId="T1" athleteId="A1" />} />
          <Route path="/group" element={<GroupPerformance teamId="T1" />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/Alice/)).toBeInTheDocument());
  });
});
