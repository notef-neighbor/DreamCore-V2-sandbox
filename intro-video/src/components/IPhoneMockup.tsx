import React from "react";

type IPhoneMockupProps = {
  children: React.ReactNode;
  scale?: number;
};

export const IPhoneMockup: React.FC<IPhoneMockupProps> = ({ children, scale = 1 }) => {
  const phoneWidth = 375;
  const phoneHeight = 812;
  const bezelWidth = 12;
  const cornerRadius = 50;

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {/* Phone outer frame */}
      <div
        style={{
          width: phoneWidth + bezelWidth * 2,
          height: phoneHeight + bezelWidth * 2,
          backgroundColor: "#1a1a1a",
          borderRadius: cornerRadius,
          padding: bezelWidth,
          boxShadow: `
            0 50px 100px rgba(0, 0, 0, 0.25),
            0 30px 60px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `,
          position: "relative",
        }}
      >
        {/* Side buttons - Volume */}
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 120,
            width: 3,
            height: 30,
            backgroundColor: "#2a2a2a",
            borderRadius: "2px 0 0 2px",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 170,
            width: 3,
            height: 55,
            backgroundColor: "#2a2a2a",
            borderRadius: "2px 0 0 2px",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 240,
            width: 3,
            height: 55,
            backgroundColor: "#2a2a2a",
            borderRadius: "2px 0 0 2px",
          }}
        />
        {/* Side button - Power */}
        <div
          style={{
            position: "absolute",
            right: -3,
            top: 180,
            width: 3,
            height: 80,
            backgroundColor: "#2a2a2a",
            borderRadius: "0 2px 2px 0",
          }}
        />

        {/* Screen */}
        <div
          style={{
            width: phoneWidth,
            height: phoneHeight,
            backgroundColor: "#000",
            borderRadius: cornerRadius - bezelWidth,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Dynamic Island / Notch */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              width: 126,
              height: 35,
              backgroundColor: "#000",
              borderRadius: 20,
              zIndex: 100,
            }}
          />

          {/* Screen content */}
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
            }}
          >
            {children}
          </div>

          {/* Home indicator */}
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              width: 134,
              height: 5,
              backgroundColor: "rgba(255, 255, 255, 0.3)",
              borderRadius: 3,
              zIndex: 100,
            }}
          />
        </div>
      </div>
    </div>
  );
};
