import { headshotUrl } from "@/lib/assets";

export function Avatar({
  displayName,
  headshotFilename,
  size,
}: {
  displayName: string;
  headshotFilename: string | null;
  size?: "lg" | "sm";
}) {
  const url = headshotUrl(headshotFilename);
  const sizeClass = size ? ` avatar-${size}` : "";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`avatar${sizeClass}`} src={url} alt={displayName} />;
  }
  return (
    <span className={`avatar-fallback${sizeClass ? ` avatar-fallback-${size}` : ""}`}>
      {displayName.slice(0, 2).toUpperCase()}
    </span>
  );
}
