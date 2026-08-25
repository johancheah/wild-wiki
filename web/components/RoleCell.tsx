import { roleIconUrl } from "@/lib/assets";

export function RoleCell({ role }: { role: string | null }) {
  const icon = roleIconUrl(role);
  return (
    <span className="role-cell">
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="role-icon" src={icon} alt={role ?? ""} />
      )}
      {role ?? "—"}
    </span>
  );
}
