import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// 1) mock project-level firebase exports used by the component
vi.mock("../firebase", () => ({
  auth: {},
  db: {},
}));

// 2) mock firebase/auth methods
const mockCreate = vi.fn().mockResolvedValue({
  user: { uid: "u1", email: "new@user.com", emailVerified: false },
});
const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
const mockSendVerify = vi.fn().mockResolvedValue(undefined);

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: (...args) => mockCreate(...args),
  updateProfile: (...args) => mockUpdateProfile(...args),
  sendEmailVerification: (...args) => mockSendVerify(...args),
}));

// 3) mock firebase/firestore methods
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn(() => ({}));
const mockServerTimestamp = vi.fn(() => new Date());

vi.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

// 4) import component under test (adjust the path if needed)
import SignUp from "../components/SignUp.jsx";

describe("SignUp", () => {
  it("creates a new account and writes user doc to Firestore", async () => {
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>
    );

    // Fill the form
    fireEvent.change(screen.getByLabelText(/Display Name/i), {
      target: { value: "Jessie" },
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "new@user.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "abcdef" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));

    // Assertions
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.any(Object), "new@user.com", "abcdef");
    });

    expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", "u1");
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        uid: "u1",
        email: "new@user.com",
        displayName: "Jessie",
        role: "athlete",
      })
    );

    expect(mockUpdateProfile).toHaveBeenCalled();
    expect(mockSendVerify).toHaveBeenCalled();
  });
});
