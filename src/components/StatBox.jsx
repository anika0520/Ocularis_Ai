// src/components/StatBox.jsx
import React from "react";
import { motion } from "framer-motion";

export default function StatBox({
  label,
  value,
  max,
  color,
  warningThreshold,
  inverse = false,
}) {
  const percent = Math.min(100, (value / max) * 100);
  const warning = inverse ? value < warningThreshold : value > warningThreshold;

  const bgColor = warning ? "from-red-500 to-red-700" : color;

  return (
    <motion.div
      className="relative bg-black/50 rounded-2xl p-6 border border-white/10 shadow-md hover:shadow-lg transition-shadow duration-300"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <p className="text-sm text-gray-300 uppercase mb-3 font-medium">
        {label}
      </p>
      <h2 className="text-4xl font-extrabold mb-4">{Math.round(value)}</h2>
      <div className="h-3 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${bgColor} ${warning ? "animate-pulse" : ""}`}
          style={{ width: `${percent}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
}
