/**
 * @file src/unit test/CreateFeedbackPoll.test.jsx
 * @description Unit tests for coach creating a feedback poll (CreateFeedbackPoll.jsx)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---- mock react-router-dom hooks (只用到 useNavigate/useParams) ----
const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({}), // 没有 pollId → 创建模式
}));

// ---- mock firebase config ----
vi.mock("../firebase", () => ({
  db: "mockDb",
  auth: {
    currentUser: { uid: "coach123" }, // 当前登录教练
  },
}));

// ---- mock Firestore ----
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => "mockDb"),

  collection: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "mockTimestamp"),
  getDocs: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

// ⚠️ 一定要在 mock 之后再 import 组件
import CreateFeedbackPoll from "../pages/CreateFeedbackPoll";

describe("CreateFeedbackPoll - coach creates a new poll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // collection 返回一个可辨认的字符串（方便断言）
    collection.mockImplementation((_db, name) => `collection:${name}`);

    // doc 这里不会在“创建模式”里用到，但是先 stub 掉以防万一
    doc.mockImplementation((...args) => ({ __ref: args }));
  });

  // ---------- Test 1: 渲染基本表单 ----------
  it("renders create form with title, deadline and default questions", async () => {
    // getDocs 用在 teams 查询，这里随便给一个空的（不会触发到）
    getDocs.mockResolvedValueOnce({
      forEach: () => {},
    });

    render(<CreateFeedbackPoll />);

    // 标题文本 & 按钮
    expect(
      screen.getByRole("heading", { name: /create feedback poll/i })
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/poll title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/deadline/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create poll/i })
    ).toBeInTheDocument();

    // 默认问题预览里有几个关键 label
    expect(screen.getByText(/training quality/i)).toBeInTheDocument();
    expect(screen.getByText(/team morale/i)).toBeInTheDocument();
    expect(screen.getByText(/coaching effectiveness/i)).toBeInTheDocument();
    expect(screen.getByText(/additional comments/i)).toBeInTheDocument();
  });

  // ---------- Test 2: 没填 title 会报错，不会调用 addDoc ----------
  it("shows error if title is missing", async () => {
    getDocs.mockResolvedValueOnce({
      forEach: () => {},
    });

    render(<CreateFeedbackPoll />);

    // 只设置 deadline，不填 title
    const deadlineInput = screen.getByLabelText(/deadline/i);
    fireEvent.change(deadlineInput, {
      target: { value: "2025-11-30T12:00" },
    });

    // 点击创建
    fireEvent.click(screen.getByRole("button", { name: /create poll/i }));

    expect(
      await screen.findByText(/please enter a poll title\./i)
    ).toBeInTheDocument();

    // 不会发请求
    expect(addDoc).not.toHaveBeenCalled();
  });

  // ---------- Test 3: 教练不属于任何 team → 显示错误，不创建 poll ----------
  it("shows error if coach is not a coach of any team", async () => {
    // getDocs 返回一个 snapshot，但 forEach 不会 push 任何 team
    getDocs.mockResolvedValueOnce({
      forEach: () => {},
    });

    render(<CreateFeedbackPoll />);

    // 填 title & deadline
    fireEvent.change(screen.getByLabelText(/poll title/i), {
      target: { value: "Weekly Training Feedback" },
    });
    fireEvent.change(screen.getByLabelText(/deadline/i), {
      target: { value: "2025-11-30T12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create poll/i }));

    expect(
      await screen.findByText(/you are not a coach of any team\./i)
    ).toBeInTheDocument();

    expect(addDoc).not.toHaveBeenCalled();
  });

  
  
});
