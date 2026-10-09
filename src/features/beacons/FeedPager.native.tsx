import React, { useEffect, useRef } from "react";
import PagerView, {
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { View } from "react-native";
import { FEED_PAGES, type FeedPage, type FeedPagerProps } from "./FeedPager.types";

export default function FeedPager<Page extends string = FeedPage>({
  page,
  children,
  onPageSelected,
  pageSwipeEnabled = true,
  reducedMotion = false,
  pages = FEED_PAGES as readonly Page[],
}: FeedPagerProps<Page>) {
  const pagerRef = useRef<PagerView>(null);
  const selectedIndex = Math.max(0, pages.indexOf(page));
  const lastRequestedIndex = useRef(selectedIndex);

  useEffect(() => {
    if (lastRequestedIndex.current === selectedIndex) return;
    lastRequestedIndex.current = selectedIndex;
    if (reducedMotion) pagerRef.current?.setPageWithoutAnimation(selectedIndex);
    else pagerRef.current?.setPage(selectedIndex);
  }, [reducedMotion, selectedIndex]);

  const handlePageSelected = (event: PagerViewOnPageSelectedEvent) => {
    const index = event.nativeEvent.position;
    if (index < 0 || index >= pages.length) return;
    lastRequestedIndex.current = index;
    onPageSelected(pages[index]);
  };

  return (
    <PagerView
      ref={pagerRef}
      initialPage={selectedIndex}
      offscreenPageLimit={Math.max(1, pages.length - 1)}
      onPageSelected={handlePageSelected}
      scrollEnabled={pageSwipeEnabled}
      style={{ flex: 1, minHeight: 0 }}
    >
      {children.map((child, index) => (
        <View key={pages[index]} collapsable={false} style={{ flex: 1, minHeight: 0 }}>
          {child}
        </View>
      ))}
    </PagerView>
  );
}
