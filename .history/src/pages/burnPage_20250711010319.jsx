import React, { useState, useEffect } from "react";
import { refreshWatchlistData } from '@data/refreshWatchlistData';
import normalizeTicker from "@data/normalizeTicker";
import { useParams } from "react-router-dom";
import WatchlistHeader from "@components/WatchlistHeader";
import WatchlistChart from "@components/WatchlistChart";
import TimeframeSelector from "@components/TimeframeSelector";
import TickerTable from "@components/TickerTable";
import AddTickerInput from "@components/AddTickerInput";
import { useAverageReturn } from "@hooks/useAverageReturn";

const BurnPage = () => {
  const { slug } = useParams();
  const [selectedTimeframe, setSelectedTimeframe] = useState("D");
  const [watchlist, setWatchlist] = useState(null);
  const [watchlists, setWatchlists] = useState({});
  const [bulkSymbols, setBulkSymbols] = useState("");
  const [buyPrice, setBuyPrice] = useState(null);
  const [buyDate, setBuyDate] = useState(null);

  // Calculate average return for the current watchlist
  const averageReturn = useAverageReturn(watchlist?.items || [], selectedTimeframe);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("burnlist_watchlists");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setWatchlists(parsed);
          const found = Object.values(parsed).find(w => w.slug === slug);
          if (found) {
            found.items = found.items?.map(normalizeTicker);
            found.items = found.items?.filter(item => {
              const isValid = item && Number(item.buyPrice) > 0 && Array.isArray(item.historicalData) && Number(item.historicalData[0]?.price) > 0;
              if (!isValid) {
                console.warn("🧨 Invalid item detected during hydration:", item);
              }
              return isValid;
            });
          }
          console.log("📦 Loaded watchlist:", found);
          setWatchlist(found || null);
        } catch (e) {
          console.error("❌ Corrupt JSON in burnlist_watchlists:", e);
          localStorage.removeItem("burnlist_watchlists");
          setWatchlist(null);
        }
      }
    } catch (error) {
      console.error("❌ Unexpected error reading burnlist_watchlists from localStorage:", error);
      setWatchlist(null);
    }
  }, [slug]);

  useEffect(() => {
    if (!watchlist || !Array.isArray(watchlist.items)) return;

    const key = Object.keys(watchlists).find(k => watchlists[k].slug === slug);
    if (!key) {
      console.warn("⚠️ Could not find matching watchlist key for slug during initial refresh");
      return;
    }

    (async () => {
      const updatedItems = await refreshWatchlistData(watchlist.items);
      if (!updatedItems) {
        console.warn("⚠️ No updated items returned from refreshWatchlistData");
        return;
      }

      updatedItems.forEach(item => {
        console.log(`📏 ${item.symbol} historicalData length after refresh: ${item.historicalData?.length}`);
      });

      const updatedWatchlist = { ...watchlist, items: updatedItems };
      const updated = { ...watchlists, [key]: updatedWatchlist };
      handleSetWatchlists(updated);
      const debugStored = localStorage.getItem("burnlist_watchlists");
      console.log("🧪 Post-refresh localStorage snapshot:", JSON.parse(debugStored));
    })();
  }, [slug]); // ✅ Run once on load only

  // Auto-refresh every 60 seconds if there are real tickers
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!watchlist || !Array.isArray(watchlist.items)) return;
      const hasRealTickers = watchlist.items.some(t => !t.isMock);
      if (!hasRealTickers) return;

      console.log("🔁 Auto-refreshing watchlist data...");
      const updatedItems = await refreshWatchlistData(watchlist.items);
      if (!updatedItems || !Array.isArray(updatedItems)) {
        console.warn("⚠️ No updated items returned from refreshWatchlistData during auto-refresh");
        return;
      }

      updatedItems.forEach(item => {
        console.log(`📏 ${item.symbol} historicalData length after auto-refresh: ${item.historicalData?.length}`);
      });

      const updatedWatchlist = { ...watchlist, items: updatedItems };
      const key = Object.keys(watchlists).find(k => watchlists[k].slug === slug);
      if (!key) {
        console.warn("⚠️ Could not find watchlist key during auto-refresh");
        return;
      }
      const updated = { ...watchlists, [key]: updatedWatchlist };
      handleSetWatchlists(updated);
    }, 60000); // 60 seconds HERE IS HOW OFTEN TO REFRESH

    return () => clearInterval(interval);
  }, [watchlist, watchlists, slug]);

  const handleSetWatchlists = (updatedLists) => {
    console.log("🔍 handleSetWatchlists input:", updatedLists);
    if (
      !updatedLists ||
      typeof updatedLists !== "object" ||
      Array.isArray(updatedLists)
    ) {
      console.error("❌ Invalid updatedLists object passed to setWatchlists.");
      return;
    }

    try {
      const newList = Object.values(updatedLists).find(w => w.slug === slug);
      if (newList) setWatchlist(newList);
      const stringified = JSON.stringify(updatedLists);
      localStorage.setItem("burnlist_watchlists", stringified);
      console.log("✅ Setting watchlists state with:", updatedLists);
      setWatchlists(updatedLists);
      const debugStored = localStorage.getItem("burnlist_watchlists");
      console.log("🧪 Post-handleSetWatchlists localStorage snapshot:", JSON.parse(debugStored));
    } catch (err) {
      console.error("❌ Failed to stringify and store burnlist_watchlists:", err);
    }
  };

  if (!watchlist) {
    return (
      <div style={{ backgroundColor: "#000000", color: "#ffffff", padding: "20px" }}>
        <h2 style={{ color: "#e31507", fontFamily: "'Courier New', monospace" }}>⚠️ Watchlist not found.</h2>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "transparent", minHeight: "100vh", color: "#ffffff", padding: "20px" }}>
      <WatchlistHeader name={watchlist.name} averageReturn={averageReturn} selected={selectedTimeframe} />
      <WatchlistChart 
        portfolioReturnData={watchlist.items?.map(item => ({
          symbol: item.symbol,
          buyDate: item.buyDate,
          historicalData: item.historicalData,
          timeframe: selectedTimeframe
        })) || []} 
        showBacktestLine={false} 
      />
      <TimeframeSelector selected={selectedTimeframe} onChange={setSelectedTimeframe} />
      {Array.isArray(watchlist.items) && watchlist.items.length > 0 ? (
        <TickerTable items={watchlist.items} selectedTimeframe={selectedTimeframe} />
      ) : (
        <div style={{ fontFamily: "'Courier New', monospace", color: "#999", textAlign: "center", marginTop: "20px" }}>
          ⚠️ No valid data to display yet.
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "30px" }}>
        <AddTickerInput
          watchlists={watchlists}
          setWatchlists={handleSetWatchlists}
          currentSlug={slug}
          bulkSymbols={bulkSymbols}
          setBulkSymbols={setBulkSymbols}
          buyPrice={buyPrice}
          setBuyPrice={setBuyPrice}
          buyDate={buyDate}
          setBuyDate={setBuyDate}
          handleBulkAdd={async (tickerObjects) => {
            if (!tickerObjects || tickerObjects.length === 0) return;

            try {
              const saved = localStorage.getItem("burnlist_watchlists");
              if (!saved || saved === "undefined") {
                console.error("❌ No valid data found in burnlist_watchlists");
                return;
              }

              const parsed = JSON.parse(saved);
              console.log("📥 Parsed localStorage watchlists:", parsed);
              const currentSlug = slug;
              const current = Object.values(parsed).find(w => w.slug === currentSlug);

              if (!current || !Array.isArray(current.items)) {
                console.error("❌ Invalid current watchlist structure");
                return;
              }

              const validTickers = tickerObjects.filter(
                t => t && t.symbol && typeof t.symbol === 'string' && Array.isArray(t.historicalData)
              );
              const existingSymbols = new Set((current.items || []).map(item => item.symbol));
              const newUniqueTickers = validTickers.filter(t => !existingSymbols.has(t.symbol));
              const safeTickers = newUniqueTickers.filter(t => Array.isArray(t.historicalData) && t.historicalData.length > 0);
              safeTickers.forEach(t => console.log("🧩 Item to add:", t));
              current.items.push(...safeTickers);

              const updated = { ...parsed };
              const matchingKey = Object.keys(updated).find(k => updated[k].slug === currentSlug);
              if (matchingKey) {
                updated[matchingKey] = current;
              } else {
                console.error("❌ Could not find matching key for slug in parsed watchlists");
                return;
              }

              console.log("🛠 Final updated watchlists before setting:", updated);
              console.log("🧠 Saving watchlists:", JSON.stringify(updated));
              localStorage.setItem("burnlist_watchlists", JSON.stringify(updated));
              setWatchlists(updated);
              console.log("🧠 Post-normalization buyPrices:", current.items.map(i => ({ symbol: i.symbol, buyPrice: i.buyPrice, latest: i.historicalData?.at(-1)?.price })));
              const stored = localStorage.getItem("burnlist_watchlists");
              console.log("🔎 Re-read from localStorage:", JSON.parse(stored));
            } catch (error) {
              console.error("❌ Error during handleBulkAdd:", error);
            }
          }}
        />
      </div>
    </div>
  );
};

export default BurnPage;