import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { IPhoneMockup } from "../components/IPhoneMockup";

export const TitleScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo animation
  const logoOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const logoX = interpolate(frame, [0, 0.5 * fps], [-30, 0], {
    extrapolateRight: "clamp",
  });

  // Tagline animation
  const taglineOpacity = interpolate(frame, [0.3 * fps, 0.7 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phone animation - slides in from right
  const phoneOpacity = interpolate(frame, [0.5 * fps, 0.9 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneX = interpolate(frame, [0.5 * fps, 0.9 * fps], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneRotate = interpolate(frame, [0.5 * fps, 0.9 * fps], [5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #FFFFFF 0%, #F8F8F8 50%, #F0F0F0 100%)",
      }}
    >
      {/* Subtle gradient accents */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "10%",
          width: 400,
          height: 400,
          background: "radial-gradient(circle, rgba(255, 59, 48, 0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "20%",
          width: 300,
          height: 300,
          background: "radial-gradient(circle, rgba(255, 59, 48, 0.05) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Left side - Branding */}
      <div
        style={{
          position: "absolute",
          left: 140,
          top: "50%",
          transform: `translateY(-50%) translateX(${logoX}px)`,
          opacity: logoOpacity,
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 80,
              height: 80,
              backgroundColor: "#FF3B30",
              borderRadius: 20,
              position: "relative",
              boxShadow: "0 12px 40px rgba(255, 59, 48, 0.3)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 18,
                backgroundColor: "#FFFFFF",
                borderRadius: 10,
              }}
            />
          </div>
          <div
            style={{
              fontSize: 20,
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
            maxWidth: 700,
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
            チャットだけで
            <br />
            <span style={{ color: "#FF3B30" }}>ゲームが生まれる</span>
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#737373",
              fontFamily: "Inter, sans-serif",
              marginTop: 28,
            }}
          >
            プログラミング不要のゲーム開発
          </div>
        </div>
      </div>

      {/* Right side - iPhone mockup */}
      <div
        style={{
          position: "absolute",
          right: 480,
          top: "50%",
          transform: `translateY(-50%) translateX(${phoneX}px) rotate(${phoneRotate}deg)`,
          opacity: phoneOpacity,
        }}
      >
        <IPhoneMockup scale={1.1}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
            }}
          >
            {/* App icon preview */}
            <div
              style={{
                width: 100,
                height: 100,
                backgroundColor: "#FF3B30",
                borderRadius: 24,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                boxShadow: "0 8px 30px rgba(255, 59, 48, 0.25)",
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  backgroundColor: "white",
                  borderRadius: 10,
                }}
              />
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#171717",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Game Creator
            </div>
          </div>
        </IPhoneMockup>
      </div>
    </AbsoluteFill>
  );
};
