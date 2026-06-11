const fs = require('fs');

const path = 'src/routes/markets.$id.tsx';
let content = fs.readFileSync(path, 'utf8');

// Import ExecutionTerminal
content = content.replace(
  /import \{ NavBar \} from "@\/components\/nav-bar";/,
  `import { NavBar } from "@/components/nav-bar";\nimport ExecutionTerminal from "@/components/execution-terminal";`
);

// Delete old SwapTab, ManageTab, RedeemTab
content = content.replace(/\/\* ─────────────────────────── swap tab ─────────────────────────── \*\/[\s\S]*?(?=\/\* ─────────────────────────── manage tab ─────────────────────────── \*\/)/, '');
content = content.replace(/\/\* ─────────────────────────── manage tab ─────────────────────────── \*\/[\s\S]*?(?=\/\* ─────────────────────────── redeem tab ─────────────────────────── \*\/)/, '');
content = content.replace(/\/\* ─────────────────────────── redeem tab ─────────────────────────── \*\/[\s\S]*?(?=function ProbabilityCanvas)/, '');

// Also delete BigInput, PreviewCell, StatCell, ConnectorLine if they exist and are unused. Wait, let's just delete IntentEngine import.
content = content.replace(/import \{ IntentEngine \} from "@\/components\/intent-engine";\n/, '');

// Replace the right side 35% panel
const panelStart = content.indexOf('{/* Intent Engine — 35% */}');
const panelEnd = content.indexOf('{/* ── End Dual Panel ── */}'); // Assuming there's some marker, wait, I need a robust replacement.

// Let's replace by regex
content = content.replace(
  /\{\/\* Intent Engine — 35% \*\/\}[\s\S]*?<\/[ \t]*div>\s*<\/[ \t]*div>\s*<\/[ \t]*div>\s*<\/[ \t]*div>\s*<\/[ \t]*main>/,
  `{/* Execution Terminal — 35% */}
          <div className="flex w-[35%] flex-col">
            <ExecutionTerminal />
          </div>
        </div>
      </div>
    </main>
  `
);

// We also need to remove the `tab` state from TerminalPage since the new ExecutionTerminal manages its own tabs.
content = content.replace(/const \[tab, setTab\] = useState<TerminalTab>\("borrow"\);\n/, '');
content = content.replace(/type TerminalTab = "swap" \| "borrow" \| "manage" \| "provide" \| "redeem";\n/, '');

fs.writeFileSync(path, content);
