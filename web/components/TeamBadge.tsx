export function TeamBadge({ isWild, name }: { isWild: boolean; name: string | null }) {
  return (
    <div className="timeline-team-badge" title={isWild ? "WILD" : name ?? "Opponent"}>
      {isWild ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo.png" alt="WILD" />
      ) : (
        <span>{(name ?? "?").slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
