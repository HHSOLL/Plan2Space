import type { PropsWithChildren } from "react";

type ShellProps = PropsWithChildren<{ className?: string }>;

export function StudioWorkspaceShell({ className = "", children }: ShellProps) {
  return <div className={`p2s-workspace-shell ${className}`.trim()}>{children}</div>;
}

export function StudioWorkspacePanel({ className = "", children }: ShellProps) {
  return <aside className={`p2s-workspace-panel ${className}`.trim()}>{children}</aside>;
}

export function StudioWorkspaceViewport({ className = "", children }: ShellProps) {
  return <section className={`p2s-workspace-viewport ${className}`.trim()}>{children}</section>;
}
