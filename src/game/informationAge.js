/** Age labels describe evidence updates, never crop age or the confidence percentage. */
export function informationAge(days, hasInformation) {
  if (!hasInformation || !Number.isFinite(days) || days < 0) return '暂无信息';
  return days === 0 ? '当天' : `${days}天前`;
}
