// src/components/Profile.jsx
import { useLoaderData } from "react-router-dom";

/** A two-column row: bold label on the left, value on the right.
 *  Value wraps automatically for long text/words. */
function Row({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        alignItems: "start",
        gap: 16,
        padding: "14px 0",
        borderBottom: "1px dashed #e5e7eb",
      }}
    >
      <div
        style={{
          color: "#0f172a",
          fontSize: 13,
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
          // Wrap long content; preserve line breaks
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

/** Section with a subtle green accent bar and uppercase heading. */
function Section({ title, children }) {
  return (
    <section style={{ margin: "26px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 4, height: 16, background: "#10b981", borderRadius: 2 }} />
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

export default function Profile() {
  const p = useLoaderData() || {};
  const name = p.name || "Athlete";

  return (
    <div style={{ padding: "28px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Name aligned to the left, no sport badge under it */}
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: 40,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: 0.3,
          }}
        >
          {name}
        </h1>

        {/* Personal Information (vertical flow) */}
        <Section title="Personal Information">
          <Row label="School" value={p.school} />
          <Row label="Grade" value={p.grade} />
          <Row label="Bio" value={p.bio} />
        </Section>

        {/* Sports Information */}
        <Section title="Sports Information">
          <Row label="Sport" value={p.sport} />
          <Row label="Position/Role" value={p.position} />
          <Row label="Team" value={p.team} />
          <Row label="Experience Level" value={p.experience} />
          {/* New emphasized fields */}
          <Row label="Sport Details" value={p.sportDetails} />
          <Row label="Goals & Objectives" value={p.goals} />
        </Section>

        {/* Footer tip */}
        <div
          style={{
            marginTop: 26,
            textAlign: "center",
            padding: 14,
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
            color: "#6b7280",
          }}
        >
          To edit your profile information, go to <strong>Settings → Edit Profile</strong>
        </div>
      </div>
    </div>
  );
}
