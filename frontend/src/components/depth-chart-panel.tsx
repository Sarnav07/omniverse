import React from "react";
import { Panel } from "./dashboard-grid";

export type DepthChartPanelProps = {
  price: number;
  lambdaWad?: bigint;
  source: "live" | "indexed" | "manifest" | "computed" | "unavailable";
  children?: React.ReactNode;
};

export function DepthChartPanel({ price, lambdaWad, source, children }: DepthChartPanelProps) {
  return (
    <Panel label="Depth Chart · Live Market Probability" className="w-full h-full">
      {children}
    </Panel>
  );
}
