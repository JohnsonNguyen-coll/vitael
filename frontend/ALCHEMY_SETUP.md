# Alchemy RPC Setup

## Why Alchemy?

Vitael's bridge feature uses Alchemy for reliable and fast RPC connections when bridging USDC via Circle CCTP. Public RPC endpoints can be slow or unreliable, causing:
- Slow transaction confirmations
- Timeout errors during approval checks
- Poor user experience

Alchemy provides:
- ⚡ Fast, reliable RPC endpoints
- 🆓 Free tier (300M compute units/month)
- 📊 Better monitoring and analytics
- 🌐 Support for all major testnets and mainnets

## Quick Setup (2 minutes)

1. **Sign up for free**: Go to https://www.alchemy.com/
2. **Create an app**:
   - Click "Create new app"
   - Choose network: Ethereum Sepolia (or others as needed)
   - Give it a name (e.g., "Vitael Bridge")
3. **Copy API Key**: 
   - Click on your app
   - Copy the API key from the dashboard
4. **Add to .env.local**:
   ```bash
   NEXT_PUBLIC_ALCHEMY_API_KEY=your_api_key_here
   ```
5. **Restart dev server**: `npm run dev`

## Supported Networks

The following testnets will use Alchemy when you provide an API key:
- ✅ Ethereum Sepolia
- ✅ Arbitrum Sepolia
- ✅ Base Sepolia
- ✅ Optimism Sepolia
- ✅ Polygon Amoy

Other networks (Arc Testnet, Avalanche Fuji) use their official RPCs.

## Without Alchemy

If you don't provide an Alchemy API key, the bridge will fall back to public RPC endpoints. This will work but may be slower and less reliable.

## Free Tier Limits

Alchemy free tier includes:
- 300M compute units/month
- Unlimited requests (rate limited)
- Support for testnets and mainnets

This is more than enough for development and testing!
