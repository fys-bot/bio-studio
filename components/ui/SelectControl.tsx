import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

export function SelectControl({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`select-control ${className}`}>
      <select {...props}>{children}</select>
      <ChevronDown size={15} aria-hidden="true" />
    </span>
  );
}
