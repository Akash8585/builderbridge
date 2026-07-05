import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink transition-colors ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
