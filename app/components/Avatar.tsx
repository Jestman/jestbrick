import { avatarHue } from "@/lib/format";

export function Avatar({
  handle,
  name,
  size = 40,
  src,
}: {
  handle: string;
  name: string;
  size?: number;
  src?: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flex: "none",
        }}
      />
    );
  }
  const hue = avatarHue(handle);
  const initials = (name || handle)
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("tr-TR");
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `hsl(${hue}, 55%, 45%)`,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.38,
        flex: "none",
        letterSpacing: 0.5,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  if (role !== "creator") return null;
  return (
    <span
      style={{
        background: "var(--yellow)",
        color: "var(--ink)",
        fontSize: 10.5,
        fontWeight: 800,
        padding: "2px 8px",
        borderRadius: 99,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
      }}
    >
      ★ İçerik Üreticisi
    </span>
  );
}
