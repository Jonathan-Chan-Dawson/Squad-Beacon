import React from "react";
import { router, type Href } from "expo-router";
import { View } from "react-native";
import { Action, Button, Sheet, Txt } from "@/src/shared/ui";
import { beaconScoreTier, scoreRewardLabels } from "../beaconScore";
import type { useBeaconScore } from "../useBeaconScore";

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
          {score.points.toLocaleString()} XP · {stage.label} · Level{" "}
          {index + 1}
        </Txt>
        <Txt muted>
          {nextStage
            ? `${(nextStage.at - score.points).toLocaleString()} XP to ${nextStage.label}`
            : "Highest tier reached. Your score can keep growing."}
        </Txt>
        {score.offline && (
          <Txt muted>
            XP couldn’t sync. Try again when you’re online.
          </Txt>
        )}
        <Action
          title={
            score.showBadge ? "Hide tier on profile" : "Show tier on profile"
          }
          run={score.toggleBadge}
          disabled={!score.synced}
          secondary
          compact
        />
        <Button
          compact
          secondary
          title="Open Rewards"
          onPress={() => {
            onClose();
            router.push("/beacon-shop" as Href);
          }}
        />
        <Txt>How you earn XP</Txt>
        <Txt muted>
          A qualifying hosted Beacon earns both hosting and attendance points.
        </Txt>
        {Object.entries(score.rewards).map(([kind, points]) => (
          <Txt key={kind} muted>
            +{points.toLocaleString()} ·{" "}
            {scoreRewardLabels[kind as keyof typeof scoreRewardLabels]}
          </Txt>
        ))}
        <Txt>Recent XP</Txt>
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
          <Txt muted>No synced XP yet.</Txt>
        )}
      </View>
    </Sheet>
  );
}
