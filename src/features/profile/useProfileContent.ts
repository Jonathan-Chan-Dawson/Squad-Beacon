import { useEffect, useRef, useState } from "react";
import { useBeacon } from "@/src/shared/store";
import { canViewProfile } from "./privacy";
import {
  profilePermissionKey,
  type ProfileContentPage,
  type ProfileContentQuery,
} from "./profileContent";

/** Every permission-bearing snapshot change invalidates pages and in-flight media. */
export function useProfileAccessKey(personId: string) {
  const { data, userId, viewerEpoch } = useBeacon();
  return JSON.stringify([
    personId,
    userId,
    viewerEpoch,
    profilePermissionKey(data),
  ]);
}
export function useProfileContent(input: ProfileContentQuery) {
  const { data, userId, loadProfileContent } = useBeacon();
  const accessKey = useProfileAccessKey(input.personId);
  const key = JSON.stringify([
    accessKey,
    input.personId,
    input.filter,
    input.query,
    input.pageSize,
  ]);
  const [result, setResult] = useState<{
    key: string;
    page?: ProfileContentPage;
    error?: string;
  }>();
  const [retry, setRetry] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const generation = useRef(0);
  const moreLock = useRef<string | null>(null);
  const allowed = canViewProfile(data, input.personId, userId);
  useEffect(() => {
    const token = ++generation.current;
    let active = true;
    if (!allowed) return;
    const params = JSON.parse(key) as [
      string,
      string,
      ProfileContentQuery["filter"],
      string,
      number,
    ];
    const timer = setTimeout(
      () => {
        void loadProfileContent({
          personId: params[1],
          filter: params[2],
          query: params[3],
          pageSize: params[4],
        }).then(
          (page) => {
            if (active && generation.current === token)
              setResult({ key, page });
          },
          (error) => {
            if (active && generation.current === token)
              setResult({
                key,
                error:
                  error instanceof Error
                    ? error.message
                    : "Could not load experiences.",
              });
          },
        );
      },
      input.query ? 200 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, retry, allowed, loadProfileContent, input.query]);
  const current = allowed && result?.key === key ? result : undefined;
  async function more() {
    if (!current?.page?.nextCursor || moreLock.current === key) return;
    const token = generation.current;
    moreLock.current = key;
    setBusyKey(key);
    try {
      const page = await loadProfileContent({
        ...input,
        cursor: current.page.nextCursor,
      });
      if (generation.current === token)
        setResult({
          key,
          page: {
            ...page,
            rows: [
              ...current.page.rows,
              ...page.rows.filter(
                (row) => !current.page!.rows.some((old) => old.id === row.id),
              ),
            ],
          },
        });
    } catch (error) {
      if (generation.current === token)
        setResult({
          key,
          page: current.page,
          error:
            error instanceof Error ? error.message : "Could not load more.",
        });
    } finally {
      if (moreLock.current === key) {
        moreLock.current = null;
        setBusyKey(null);
      }
    }
  }
  return {
    page: current?.page,
    error: current?.error,
    loading: allowed && !current,
    loadingMore: busyKey === key,
    retry: () => setRetry((n) => n + 1),
    more,
    accessKey,
  };
}
