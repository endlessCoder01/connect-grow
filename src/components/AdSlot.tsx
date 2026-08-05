import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, ADSENSE_ENABLED } from "@/lib/adsense";

type Props = {
  slot: string;
  format?: string;
  className?: string;
  style?: React.CSSProperties;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ slot, format = "auto", className, style }: Props) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!ADSENSE_ENABLED || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      console.warn("AdSense push failed", e);
    }
  }, []);

  if (!ADSENSE_ENABLED) {
    return (
      <div
        className={
          "flex items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground " +
          (className ?? "")
        }
        style={style}
      >
        Pray Daily 
      </div>
    );
  }

  return (
    <ins
      className={"adsbygoogle block " + (className ?? "")}
      style={{ display: "block", ...style }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
