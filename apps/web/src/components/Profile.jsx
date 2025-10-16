// src/components/Profile.jsx
import { useLoaderData } from "react-router-dom";
import { SPORTS, GRADES, EXPERIENCE_LEVELS } from "../constants/constants";

/** A two-column row: bold label on the left, value on the right. */
function Row({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        alignItems: "start",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px dashed var(--border)",
      }}
    >
      <div
        style={{
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#111827",
          fontSize: 16,
          fontWeight: 600,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          lineHeight: 1.6,
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

/** Section card with subtle brand accent bar and heading. */
function Section({ title, children }) {
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 4, height: 16, background: "var(--brand-primary)", borderRadius: 2 }} />
        <h3
          style={{
            margin: 0,
            color: "#0f172a",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

export default function Profile({ user }) {
  const p = useLoaderData() || {};
  const name = p.name || user?.displayName || user?.email || "User";
  const userRole = user?.role;

  // Get user role from the merged user object
  const isCoach = userRole === "coach";

  // Helper functions to convert stored values to display labels
  const getSportLabel = (value) => {
    const sport = SPORTS.find(s => s.value === value);
    return sport ? sport.label : value;
  };

  const getGradeLabel = (value) => {
    const grade = GRADES.find(g => g.value === value);
    return grade ? grade.label : value;
  };

  const getExperienceLabel = (value) => {
    const experience = EXPERIENCE_LEVELS.find(e => e.value === value);
    return experience ? experience.label : value;
  };

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Name */}
        <h1
          style={{
            margin: "0 0 6px 0",
            fontSize: 36,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: 0.3,
            lineHeight: 1.2,
            textAlign: "left",
          }}
        >
          {name}
        </h1>
        <div
          style={{
            height: 4,
            width: 120,
            background: "var(--brand-primary)",
            borderRadius: 999,
            opacity: 0.25,
            marginBottom: 12,
          }}
        />

        {isCoach ? (
          <>
            {/* Coach Personal Information */}
            <Section title="Personal Information">
              <Row label="School" value={p.school} />
              <Row label="Bio" value={p.bio} />
            </Section>

            {/* Coach Sports Information */}
            <Section title="Sports Information">
              <Row label="Sport" value={getSportLabel(p.sport)} />
              <Row label="Team" value={p.team} />
              <Row label="Sport Details" value={p.sportDetails} />
            </Section>
          </>
        ) : (
          <>
            {/* Athlete Personal Information */}
            <Section title="Personal Information">
              <Row label="School" value={p.school} />
              <Row label="Grade" value={getGradeLabel(p.grade)} />
              <Row label="Bio" value={p.bio} />
            </Section>

            {/* Athlete Sports Information */}
            <Section title="Sports Information">
              <Row label="Sport" value={getSportLabel(p.sport)} />
              <Row label="Position/Role" value={p.position} />
              <Row label="Team" value={p.team} />
              <Row label="Experience Level" value={getExperienceLabel(p.experience)} />
              <Row label="Sport Details" value={p.sportDetails} />
              <Row label="Goals & Objectives" value={p.goals} />
            </Section>
          </>
        )}

        {/* Footer tip */}
        <div className="card" style={{ marginTop: 16, textAlign: "center" }}>
          <p className="text-muted">
            To edit your profile information, go to <strong>Settings → Edit Profile</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
