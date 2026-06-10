import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { SimulationBanner } from "../simulation-banner";

describe("SimulationBanner", () => {
  beforeEach(() => { cleanup(); });

  it("Property 5: always renders all three required strings", () => {
    render(<SimulationBanner />);
    expect(screen.getByText(/SIMULATION/)).toBeInTheDocument();
    expect(screen.getByText(/Client-side only/)).toBeInTheDocument();
    expect(screen.getByText(/No on-chain transactions/)).toBeInTheDocument();
  });

  it("remains visible when presentMode would normally hide things", () => {
    // SimulationBanner accepts no presentMode prop and never conditionally hides itself
    render(<SimulationBanner />);
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});
