import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

import { TitleScene } from "./scenes/TitleScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { SolutionScene } from "./scenes/SolutionScene";
import { FeatureChat } from "./scenes/FeatureChat";
import { FeaturePreview } from "./scenes/FeaturePreview";
import { Feature2D3D } from "./scenes/Feature2D3D";
import { FeatureAI } from "./scenes/FeatureAI";
import { EndingScene } from "./scenes/EndingScene";

export const IntroVideo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <TransitionSeries>
        {/* Title: 0-3s (90 frames) */}
        <TransitionSeries.Sequence durationInFrames={90}>
          <TitleScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Problem: 3-6s (90 frames) */}
        <TransitionSeries.Sequence durationInFrames={90}>
          <ProblemScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Solution: 6-9s (90 frames) */}
        <TransitionSeries.Sequence durationInFrames={90}>
          <SolutionScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Feature 1: Chat Interface (90 frames) */}
        <TransitionSeries.Sequence durationInFrames={90}>
          <FeatureChat />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Feature 2: Real-time Preview (90 frames) */}
        <TransitionSeries.Sequence durationInFrames={90}>
          <FeaturePreview />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Feature 3: 2D/3D Support (90 frames) */}
        <TransitionSeries.Sequence durationInFrames={90}>
          <Feature2D3D />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Feature 4: AI Image Generation (90 frames) */}
        <TransitionSeries.Sequence durationInFrames={90}>
          <FeatureAI />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        {/* Ending: 120 frames (4s) */}
        <TransitionSeries.Sequence durationInFrames={120}>
          <EndingScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
