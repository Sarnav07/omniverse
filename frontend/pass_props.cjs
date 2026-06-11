const fs = require('fs');
let content = fs.readFileSync('src/routes/markets.$id.tsx', 'utf8');

content = content.replace(
  /<ExecutionTerminal \/>/,
  `<ExecutionTerminal poolWeth={livePool} poolUsdc={MARKET.poolUsdc} lending={MARKET.lending} yesPrice={liveYes} conditionId={id} />`
);

fs.writeFileSync('src/routes/markets.$id.tsx', content);
