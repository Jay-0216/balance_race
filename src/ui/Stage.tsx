import type { ReactNode } from "react";

/** The 9:16 frame every screen renders into. */
export default function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <div className="stage">{children}</div>
    </div>
  );
}
