import type { ReactNode } from "react";
import { ApiError } from "../api";

/** Shared form building blocks for the owner area. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="muted note">{hint}</p>}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "ok" | "error"; children: ReactNode }) {
  return (
    <p className={kind === "ok" ? "notice notice-ok" : "notice notice-error"} role={kind === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export function errorText(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.";
}
