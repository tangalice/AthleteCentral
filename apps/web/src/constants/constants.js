// src/constants/constants.js

export const GRADES = [
    { value: "9th", label: "9th Grade" },
    { value: "10th", label: "10th Grade" },
    { value: "11th", label: "11th Grade" },
    { value: "12th", label: "12th Grade" },
    { value: "Freshman", label: "College Freshman" },
    { value: "Sophomore", label: "College Sophomore" },
    { value: "Junior", label: "College Junior" },
    { value: "Senior", label: "College Senior" },
  ];
  
  export const SPORTS = [
    { value: "swimming", label: "Swimming" },
    { value: "track & field", label: "Track & Field" },
    { value: "cross country", label: "Cross Country" },
    { value: "rowing", label: "Rowing" },
    { value: "weightlifting", label: "Weightlifting" },
    { value: "basketball", label: "Basketball" },
    { value: "football", label: "Football" },
    { value: "soccer", label: "Soccer" },
    { value: "baseball", label: "Baseball" },
    { value: "softball", label: "Softball" },
    { value: "tennis", label: "Tennis" },
    { value: "volleyball", label: "Volleyball" },
    { value: "wrestling", label: "Wrestling" },
    { value: "golf", label: "Golf" },
    { value: "other", label: "Other" },
  ];
  
  export const EXPERIENCE_LEVELS = [
    { value: "Beginner", label: "Beginner (0-1 years)" },
    { value: "Intermediate", label: "Intermediate (2-4 years)" },
    { value: "Advanced", label: "Advanced (5+ years)" },
    { value: "Elite", label: "Elite/Professional" },
  ];
  
  export const USER_ROLES = {
    ATHLETE: "athlete",
    COACH: "coach",
  };
  
  export const ROUTES = {
    HOME: "/",
    LOGIN: "/login",
    SIGNUP: "/signup",
    DASHBOARD: "/dashboard",
    PROFILE: "/profile",
    MESSAGES: "/messages",
    SETTINGS: "/settings",
    VERIFY_EMAIL: "/verify-email",
    ATHLETE_DASHBOARD: "/athlete-dashboard",
    COACH_DASHBOARD: "/coach-dashboard",
  };
  
  export const COLORS = {
    primary: "#646cff",
    danger: "#ff4444",
    success: "#4CAF50",
    warning: "#ffa726",
    info: "#2196F3",
    light: "#f8f9fa",
    dark: "#333",
    muted: "#666",
    border: "#ddd",
    // New brand colors
    brand: {
      primary: "#10b981",
      secondary: "#0f172a",
      accent: "#ffeaa7",
    },
  };

  export const TWILIO_INFO = {
    ACCOUNT_SID: "ACaec207959fe6a2a15127fe0b94259b0f",
    AUTH_TOKEN: "7a26d7376f3486bc4c3dd45ca936295e",
    FROM_PHONE: "+8665666430",
  };