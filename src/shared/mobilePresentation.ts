/** Native-stack owns reverse animations and interactive back gestures. */
export function pageAnimation(reduced: boolean, rtl = false) {
  return reduced ? "none" : rtl ? "slide_from_left" : "slide_from_right";
}

export function sheetSurface(
  backgroundColor: string,
  radius: number,
  centered = false,
) {
  return {
    backgroundColor,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: centered ? radius : 0,
    borderBottomRightRadius: centered ? radius : 0,
  };
}
