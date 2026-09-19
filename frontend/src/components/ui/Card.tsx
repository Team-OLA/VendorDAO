/** A flat panel with a light border and subtle shadow — no dark-theme translucency. */
export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
