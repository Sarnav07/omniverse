/// ABI fragments for MultiverseLending — all 8 events.
/// Extracted from contracts-sol/src/MultiverseLending.sol

export const MultiverseLendingAbi = [
  {
    type: "event",
    name: "ReserveSeeded",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Borrowed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Repaid",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "yesWon", type: "bool", indexed: false },
      { name: "pEth", type: "uint256", indexed: false },
      { name: "wethRedeemed", type: "uint256", indexed: false },
      { name: "usdcRedeemed", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BorrowerClaimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "wethOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LenderClaimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "wethOut", type: "uint256", indexed: false },
      { name: "usdcOut", type: "uint256", indexed: false },
    ],
  },
] as const;
