import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const SolutionScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Main text animation
  const textOpacity = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textScale = interpolate(frame, [0, 0.4 * fps], [0.9, 1], {
    extrapolateRight: "clamp",
  });

  // Chat bubble animation
  const chatOpacity = interpolate(frame, [0.5 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chatX = interpolate(frame, [0.5 * fps, 0.8 * fps], [-30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Arrow animation
  const arrowOpacity = interpolate(frame, [0.8 * fps, 1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowX = interpolate(frame, [1 * fps, 2 * fps], [0, 10], {
    extrapolateRight: "clamp",
  });

  // Game icon animation
  const gameOpacity = interpolate(frame, [1 * fps, 1.3 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gameX = interpolate(frame, [1 * fps, 1.3 * fps], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800,
          height: 600,
          background: "radial-gradient(circle, rgba(255, 59, 48, 0.06) 0%, transparent 60%)",
          filter: "blur(80px)",
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 60,
        }}
      >
        {/* Main message */}
        <div
          style={{
            opacity: textOpacity,
            transform: `scale(${textScale})`,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: "#171717",
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            <span style={{ color: "#FF3B30" }}>自然言語</span>で伝えるだけ
          </div>
        </div>

        {/* Visual flow: Chat → Arrow → Game */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 50,
          }}
        >
          {/* Chat bubble */}
          <div
            style={{
              opacity: chatOpacity,
              transform: `translateX(${chatX}px)`,
              backgroundColor: "#FFFFFF",
              borderRadius: 32,
              padding: "36px 52px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
              border: "1px solid rgba(0, 0, 0, 0.06)",
            }}
          >
            <span
              style={{
                fontSize: 32,
                color: "#525252",
                fontFamily: "Inter, sans-serif",
              }}
            >
              「シューティングゲームを作って」
            </span>
          </div>

          {/* Arrow */}
          <div
            style={{
              opacity: arrowOpacity,
              transform: `translateX(${arrowX}px)`,
            }}
          >
            <svg width="100" height="40" viewBox="0 0 100 40" fill="none">
              <path
                d="M0 20 L80 20 M65 8 L80 20 L65 32"
                stroke="#FF3B30"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Game icon */}
          <div
            style={{
              opacity: gameOpacity,
              transform: `translateX(${gameX}px)`,
              width: 150,
              height: 150,
              backgroundColor: "#FF3B30",
              borderRadius: 36,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              boxShadow: "0 15px 50px rgba(255, 59, 48, 0.35)",
            }}
          >
            <span style={{ fontSize: 72 }}>🎮</span>
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: gameOpacity,
            marginTop: 30,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: "#A3A3A3",
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              textAlign: "center",
            }}
          >
            AIがあなたのアイデアをゲームに変換
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
