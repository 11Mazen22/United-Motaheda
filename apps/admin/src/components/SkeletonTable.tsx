import React from 'react';

interface Props {
  rows?: number;
  cols?: number;
}

export function SkeletonTable({ rows = 5, cols = 5 }: Props) {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-gray-100 dark:bg-slate-700 rounded-t-xl mb-1" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 px-4 py-3 border-b border-gray-50 dark:border-slate-700"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-4 bg-gray-100 dark:bg-slate-700 rounded flex-1"
              style={{ opacity: j === 0 ? 1 : 0.6 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-4 space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-100 dark:bg-slate-700 rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}
