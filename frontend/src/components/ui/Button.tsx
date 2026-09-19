import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-[#1736F5] text-white hover:bg-[#122bc9]",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
  danger: "bg-red-600 text-white hover:bg-red-500",
  neutral: "bg-gray-200 text-[#0b1333] hover:bg-gray-300",
  gold: "bg-[#FFC709] text-[#0b1333] hover:bg-[#e6b408]",
} as const;

type ButtonVariant = keyof typeof VARIANTS;

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

/** A solid, flat-color action button — no shadows, no gradients. */
export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}
