/**
 * @file src/unit test/FeedbackSummaryPage.test.jsx
 * @description Unit tests for coach viewing feedback results (FeedbackSummaryPage.jsx)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ---- mock react-router-dom ----
const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// ---- mock firebase config ----
vi.mock("../firebase", () => ({
  db: "mockDb",
}));

// ---- mock chart.js 组件：只渲染一个占位 div 就好 ----
vi.mock("react-chartjs-2", () => ({
  Bar: () => <div data-testid="bar-chart">Mock Chart</div>,
}));

// ---- mock Firestore ----
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  deleteDoc,
} from "firebase/firestore";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn((...args) => ({ __q: args })),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  deleteDoc: vi.fn(),
}));

// ⚠️ mocks 完成后再 import 组件
import FeedbackSummaryPage from "../pages/FeedbackSummaryPage";

describe("FeedbackSummaryPage - coach views feedback results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    collection.mockImplementation(() => ({ __col: true }));
    query.mockImplementation((...args) => ({ __q: args }));
  });

  // ---------- Test 1: 没有任何 poll 时，显示 “No polls found...” ----------
  it("shows empty state when there are no polls", async () => {
    // 第一次 getDocs：poll 列表（空）
    getDocs.mockResolvedValueOnce({
      docs: [],
    });

    render(<FeedbackSummaryPage />);

    expect(
      await screen.findByText(/no polls found for this time period/i)
    ).toBeInTheDocument();
  });

  // ---------- Test 2: 有一个 poll + 一条 response，展示平均值和评论 ----------
  it("renders poll averages and shows anonymous comments in the side panel", async () => {
    const deadlineDate = new Date("2025-11-30T12:00:00Z");
    const submittedDate = new Date("2025-11-29T10:00:00Z");

    // 第一次 getDocs：poll 列表
    getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: "poll1",
          data: () => ({
            title: "Week 1 Feedback",
            deadline: { toDate: () => deadlineDate },
          }),
        },
      ],
    });

    // 第二次 getDocs：poll1 的 responses
    getDocs.mockResolvedValueOnce({
      size: 1,
      forEach: (cb) =>
        cb({
          data: () => ({
            answers: {
              trainingQuality: 4,
              teamMorale: 5,
              coachingEffectiveness: 3,
              openComment: "Great week overall!",
            },
            submittedAt: { toDate: () => submittedDate },
          }),
        }),
    });

    render(<FeedbackSummaryPage />);

    // 等待 poll 加载出来
    expect(
      await screen.findByText("Week 1 Feedback")
    ).toBeInTheDocument();

    // Responses 计数
    expect(screen.getByText(/responses:\s*1/i)).toBeInTheDocument();

    // 平均值（4,5,3 → 4.00 / 5.00 / 3.00）
    expect(screen.getByText(/training:\s*4\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/morale:\s*5\.00/i)).toBeInTheDocument();
    expect(
      screen.getByText(/coaching effectiveness:\s*3\.00/i)
    ).toBeInTheDocument();

    // 右侧初始提示
    expect(
      screen.getByText(/click “view anonymous comments” on a poll/i)
    ).toBeInTheDocument();

    // 点左边的 “View Anonymous Comments (1)” 按钮
    fireEvent.click(
      screen.getByRole("button", { name: /view anonymous comments/i })
    );

    // 右侧 panel 里出现标题 + 评论内容
    expect(
      await screen.findByText(/week 1 feedback – anonymous comments/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/great week overall!/i)
    ).toBeInTheDocument();
  });

  // ---------- Test 3: 顶部 “Back to Dashboard” 按钮会调用 navigate(-1) ----------
  it("navigates back when clicking Back to Dashboard", async () => {
    // 仍然要 mock 一下 getDocs，否则 useEffect 里会 await
    getDocs.mockResolvedValueOnce({ docs: [] });

    render(<FeedbackSummaryPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /back to dashboard/i })
    );

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
