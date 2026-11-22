import React from "react";
import { View } from "react-native";
import { Action, Sheet, Txt } from "@/src/shared/ui";
import { beaconScoreTier, scoreRewardLabels } from "../beaconScore";
import type { useBeaconScore } from "../useBeaconScore";
import { BeaconSkinPreview } from "@/src/features/beacons/components/BeaconSkinPreview";

export function BeaconScoreSheet({
  score,
  visible,
  onClose,
}: {
  score: ReturnType<typeof useBeaconScore>;
  visible: boolean;
  onClose: () => void;
}) {
  const { index, stage, nextStage } = beaconScoreTier(score.points);
  return (
    <Sheet title="Beacon Score" visible={visible} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <Txt>
          {score.points.toLocaleString()} points · {stage.label} · Level{" "}
          {index + 1}
        </Txt>
        <Txt muted>
          {nextStage
            ? `${(nextStage.at - score.points).toLocaleString()} points to ${nextStage.label}`
            : "Highest tier reached. Your score can keep growing."}
        </Txt>
        {score.offline && (
          <Txt muted>
            Score couldn’t sync. Taps are saved on this device for retry.
          </Txt>
        )}
        <Txt muted>
          {score.taps.toLocaleString()} lifetime taps on this device
        </Txt>
        <Action
          title={
            score.showBadge ? "Hide tier on profile" : "Show tier on profile"
          }
          run={score.toggleBadge}
          disabled={!score.synced}
          secondary
          compact
        />
        <BeaconSkinPreview />
        <Txt>How you earn points</Txt>
        <Txt muted>
          {score.tapRate === 1
            ? "+1 per tap, with no daily limit"
            : `+1 every ${score.tapRate} taps · ${score.tapRate - score.tapRemainder} to your next point`}
        </Txt>
        {score.tapRate > 1 && <Txt muted>Tap rewards improve every three levels. At Level 22, every tap earns a point.</Txt>}
        <Txt muted>A qualifying hosted Beacon earns both hosting and attendance points.</Txt>
        {Object.entries(score.rewards).map(([kind, points]) => (
          <Txt key={kind} muted>
            +{points.toLocaleString()} ·{" "}
            {scoreRewardLabels[kind as keyof typeof scoreRewardLabels]}
          </Txt>
        ))}
        <Txt>Recent points</Txt>
        {score.history.length ? (
          score.history.map((award) => (
            <Txt key={award.id} muted>
              +{award.points.toLocaleString()} · {scoreRewardLabels[award.kind]}
              {award.earned_at
                ? ` · ${new Date(award.earned_at).toLocaleDateString()}`
                : ""}
            </Txt>
          ))
        ) : (
          <Txt muted>No synced points yet.</Txt>
        )}
      </View>
    </Sheet>
  );
}
