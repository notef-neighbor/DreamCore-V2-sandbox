import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { IPhoneMockup } from "../components/IPhoneMockup";

export const Feature2D3D = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title animation
  const titleOpacity = interpolate(frame, [0, 0.3 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 0.3 * fps], [-20, 0], {
    extrapolateRight: "clamp",
  });

  // 2D phone animation
  const phone2DOpacity = interpolate(frame, [0.3 * fps, 0.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phone2DX = interpolate(frame, [0.3 * fps, 0.6 * fps], [-40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3D phone animation
  const phone3DOpacity = interpolate(frame, [0.5 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phone3DX = interpolate(frame, [0.5 * fps, 0.8 * fps], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Cube rotation
  const cubeRotation = interpolate(frame, [0, 3 * fps], [0, 360], {
    extrapolateRight: "extend",
  });

  // Bouncing character animation
  const characterY = interpolate(
    frame % (fps * 0.6),
    [0, fps * 0.3, fps * 0.6],
    [0, -15, 0]
  );

  // Coin spinning
  const coinRotation = interpolate(frame, [0, fps], [0, 360], {
    extrapolateRight: "extend",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #FFFFFF 0%, #F8F8F8 50%, #F5F5F5 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background gradients */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "20%",
          width: 400,
          height: 400,
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "20%",
          width: 400,
          height: 400,
          background: "radial-gradient(circle, rgba(255, 59, 48, 0.06) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Title and badge */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: "50%",
          transform: `translateX(-50%) translateY(${titleY}px)`,
          opacity: titleOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "20px 50px",
            background: "#FF3B30",
            borderRadius: 100,
          }}
        >
          <span style={{ fontSize: 42 }}>🎨</span>
          <span
            style={{
              fontSize: 42,
              fontWeight: 600,
              color: "white",
              fontFamily: "Inter, sans-serif",
            }}
          >
            2D / 3D 両対応
          </span>
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#171717",
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            textAlign: "center",
          }}
        >
          ゲームに応じて<span style={{ color: "#FF3B30" }}>自動で選択</span>
        </div>
      </div>

      {/* Two phones side by side */}
      <div
        style={{
          display: "flex",
          gap: 50,
          marginTop: 200,
        }}
      >
        {/* 2D Phone */}
        <div
          style={{
            opacity: phone2DOpacity,
            transform: `translateX(${phone2DX}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <IPhoneMockup scale={0.8}>
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(180deg, #87CEEB 0%, #98D8C8 100%)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Clouds */}
              <div
                style={{
                  position: "absolute",
                  top: 80,
                  left: 30,
                  width: 60,
                  height: 25,
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                  borderRadius: 20,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 100,
                  right: 40,
                  width: 50,
                  height: 20,
                  backgroundColor: "rgba(255, 255, 255, 0.7)",
                  borderRadius: 15,
                }}
              />

              {/* Ground */}
              <div
                style={{
                  position: "absolute",
                  bottom: 60,
                  left: 20,
                  right: 20,
                  height: 30,
                  background: "#10B981",
                  borderRadius: 6,
                }}
              />

              {/* Platform */}
              <div
                style={{
                  position: "absolute",
                  bottom: 140,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 80,
                  height: 18,
                  background: "#FF3B30",
                  borderRadius: 5,
                }}
              />

              {/* Character */}
              <div
                style={{
                  position: "absolute",
                  bottom: 90 + Math.abs(characterY),
                  left: 80,
                  fontSize: 40,
                }}
              >
                🐱
              </div>

              {/* Coin */}
              <div
                style={{
                  position: "absolute",
                  bottom: 165,
                  left: "50%",
                  transform: `translateX(-50%) scaleX(${Math.cos((coinRotation * Math.PI) / 180)})`,
                  fontSize: 26,
                }}
              >
                ⭐
              </div>
            </div>
          </IPhoneMockup>
        </div>

        {/* 3D Phone */}
        <div
          style={{
            opacity: phone3DOpacity,
            transform: `translateX(${phone3DX}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <IPhoneMockup scale={0.8}>
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Stars */}
              {Array.from({ length: 30 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${(i * 23) % 100}%`,
                    top: `${(i * 17) % 100}%`,
                    width: 2,
                    height: 2,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 255, 255, 0.4)",
                  }}
                />
              ))}

              {/* 3D Cube */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  perspective: 500,
                }}
              >
                <div
                  style={{
                    width: 100,
                    height: 100,
                    position: "relative",
                    transformStyle: "preserve-3d",
                    transform: `rotateX(${cubeRotation * 0.5}deg) rotateY(${cubeRotation}deg)`,
                  }}
                >
                  {[
                    { transform: "translateZ(50px)", bg: "#FF3B30" },
                    { transform: "rotateY(180deg) translateZ(50px)", bg: "#FF6B6B" },
                    { transform: "rotateY(90deg) translateZ(50px)", bg: "#FF8A8A" },
                    { transform: "rotateY(-90deg) translateZ(50px)", bg: "#FF5252" },
                    { transform: "rotateX(90deg) translateZ(50px)", bg: "#FF4444" },
                    { transform: "rotateX(-90deg) translateZ(50px)", bg: "#FF7777" },
                  ].map((face, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        width: 100,
                        height: 100,
                        backgroundColor: face.bg,
                        opacity: 0.9,
                        transform: face.transform,
                        border: "2px solid rgba(255, 255, 255, 0.3)",
                        borderRadius: 8,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </IPhoneMockup>
        </div>
      </div>
    </AbsoluteFill>
  );
};
