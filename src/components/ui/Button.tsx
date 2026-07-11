import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-brand-primary text-white hover:bg-brand-primary-dark",
    secondary:
      "border border-gray-300 bg-white text-brand-secondary hover:border-brand-primary hover:text-brand-primary",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
