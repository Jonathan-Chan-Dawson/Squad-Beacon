import type { ReactNode } from "react";

export type FeedPage = "Now" | "Upcoming" | "Past";

export type FeedPagerProps<Page extends string = FeedPage> = {
  page: Page;
  children: readonly ReactNode[];
  onPageSelected: (page: Page) => void;
  /** Stable page identifiers. Defaults to the three Beacon periods. */
  pages?: readonly Page[];
  /** False while a card's horizontal response gesture owns the touch. */
  pageSwipeEnabled?: boolean;
  reducedMotion?: boolean;
};

export const FEED_PAGES: readonly FeedPage[] = ["Now", "Upcoming", "Past"];

export function feedPageIndex(page: FeedPage) {
  return FEED_PAGES.indexOf(page);
}
