// src/components/MetricCard.jsx
import React from "react";

export default function MetricCard({
  label,
  value,
  unit,
  color = "text-[#00ff9d]",
  icon,
}) {
  return (
    <div className="glow-card p-4 text-center">
      <div className="text-xs text-[#94a3b8] uppercase mb-1">{label}</div>
      <div
        className={`text-2xl font-bold ${color} flex items-baseline justify-center gap-1.5`}
      >
        {value}
        <span className="text-sm opacity-80">{unit}</span>
      </div>
      {icon && <div className="mt-1 opacity-80">{icon}</div>}
    </div>
  );
}
