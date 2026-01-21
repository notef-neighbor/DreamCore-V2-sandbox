import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const ProblemScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title animation
  const titleOpacity = interpolate(frame, [0, 0.3 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Problems appearing one by one with horizontal layout
  const problems = [
    { icon: "💻", text: "プログラミングの知識が必要", delay: 0.3 },
    { icon: "🔧", text: "開発環境の構築が大変", delay: 0.6 },
    { icon: "⏰", text: "何ヶ月もの時間がかかる", delay: 0.9 },
  ];

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #FAFAFA 0%, #F5F5F5 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Subtle gradient orb */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800,
          height: 600,
          background: "radial-gradient(ellipse, rgba(255, 59, 48, 0.05) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 60,
        }}
      >
        {/* Title */}
        <div
          style={{
            opacity: titleOpacity,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#525252",
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              textAlign: "center",
            }}
          >
            ゲーム開発は
            <span style={{ color: "#FF3B30" }}> 難しい</span>
          </div>
        </div>

        {/* Problem cards in horizontal row */}
        <div
          style={{
            display: "flex",
            gap: 36,
          }}
        >
          {problems.map((problem, i) => {
            const itemOpacity = interpolate(
              frame,
              [problem.delay * fps, (problem.delay + 0.25) * fps],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const itemY = interpolate(
              frame,
              [problem.delay * fps, (problem.delay + 0.25) * fps],
              [20, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  opacity: itemOpacity,
                  transform: `translateY(${itemY}px)`,
                  backgroundColor: "white",
                  padding: "40px 44px",
                  borderRadius: 28,
                  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.06)",
                  width: 260,
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 20,
                    backgroundColor: "rgba(255, 59, 48, 0.1)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 36,
                  }}
                >
                  {problem.icon}
                </div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "rgba(255, 59, 48, 0.1)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FF3B30"
                    strokeWidth="2.5"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: 20,
                    color: "#525252",
                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                    fontWeight: 500,
                    textAlign: "center",
                    lineHeight: 1.4,
                  }}
                >
                  {problem.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
