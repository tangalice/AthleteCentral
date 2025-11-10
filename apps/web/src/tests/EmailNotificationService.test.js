import { describe, test, expect, beforeEach, vi } from "vitest";

// Ensure window.location.origin exists before importing the module under test
Object.defineProperty(global, "window", {
  value: { location: { origin: "http://localhost" } },
  writable: true,
});

// Mocks for firebase/firestore
const mockGetDoc = vi.fn();
const mockAddDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  getDoc: (...args) => mockGetDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
}));

// Mock the firebase db export used by the service
vi.mock("../firebase", () => ({ db: {} }));

describe("EmailNotificationService", () => {
  let service;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockGetDoc.mockReset();
    mockAddDoc.mockReset();
    mockCollection.mockReset();
    mockDoc.mockReset();

    // default mocks
    mockCollection.mockReturnValue({ path: "mail" });
    mockDoc.mockImplementation((db, col, id) => ({ db, col, id }));

    // Dynamically import module after mocks/window setup
    service = await import("../services/EmailNotificationService.js");
  });

  test("shouldSendEmailNotification returns false when user prefs missing", async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const res = await service.shouldSendEmailNotification("user1", "unreadMessages");
    expect(res).toBe(false);
  });

  test("shouldSendEmailNotification returns false when emailNotifications disabled", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ emailNotifications: false, email: "user@example.com" }),
      id: "user1",
    });
    const res = await service.shouldSendEmailNotification("user1", "unreadMessages");
    expect(res).toBe(false);
  });

  test("sendEmailNotification queues mail when allowed and formatted", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        emailNotifications: true,
        email: "athlete@example.com",
        displayName: "Athlete",
        unreadMessages: true,
      }),
      id: "user1",
    });

    mockAddDoc.mockResolvedValueOnce({ id: "mail-doc-id" });

    const result = await service.sendEmailNotification("user1", "incompleteProfile", {});

    expect(result).toEqual({ success: true });
    expect(mockCollection).toHaveBeenCalledWith({}, "mail");
    expect(mockAddDoc).toHaveBeenCalledTimes(1);

    const addDocArgs = mockAddDoc.mock.calls[0][1];
    expect(addDocArgs.to).toBe("athlete@example.com");
    expect(addDocArgs.message.subject).toBe("Complete Your Profile");
    expect(typeof addDocArgs.message.text).toBe("string");
    expect(typeof addDocArgs.message.html).toBe("string");
  });

  test("sendEmailNotification skips when prefs (or email presence) disallow", async () => {
    // Force prefs check to pass
    const shouldSpy = vi
      .spyOn(service, "shouldSendEmailNotification")
      .mockResolvedValue(true);

    // Return prefs with an empty email (bypasses the fallback to userId)
    const prefsSpy = vi
      .spyOn(service, "getUserNotificationPreferences")
      .mockResolvedValue({
        emailNotifications: true,
        incompleteProfile: true, // type enabled
        email: "",               // <-- triggers no_email in sendEmailNotification
        displayName: "User",
      });

    const result = await service.sendEmailNotification("user1", "incompleteProfile", {});
    expect(result).toEqual({ success: false, reason: "preferences_disabled" });
    expect(mockAddDoc).not.toHaveBeenCalled();

    // cleanup (optional)
    shouldSpy.mockRestore();
    prefsSpy.mockRestore();
  });

  test("sendEmailNotification handles formatter error for unknown type", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ emailNotifications: true, email: "x@y.com" }),
      id: "user1",
    });

    const result = await service.sendEmailNotification("user1", "unknownType", {});
    expect(result).toEqual({ success: false, reason: "format_error" });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});


