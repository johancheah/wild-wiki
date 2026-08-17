import { mapIcon } from "@/lib/assets";

export function MapCell({ map }: { map: string }) {
  const icon = mapIcon(map);
  return (
    <span className="map-cell">
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="map-icon" src={icon} alt={map} />
      )}
      {map}
    </span>
  );
}
