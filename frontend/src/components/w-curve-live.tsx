import React, { useMemo } from "react";
import { motion } from "motion/react";

export type WCurveLiveProps = {
  price: number;
  lambdaWad?: bigint;
  source: "live" | "indexed" | "manifest" | "computed" | "unavailable";
  preAttackPrice?: number;
};

export function WCurveLive({ price, lambdaWad, source, preAttackPrice }: WCurveLiveProps) {
  const lambda = lambdaWad ? Number(lambdaWad) / 1e18 : 1;
  return (
    <div className="flex flex-col w-full h-full p-6">
      <WCurveHeader lambda={lambda} />
      <WCurveChart price={price} lambda={lambda} preAttackPrice={preAttackPrice} />
    </div>
  );
}

export type WCurveHeaderProps = {
  lambda: number;
};

export function WCurveHeader({ lambda }: WCurveHeaderProps) {
  return (
    <div className="flex justify-between items-start w-full mb-6">
      <div>
        <h3 className="text-sm font-medium text-white">
          Optimal Activeness{" "}
          <span className="italic font-serif">λ</span>
          <sup className="text-[10px]">★</sup>
          <span className="text-[#8B8D98]">(p)</span>
        </h3>
        <p className="text-xs text-[#8B8D98] mt-1">
          Solver routing intensity across the probability surface.
        </p>
      </div>
      <div className="text-right">
        <div className="text-[9px] uppercase tracking-widest text-[#8B8D98]">
          Current <span className="italic font-serif">λ</span>★
        </div>
        <div
          className="text-2xl font-mono text-white tracking-tight"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {lambda.toFixed(3)}
        </div>
      </div>
    </div>
  );
}

export type WCurveChartProps = {
  price: number;
  lambda: number;
  preAttackPrice?: number;
};

export function WCurveChart({ price, lambda, preAttackPrice }: WCurveChartProps) {
  const w = 800;
  const h = 300;
  const padL = 32;
  const padR = 16;
  const padT = 16;
  const padB = 24;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const { linePath, fillPath, priceX, priceY } = useMemo(() => {
    // Real W-shape: λ*(P) has local maxima at P≈0.16 and P≈0.84, minimum at P=0.5
    const lambdaStarApprox = (p: number): number => {
      if (p <= 0.0001 || p >= 0.9999) return 0.05;
      const w1 = Math.exp(-Math.pow((p - 0.16) / 0.12, 2));
      const w2 = Math.exp(-Math.pow((p - 0.84) / 0.12, 2));
      return 0.05 + 0.45 * (w1 + w2);
    };

    const N = 80;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      const y = lambdaStarApprox(p);
      pts.push([padL + p * innerW, padT + (1 - y) * innerH]);
    }
    const line = pts.reduce((acc, [x, y], i) => {
      if (i === 0) return `M ${x.toFixed(2)} ${y.toFixed(2)}`;
      const [px, py] = pts[i - 1];
      const cx = (px + x) / 2;
      return `${acc} Q ${cx.toFixed(2)} ${py.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }, "");
    const fill = `${line} L ${padL + innerW} ${padT + innerH} L ${padL} ${padT + innerH} Z`;

    const px = padL + price * innerW;
    const pyRaw = lambdaStarApprox(price);
    const py = padT + (1 - pyRaw) * innerH;
    return { linePath: line, fillPath: fill, priceX: px, priceY: py };
  }, [lambda, price, innerW, innerH]);

  const vGrid = [0, 0.25, 0.5, 0.75, 1];
  const hGrid = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full flex-1 relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="w-full h-full block"
      >
        <defs>
          <pattern
            id="diagonalHatch"
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="rgba(37, 99, 235, 0.2)"
              strokeWidth="1"
            />
          </pattern>
          <linearGradient id="fadeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.4)" />
            <stop offset="100%" stopColor="rgba(37, 99, 235, 0)" />
          </linearGradient>
        </defs>

        {/* grid */}
        {vGrid.map((g) => (
          <line
            key={`v-${g}`}
            x1={padL + g * innerW}
            x2={padL + g * innerW}
            y1={padT}
            y2={padT + innerH}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          />
        ))}
        {hGrid.map((g) => (
          <line
            key={`h-${g}`}
            x1={padL}
            x2={padL + innerW}
            y1={padT + g * innerH}
            y2={padT + g * innerH}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          />
        ))}

        {/* fill: hatch then gradient wash */}
        <path d={fillPath} fill="url(#diagonalHatch)" />
        <path d={fillPath} fill="url(#fadeGradient)" />

        {/* animated line */}
        <motion.path
          d={linePath}
          stroke="#3B82F6"
          strokeWidth="2"
          fill="none"
          animate={{ d: linePath }}
          transition={{ type: "spring", bounce: 0, duration: 0.6 }}
          style={{ vectorEffect: "non-scaling-stroke" }}
        />

        {/* pre-attack price indicator if exists */}
        {preAttackPrice !== undefined && (
          <line
            x1={padL + preAttackPrice * innerW}
            x2={padL + preAttackPrice * innerW}
            y1={padT}
            y2={padT + innerH}
            stroke="rgba(239, 68, 68, 0.4)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}

        {/* glowing live node */}
        <motion.circle
          cx={priceX}
          cy={priceY}
          r="4"
          fill="#FFFFFF"
          animate={{ cx: priceX, cy: priceY }}
          transition={{ type: "spring", bounce: 0, duration: 0.6 }}
          style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.8))" }}
        />

        {/* axis labels */}
        {vGrid.map((g) => (
          <text
            key={`vl-${g}`}
            x={padL + g * innerW}
            y={h - 6}
            fontSize="9"
            fill="#8B8D98"
            textAnchor="middle"
            style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.1em" }}
          >
            {g.toFixed(2)}
          </text>
        ))}
      </svg>
    </div>
  );
}
