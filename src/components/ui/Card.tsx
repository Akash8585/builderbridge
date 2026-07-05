import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-canvas border border-hairline rounded-lg ${className}`}
      {...props}
    />
  );
}
