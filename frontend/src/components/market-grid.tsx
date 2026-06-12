import { motion, AnimatePresence } from "motion/react";
import { MarketCard, Market } from "./market-card";

export type MarketGridProps = {
  markets: Market[];
};

export function MarketGrid({ markets }: MarketGridProps) {
  return (
    <motion.div
      layout
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pb-24"
    >
      <AnimatePresence mode="popLayout">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
