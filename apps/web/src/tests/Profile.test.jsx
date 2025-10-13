import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// mock ../firebase exports used by the component
const mockCurrentUser = { uid: "u1" };
vi.mock("../firebase", () => ({
  auth: { get currentUser() { return mockCurrentUser; } },
  db: {},
}));

// mock firestore data read/write
const mockGetDoc = vi.fn().mockResolvedValue({
  exists: () => true,
  data: () => ({
    displayName: "Jessie",
    role: "athlete",
  }),
});
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn(() => ({}));
const mockServerTimestamp = vi.fn(() => new Date());

vi.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

import Profile from "../components/Profile.jsx";

describe("Profile", () => {
  it("loads user profile and saves updates", async () => {
    render(<Profile />);

    // Loading indicator first
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Display Name/i)).toHaveValue("Jessie");
    });
    expect(screen.getByLabelText(/Role/i)).toHaveValue("athlete");

    // Change display name and save
    fireEvent.change(screen.getByLabelText(/Display Name/i), {
      target: { value: "Jessie L" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          displayName: "Jessie L",
          role: "athlete",
        })
      );
    });
  });
});
