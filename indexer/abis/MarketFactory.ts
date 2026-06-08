/// ABI fragments for MarketFactory — only EventCreated event + view functions.
/// Extracted from contracts-sol/src/MarketFactory.sol

export const MarketFactoryAbi = [
  {
    type: "event",
    name: "EventCreated",
    inputs: [
      { name: "conditionId", type: "bytes32", indexed: true },
      { name: "questionId", type: "bytes32", indexed: true },
      { name: "resolver", type: "address", indexed: false },
      { name: "poolWeth", type: "address", indexed: false },
      { name: "poolUsdc", type: "address", indexed: false },
      { name: "wethMarketId", type: "uint256", indexed: false },
      { name: "usdcMarketId", type: "uint256", indexed: false },
      { name: "question", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "category", type: "string", indexed: false },
    ],
  },
  {
    type: "function",
    name: "weth",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usdc",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;
