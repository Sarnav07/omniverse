#!/usr/bin/env node

// Visualization of OLD (dome) vs NEW (W-shape) lambda curves

console.log("\n╔════════════════════════════════════════════════════════════════╗");
console.log("║  λ*(P) Curve Comparison: OLD (dome) vs NEW (correct W-shape)  ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

// OLD formula (WRONG - dome shape peaking at P=0.5)
function oldFormula(p) {
  const exponent = 0.6 + (1 - 0.5) * 0.8; // lambda=0.5 as example
  return Math.pow(4 * p * (1 - p), exponent);
}

// NEW formula (CORRECT - W-shape with minimum at P=0.5)
function newFormula(p) {
  if (p <= 0.0001 || p >= 0.9999) return 0.05;
  const w1 = Math.exp(-Math.pow((p - 0.16) / 0.12, 2));
  const w2 = Math.exp(-Math.pow((p - 0.84) / 0.12, 2));
  return 0.05 + 0.45 * (w1 + w2);
}

// ASCII chart generator
function drawChart(title, formula) {
  console.log(`\n${title}:`);
  console.log("λ* │");
  
  const width = 60;
  const height = 15;
  const points = [];
  
  for (let i = 0; i <= width; i++) {
    const p = i / width;
    const lambda = formula(p);
    points.push(lambda);
  }
  
  const maxLambda = Math.max(...points);
  const minLambda = Math.min(...points);
  
  for (let row = height; row >= 0; row--) {
    const level = minLambda + (maxLambda - minLambda) * (row / height);
    let line = (level * 100).toFixed(0).padStart(3, ' ') + "% │";
    
    for (let i = 0; i <= width; i++) {
      if (Math.abs(points[i] - level) < (maxLambda - minLambda) / height / 2) {
        line += "█";
      } else if (points[i] > level) {
        line += "░";
      } else {
        line += " ";
      }
    }
    console.log(line);
  }
  
  console.log("   0├" + "─".repeat(width) + "┤");
  console.log("    0%        P=0.16      P=0.5       P=0.84        100%");
  console.log(`    Min: ${(minLambda * 100).toFixed(1)}%  Max: ${(maxLambda * 100).toFixed(1)}%`);
}

drawChart("❌ OLD (dome - WRONG)", oldFormula);
drawChart("✅ NEW (W-shape - CORRECT)", newFormula);

// Key statistics
console.log("\n╔═══════════════════════════════════════════════════════════╗");
console.log("║  Key Differences:                                         ║");
console.log("╠═══════════════════════════════════════════════════════════╣");

const testPoints = [0.16, 0.5, 0.84];
console.log("║  Probability │    OLD (wrong)  │   NEW (correct)         ║");
console.log("║──────────────┼─────────────────┼─────────────────────────║");
for (const p of testPoints) {
  const oldVal = (oldFormula(p) * 100).toFixed(1);
  const newVal = (newFormula(p) * 100).toFixed(1);
  const indicator = p === 0.5 ? "← Should be MIN" : "← Should be MAX";
  console.log(`║  P = ${p.toFixed(2)}   │     ${oldVal.padStart(5)}%     │     ${newVal.padStart(5)}%   ${indicator.padEnd(16)} ║`);
}

console.log("╚═══════════════════════════════════════════════════════════╝\n");

console.log("Paper's claim (§6-7): λ*(P) is W-SHAPED with:");
console.log("  • Local MAXIMA at P ≈ 0.16 and P ≈ 0.84");
console.log("  • Local MINIMUM at P = 0.5");
console.log("  • Collapses to ~0 at P → 0 and P → 1\n");

console.log("OLD formula produced a DOME (peak at 0.5) - directly contradicts paper!");
console.log("NEW formula produces the correct W-SHAPE matching the paper. ✓\n");
