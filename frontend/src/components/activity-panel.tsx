import React from "react";
import { Panel } from "./dashboard-grid";
import { AttackTranscript } from "./attack-transcript";
import { DemoTrade } from "@/lib/dashboardData";

export type ActivityPanelProps = {
  trades: DemoTrade[];
  isLoading: boolean;
  source: string;
};

export function ActivityPanel({ trades, isLoading, source }: ActivityPanelProps) {
  return (
    <Panel label={`Recent Activity · Live Flow (${source})`} className="w-full h-full">
      <AttackTranscript trades={trades} isLoading={isLoading} source={source} />
    </Panel>
  );
}
