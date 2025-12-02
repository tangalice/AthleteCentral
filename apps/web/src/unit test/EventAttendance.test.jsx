/**
 * ✅ Vitest version of unit tests for EventAttendance.jsx (pure JS)
 * Covers:
 *   - Loading & error state
 *   - Member fetching via fetchTeamAthletes
 *   - Coach interaction (status change, note change)
 *   - Attendance stats rendering
 *   - Firestore update & alert on save
 */

import React from "react";
import {
  render,
  screen,
  act,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import EventAttendance from "../components/EventAttendance";

// ---------- 🧩 window.alert mock ----------
if (!window.alert) {
  // jsdom 里一般有，这句只是兜底
  // @ts-ignore  // 这个只是注释，不会出 TS 报错
  window.alert = () => {};
}
vi.spyOn(window, "alert").mockImplementation(() => {});

// ---------- 🔧 Mock firebase + Firestore ----------

// mock ../firebase
vi.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "U1", email: "coach@example.com" } },
}));

// 用一个可控的 onSnapshot mock，方便 per-test 改实现
const mockOnSnapshot = vi.fn();

// Firestore 函数 mock（全部改成没有类型的 JS 写法）
vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    collection: vi.fn(),
    updateDoc: vi.fn(() => Promise.resolve()),
    // ⬇⬇⬇ 去掉 : any[]
    onSnapshot: (...args) => mockOnSnapshot(...args),
  };
});

// ---------- 👥 Mock teamService ----------
import { fetchTeamAthletes } from "../services/teamService";
vi.mock("../services/teamService", () => ({
  fetchTeamAthletes: vi.fn(() =>
    Promise.resolve([
      { id: "A1", name: "Alice", email: "alice@example.com" },
      { id: "A2", name: "Bob", email: "bob@example.com" },
    ])
  ),
}));

// ---------- 📊 Mock constants ----------
vi.mock("../constants/constants", () => ({
  ATTENDANCE_STATUS: {
    PRESENT: "present",
    ABSENT: "absent",
    LATE: "late",
    EXCUSED: "excused",
  },
  ATTENDANCE_CONFIG: {
    present: { color: "#10b981", label: "Present", emoji: "✅" },
    absent: { color: "#ef4444", label: "Absent", emoji: "❌" },
    late: { color: "#f59e0b", label: "Late", emoji: "⏰" },
    excused: { color: "#3b82f6", label: "Excused", emoji: "📘" },
    unset: { color: "#9ca3af", label: "Unset", emoji: "⬜" },
  },
}));

// ---------- 🔁 默认的 onSnapshot 实现：返回一个正常的 event ----------
// ⬇⬇⬇ 去掉 (ref: any, cb: any)
const defaultOnSnapshotImpl = (ref, cb) => {
  cb({
    exists: () => true,
    data: () => ({
      title: "Morning Practice",
      datetime: { toDate: () => new Date("2025-11-06T08:00:00") },
      assignedMemberIds: ["A1", "A2"],
      attendanceRecords: {
        A1: { status: "present", note: "On time" },
        A2: { status: "late", note: "" },
      },
    }),
  });
  return () => {};
};

// ---------- 🧼 beforeEach ----------
beforeEach(() => {
  vi.clearAllMocks();
  window.alert.mockClear();

  mockOnSnapshot.mockImplementation(defaultOnSnapshotImpl);
});

// ---------- 🧪 Tests ----------

describe("📋 EventAttendance Component", () => {
  it("renders loading state", () => {
    // 对这个测试，我们让 onSnapshot 不立刻回调，保证 loading 文本可见
    mockOnSnapshot.mockImplementationOnce(() => () => {});

    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    expect(
      screen.getByText(/Loading event and member details/i)
    ).toBeInTheDocument();
  });

  it("renders event details and attendance stats", async () => {
    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    await waitFor(() => {
      expect(screen.getByText("Morning Practice")).toBeInTheDocument();
      expect(screen.getByText(/Assigned Athletes/i)).toBeInTheDocument();
      // 下面两个根据你的组件的具体文案：这里假设有 Present / Late 文字
      expect(screen.getByText(/Present/i)).toBeInTheDocument();
      expect(screen.getByText(/Late/i)).toBeInTheDocument();
    });
  });

  it("fetches team athletes through fetchTeamAthletes", async () => {
    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    await waitFor(() => {
      expect(fetchTeamAthletes).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("coach can change athlete status and add note", async () => {
    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    // 等待列表渲染出 Bob
    await waitFor(() => screen.getByText("Bob"));

    // 假设每个状态按钮上有 title="Late" 这样的 tooltip 文案
    const lateBtnList = screen.getAllByTitle("Late");
    // 第二个是 Bob 的
    const lateBtn = lateBtnList[1];

    await act(async () => {
      fireEvent.click(lateBtn);
    });

    const noteInputs = screen.getAllByPlaceholderText("Note...");
    const noteInput = noteInputs[1];

    await act(async () => {
      fireEvent.change(noteInput, { target: { value: "Traffic" } });
    });

    // ⬇⬇⬇ 去掉 (noteInput as HTMLInputElement)
    expect(noteInput.value).toBe("Traffic");
  });

  it("calls updateDoc when saving attendance", async () => {
    const { updateDoc } = await import("firebase/firestore");

    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    await waitFor(() => screen.getByText("Save Attendance"));

    const saveBtn = screen.getByText("Save Attendance");

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalledTimes(1);
    });
  });

  it("shows alert when attendance saved successfully", async () => {
    render(<EventAttendance eventId="E1" teamId="T1" isCoach={true} />);

    await waitFor(() => screen.getByText("Save Attendance"));
    const saveBtn = screen.getByText("Save Attendance");

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(window.alert).toHaveBeenCalledWith(
      "Attendance saved successfully!"
    );
  });

  it("renders error state if event not found", async () => {
    // 这次让 onSnapshot 返回不存在的文档
    // ⬇⬇⬇ 去掉 (ref: any, cb: any)
    mockOnSnapshot.mockImplementationOnce((ref, cb) => {
      cb({ exists: () => false });
      return () => {};
    });

    render(<EventAttendance eventId="bad" teamId="T1" isCoach={true} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Error: Event not found/i)
      ).toBeInTheDocument();
    });
  });
});
