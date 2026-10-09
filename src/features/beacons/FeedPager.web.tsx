import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { FEED_PAGES, type FeedPage, type FeedPagerProps } from "./FeedPager.types";

export default function FeedPager<Page extends string = FeedPage>({
  page,
  children,
  onPageSelected,
  pageSwipeEnabled = true,
  reducedMotion = false,
  pages = FEED_PAGES as readonly Page[],
}: FeedPagerProps<Page>) {
  const scrollRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const selectedIndex = Math.max(0, pages.indexOf(page));
  const lastRequestedIndex = useRef(selectedIndex);
  const lastPositionedWidth = useRef(0);

  useEffect(() => {
    if (!pageWidth || (lastRequestedIndex.current === selectedIndex && lastPositionedWidth.current === pageWidth)) return;
    lastRequestedIndex.current = selectedIndex;
    const resized = lastPositionedWidth.current !== pageWidth;
    lastPositionedWidth.current = pageWidth;
    scrollRef.current?.scrollTo({
      x: selectedIndex * pageWidth,
      animated: !reducedMotion && !resized,
    });
  }, [pageWidth, reducedMotion, selectedIndex]);

  return (
    <View
      onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
      style={{ flex: 1, minHeight: 0 }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        directionalLockEnabled
        nestedScrollEnabled
        scrollEnabled={pageSwipeEnabled}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => {
          if (!pageWidth) return;
          const index = Math.max(
            0,
            Math.min(
              pages.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / pageWidth),
            ),
          );
          lastRequestedIndex.current = index;
          onPageSelected(pages[index]);
        }}
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {children.map((child, index) => (
          <View
            key={pages[index]}
            style={{ width: pageWidth || "100%", flexShrink: 0, minHeight: 0 }}
          >
            {child}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
