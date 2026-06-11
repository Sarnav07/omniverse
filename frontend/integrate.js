const fs = require('fs');

// 1. EXPLORER
const oldExplorer = fs.readFileSync('src/routes/explorer.tsx', 'utf8');
const mathExplorer = fs.readFileSync('../bet-slip-terminal/src/components/MathExplorer.tsx', 'utf8');

const routeDefExp = oldExplorer.match(/export const Route = createFileRoute\("\/explorer"\)\(\{[\s\S]*?component: ExplorerPage,\n\}\);/)[0];

const newExplorer = `import { createFileRoute, Link } from "@tanstack/react-router";
import { NavBar } from "@/components/nav-bar";
${mathExplorer.replace(/export function MathExplorer\(\) \{/, 'function ExplorerPage() {').replace(/export default MathExplorer;/, '')}
${routeDefExp.replace('component: ExplorerPage,', 'component: () => (<><NavBar hideWallet={true} /><ExplorerPage /></>),')}
`;

fs.writeFileSync('src/routes/explorer.tsx', newExplorer);

// 2. SIMULATE
const oldSimulate = fs.readFileSync('src/routes/simulate.tsx', 'utf8');
const simulatePage = fs.readFileSync('../bet-slip-terminal/src/components/SimulatePage.tsx', 'utf8');

const routeDefSim = oldSimulate.match(/export const Route = createFileRoute\("\/simulate"\)\(\{[\s\S]*?component: SimulatePage,\n\}\);/)[0];

const newSimulate = `import { createFileRoute, Link } from "@tanstack/react-router";
import { NavBar } from "@/components/nav-bar";
${simulatePage.replace(/export function SimulatePage\(\) \{/, 'function WrappedSimulatePage() {').replace(/export default SimulatePage;/, '')}
${routeDefSim.replace('component: SimulatePage,', 'component: () => (<><NavBar hideWallet={true} /><WrappedSimulatePage /></>),')}
`;

fs.writeFileSync('src/routes/simulate.tsx', newSimulate);

