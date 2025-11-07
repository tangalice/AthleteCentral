/**
 * ✅ Fixed Unit Test for TrackField.jsx
 * Covers: headings, mode toggle, input validation, calculations, predictions
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import TrackField from "../components/TrackField";
jest.mock("firebase/app", () => ({
    initializeApp: jest.fn(() => ({})),
  }));
  
  jest.mock("firebase/auth", () => ({
    getAuth: jest.fn(() => ({})),
  }));
  
  jest.mock("firebase/firestore", () => ({
    getFirestore: jest.fn(() => ({})),
    doc: jest.fn(() => ({})),
    getDoc: jest.fn(() => Promise.resolve({ exists: () => false })),
    updateDoc: jest.fn(() => Promise.resolve()),
    setDoc: jest.fn(() => Promise.resolve()),
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  }));

// ---- ✅ Mock Firestore ----

// ---- ✅ Mock localStorage ----
beforeAll(() => {
  global.localStorage = {
    store: {},
    getItem(key) {
      return this.store[key] || null;
    },
    setItem(key, value) {
      this.store[key] = value.toString();
    },
    clear() {
      this.store = {};
    },
    removeItem(key) {
      delete this.store[key];
    },
  };
});

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// ---- ✅ Tests ----
describe("🏃‍♀️ TrackField Component", () => {
  test("renders main headings correctly", () => {
    render(<TrackField />);
    expect(screen.getByText(/Track & Field/i)).toBeInTheDocument();
    expect(screen.getByText(/Indoor \/ Outdoor Adjustment/i)).toBeInTheDocument();
    expect(screen.getByText(/Race Time Prediction/i)).toBeInTheDocument();
  });

  test("toggles mode radio buttons", async () => {
    render(<TrackField />);
    const indoorRadios = screen.getAllByLabelText(/Indoor/i);
    const outdoorRadios = screen.getAllByLabelText(/Outdoor/i);

    expect(indoorRadios[0]).toBeChecked();
    await act(async () => {
      fireEvent.click(outdoorRadios[0]);
    });
    expect(outdoorRadios[0]).toBeChecked();
  });

  test("shows error if distance or time missing", async () => {
    render(<TrackField />);
    const button = screen.getByText(/Calculate Adjustment/i);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(
      screen.getByText(/Please enter both distance and time/i)
    ).toBeInTheDocument();
  });

  test("calculates adjusted time correctly (indoor to outdoor)", async () => {
    render(<TrackField />);
    const inputs = screen.getAllByRole("spinbutton");

    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "400" } }); // distance
      fireEvent.change(inputs[1], { target: { value: "60" } }); // time
      fireEvent.click(screen.getByText(/Calculate Adjustment/i));
    });

    await waitFor(() => {
      expect(screen.getByText(/Adjusted Outdoor Time/i)).toBeInTheDocument();
    });
  });

  test("predicts race time correctly", async () => {
    render(<TrackField />);
    const numberInputs = screen.getAllByRole("spinbutton");

    await act(async () => {
      fireEvent.change(numberInputs[2], { target: { value: "400" } }); // known distance
      fireEvent.change(numberInputs[3], { target: { value: "60" } }); // known time
      fireEvent.change(numberInputs[4], { target: { value: "800" } }); // target distance
      fireEvent.click(screen.getByText(/Predict Time/i));
    });

    await waitFor(() => {
      expect(screen.getByText(/Predicted/i)).toBeInTheDocument();
    });
  });

  test("shows error for unrealistic input", async () => {
    render(<TrackField />);
    const numberInputs = screen.getAllByRole("spinbutton");

    await act(async () => {
      fireEvent.change(numberInputs[2], { target: { value: "100" } });
      fireEvent.change(numberInputs[3], { target: { value: "200" } });
      fireEvent.change(numberInputs[4], { target: { value: "400" } });
      fireEvent.click(screen.getByText(/Predict Time/i));
    });

    await waitFor(() => {
      expect(screen.getByText(/unrealistic/i)).toBeInTheDocument();
    });
  });
});
