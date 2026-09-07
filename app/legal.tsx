import React from "react";
import { Text, View, Linking } from "react-native";
import { Action, Screen, Txt, styles } from "@/src/ui";
export default function Legal() {
  const support = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
  return (
    <Screen
      title="Your trust comes first."
      eyebrow="PRIVACY & COMMUNITY"
      create={false}
    >
      <View style={styles.card}>
        <Text style={styles.h2}>What we store</Text>
        <Txt>
          Account details, your private birth date for age eligibility, profile,
          friendships, groups, goals, habits, activity plans, RSVPs, and
          comments. Each item is visible only to its authorized audience.
        </Txt>
        <Txt>
          Your live location is off by default. If you enable sharing, we keep
          only the latest point for the selected session. Access ends at expiry
          or revocation; expired points are removed by scheduled cleanup. We do
          not keep routes or sell your precise location.
        </Txt>
      </View>
      <View style={styles.card}>
        <Text style={styles.h2}>Your choices</Text>
        <Txt>
          Choose who sees each goal, habit, and activity. Stop location sharing
          at any time. Block accounts and report concerns from a profile or
          activity. Delete your account in Profile.
        </Txt>
        <Txt>
          Deleted accounts lose their app data. Safety reports are retained for
          up to 90 days, with the reporter account reference removed on account
          deletion. Inbox updates are retained for 30 days. Provider backup
          retention may delay removal from backups.
        </Txt>
      </View>
      <View style={styles.card}>
        <Text style={styles.h2}>Community standards</Text>
        <Txt>
          Be respectful. No harassment, threats, impersonation, hate, sexual
          exploitation, or sharing someone else’s private information. Do not
          use the app to track someone without their permission. Only invite
          people you know.
        </Txt>
        <Txt>
          Squad Beacon is for ages 16+. It is not an emergency or
          safety-monitoring service. For immediate danger, contact local
          emergency services.
        </Txt>
      </View>
      <View style={styles.card}>
        <Text style={styles.h2}>Support & safety reports</Text>
        {support ? (
          <Action
            title={support}
            secondary
            run={() => Linking.openURL("mailto:" + support)}
          />
        ) : (
          <Txt>
            Operator support contact must be configured before a public pilot.
            In-app reports are available to the appointed moderation team.
          </Txt>
        )}
        <Txt muted>
          These pilot disclosures must be reviewed and completed with operator
          and provider details before public distribution.
        </Txt>
      </View>
    </Screen>
  );
}
