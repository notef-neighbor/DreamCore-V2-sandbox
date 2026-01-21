import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { IPhoneMockup } from "../components/IPhoneMockup";

export const EndingScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo animation
  const logoOpacity = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const logoScale = interpolate(frame, [0, 0.4 * fps], [0.9, 1], {
    extrapolateRight: "clamp",
  });

  // Tagline animation
  const taglineOpacity = interpolate(frame, [0.3 * fps, 0.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phone animation
  const phoneOpacity = interpolate(frame, [0.5 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneX = interpolate(frame, [0.5 * fps, 0.8 * fps], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // CTA animation
  const ctaOpacity = interpolate(frame, [1 * fps, 1.3 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaScale = interpolate(frame, [1 * fps, 1.3 * fps], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Floating animation for phone
  const floatY = interpolate(
    frame % (fps * 2),
    [0, fps, fps * 2],
    [0, -8, 0]
  );

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #FFFFFF 0%, #F8F8F8 50%, #F5F5F5 100%)",
      }}
    >
      {/* Gradient backgrounds */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "15%",
          width: 400,
          height: 400,
          background: "radial-gradient(ellipse, rgba(255, 59, 48, 0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          right: "20%",
          width: 350,
          height: 350,
          background: "radial-gradient(ellipse, rgba(255, 59, 48, 0.06) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Left side - Branding and CTA */}
      <div
        style={{
          position: "absolute",
          left: 140,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 44,
        }}
      >
        {/* Brand mark and logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 60,
                height: 60,
                backgroundColor: "#FF3B30",
                borderRadius: 16,
                position: "relative",
                boxShadow: "0 10px 35px rgba(255, 59, 48, 0.3)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 14,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 7,
                }}
              />
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#171717",
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              GAME CREATOR
            </div>
          </div>

          {/* Tagline */}
          <div
            style={{
              opacity: taglineOpacity,
              maxWidth: 900,
            }}
          >
            <div
              style={{
                fontSize: 82,
                fontWeight: 700,
                color: "#171717",
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                lineHeight: 1.2,
              }}
            >
              あなたのアイデアを
              <br />
              <span style={{ color: "#FF3B30" }}>プレイできるゲーム</span>に
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div
          style={{
            opacity: ctaOpacity,
            transform: `scale(${ctaScale})`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "24px 48px",
              background: "#FF3B30",
              borderRadius: 60,
              boxShadow: "0 12px 50px rgba(255, 59, 48, 0.4)",
              width: "fit-content",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: "white",
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              今すぐ始める
            </span>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>

          {/* Sub text */}
          <div
            style={{
              marginTop: 20,
              fontSize: 18,
              color: "#A3A3A3",
              fontFamily: "Inter, sans-serif",
            }}
          >
            無料で試せます
          </div>
        </div>
      </div>

      {/* Right side - iPhone mockup showing app */}
      <div
        style={{
          position: "absolute",
          right: 480,
          top: "50%",
          transform: `translateY(-50%) translateX(${phoneX}px) translateY(${floatY}px)`,
          opacity: phoneOpacity,
        }}
      >
        <IPhoneMockup scale={1.15}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 30,
            }}
          >
            {/* Create button mockup */}
            <div
              style={{
                width: 130,
                height: 130,
                backgroundColor: "white",
                borderRadius: 35,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 14,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FF3B30"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#FF3B30",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                つくる
              </span>
            </div>

            {/* Recent games preview */}
            <div
              style={{
                display: "flex",
                gap: 12,
              }}
            >
              {["🚀", "🎮", "🎯"].map((emoji, i) => (
                <div
                  key={i}
                  style={{
                    width: 60,
                    height: 60,
                    backgroundColor: "#F5F5F5",
                    borderRadius: 16,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 28,
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>
          </div>
        </IPhoneMockup>
      </div>
    </AbsoluteFill>
  );
};
