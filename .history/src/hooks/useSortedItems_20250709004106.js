import { useMemo } from "react";

// Hook to sort an array of normalized ticker items by a given key and direction
export function useSortedItems(items, sortConfig) {
  return useMemo(() => {
    if (!sortConfig?.key) {
      console.log("ℹ️ No sort key provided, returning original items");
      return items;
    }

    console.log(`🔃 Sorting items by ${sortConfig.key} (${sortConfig.direction})`);

    const sorted = [...items].sort((a, b) => {
      const aLastPrice = a.historicalData?.[a.historicalData.length - 1]?.price ?? 0;
      const bLastPrice = b.historicalData?.[b.historicalData.length - 1]?.price ?? 0;

      let aVal = sortConfig.key === "changePercent"
        ? ((aLastPrice - a.buyPrice) / a.buyPrice) * 100
        : a[sortConfig.key];
      let bVal = sortConfig.key === "changePercent"
        ? ((bLastPrice - b.buyPrice) / b.buyPrice) * 100
        : b[sortConfig.key];

      if (typeof aVal === "string") aVal = aVal.toUpperCase();
      if (typeof bVal === "string") bVal = bVal.toUpperCase();

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    console.log("✅ Sorted items:", sorted);
    return sorted;
  }, [items, sortConfig]);
}
