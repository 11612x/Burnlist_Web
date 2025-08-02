// Test data generator for development
export const generateTestCSV = () => {
  const testStocks = [
    {
      Ticker: 'AAPL',
      Company: 'Apple Inc.',
      Sector: 'Technology',
      Industry: 'Consumer Electronics',
      Country: 'USA',
      'Market Cap': '$2,500.00B',
      'P/E': '25.5',
      Price: '$150.25',
      Change: '+2.5%',
      Volume: '50,000,000'
    },
    {
      Ticker: 'MSFT',
      Company: 'Microsoft Corporation',
      Sector: 'Technology',
      Industry: 'Software',
      Country: 'USA',
      'Market Cap': '$2,200.00B',
      'P/E': '30.2',
      Price: '$320.10',
      Change: '+1.8%',
      Volume: '35,000,000'
    },
    {
      Ticker: 'GOOGL',
      Company: 'Alphabet Inc.',
      Sector: 'Technology',
      Industry: 'Internet Content & Information',
      Country: 'USA',
      'Market Cap': '$1,800.00B',
      'P/E': '28.7',
      Price: '$2,850.75',
      Change: '-0.5%',
      Volume: '15,000,000'
    },
    {
      Ticker: 'AMZN',
      Company: 'Amazon.com Inc.',
      Sector: 'Consumer Cyclical',
      Industry: 'Internet Retail',
      Country: 'USA',
      'Market Cap': '$1,600.00B',
      'P/E': '45.2',
      Price: '$3,200.50',
      Change: '+3.2%',
      Volume: '25,000,000'
    },
    {
      Ticker: 'TSLA',
      Company: 'Tesla Inc.',
      Sector: 'Consumer Cyclical',
      Industry: 'Auto Manufacturers',
      Country: 'USA',
      'Market Cap': '$800.00B',
      'P/E': '75.8',
      Price: '$250.00',
      Change: '-1.2%',
      Volume: '40,000,000'
    },
    {
      Ticker: 'NVDA',
      Company: 'NVIDIA Corporation',
      Sector: 'Technology',
      Industry: 'Semiconductors',
      Country: 'USA',
      'Market Cap': '$1,200.00B',
      'P/E': '85.3',
      Price: '$480.75',
      Change: '+5.8%',
      Volume: '30,000,000'
    },
    {
      Ticker: 'META',
      Company: 'Meta Platforms Inc.',
      Sector: 'Technology',
      Industry: 'Internet Content & Information',
      Country: 'USA',
      'Market Cap': '$900.00B',
      'P/E': '22.1',
      Price: '$350.25',
      Change: '+2.1%',
      Volume: '20,000,000'
    },
    {
      Ticker: 'BRK.A',
      Company: 'Berkshire Hathaway Inc.',
      Sector: 'Financial Services',
      Industry: 'Insurance',
      Country: 'USA',
      'Market Cap': '$700.00B',
      'P/E': '18.5',
      Price: '$520,000.00',
      Change: '+0.8%',
      Volume: '1,500'
    }
  ];

  // Convert to CSV format
  const headers = ['No.', 'Ticker', 'Company', 'Sector', 'Industry', 'Country', 'Market Cap', 'P/E', 'Price', 'Change', 'Volume'];
  const csvRows = [headers.join(',')];
  
  testStocks.forEach((stock, index) => {
    const row = [
      index + 1,
      stock.Ticker,
      stock.Company,
      stock.Sector,
      stock.Industry,
      stock.Country,
      stock['Market Cap'],
      stock['P/E'],
      stock.Price,
      stock.Change,
      stock.Volume
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
};

export const getTestData = () => {
  const csvText = generateTestCSV();
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}; 