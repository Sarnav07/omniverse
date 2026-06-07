import { useEffect, useRef } from "react";

/**
 * Distant-nebula ambient: extreme blur, single-digit opacity orbs.
 * Light is functional, never decorative. Cursor parallax is microscopic.
 */
export function FluidBackground() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0,
      raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * -16;
      ty = (e.clientY / window.innerHeight - 0.5) * -16;
    };
    const tick = () => {
      cx += (tx - cx) * 0.03;
      cy += (ty - cy) * 0.03;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div ref={trackRef} className="absolute inset-0">
        <div
          className="fluid-orb"
          style={{
            width: "70vw",
            height: "70vw",
            top: "-20vh",
            left: "30vw",
            background:
              "radial-gradient(circle, rgba(255,140,0,0.10) 0%, rgba(255,140,0,0.04) 40%, transparent 70%)",
            animation: "fluid-drift-1 60s ease-in-out infinite",
          }}
        />
        <div
          className="fluid-orb"
          style={{
            width: "75vw",
            height: "75vw",
            top: "30vh",
            left: "-25vw",
            background:
              "radial-gradient(circle, rgba(0,229,255,0.08) 0%, rgba(0,229,255,0.03) 45%, transparent 75%)",
            animation: "fluid-drift-2 80s ease-in-out infinite",
          }}
        />
        <div
          className="fluid-orb"
          style={{
            width: "55vw",
            height: "55vw",
            top: "55vh",
            left: "40vw",
            background: "radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%)",
            animation: "fluid-drift-3 72s ease-in-out infinite",
          }}
        />
      </div>
      {/* hairline grid — institutional graph paper */}
      <div className="absolute inset-0 hairline-grid opacity-[0.35]" />
      {/* vignette to deepen edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 20%, rgba(3,3,3,0.7) 70%, #030303 100%)",
        }}
      />
    </div>
  );
}
