import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { IPhoneMockup } from "../components/IPhoneMockup";

export const FeaturePreview = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Left text animation
  const textOpacity = interpolate(frame, [0, 0.3 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textX = interpolate(frame, [0, 0.3 * fps], [-20, 0], {
    extrapolateRight: "clamp",
  });

  // Phone animation
  const phoneOpacity = interpolate(frame, [0.2 * fps, 0.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneX = interpolate(frame, [0.2 * fps, 0.5 * fps], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Game animation - vertical shooter
  const shipX = interpolate(
    frame,
    [0, fps, 2 * fps, 3 * fps],
    [0, -30, 30, 0],
    { extrapolateRight: "clamp" }
  );

  const bulletY = interpolate(frame, [0.5 * fps, 1.5 * fps], [0, -250], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enemyOpacity = interpolate(frame, [1.3 * fps, 1.5 * fps], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Focus zoom on action - zooms when bullet hits
  const actionZoom = interpolate(
    frame,
    [1.2 * fps, 1.5 * fps, 1.8 * fps],
    [1, 1.08, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Explosion effect
  const explosionScale = interpolate(
    frame,
    [1.3 * fps, 1.5 * fps, 1.8 * fps],
    [0, 1.2, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const explosionOpacity = interpolate(
    frame,
    [1.3 * fps, 1.5 * fps, 1.8 * fps],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Score animation
  const scoreValue = Math.floor(
    interpolate(frame, [0, 2 * fps], [1000, 1500], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #FFFFFF 0%, #F8F8F8 50%, #F5F5F5 100%)",
      }}
    >
      {/* Gradient background */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "20%",
          width: 500,
          height: 400,
          background: "radial-gradient(ellipse, rgba(255, 59, 48, 0.06) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Left side - Feature description */}
      <div
        style={{
          position: "absolute",
          left: 140,
          top: "50%",
          transform: `translateY(-50%) translateX(${textX}px)`,
          opacity: textOpacity,
          display: "flex",
          flexDirection: "column",
          gap: 32,
          maxWidth: 650,
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              background: "#FF3B30",
              borderRadius: 50,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "white",
                fontFamily: "Inter, sans-serif",
              }}
            >
              リアルタイムプレビュー
            </span>
          </div>

          {/* Live indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "rgba(255, 59, 48, 0.1)",
              borderRadius: 50,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#FF3B30",
                boxShadow: "0 0 8px rgba(255, 59, 48, 0.6)",
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#FF3B30",
                fontFamily: "Inter, sans-serif",
              }}
            >
              LIVE
            </span>
          </div>
        </div>

        {/* Main text */}
        <div
          style={{
            fontSize: 82,
            fontWeight: 700,
            color: "#171717",
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            lineHeight: 1.2,
          }}
        >
          変更が<span style={{ color: "#FF3B30" }}>即座に</span>
          <br />
          ゲームに反映
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 24,
            color: "#737373",
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.6,
          }}
        >
          AIとの会話でゲームが進化。
          <br />
          リアルタイムで確認しながら開発できます。
        </div>
      </div>

      {/* Right side - iPhone mockup with game and focus zoom */}
      <div
        style={{
          position: "absolute",
          right: 480,
          top: "50%",
          transform: `translateY(-50%) translateX(${phoneX}px) scale(${actionZoom})`,
          opacity: phoneOpacity,
        }}
      >
        <IPhoneMockup scale={1.15}>
          {/* Game screen content - vertical shooter */}
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(180deg, #0a0a1a 0%, #1a1a3a 100%)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Stars */}
            {Array.from({ length: 50 }, (_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${(i * 23) % 100}%`,
                  top: `${(i * 17) % 100}%`,
                  width: i % 3 === 0 ? 3 : 2,
                  height: i % 3 === 0 ? 3 : 2,
                  borderRadius: "50%",
                  backgroundColor: `rgba(255, 255, 255, ${0.3 + (i % 5) * 0.1})`,
                }}
              />
            ))}

            {/* Score with animation */}
            <div
              style={{
                position: "absolute",
                top: 60,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 20,
                color: "white",
                fontFamily: "monospace",
                fontWeight: 700,
                textShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
              }}
            >
              SCORE: {scoreValue}
            </div>

            {/* Enemy */}
            <div
              style={{
                position: "absolute",
                top: 140,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 44,
                opacity: enemyOpacity,
              }}
            >
              👾
            </div>

            {/* Explosion effect */}
            <div
              style={{
                position: "absolute",
                top: 120,
                left: "50%",
                transform: `translateX(-50%) scale(${explosionScale})`,
                opacity: explosionOpacity,
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255, 200, 50, 0.9) 0%, rgba(255, 100, 50, 0.6) 40%, transparent 70%)",
                boxShadow: "0 0 40px rgba(255, 150, 50, 0.8)",
              }}
            />

            {/* Bullet */}
            <div
              style={{
                position: "absolute",
                bottom: 180 - bulletY,
                left: "50%",
                transform: "translateX(-50%)",
                width: 8,
                height: 30,
                backgroundColor: "#FF3B30",
                borderRadius: 4,
                boxShadow: "0 0 15px rgba(255, 59, 48, 0.9)",
              }}
            />

            {/* Player ship - at bottom */}
            <div
              style={{
                position: "absolute",
                bottom: 120,
                left: `calc(50% + ${shipX}px)`,
                transform: "translateX(-50%)",
                fontSize: 48,
              }}
            >
              🚀
            </div>

            {/* Touch controls */}
            <div
              style={{
                position: "absolute",
                bottom: 40,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 50,
              }}
            >
              <div
                style={{
                  width: 55,
                  height: 55,
                  borderRadius: 28,
                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </div>
              <div
                style={{
                  width: 55,
                  height: 55,
                  borderRadius: 28,
                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </div>
        </IPhoneMockup>
      </div>
    </AbsoluteFill>
  );
};
