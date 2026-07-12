/** "3 dk", "5 sa", "2 gün" gibi Türkçe göreli zaman. */
export function timeAgo(date: Date): string {
  const s = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (s < 60) return "az önce";
  if (s < 3600) return `${Math.floor(s / 60)} dk`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa`;
  if (s < 604800) return `${Math.floor(s / 86400)} gün`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/** Avatar rengi: handle'dan deterministik ton. */
export function avatarHue(handle: string): number {
  let h = 0;
  for (const c of handle) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
