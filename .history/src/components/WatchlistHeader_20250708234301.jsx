import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const WatchlistHeader = ({ name, averageReturn, selected }) => {
  // Debug: Log the precomputed average return passed as prop
  console.log("📊 WatchlistHeader received averageReturn:", averageReturn);
  const returnPercent =
    typeof averageReturn === "number" && isFinite(averageReturn)
      ? averageReturn
      : null;

  const [watchlistName, setWatchlistName] = useState("");
  const { slug } = useParams();

  useEffect(() => {
    console.log("📛 Slug from URL:", slug);

    try {
      const stored = localStorage.getItem("burnlist_watchlists");
      console.log("📦 Raw from localStorage:", stored);

      if (stored) {
        const parsed = JSON.parse(stored);
        const found = parsed.find((wl) => wl.slug === slug);
        console.log("🧭 Found watchlist:", found);

        if (found && typeof found.name === "string") {
          console.log("✅ Setting name to:", found.name);
          setWatchlistName(found.name);
        }
      }
    } catch (err) {
      console.warn("⚠️ Failed to load watchlist name in header", err);
    }
  }, [slug]);

  return (
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 2rem",
    backgroundColor: "#e31507",
    color: "#ffffff",
    fontFamily: "'Courier New', Courier, monospace",
    width: "100%",
    position: "sticky",
    top: 0,
    zIndex: 999
  }}
>
      <div style={{ maxWidth: 200, textAlign: "right" }}>
        <div>
          <h1 style={{ margin: 0, whiteSpace: "nowrap", color: "#e31507", fontFamily: "'Courier New', Courier, monospace" }}>
            {watchlistName ? watchlistName : (name || "Untitled Watchlist")}
          </h1>
          {returnPercent !== null && (
            <div
              style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 16,
                marginTop: 4,
                color: returnPercent >= 0 ? "rgb(127, 186, 161)" : "#e31507"
              }}
            >
              <span>
                {returnPercent.toFixed(2)}%
                <span style={{ fontSize: 13 }}>
                  {" "}
                  ({selected?.toUpperCase() || "N/A"})
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WatchlistHeader;