"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

const WORDS = [
  { text: "OMNIVERSE", left: "50%", top: "50%" },
  { text: "AMM", left: "15%", top: "20%" },
  { text: "BOUNDED LIQUIDITY", left: "80%", top: "25%" },
  { text: "STYLUS", left: "25%", top: "75%" },
  { text: "ARBITRUM", left: "75%", top: "80%" },
  { text: "PREDICTION MARKETS", left: "10%", top: "45%" },
  { text: "GAUSSIAN DEFENSE", left: "85%", top: "60%" },
  { text: "ZERO-LIQUIDATION", left: "35%", top: "12%" },
  { text: "MEV", left: "65%", top: "18%" },
  { text: "TOXIC FLOW", left: "45%", top: "85%" },
  { text: "SOLVERS", left: "15%", top: "85%" },
  { text: "YIELD", left: "90%", top: "40%" },
];

export function HeroMesh() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // We want the lines to slowly fade in after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    // Get all word elements
    const wordElements = Array.from(container.querySelectorAll(".mesh-word")) as HTMLElement[];
    let rafId: number;

    const render = () => {
      const parentRect = container.getBoundingClientRect();
      
      const centers = wordElements.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left - parentRect.left + rect.width / 2,
          y: rect.top - parentRect.top + rect.height / 2
        };
      });

      // Clear existing lines
      svg.innerHTML = "";
      
      // Connect all pairs if they are within a certain distance, or just connect all?
      // The Framer component "closer" mode connects nearest N. Let's do nearest 3.
      
      const connections = new Set<string>();
      for (let i = 0; i < centers.length; i++) {
        const dists = [];
        for (let j = 0; j < centers.length; j++) {
          if (i === j) continue;
          const dx = centers[i].x - centers[j].x;
          const dy = centers[i].y - centers[j].y;
          dists.push({ index: j, distance: Math.sqrt(dx*dx + dy*dy) });
        }
        
        dists.sort((a, b) => a.distance - b.distance);
        const closestCount = Math.min(3, dists.length);
        
        for (let k = 0; k < closestCount; k++) {
          const targetIndex = dists[k].index;
          const key = i < targetIndex ? `${i}-${targetIndex}` : `${targetIndex}-${i}`;
          connections.add(key);
        }
      }

      connections.forEach(key => {
        const [i, j] = key.split("-").map(Number);
        const dx = centers[i].x - centers[j].x;
        const dy = centers[i].y - centers[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // fade out lines that are too long
        const maxDist = 600;
        const opacity = Math.max(0, 1 - dist / maxDist) * 0.15; // max 0.15 opacity

        if (opacity > 0) {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", centers[i].x.toString());
          line.setAttribute("y1", centers[i].y.toString());
          line.setAttribute("x2", centers[j].x.toString());
          line.setAttribute("y2", centers[j].y.toString());
          line.setAttribute("stroke", "white");
          line.setAttribute("stroke-opacity", opacity.toString());
          line.setAttribute("stroke-width", "1");
          svg.appendChild(line);
        }
      });

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [mounted]);

  // Generate random animation values once
  const anims = useRef(WORDS.map(() => ({
    x: [0, Math.random() * 60 - 30, Math.random() * 60 - 30, 0],
    y: [0, Math.random() * 60 - 30, Math.random() * 60 - 30, 0],
    duration: 15 + Math.random() * 15
  })));

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      {/* Soft radial vignette so edges fade */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(8,8,10,0) 0%, rgba(8,8,10,0) 45%, rgba(8,8,10,0.85) 85%, #08080A 100%)",
        }}
      />

      <svg 
        ref={svgRef} 
        className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000"
        style={{ opacity: mounted ? 1 : 0 }}
      />

      {WORDS.map((w, i) => (
        <div
          key={i}
          className="absolute"
          style={{ left: w.left, top: w.top, transform: "translate(-50%, -50%)" }}
        >
          <motion.div
            className="mesh-word font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B8D98]/40 whitespace-nowrap"
            animate={{
              x: anims.current[i].x,
              y: anims.current[i].y
            }}
            transition={{
              duration: anims.current[i].duration,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {w.text}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
