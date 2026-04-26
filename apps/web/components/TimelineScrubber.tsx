"use client";
import { useState } from "react";

export const TimelineScrubber: React.FC<{
  days?: number;
  onChange?: (daysAgo: number) => void;
}> = ({ days = 30, onChange }) => {
  const [value, setValue] = useState(days);
  return (
    <div className="flex flex-col gap-2 text-xs text-fg-muted">
      <label htmlFor="scrubber" className="uppercase tracking-wide font-semibold">
        Window · last {value} day{value === 1 ? "" : "s"}
      </label>
      <input
        id="scrubber"
        type="range"
        min={1}
        max={days}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          setValue(v);
          onChange?.(v);
        }}
        className="w-full accent-[#22D3EE]"
        aria-label="Time window in days"
      />
    </div>
  );
};
