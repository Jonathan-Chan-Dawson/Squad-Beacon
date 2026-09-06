"use strict";

import React, { useCallback } from 'react';
import { assignRef, preferHostInstance } from '../../../hostInstance';
import { tagMessage } from '../../../utils';
export const Wrap = ({
  ref,
  children
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let child;
  try {
    child = React.Children.only(children);
  } catch (e) {
    throw new Error(tagMessage(`VirtualGestureDetector expects exactly one React element as its child. To use a gesture with multiple views, wrap them in a single parent view and attach the gesture to that.`));
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const childRef = child.props.ref;
  const attachRef = useCallback(instance => {
    const childCleanup = assignRef(childRef, instance);
    const forwardedCleanup = assignRef(ref, preferHostInstance(instance));
    const hasCleanup = typeof childCleanup === 'function' || typeof forwardedCleanup === 'function';
    if (!hasCleanup) {
      return undefined;
    }
    return () => {
      if (typeof childCleanup === 'function') {
        childCleanup();
      } else {
        assignRef(childRef, null);
      }
      if (typeof forwardedCleanup === 'function') {
        forwardedCleanup();
      } else {
        assignRef(ref, null);
      }
    };
  }, [childRef, ref]);
  return /*#__PURE__*/React.cloneElement(child, {
    collapsable: false,
    ref: attachRef
  },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  child.props.children);
};
//# sourceMappingURL=Wrap.js.map