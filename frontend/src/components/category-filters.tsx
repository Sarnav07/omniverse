import React from "react";

export const CATEGORIES = ["all", "macro", "yield", "rates", "vol", "stable", "rwa", "lst"];

export type CategoryFiltersProps = {
  activeCategory: string;
  onChange: (category: string) => void;
};

export function CategoryFilters({ activeCategory, onChange }: CategoryFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {CATEGORIES.map((c) => (
        <FilterPill key={c} label={c} active={c === activeCategory} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

export type FilterPillProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export function FilterPill({ label, active, onClick }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-[10px] font-medium tracking-widest uppercase rounded-full border transition-all cursor-pointer outline-none focus-visible:border-white/40 ${
        active
          ? "bg-white text-black border-transparent shadow-[0_0_15px_rgba(255,255,255,0.15)]"
          : "bg-transparent border-white/10 text-[#8B8D98] hover:border-white/30 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
