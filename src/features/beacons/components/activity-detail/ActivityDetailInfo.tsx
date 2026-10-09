import React from "react";
import {
  ActivityDetailInfoContent,
  type ActivityDetailInfoProps,
} from "./ActivityDetailInfo.shared";

export type { ActivityDetailInfoProps } from "./ActivityDetailInfo.shared";

export function ActivityDetailInfo(props: ActivityDetailInfoProps) {
  return <ActivityDetailInfoContent {...props} />;
}

export default ActivityDetailInfo;
