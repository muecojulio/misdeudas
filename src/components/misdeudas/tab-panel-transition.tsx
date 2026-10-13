import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TabId } from "@/lib/misdeudas/types";

export function TabPanelTransition({
  tab,
  direction,
  children,
}: {
  tab: TabId;
  direction: "forward" | "backward";
  children: ReactNode;
}) {
  const previousRef = useRef({ tab, direction, children });
  const latestRef = useRef({ tab, direction, children });
  latestRef.current = { tab, direction, children };
  const [exiting, setExiting] = useState<null | {
    tab: TabId;
    direction: "forward" | "backward";
    children: ReactNode;
  }>(null);

  if (previousRef.current.tab === tab) {
    previousRef.current = { tab, direction, children };
  }

  useEffect(() => {
    const previous = previousRef.current;
    if (previous.tab === tab) return;
    setExiting(previous);
    previousRef.current = latestRef.current;
    const timer = window.setTimeout(() => setExiting(null), 190);
    return () => window.clearTimeout(timer);
  }, [tab]);

  return (
    <div className="tab-panel-stack">
      <div className="tab-panel-layer tab-panel-transition" data-direction={direction} key={tab}>
        {children}
      </div>
      {exiting ? (
        <div
          className="tab-panel-layer tab-panel-exit"
          data-direction={exiting.direction}
          key={exiting.tab}
          aria-hidden="true"
          inert
        >
          {exiting.children}
        </div>
      ) : null}
    </div>
  );
}
