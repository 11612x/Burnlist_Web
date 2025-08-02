# Finviz Elite Authentication Guide

## The Issue

Finviz Elite URLs like this:
```
https://elite.finviz.com/export.ashx?v=111&f=an_recom_buybetter,geo_usa,sh_avgvol_o500,sh_price_15to120,ta_beta_1to1.8,ta_pattern_channelup|tlsupport,ta_perf_-4to0-1w,ta_rsi_35to50,ta_sma20_pb,ta_sma50_pa,ta_volatility_to4xto4&ft=4f6202a40-4a7c-4d91-9ef8-068795ffbac0
```

Require proper session authentication. The `ft=4f6202a40-4a7c-4d91-9ef8-068795ffbac0` parameter is a session token that must be obtained through the Finviz Elite login process.

## Solutions

### Option 1: Browser Extension (Recommended for Development)

1. **Install a CORS browser extension** like "CORS Unblock" or "Allow CORS"
2. **Enable the extension** for your development domain
3. **Use the Elite URLs directly** in your app
4. **The extension will handle CORS** automatically

### Option 2: Manual Session Token Extraction

1. **Log into Finviz Elite** in your browser
2. **Create your screener** and get the export URL
3. **Copy the `ft=` parameter** from the URL
4. **Use that token** in your app

### Option 3: Backend Proxy with Session Management

For production use, you would need to:
1. **Implement proper session management**
2. **Handle login/logout flows**
3. **Store and refresh session tokens**
4. **Deploy a proper backend service**

## Current Implementation

The current proxy server will:
- ✅ **Work with test data** for development
- ✅ **Handle CORS issues** gracefully
- ✅ **Provide clear error messages**
- ✅ **Fall back to test data** when Elite access fails

## For Your App

Right now, your screener functionality will:
1. **Try to fetch from Elite URL** (will fail due to auth)
2. **Fall back to test data** automatically
3. **Show appropriate messages** to users
4. **Work perfectly for development** with test data

## Next Steps

1. **For Development**: Use the test data functionality
2. **For Production**: Implement proper Elite authentication
3. **For Testing**: Use browser extensions to bypass CORS

The app is fully functional with test data and will work seamlessly once you implement proper Elite authentication. 