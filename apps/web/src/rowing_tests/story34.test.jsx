/**
 * Story 34 — Watts Page
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import WattsPage from "../components/WattsPage";

const mockGetDocs = vi.fn();
vi.mock("firebase/firestore", () => ({
  getDocs: (...a) => mockGetDocs(...a),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

describe("Story 34 — Watts Page", () => {
  const twoK = { id: "r1", data: () => ({ testPiece: "2k", time: 480 }) };

  test("34.1 — athlete computes watts", async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [twoK] });
    render(<WattsPage user={{ uid: "A1" }} />);
    fireEvent.change(screen.getByLabelText(/weight.*kg/i), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText(/test piece/i), { target: { value: "2k" } });
    const watts = await screen.findByTestId("avg-watts");
    const wkg = await screen.findByTestId("watts-kg");
    expect(watts.textContent).toMatch(/\d/);
    expect(wkg.textContent).toMatch(/\d/);
  });

  test("34.2 — coach selects athlete → watts visible", async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [twoK] });
    render(<WattsPage teamId="T1" isCoach />);
    const athleteSel = await screen.findByLabelText(/athlete/i);
    fireEvent.change(athleteSel, { target: { value: "A1" } });
    fireEvent.change(screen.getByLabelText(/weight.*kg/i), { target: { value: "75" } });
    fireEvent.change(screen.getByLabelText(/test piece/i), { target: { value: "2k" } });
    await waitFor(() => expect(screen.getByTestId("avg-watts")).toBeInTheDocument());
  });
});
