import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import TrackField from "../components/TrackField";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
} from "vitest";

// ---- ✅ Mock Firebase ----
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  updateDoc: vi.fn(() => Promise.resolve()),
  setDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
}));

// ---- ✅ Mock localStorage ----
beforeAll(() => {
  const store = {};

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(store, key)
          ? store[key]
          : null;
      },
      setItem(key, value) {
        store[key] = value.toString();
      },
      clear() {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      removeItem(key) {
        delete store[key];
      },
    },
  });
});

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

// ---- ✅ Tests ----
describe("🏃‍♀️ TrackField Component", () => {
  it("renders main headings correctly", () => {
    render(<TrackField />);
    expect(screen.getByText(/Track & Field/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Indoor \/ Outdoor Adjustment/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Race Time Prediction/i)).toBeInTheDocument();
  });

  it("toggles mode radio buttons", async () => {
    render(<TrackField />);
    const indoorRadios = screen.getAllByLabelText(/Indoor/i);
    const outdoorRadios = screen.getAllByLabelText(/Outdoor/i);

    expect(indoorRadios[0]).toBeChecked();

    await act(async () => {
      fireEvent.click(outdoorRadios[0]);
    });

    expect(outdoorRadios[0]).toBeChecked();
  });

  it("shows error if distance or time missing", async () => {
    render(<TrackField />);
    const button = screen.getByText(/Calculate Adjustment/i);

    await act(async () => {
      fireEvent.click(button);
    });

    expect(
      screen.getByText(/Please enter both distance and time/i)
    ).toBeInTheDocument();
  });

  it("calculates adjusted time correctly (indoor to outdoor)", async () => {
    render(<TrackField />);
    const inputs = screen.getAllByRole("spinbutton");

    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "400" } }); // distance
      fireEvent.change(inputs[1], { target: { value: "60" } }); // time
      fireEvent.click(screen.getByText(/Calculate Adjustment/i));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Adjusted Outdoor Time/i)
      ).toBeInTheDocument();
    });
  });

  it("predicts race time correctly", async () => {
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

  it("shows error for unrealistic input", async () => {
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
