import React from "react";

export default function MetricCard({ label, value, unit, color, icon }) {
  return (
    <div className="glass p-6 text-center hover:scale-105 transition-transform duration-300">
      <p className="text-xs text-cyan-300/70 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-3xl font-bold ${color}`}>
        {value}
        <span className="text-sm ml-1 opacity-80">{unit}</span>
      </p>
      {icon && <div className="mt-2 opacity-70">{icon}</div>}
    </div>
  );
}
