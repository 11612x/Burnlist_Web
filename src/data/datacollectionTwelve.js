// datacollectionTwelve.js
// Centralized logic for determining interval, outputsize, and date params for Twelve Data API

export function getTwelveDataCollectionParams(timeframe, formData) {
  const today = new Date();
  if (timeframe === 'D') {
    return { interval: '1min', outputsize: 24 };
  }
  if (timeframe === 'W') {
    return { interval: '4h', outputsize: 21 };
  }
  if (timeframe === 'M') {
    return { interval: '1day', outputsize: 30 };
  }
  if (timeframe === 'YTD') {
    const currentYear = today.getFullYear();
    const jan1 = new Date(currentYear, 0, 1);
    const days = Math.floor((today - jan1) / (1000 * 60 * 60 * 24)) + 1;
    return { interval: '1day', outputsize: days, start_date: `${currentYear}-01-01` };
  }
  // custom
  return {
    interval: formData.interval,
    outputsize: formData.outputsize,
    start_date: formData.start_date,
    end_date: formData.end_date
  };
}