import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { AttackTranscript } from "../attack-transcript";
import { DemoTrade } from "@/lib/dashboardData";

const mockTrades: DemoTrade[] = [
  {
    id: "1",
    side: 0,
    sideLabel: "BUY YES",
    size: 2000000000000000000000n,
    priceAfter: 600000000000000000n,
    lambdaWad: 900000000000000000n,
    ellWad: 5000000000000000000000n,
    gapWad: 100000000000000000n,
    trader: "0xabc",
    txHash: "0xdeadbeef1234567890abcdef",
    blockNumber: 12345678,
    timestamp: 1700000000,
  },
  {
    id: "2",
    side: 0,
    sideLabel: "BUY YES",
    size: 4000000000000000000000n,
    priceAfter: 700000000000000000n,
    lambdaWad: 800000000000000000n,
    ellWad: 5000000000000000000000n,
    gapWad: 100000000000000000n,
    trader: "0xdef",
    txHash: "0xcafebabe0987654321fedcba",
    blockNumber: 12345679,
    timestamp: 1700001000,
  },
];

describe("AttackTranscript", () => {
  it("renders Arbiscan links with correct tx hashes (Property 2: Tx Hash Authenticity)", () => {
    render(<AttackTranscript trades={mockTrades} isLoading={false} source="indexed" />);

    const links = screen.getAllByRole("link");
    // Each link should contain the corresponding tx hash
    expect(links[0]).toHaveAttribute("href", "https://sepolia.arbiscan.io/tx/0xdeadbeef1234567890abcdef");
    expect(links[1]).toHaveAttribute("href", "https://sepolia.arbiscan.io/tx/0xcafebabe0987654321fedcba");
  });

  it("renders skeleton loaders while loading", () => {
    const { container } = render(<AttackTranscript trades={[]} isLoading={true} source="indexed" />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows unavailable badge when source is unavailable", () => {
    render(<AttackTranscript trades={[]} isLoading={false} source="unavailable" />);
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });
});
