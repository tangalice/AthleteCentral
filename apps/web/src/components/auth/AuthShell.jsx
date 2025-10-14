// src/components/AuthShell.jsx
// Big Brand mark for the left panel
function BrandMarkLarge() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="2" />
        <path d="M4 12c6 0 6-8 16-8" stroke="#10b981" strokeWidth="2" />
        <path d="M4 12c6 0 6 8 16 8" stroke="#10b981" strokeWidth="2" />
      </svg>
      <span
        style={{
          fontSize: 40,
          fontWeight: 900,
          letterSpacing: 0.2,
          background: "linear-gradient(90deg,#0f172a,#10b981)",
          WebkitBackgroundClip: "text",
          color: "transparent",
          lineHeight: 1,
        }}
      >
        Athlete Hub
      </span>
    </div>
  );
}

export default function AuthShell({ children, footer }) {
  return (
    <>
      {/* Two-column auth layout */}
      <div
        style={{
          minHeight: "100vh", 
          display: "flex",
          background: "#fff",
        }}
      >
        {/* Left: Brand / tagline */}
        <div
          style={{
            flex: 1,
            minWidth: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
            background:
              "radial-gradient(1200px 600px at -10% -10%, #ecfeff 0%, transparent 60%), radial-gradient(800px 400px at 120% 120%, #ecfdf5 0%, transparent 60%)",
            borderRight: "1px solid #eef2f7",
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <BrandMarkLarge />
            <p
              style={{
                marginTop: 20,
                color: "#334155",
                fontSize: 18,
                lineHeight: 1.7,
                letterSpacing: 0.2,
              }}
            >
              A secure, central hub where competitive student-athletes and coaches
              log performance, manage teams, and forecast progress.
            </p>
          </div>
        </div>

        {/* Right: Auth card */}
        <div
          style={{
            flex: 1,
            minWidth: 360,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
              padding: 28,
              background: "#fff",
            }}
          >
            {children}
            {footer ? <div style={{ marginTop: 16 }}>{footer}</div> : null}
          </div>
        </div>
      </div>
    </>
  );
}
