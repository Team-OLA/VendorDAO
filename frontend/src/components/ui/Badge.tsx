const VARIANTS = {
  indigo: "bg-[#1736F5] text-white",
  emerald: "bg-emerald-600 text-white",
  red: "bg-red-600 text-white",
  amber: "bg-amber-600 text-white",
  blue: "bg-blue-600 text-white",
  zinc: "bg-gray-500 text-white",
  teal: "bg-teal-600 text-white",
  fuchsia: "bg-fuchsia-600 text-white",
  gold: "bg-[#FFC709] text-[#0b1333]",
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

/** A solid, flat-color status pill (deliberately not translucent/ringed — bold flat design). */
export function Badge({
  variant = "zinc",
  children,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold tracking-wide uppercase ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  );
}
