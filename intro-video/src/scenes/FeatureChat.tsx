import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { IPhoneMockup } from "../components/IPhoneMockup";

export const FeatureChat = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Chat messages appearing
  const messages = [
    { text: "シューティングゲームを作って", isUser: true, delay: 0.3 },
    { text: "宇宙船で敵を撃つゲームを作成しています...", isUser: false, delay: 0.8 },
    { text: "敵をもっと速くして", isUser: true, delay: 1.5 },
    { text: "速度を上げました！", isUser: false, delay: 2.0 },
  ];

  // Find which message is currently active (most recently appeared)
  const activeMessageIndex = messages.reduce((acc, msg, i) => {
    if (frame >= msg.delay * fps) return i;
    return acc;
  }, -1);

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

  // Zoom effect on phone - zooms in when messages appear
  const zoomScale = interpolate(
    frame,
    [0.5 * fps, 1 * fps, 1.5 * fps, 2 * fps, 2.5 * fps],
    [1, 1.05, 1, 1.05, 1],
    { extrapolateRight: "clamp" }
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
          maxWidth: 900,
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "white",
              fontFamily: "Inter, sans-serif",
            }}
          >
            チャットで作る
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
          話しかけるだけで
          <br />
          <span style={{ color: "#FF3B30" }}>ゲームが完成</span>
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
          自然な言葉でAIに話しかけるだけ。
          <br />
          複雑なコードは一切不要です。
        </div>
      </div>

      {/* Right side - iPhone mockup with zoom effect */}
      <div
        style={{
          position: "absolute",
          right: 480,
          top: "50%",
          transform: `translateY(-50%) translateX(${phoneX}px) scale(${zoomScale})`,
          opacity: phoneOpacity,
        }}
      >
        <IPhoneMockup scale={1.15}>
          {/* App screen content */}
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 90,
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
                display: "flex",
                alignItems: "flex-end",
                padding: "0 16px 12px",
                borderBottom: "1px solid #F5F5F5",
                gap: 10,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#A3A3A3"
                strokeWidth="2"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#171717",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                宇宙シューティング
              </span>
              <div style={{ flex: 1 }} />
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: "#10B981",
                  boxShadow: "0 0 6px rgba(16, 185, 129, 0.5)",
                }}
              />
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                overflowY: "auto",
              }}
            >
              {messages.map((msg, i) => {
                const msgOpacity = interpolate(
                  frame,
                  [msg.delay * fps, (msg.delay + 0.2) * fps],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                );
                const msgY = interpolate(
                  frame,
                  [msg.delay * fps, (msg.delay + 0.2) * fps],
                  [10, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                );

                // Highlight effect for active message
                const isActive = i === activeMessageIndex;
                const highlightScale = isActive
                  ? interpolate(
                      frame,
                      [msg.delay * fps, (msg.delay + 0.15) * fps, (msg.delay + 0.4) * fps],
                      [1, 1.02, 1],
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                    )
                  : 1;

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: msg.isUser ? "flex-end" : "flex-start",
                      opacity: msgOpacity,
                      transform: `translateY(${msgY}px) scale(${highlightScale})`,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "80%",
                        padding: "10px 14px",
                        borderRadius: 14,
                        backgroundColor: msg.isUser ? "#FF3B30" : "#F5F5F5",
                        fontSize: 14,
                        color: msg.isUser ? "white" : "#171717",
                        fontFamily: "Inter, sans-serif",
                        lineHeight: 1.4,
                        boxShadow: isActive
                          ? "0 4px 20px rgba(0, 0, 0, 0.1)"
                          : "none",
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input area */}
            <div
              style={{
                padding: "12px 16px 30px",
                borderTop: "1px solid #F5F5F5",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 36,
                  backgroundColor: "#F5F5F5",
                  borderRadius: 18,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 14px",
                }}
              >
                <span style={{ color: "#A3A3A3", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
                  自由に話しかけてください
                </span>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: "#FF3B30",
                  borderRadius: 18,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
            </div>
          </div>
        </IPhoneMockup>
      </div>
    </AbsoluteFill>
  );
};
