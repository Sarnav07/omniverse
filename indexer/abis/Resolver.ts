/// ABI fragment for Resolver — only the Resolved event.
/// Extracted from contracts-sol/src/Resolver.sol

export const ResolverAbi = [
  {
    type: "event",
    name: "Resolved",
    inputs: [
      { name: "questionId", type: "bytes32", indexed: true },
      // payouts is a dynamic uint256[] — Ponder handles this as bigint[]
      { name: "payouts", type: "uint256[]", indexed: false },
    ],
  },
] as const;
