import { useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

export type DataSource = "live" | "indexed" | "manifest" | "computed" | "unavailable";

interface WCurveLiveProps {
  price: number;           // 0..1
  lambdaWad?: bigint;
  source: DataSource;
  preAttackPrice?: number; // optional
}

export function WCurveLive({ price, lambdaWad, source, preAttackPrice }: WCurveLiveProps) {
  const W = 800;
  const H = 340;
  const pad = 0;

  const [hoverP, setHoverP] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const lambdaScale = lambdaWad ? Math.max(0.5, Math.min(2, Number(lambdaWad) / 1e18)) : 1;

  const getLam = (p: number) => {
    return 0.18 + 0.85 * (Math.pow(2 * (p - 0.5), 2) * 0.6 * lambdaScale + Math.pow(Math.sin(p * Math.PI), 2) * -0.42 + 0.5);
  };

  const getDotY = (p: number) => {
    const lam = getLam(p);
    return H - Math.max(0, Math.min(1, lam - 0.1)) * H;
  };

  const path = useMemo(() => {
    const pts: string[] = [];
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      const x = p * W;
      const y = getDotY(p);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(" ");
  }, [lambdaScale]);

  const clampedPrice = Math.max(0, Math.min(1, price));
  const dotX = clampedPrice * W;
  const dotY = getDotY(clampedPrice);
  const lamAt = lambdaWad ? Number(lambdaWad) / 1e18 : 1;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let p = x / rect.width;
    p = Math.max(0, Math.min(1, p));
    setHoverP(p);
  };

  return (
    <div className="flex h-full flex-col relative group">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[13px] font-medium text-text-primary">
            Optimal Activeness λ*(p)
          </div>
          <div className="mt-1 text-[12px] text-text-secondary">
            Liquidity contracts as probability approaches 0 or 1.
          </div>
        </div>
        <div className="text-right tabular">
          <div className="text-[10px] font-medium uppercase tracking-widest text-text-secondary">Current λ*</div>
          <div className="text-2xl font-semibold text-white">{lamAt.toFixed(3)}</div>
        </div>
      </div>

      <div className="relative flex-1 w-full overflow-hidden rounded-lg border border-white/[0.04] bg-white/[0.01]">
        <svg 
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`} 
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverP(null)}
        >
          <defs>
            {/* Pattern Fill: 2px diagonal lines */}
            <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45 0 0)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(37, 99, 235, 0.2)" strokeWidth="2" />
            </pattern>
            {/* Vertical Gradient Overlay */}
            <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(37, 99, 235, 0.4)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <linearGradient id="curveGradientLive" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(37, 99, 235, 0.4)" />
              <stop offset={`${clampedPrice * 100}%`} stopColor="var(--accent-blue)" />
              <stop offset="100%" stopColor="rgba(37, 99, 235, 0.4)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={`v${g}`} x1={g * W} x2={g * W} y1={0} y2={H} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {[0.33, 0.66].map((g) => (
            <line key={`h${g}`} x1={0} x2={W} y1={g * H} y2={g * H} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}

          {/* Area Fills */}
          <motion.path
            d={path + ` L ${W} ${H} L 0 ${H} Z`}
            fill="url(#diagonalHatch)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.path
            d={path + ` L ${W} ${H} L 0 ${H} Z`}
            fill="url(#areaGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* W Curve Stroke */}
          <motion.path
            d={path}
            fill="none"
            stroke="url(#curveGradientLive)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: "drop-shadow(0 0 8px rgba(37, 99, 235, 0.4))" }}
          />

          {/* Live current dot */}
          <motion.g animate={{ x: dotX, y: dotY }} transition={{ type: "spring", stiffness: 90, damping: 18 }}>
            <circle r="16" fill="rgba(37, 99, 235, 0.15)">
              <animate attributeName="r" values="8;20;8" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="4" fill="var(--accent-blue)" />
            <circle r="2" fill="#fff" />
          </motion.g>

          {/* Hover Interactive Layer */}
          <AnimatePresence>
            {hoverP !== null && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <line 
                  x1={hoverP * W} 
                  x2={hoverP * W} 
                  y1={getDotY(hoverP)} 
                  y2={H} 
                  stroke="rgba(255,255,255,0.2)" 
                  strokeWidth="1" 
                  strokeDasharray="4 4" 
                />
                <circle cx={hoverP * W} cy={getDotY(hoverP)} r="4" fill="white" style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.8))" }} />
              </motion.g>
            )}
          </AnimatePresence>
        </svg>

        {/* Hover Tooltip HTML Overlay */}
        <AnimatePresence>
          {hoverP !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute w-[160px] rounded-xl border border-white/[0.08] bg-[#141417]/80 backdrop-blur-xl p-3 z-20"
              style={{
                left: `clamp(10px, ${hoverP * 100}% - 80px, calc(100% - 170px))`,
                top: `${(getDotY(hoverP) / H) * 100}%`,
                marginTop: "-80px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] uppercase tracking-widest text-text-secondary">Price</span>
                  <span className="tabular font-mono text-xs text-white">{(hoverP * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] uppercase tracking-widest text-text-secondary">Activeness</span>
                  <span className="tabular font-mono text-xs text-accent-blue">{getLam(hoverP).toFixed(3)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
