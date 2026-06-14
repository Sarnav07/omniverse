// Static fallback addresses — verified live on Arbitrum Sepolia (match demo-manifest.json).
// Runtime code prefers the manifest; these are the offline fallback.
export const CONTRACT_ADDRESSES = {
  OmniverseMath: "0x3F280606ceA810947e43e5DDB7FD2b5A18301dBa" as `0x${string}`,
  ConditionalTokens: "0x1614134BC92fC3dBdC304dFc32178290d4037c1F" as `0x${string}`,
  WETH: "0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204" as `0x${string}`,
  USDC: "0xBCB53c282F9106f3CBD063824c657Cb5928AEB71" as `0x${string}`,
  PriceOracle: "0x9F0d878F5cFB6490B3DaA83e8b716D45E3484acE" as `0x${string}`,
  Resolver: "0xb99d93a881f633F7426529A76CEAA5Ee0Fab7509" as `0x${string}`,
  MarketFactory: "0xc3DFbA9E807d3AF9d52Ded98277083B7211297d7" as `0x${string}`,
  MultiverseLending: "0x63878d16bAe4DBb7712Af8387FaC206Aa7C3145E" as `0x${string}`,
  OmniverseRouter: "0x50365ed56d31A1dB54bad15eB5D8C8AF0a5AEE4D" as `0x${string}`,
} as const;
