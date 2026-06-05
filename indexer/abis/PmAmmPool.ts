/// ABI fragments for PmAmmPool — only the events and view functions the indexer needs.
/// Extracted from contracts-sol/src/PmAmmPool.sol

export const PmAmmPoolAbi = [
  // ── Events ──────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "OmniverseTrade",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "side", type: "uint8", indexed: false },
      { name: "size", type: "uint256", indexed: false },
      { name: "priceWad", type: "uint256", indexed: false },
      { name: "ellWad", type: "uint256", indexed: false },
      { name: "lambdaWad", type: "uint256", indexed: false },
      { name: "gapWad", type: "int256", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Rebalanced",
    inputs: [
      { name: "xActive", type: "uint256", indexed: false },
      { name: "yActive", type: "uint256", indexed: false },
      { name: "ellActive", type: "uint256", indexed: false },
      { name: "lambdaWad", type: "uint256", indexed: false },
      { name: "blockNumber", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LiquidityAdded",
    inputs: [
      { name: "provider", type: "address", indexed: true },
      { name: "yesAmount", type: "uint256", indexed: false },
      { name: "noAmount", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LiquidityRemoved",
    inputs: [
      { name: "provider", type: "address", indexed: true },
      { name: "yesAmount", type: "uint256", indexed: false },
      { name: "noAmount", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },

  // ── View functions (for on-demand reads in handlers) ────────────────────────
  {
    type: "function",
    name: "conditionId",
    inputs: [],
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collateralToken",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "marketId",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;
