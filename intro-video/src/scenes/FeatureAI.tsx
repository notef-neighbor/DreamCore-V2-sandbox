import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { IPhoneMockup } from "../components/IPhoneMockup";

export const FeatureAI = () => {
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

  // Progress animation
  const progress = interpolate(frame, [0.5 * fps, 2.2 * fps], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Generated images with focus effect
  const images = [
    { emoji: "🚀", label: "プレイヤー", delay: 0.8 },
    { emoji: "👾", label: "敵キャラ", delay: 1.2 },
    { emoji: "💎", label: "アイテム", delay: 1.6 },
    { emoji: "🌟", label: "エフェクト", delay: 2.0 },
  ];

  // Find active generating image
  const activeImageIndex = images.reduce((acc, img, i) => {
    if (frame >= img.delay * fps && frame < (img.delay + 0.3) * fps) return i;
    return acc;
  }, -1);

  // Zoom pulse when images are generated
  const zoomPulse = interpolate(
    frame,
    [0.8 * fps, 1 * fps, 1.2 * fps, 1.4 * fps, 1.6 * fps, 1.8 * fps, 2 * fps, 2.2 * fps],
    [1, 1.03, 1, 1.03, 1, 1.03, 1, 1.03],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #FFFFFF 0%, #F8F8F8 50%, #F5F5F5 100%)",
      }}
    >
      {/* Subtle gradient background */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "20%",
          width: 500,
          height: 400,
          background: "radial-gradient(circle, rgba(255, 59, 48, 0.06) 0%, transparent 60%)",
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
            padding: "10px 18px",
            background: "#FF3B30",
            borderRadius: 50,
            width: "fit-content",
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
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "white",
              fontFamily: "Inter, sans-serif",
            }}
          >
            AI画像生成
          </span>
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
          ゲーム素材も
          <br />
          <span style={{ color: "#FF3B30" }}>自動生成</span>
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
          キャラクター、背景、アイテムなど
          <br />
          ゲームに必要な素材をAIが自動生成。
        </div>

        {/* Generated items list */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 10,
          }}
        >
          {images.map((img, i) => {
            const itemOpacity = interpolate(
              frame,
              [img.delay * fps, (img.delay + 0.2) * fps],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  backgroundColor: "rgba(255, 59, 48, 0.08)",
                  borderRadius: 20,
                  opacity: itemOpacity,
                }}
              >
                <span style={{ fontSize: 16 }}>{img.emoji}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#525252",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {img.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right side - iPhone mockup with AI generation UI */}
      <div
        style={{
          position: "absolute",
          right: 480,
          top: "50%",
          transform: `translateY(-50%) translateX(${phoneX}px) scale(${zoomPulse})`,
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
              paddingTop: 80,
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#171717",
                fontFamily: "Inter, sans-serif",
                marginBottom: 30,
              }}
            >
              AIで素材を作成
            </div>

            {/* AI Icon with pulse */}
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: 24,
                backgroundColor: "#F5F5F5",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 24,
                boxShadow: progress < 100 ? "0 0 20px rgba(255, 59, 48, 0.2)" : "none",
              }}
            >
              <span style={{ fontSize: 48 }}>🤖</span>
            </div>

            {/* Progress bar */}
            <div
              style={{
                width: 220,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  height: 8,
                  backgroundColor: "#E5E5E5",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #FF3B30, #FF6B6B)",
                    borderRadius: 4,
                    transition: "width 0.1s ease-out",
                  }}
                />
              </div>
              <div
                style={{
                  textAlign: "center",
                  marginTop: 10,
                  fontSize: 14,
                  color: progress >= 100 ? "#10B981" : "#A3A3A3",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                }}
              >
                {progress >= 100 ? "完了！" : `生成中... ${Math.round(progress)}%`}
              </div>
            </div>

            {/* Generated images grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 14,
                padding: 20,
                marginTop: 10,
              }}
            >
              {images.map((img, i) => {
                const imgOpacity = interpolate(
                  frame,
                  [img.delay * fps, (img.delay + 0.15) * fps],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                );
                const imgScale = interpolate(
                  frame,
                  [img.delay * fps, (img.delay + 0.15) * fps],
                  [0.5, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                );

                const isActive = i === activeImageIndex;

                return (
                  <div
                    key={i}
                    style={{
                      width: 90,
                      height: 90,
                      backgroundColor: "#F5F5F5",
                      borderRadius: 20,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 6,
                      opacity: imgOpacity,
                      transform: `scale(${imgScale})`,
                      boxShadow: isActive
                        ? "0 4px 20px rgba(255, 59, 48, 0.25)"
                        : "0 2px 8px rgba(0, 0, 0, 0.05)",
                      border: isActive ? "2px solid #FF3B30" : "none",
                    }}
                  >
                    <span style={{ fontSize: 36 }}>{img.emoji}</span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "#737373",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {img.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </IPhoneMockup>
      </div>
    </AbsoluteFill>
  );
};
