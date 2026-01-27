import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Img, staticFile } from "remotion";

export const GameDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const bgImg = staticFile("asset0.png");

  // Scene timing
  const scene1End = 45;
  const scene2End = 105;
  const scene3End = 165;
  const scene4End = 210;

  // Scene 1: Intro (0-45f)
  const scene1Scale = interpolate(frame, [0, 45], [0.7, 0.85], { extrapolateRight: "clamp" });
  const scene1TitleOpacity = interpolate(frame, [0, 20, 45], [0, 1, 1]);
  const scene1TitleY = interpolate(frame, [0, 20], [100, 0], { extrapolateRight: "clamp" });

  // Scene 2: Main Play (45-105f)
  const scene2Scale = interpolate(frame, [45, 60], [0.85, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scene2TitleOpacity = interpolate(frame, [45, 60], [1, 0.3]);
  const scene2TitleScale = interpolate(frame, [45, 60], [1, 0.4]);
  const scene2TitleX = interpolate(frame, [45, 60], [0, -380]);
  const scene2TitleY = interpolate(frame, [45, 60], [0, -800]);

  // Scene 3: Climax (105-165f)
  const scene3Scale = interpolate(frame, [105, 120], [1.0, 1.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scene3Vignette = interpolate(frame, [105, 120], [0, 0.8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Scene 4: Finish (165-210f)
  const scene4Flash = interpolate(frame, [165, 168], [0, 1], { extrapolateRight: "clamp" });
  const scene4FlashFade = interpolate(frame, [168, 175], [1, 0], { extrapolateLeft: "clamp" });
  const scene4Scale = interpolate(frame, [165, 180], [1.4, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scene4TitleOpacity = interpolate(frame, [175, 190], [0, 1], { extrapolateLeft: "clamp" });
  const scene4CTAOpacity = interpolate(frame, [190, 200], [0, 1], { extrapolateLeft: "clamp" });
  const scene4CTAPulse = Math.sin(frame * 0.3) * 0.1 + 1;

  // Current scale based on scene
  let currentScale = 1;
  if (frame < scene1End) currentScale = scene1Scale;
  else if (frame < scene2End) currentScale = scene2Scale;
  else if (frame < scene3End) currentScale = scene3Scale;
  else currentScale = scene4Scale;

  // Block positions (grid-based)
  const blockSize = 84; // 30 * (1080/390) ≈ 83
  const cols = 10;
  const rows = 20;
  const boardW = cols * blockSize;
  const boardH = rows * blockSize;
  const boardX = (width - boardW) / 2;
  const boardY = 330;

  // Falling piece animation
  const pieceY = interpolate(frame, [45, 105], [boardY, boardY + blockSize * 15], { extrapolateRight: "clamp" });
  const pieceRotation = interpolate(frame, [60, 75, 90], [0, 90, 90], { extrapolateRight: "clamp" });

  // Settled blocks (simulate filled rows)
  const settledBlocks = [
    { x: 3, y: 18, color: "#ff0000" },
    { x: 4, y: 18, color: "#ff0000" },
    { x: 5, y: 18, color: "#00ffff" },
    { x: 6, y: 18, color: "#00ffff" },
    { x: 7, y: 18, color: "#ffff00" },
    { x: 2, y: 19, color: "#ff00ff" },
    { x: 3, y: 19, color: "#00ff00" },
    { x: 4, y: 19, color: "#ff7f00" },
    { x: 5, y: 19, color: "#4169e1" },
    { x: 6, y: 19, color: "#ff0000" },
    { x: 7, y: 19, color: "#00ffff" },
    { x: 8, y: 19, color: "#ffff00" },
  ];

  // Line clear animation (Scene 3)
  const lineClearOpacity = interpolate(frame, [110, 115, 120, 125], [1, 0, 0, 0]);
  const lineClearFlash = interpolate(frame, [110, 115], [0, 1], { extrapolateRight: "clamp" });

  // Explosion particles (Scene 3)
  const particles = Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * Math.PI * 2;
    const speed = 5 + Math.random() * 3;
    const particleFrame = frame - 115;
    const x = boardX + boardW / 2 + Math.cos(angle) * speed * particleFrame;
    const y = boardY + boardH - blockSize * 2 + Math.sin(angle) * speed * particleFrame;
    const opacity = interpolate(particleFrame, [0, 15, 30], [1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return { x, y, opacity, color: ["#ff0000", "#ffff00", "#00ffff", "#ff00ff"][i % 4] };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a2e" }}>
      {/* Background */}
      <AbsoluteFill style={{ transform: `scale(${currentScale})`, transformOrigin: "center" }}>
        <Img 
          src={bgImg} 
          style={{ 
            width: "100%", 
            height: "100%", 
            objectFit: "cover",
            opacity: 0.6
          }} 
        />
        
        {/* Sky gradient overlay */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "60%",
          background: "linear-gradient(to bottom, rgba(135, 206, 235, 0.4), transparent)"
        }} />

        {/* Board background */}
        <div style={{
          position: "absolute",
          left: boardX - 6,
          top: boardY - 6,
          width: boardW + 12,
          height: boardH + 12,
          background: "rgba(0, 0, 0, 0.85)",
          border: "6px solid #ffffff",
          boxShadow: "0 0 30px rgba(0, 255, 255, 0.5)"
        }} />

        {/* Grid lines */}
        {frame >= 45 && Array.from({ length: cols + 1 }).map((_, i) => (
          <div key={`v${i}`} style={{
            position: "absolute",
            left: boardX + i * blockSize,
            top: boardY,
            width: 2,
            height: boardH,
            background: "rgba(255, 255, 255, 0.1)"
          }} />
        ))}
        {frame >= 45 && Array.from({ length: rows + 1 }).map((_, i) => (
          <div key={`h${i}`} style={{
            position: "absolute",
            left: boardX,
            top: boardY + i * blockSize,
            width: boardW,
            height: 2,
            background: "rgba(255, 255, 255, 0.1)"
          }} />
        ))}

        {/* Settled blocks */}
        {frame >= 45 && settledBlocks.map((block, i) => (
          <div key={i} style={{
            position: "absolute",
            left: boardX + block.x * blockSize,
            top: boardY + block.y * blockSize,
            width: blockSize,
            height: blockSize,
            background: block.color,
            border: "4px solid #000",
            boxShadow: `inset 4px 4px 0 rgba(255, 255, 255, 0.4), inset -4px -4px 0 rgba(0, 0, 0, 0.4)`,
            opacity: block.y === 19 ? lineClearOpacity : 1
          }} />
        ))}

        {/* Falling T-piece */}
        {frame >= 45 && frame < 110 && (
          <div style={{
            position: "absolute",
            left: boardX + 3 * blockSize,
            top: pieceY,
            width: blockSize * 3,
            height: blockSize * 2,
            transform: `rotate(${pieceRotation}deg)`,
            transformOrigin: "center"
          }}>
            {/* T shape */}
            <div style={{ position: "absolute", left: blockSize, top: 0, width: blockSize, height: blockSize, background: "#ff00ff", border: "4px solid #000", boxShadow: "inset 4px 4px 0 rgba(255, 255, 255, 0.4)" }} />
            <div style={{ position: "absolute", left: 0, top: blockSize, width: blockSize, height: blockSize, background: "#ff00ff", border: "4px solid #000", boxShadow: "inset 4px 4px 0 rgba(255, 255, 255, 0.4)" }} />
            <div style={{ position: "absolute", left: blockSize, top: blockSize, width: blockSize, height: blockSize, background: "#ff00ff", border: "4px solid #000", boxShadow: "inset 4px 4px 0 rgba(255, 255, 255, 0.4)" }} />
            <div style={{ position: "absolute", left: blockSize * 2, top: blockSize, width: blockSize, height: blockSize, background: "#ff00ff", border: "4px solid #000", boxShadow: "inset 4px 4px 0 rgba(255, 255, 255, 0.4)" }} />
          </div>
        )}

        {/* Line clear flash */}
        {frame >= 110 && frame < 125 && (
          <div style={{
            position: "absolute",
            left: boardX,
            top: boardY + (rows - 1) * blockSize,
            width: boardW,
            height: blockSize,
            background: `rgba(255, 255, 255, ${lineClearFlash * 0.8})`,
            mixBlendMode: "screen"
          }} />
        )}

        {/* Explosion particles */}
        {frame >= 115 && frame < 145 && particles.map((p, i) => (
          <div key={i} style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: 12,
            height: 12,
            background: p.color,
            borderRadius: "50%",
            opacity: p.opacity,
            boxShadow: `0 0 15px ${p.color}`
          }} />
        ))}

        {/* Score (appears in Scene 2) */}
        {frame >= 45 && (
          <div style={{
            position: "absolute",
            top: 80,
            left: 80,
            color: "#00ffff",
            fontSize: 48,
            fontFamily: "'Courier New', monospace",
            fontWeight: "bold",
            textShadow: "4px 4px #ff00ff, 0 0 20px #00ffff",
            opacity: frame < scene3End ? 1 : 0.5
          }}>
            {frame < 115 ? "SCORE: 1200" : "SCORE: 1600"}
          </div>
        )}

        {/* Next piece preview (Scene 2) */}
        {frame >= 45 && frame < scene3End && (
          <div style={{
            position: "absolute",
            top: 200,
            right: 80,
            padding: 20,
            background: "rgba(0, 0, 0, 0.7)",
            border: "4px solid #fff",
            borderRadius: 8
          }}>
            <div style={{ color: "#fff", fontSize: 24, marginBottom: 10, fontFamily: "'Courier New', monospace" }}>NEXT</div>
            <div style={{ width: blockSize, height: blockSize * 2, background: "#00ffff", border: "4px solid #000" }} />
            <div style={{ width: blockSize, height: blockSize * 2, background: "#00ffff", border: "4px solid #000", marginTop: -blockSize * 2, marginLeft: blockSize }} />
            <div style={{ width: blockSize, height: blockSize * 2, background: "#00ffff", border: "4px solid #000", marginTop: -blockSize * 2, marginLeft: blockSize * 2 }} />
            <div style={{ width: blockSize, height: blockSize * 2, background: "#00ffff", border: "4px solid #000", marginTop: -blockSize * 2, marginLeft: blockSize * 3 }} />
          </div>
        )}
      </AbsoluteFill>

      {/* Scene 3 vignette */}
      {frame >= scene2End && frame < scene4End && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle, transparent 40%, rgba(0, 0, 0, ${scene3Vignette}) 100%)`,
          pointerEvents: "none"
        }} />
      )}

      {/* Scene 4 flash */}
      {frame >= 165 && frame < 175 && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "#ffffff",
          opacity: scene4Flash * scene4FlashFade
        }} />
      )}

      {/* Title - Scene 1 & 2 */}
      {frame < scene2End && (
        <div style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          transform: `translate(-50%, -50%) translate(${scene2TitleX}px, ${scene2TitleY}px) scale(${scene2TitleScale})`,
          opacity: frame < scene1End ? scene1TitleOpacity : scene2TitleOpacity,
          textAlign: "center"
        }}>
          <div style={{
            color: "#00ffff",
            fontSize: 120,
            fontFamily: "'Courier New', monospace",
            fontWeight: "bold",
            textShadow: "8px 8px #ff00ff, 0 0 40px #00ffff",
            letterSpacing: 4,
            transform: `translateY(${scene1TitleY}px)`
          }}>
            RETRO
          </div>
          <div style={{
            color: "#ffff00",
            fontSize: 100,
            fontFamily: "'Courier New', monospace",
            fontWeight: "bold",
            textShadow: "8px 8px #ff00ff, 0 0 40px #ffff00",
            marginTop: 20,
            transform: `translateY(${scene1TitleY}px)`
          }}>
            BLOCK PUZZLE
          </div>
        </div>
      )}

      {/* Title - Scene 4 */}
      {frame >= scene3End && (
        <div style={{
          position: "absolute",
          top: "35%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: scene4TitleOpacity,
          textAlign: "center"
        }}>
          <div style={{
            color: "#00ffff",
            fontSize: 130,
            fontFamily: "'Courier New', monospace",
            fontWeight: "bold",
            textShadow: "10px 10px #ff00ff, 0 0 50px #00ffff",
            letterSpacing: 6
          }}>
            RETRO
          </div>
          <div style={{
            color: "#ffff00",
            fontSize: 110,
            fontFamily: "'Courier New', monospace",
            fontWeight: "bold",
            textShadow: "10px 10px #ff00ff, 0 0 50px #ffff00",
            marginTop: 25
          }}>
            BLOCK PUZZLE
          </div>
        </div>
      )}

      {/* CTA - Scene 4 */}
      {frame >= 190 && (
        <div style={{
          position: "absolute",
          bottom: "25%",
          left: "50%",
          transform: `translate(-50%, 0) scale(${scene4CTAPulse})`,
          opacity: scene4CTAOpacity,
          padding: "30px 80px",
          background: "#ffff00",
          border: "8px solid #fff",
          borderRadius: 12,
          boxShadow: "0 12px 0 #b8860b, 0 0 40px rgba(255, 255, 0, 0.8)",
          color: "#000",
          fontSize: 60,
          fontFamily: "'Courier New', monospace",
          fontWeight: "bold",
          textTransform: "uppercase"
        }}>
          PLAY NOW
        </div>
      )}

      {/* Scanlines effect */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 100%)",
        backgroundSize: "100% 8px",
        pointerEvents: "none",
        opacity: 0.3
      }} />
    </AbsoluteFill>
  );
};
