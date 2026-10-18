import { useEffect, useRef } from "react";
import { router, type Href } from "expo-router";
import type { BeaconCollection } from "../personalCollections";

/** Keep existing collection shortcuts while browsing always uses a full page. */
export function BeaconCollections({
  collection,
  onClose,
}: {
  collection: BeaconCollection | null;
  onClose: () => void;
}) {
  const opened = useRef<BeaconCollection | null>(null);
  useEffect(() => {
    if (!collection) {
      opened.current = null;
      return;
    }
    if (opened.current === collection) return;
    opened.current = collection;
    onClose();
    router.push(`/my-collection?section=${collection}` as Href);
  }, [collection, onClose]);
  return null;
}
