import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded border border-border bg-bg-raised ${className}`}
      {...props}
    />
  );
}
