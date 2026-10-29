import React, { useLayoutEffect, useRef, useState } from "react";
import { Linking, Pressable, Share, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Svg, { Path, Rect } from "react-native-svg";
import QRCode from "qrcode";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Chips, Field, Sheet, Txt, useTheme } from "@/src/shared/ui";
import { guestSharingOrigin, manageGuestAccess } from "./guestTransport";

type Settings = {
  enabled: boolean;
  access?: "preview" | "participate";
  expires_at?: string | null;
  preview_title?: string;
  preview_description?: string;
  area_label?: string;
  url?: string;
  stop_ids?: string[];
};
type Guest = { id: string; name: string; response: string; approved: boolean };

export type GuestShareProps = {
  visible: boolean; onClose: () => void; target: string; title: string;
  kind?: "beacon" | "decision" | "plan" | "status";
  stops?: { id: string; title: string }[];
  statusText?: string;
  expiresAt?: string;
  readOnly?: boolean;
};

export function GuestShareSheet(props: GuestShareProps) {
  const { userId, viewerEpoch } = useBeacon();
  // Destroy invitation tokens and draft settings when ownership changes or
  // the sheet closes, before another account can see or reuse them.
  return props.visible ? <GuestShareSession key={`${userId}:${viewerEpoch}:${props.kind}:${props.target}:${props.title}`} {...props} /> : null;
}

export function GuestShareButton({ label = "Share invitation", ...props }: Omit<GuestShareProps, "visible" | "onClose"> & { label?: string }) {
  const { data } = useBeacon();
  const [open, setOpen] = useState(false);
  if (!guestSharingOrigin() || !(props.kind && props.kind !== "beacon" ? data.capabilities?.guest_planning : data.capabilities?.guest_sharing)) return null;
  return <><Button secondary compact title={label} onPress={() => setOpen(true)} /><GuestShareSheet {...props} visible={open} onClose={() => setOpen(false)} /></>;
}

function GuestShareSession({ visible, onClose, target, title, kind = "beacon", stops = [], statusText, expiresAt, readOnly = false }: GuestShareProps) {
  const { userId, getViewerEpoch, viewerEpoch, refresh } = useBeacon();
  const { styles } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [link, setLink] = useState("");
  const [panel, setPanel] = useState<"menu" | "settings" | "qr" | "attendance">("menu");
  const [access, setAccess] = useState<"preview" | "participate">("preview");
  const [expiry, setExpiry] = useState<"7 days" | "30 days" | "No expiry" | "1 hour" | "Until note ends">(kind === "status" ? "1 hour" : "7 days");
  const [selectedStops, setSelectedStops] = useState<string[]>([]);
  const [previewTitle, setPreviewTitle] = useState(title);
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const current = useRef({ userId, viewerEpoch, target, visible });
  useLayoutEffect(() => {
    current.current = { userId, viewerEpoch, target, visible };
    return () => { current.current.visible = false; };
  }, [userId, viewerEpoch, target, visible]);

  const request = async <T,>(body: Record<string, unknown>): Promise<T> => {
    const actor = userId, epoch = getViewerEpoch(), requestedTarget = target;
    if (!actor) throw new Error("Sign in to manage sharing.");
    const assertCurrent = () => {
      if (current.current.userId !== actor || getViewerEpoch() !== epoch || current.current.target !== requestedTarget || !current.current.visible)
        throw new Error("Your account or invitation changed. Reopen sharing.");
    };
    return manageGuestAccess<T>(actor, body, assertCurrent);
  };
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    const snapshot = current.current;
    lock.current = true; setBusy(true); setMessage("");
    try { await work(); }
    catch (error) {
      if (current.current.userId === snapshot.userId && current.current.viewerEpoch === snapshot.viewerEpoch && current.current.target === snapshot.target && current.current.visible)
        setMessage((error as Error).message);
    } finally { lock.current = false; setBusy(false); }
  };
  const loadSettings = () => run(async () => {
    const result = await request<Settings>({ action: "share", command: "read", kind, target });
    setSettings(result); setAccess(result.access ?? "preview");
    setPreviewTitle(result.preview_title ?? title); setDescription(result.preview_description ?? ""); setArea(result.area_label ?? "");
    setSelectedStops(result.stop_ids ?? []);
    setPanel("settings");
  });
  const generate = () => run(async () => {
    const expires = kind === "status" ? new Date(Math.min(Date.parse(expiresAt ?? ""), expiry === "1 hour" ? Date.now() + 3600000 : Infinity)).toISOString()
      : expiry === "No expiry" ? null : new Date(Date.now() + (expiry === "7 days" ? 7 : 30) * 86400000).toISOString();
    const result = await request<Settings>({ action: "share", command: settings?.enabled ? "regenerate" : "enable", kind, target,
      settings: { access: readOnly || kind === "plan" || kind === "status" ? "preview" : access, expires_at: expires, preview_title: previewTitle.trim(), preview_description: description.trim(), area_label: area.trim(), stop_ids: selectedStops, ...(kind === "status" ? {status_text:statusText} : {}) } });
    if (!result.url?.startsWith(`${guestSharingOrigin()}/g/`)) throw new Error("A secure invitation could not be created.");
    setSettings(result); setLink(result.url); setPanel("menu");
  });
  const needLink = async (work: () => Promise<void>) => {
    if (!link) { await loadSettings(); return; }
    await run(work);
  };
  const copyLink = () => needLink(async () => {
    const copied = await Clipboard.setStringAsync(link);
    setMessage(copied ? "Link copied." : "Select and copy your invitation link below.");
  });
  const loadGuests = () => run(async () => {
    const result = await request<{ guests: Guest[] }>({ action: "attendance", kind, target, command: "read" });
    setGuests(result.guests); setPanel("attendance");
  });
  const updateGuest = (participant: string, command: "approve" | "remove") => run(async () => {
    const result = await request<{ guests: Guest[] }>({ action: "attendance", kind, target, participant, command });
    setGuests(result.guests); await refresh();
  });
  const qr = link && panel === "qr" ? QRCode.create(link, { errorCorrectionLevel: "M" }) : null;
  let qrPath = "";
  if (qr) for (let row = 0; row < qr.modules.size; row++) for (let col = 0; col < qr.modules.size; col++)
    if (qr.modules.get(row, col)) qrPath += `M${col + 4} ${row + 4}h1v1h-1z`;

  return <Sheet title="Share invitation" visible={visible} onClose={onClose}>
    <View style={{ gap: 12 }}>
      {panel === "menu" ? <>
        <Txt muted>{link ? "Guest access enabled. Anyone with this link can view the shared invitation." : "Enable or manage a guest invitation in Guest Access Settings. Guest access stays off until an organizer enables it."}</Txt>
        <Action title="Share Link" disabled={busy} run={() => needLink(async () => { await Share.share({ title, message: `${title}\n${link}`, url: link }); })} />
        <Action title="Copy Link" disabled={busy} run={copyLink} />
        <Action title="QR Code" disabled={busy} run={() => needLink(async () => setPanel("qr"))} />
        <Action title="Guest Access Settings" disabled={busy} run={loadSettings} />
        {kind === "beacon" || kind === "decision" ? <Action title="Guest responses" disabled={busy} run={loadGuests} /> : null}
        {link ? <TextInput value={link} readOnly selectTextOnFocus accessibilityLabel="Invitation link to copy" style={styles.input} /> : null}
      </> : null}
      {panel === "settings" ? <>
        <Txt>{settings?.enabled ? "Guest access is enabled. Saving creates a new link and disables the previous link." : "Enable guest access explicitly for this invitation."}</Txt>
        <Txt muted>Only the title, description and general area below appear outside Squad Beacon. Avoid private meeting details.</Txt>
        <Field label="Shared title" value={previewTitle} onChangeText={setPreviewTitle} maxLength={120} />
        <Field label="Shared description" value={description} onChangeText={setDescription} maxLength={500} multiline />
        <Field label="General area (optional)" value={area} onChangeText={setArea} maxLength={160} />
        {!readOnly && kind !== "plan" && kind !== "status" ? <Chips options={["preview", "participate"] as const} value={access} onChange={setAccess} /> : <Txt muted>Read-only sharing.</Txt>}
        {!readOnly && access === "participate" ? <Txt muted>Email verification is required to respond. Organizer approval, capacity and decision deadlines still apply.</Txt> : null}
        {kind === "status" ? <><Txt>Selected text snapshot: {statusText}</Txt><Txt muted>This shares only the selected text until expiry. Live location, attachments and availability are excluded.</Txt><Chips options={["1 hour", "Until note ends"] as const} value={expiry as "1 hour" | "Until note ends"} onChange={setExpiry} /></> : <Chips options={["7 days", "30 days", "No expiry"] as const} value={expiry as "7 days" | "30 days" | "No expiry"} onChange={setExpiry} />}
        {kind === "plan" ? <><Txt>Select the stops to share. New stops remain private. Linked Beacons and decisions appear only while their organizers independently enable guest access.</Txt>{stops.map(stop => <Pressable key={stop.id} accessibilityRole="checkbox" accessibilityState={{ checked: selectedStops.includes(stop.id), disabled: busy }} disabled={busy} onPress={() => setSelectedStops(ids => ids.includes(stop.id) ? ids.filter(id => id !== stop.id) : [...ids,stop.id])} style={[styles.card,{ minHeight: 48 }]}><Txt>{selectedStops.includes(stop.id) ? "✓ " : "○ "}{stop.title}</Txt></Pressable>)}</> : null}
        <Button title={settings?.enabled ? "Replace invitation link" : "Enable guest invitation"} disabled={busy || !previewTitle.trim() || (kind === "plan" && !selectedStops.length)} onPress={() => void generate()} />
        {settings?.enabled ? <Button secondary title="Disable guest access" disabled={busy} onPress={() => void run(async () => {
          await request({ action: "share", command: "revoke", kind, target }); setLink(""); setSettings({ enabled: false }); setMessage("Guest access disabled. Recorded responses are preserved.");
        })} /> : null}
      </> : null}
      {panel === "qr" && qr ? <>
        <View accessibilityLabel="QR invitation code" style={{ alignItems: "center", padding: 12, backgroundColor: "white" }}>
          <Svg width={230} height={230} viewBox={`0 0 ${qr.modules.size + 8} ${qr.modules.size + 8}`}><Rect width={qr.modules.size + 8} height={qr.modules.size + 8} fill="white" /><Path d={qrPath} fill="#181A1F" /></Svg>
        </View>
        <Button secondary title="Download QR flyer" onPress={() => void run(async () => { await Linking.openURL(`${link}/flyer.svg`); })} />
        <Txt muted>Disabling a link prevents future access. Downloaded flyers and cached social previews cannot be recalled.</Txt>
      </> : null}
      {panel === "attendance" ? <>
        {!guests.length ? <Txt muted>No guest responses yet.</Txt> : guests.map(guest => <View key={guest.id} style={{ gap: 6 }}>
          <Txt>{guest.name} · {guest.response === "requested" ? "Pending approval" : guest.response}</Txt>
          {guest.response === "requested" ? <Action title={`Approve ${guest.name}`} disabled={busy} run={() => updateGuest(guest.id, "approve")} /> : null}
          <Action title={`Remove ${guest.name}`} disabled={busy} run={() => updateGuest(guest.id, "remove")} />
        </View>)}
      </> : null}
      {message ? <View accessibilityRole="alert"><Txt>{message}</Txt></View> : null}
      {panel !== "menu" ? <Button secondary title="Back to sharing" disabled={busy} onPress={() => setPanel("menu")} /> : null}
    </View>
  </Sheet>;
}
