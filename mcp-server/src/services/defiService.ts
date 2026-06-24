import { getClient, SupportedChain } from './viemClient.js';
import { encodeFunctionData, pad } from 'viem';
import { ERC20_ABI, LENDING_POOL_ABI, ROUTER_ABI, BRIDGE_ABI } from '../contracts/abi.js';

// Mock contract addresses for testnets (replace with real addresses in production)
const getAddresses = (chain: SupportedChain): { pool: string, router: string, bridge: string, factory?: string, quoter?: string } => {
  const addresses: Record<SupportedChain, { pool: string, router: string, bridge: string, factory?: string, quoter?: string }> = {
    sepolia: { pool: '0x0000000000000000000000000000000000000001', router: '0x0000000000000000000000000000000000000002', bridge: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA', factory: '0x0000000000000000000000000000000000000004', quoter: '0x0000000000000000000000000000000000000005' },
    arbitrumSepolia: { pool: '0x0000000000000000000000000000000000000001', router: '0x0000000000000000000000000000000000000002', bridge: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA', factory: '0x0000000000000000000000000000000000000004', quoter: '0x0000000000000000000000000000000000000005' },
    baseSepolia: { pool: '0x0000000000000000000000000000000000000001', router: '0x0000000000000000000000000000000000000002', bridge: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA', factory: '0x0000000000000000000000000000000000000004', quoter: '0x0000000000000000000000000000000000000005' },
    polygonAmoy: { pool: '0x0000000000000000000000000000000000000001', router: '0x0000000000000000000000000000000000000002', bridge: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA', factory: '0x0000000000000000000000000000000000000004', quoter: '0x0000000000000000000000000000000000000005' },
    avalancheFuji: { pool: '0x0000000000000000000000000000000000000001', router: '0x0000000000000000000000000000000000000002', bridge: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA', factory: '0x0000000000000000000000000000000000000004', quoter: '0x0000000000000000000000000000000000000005' },
    optimismSepolia: { pool: '0x0000000000000000000000000000000000000001', router: '0x0000000000000000000000000000000000000002', bridge: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA', factory: '0x0000000000000000000000000000000000000004', quoter: '0x0000000000000000000000000000000000000005' },
    arcTestnet: { 
      pool: process.env.LENDING_POOL || process.env.NEXT_PUBLIC_LENDING_POOL || '0x0000000000000000000000000000000000000001', 
      router: process.env.DEX_ROUTER || process.env.NEXT_PUBLIC_DEX_ROUTER || '0x0000000000000000000000000000000000000002', 
      bridge: process.env.BRIDGE || '0x0000000000000000000000000000000000000003',
      factory: process.env.DEX_FACTORY || process.env.NEXT_PUBLIC_DEX_FACTORY || '0x0000000000000000000000000000000000000004',
      quoter: process.env.DEX_QUOTER || process.env.NEXT_PUBLIC_DEX_QUOTER || '0x0000000000000000000000000000000000000005'
    }
  };
  return addresses[chain];
};

export class DefiService {
  
  static resolveTokenAddress(chain: SupportedChain, asset: string): string {
    if (asset.startsWith('0x')) return asset;
    
    let tokenAddress = asset;
    const assetUpper = asset.toUpperCase();
    
    if (assetUpper === 'USDC') {
      if (chain === 'arcTestnet') tokenAddress = '0x3600000000000000000000000000000000000000';
      else if (chain === 'sepolia') tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
      else tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // Default fallback for USDC on testnets
    } else if (chain === 'arcTestnet') {
      if (assetUpper === 'EURC') tokenAddress = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a';
      else if (assetUpper === 'CIRBTC') tokenAddress = '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF';
    }
    return tokenAddress;
  }
  
  // -- READ OPERATIONS --
  
  static async getMarkets(chain: SupportedChain) {
    if (chain === 'arcTestnet') {
      return [
        { asset: "USDC", address: "0x3600000000000000000000000000000000000000", totalSupplied: "0", totalBorrowed: "0" },
        { asset: "EURC", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", totalSupplied: "0", totalBorrowed: "0" },
        { asset: "cirBTC", address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", totalSupplied: "0", totalBorrowed: "0" }
      ];
    }
    // In a real implementation, you might fetch this from a factory or subgraph
    return [
      { asset: "USDC", address: "0x0000000000000000000000000000000000000001", totalSupplied: "1000000", totalBorrowed: "500000" },
      { asset: "WETH", address: "0x0000000000000000000000000000000000000002", totalSupplied: "5000", totalBorrowed: "1000" }
    ];
  }

  static async getPools(chain: SupportedChain) {
    return [
      { pair: "USDC/WETH", address: "0x...", reserve0: "1000000", reserve1: "300" }
    ];
  }

  static async getAPR(chain: SupportedChain, asset: string) {
    // Mock APR fetching
    return {
      supplyAPR: "4.5%",
      borrowAPR: "6.2%"
    };
  }

  static async getPosition(chain: SupportedChain, userAddress: string) {
    const client = getClient(chain);
    const poolAddress = getAddresses(chain).pool as `0x${string}`;
    
    try {
      const data = await client.readContract({
        address: poolAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'getPosition',
        args: [userAddress as `0x${string}`]
      });
      // VitaelLendingPool.getPosition returns: (totalCollateralUSD, totalBorrowUSD, healthFactor)
      // totalCollateralUSD is data[0], totalBorrowUSD is data[1], healthFactor is data[2]
      return {
        totalCollateralBase: data[0].toString(),
        totalDebtBase: data[1].toString(),
        // Mock availableBorrowsBase as difference (simplified)
        availableBorrowsBase: (data[0] > data[1] ? (data[0] - data[1]).toString() : "0"),
        healthFactor: data[2].toString()
      };
    } catch (e: any) {
      console.warn("Mocking getPosition due to no real contract. Error:", e.message);
      return { totalCollateralBase: "1000", totalDebtBase: "500", availableBorrowsBase: "500", healthFactor: "2000000000000000000" };
    }
  }

  static async getHealthFactor(chain: SupportedChain, userAddress: string) {
    const position = await this.getPosition(chain, userAddress);
    return { healthFactor: position.healthFactor };
  }

  static async getBalance(chain: SupportedChain, userAddress: string, asset: string) {
    const client = getClient(chain);
    try {
      // For native token (often requested as 'native' or 'ETH' or 'ARC')
      if (asset.toLowerCase() === 'native' || asset.toLowerCase() === 'eth' || asset.toLowerCase() === 'arc' || asset === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        const balance = await client.getBalance({ address: userAddress as `0x${string}` });
        return { asset, balance: balance.toString() };
      }
      
      const tokenAddress = this.resolveTokenAddress(chain, asset);

      // For ERC20 tokens
      const balance = await client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`]
      });
      return { asset, balance: balance.toString() };
    } catch (e: any) {
      console.warn("Error fetching balance:", e.message);
      return { asset, balance: "0", error: e.message };
    }
  }

  static async quoteSwap(chain: SupportedChain, amountIn: string, path: string[]) {
    try {
      const client = getClient(chain);
      const routerAddress = getAddresses(chain).router as `0x${string}`;
      const resolvedPath = path.map(p => this.resolveTokenAddress(chain, p));
      
      const amountsOut = await client.readContract({
        address: routerAddress,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [BigInt(amountIn), resolvedPath as `0x${string}`[]]
      }) as bigint[];
      
      return { expectedOut: amountsOut[amountsOut.length - 1].toString() };
    } catch (e: any) {
      console.warn("Error quoting swap:", e.message);
      return { expectedOut: "0", error: e.message };
    }
  }

  static async quoteBridge(fromChain: SupportedChain, toChain: SupportedChain, amount: string) {
    return { estimatedFee: "0.02 USDC", estimatedTime: "15 seconds" };
  }

  static async quoteAddLiquidity(chain: SupportedChain, tokenA: string, tokenB: string, amountA: string) {
    return { requiredAmountB: "Mock required amount B", expectedLpTokens: "Mock LP Tokens" };
  }

  // -- WRITE PAYLOAD GENERATORS (UNSIGNED TRANSACTIONS) --

  static generateDepositPayload(chain: SupportedChain, asset: string, amount: string, onBehalfOf: string) {
    const poolAddress = getAddresses(chain).pool as `0x${string}`;
    const tokenAddress = this.resolveTokenAddress(chain, asset);
    const data = encodeFunctionData({
      abi: LENDING_POOL_ABI,
      functionName: 'supply',
      args: [tokenAddress as `0x${string}`, BigInt(amount)]
    });

    return {
      to: poolAddress,
      data,
      value: "0"
    };
  }

  static generateWithdrawPayload(chain: SupportedChain, asset: string, amount: string, to: string) {
    const poolAddress = getAddresses(chain).pool as `0x${string}`;
    const tokenAddress = this.resolveTokenAddress(chain, asset);
    const data = encodeFunctionData({
      abi: LENDING_POOL_ABI,
      functionName: 'withdraw',
      args: [tokenAddress as `0x${string}`, BigInt(amount)]
    });

    return {
      to: poolAddress,
      data,
      value: "0"
    };
  }

  static generateBorrowPayload(chain: SupportedChain, asset: string, amount: string, onBehalfOf: string) {
    const poolAddress = getAddresses(chain).pool as `0x${string}`;
    const tokenAddress = this.resolveTokenAddress(chain, asset);
    const data = encodeFunctionData({
      abi: LENDING_POOL_ABI,
      functionName: 'borrow',
      args: [tokenAddress as `0x${string}`, BigInt(amount)]
    });

    return {
      to: poolAddress,
      data,
      value: "0"
    };
  }

  static generateRepayPayload(chain: SupportedChain, asset: string, amount: string, onBehalfOf: string) {
    const poolAddress = getAddresses(chain).pool as `0x${string}`;
    const tokenAddress = this.resolveTokenAddress(chain, asset);
    const data = encodeFunctionData({
      abi: LENDING_POOL_ABI,
      functionName: 'repay',
      args: [tokenAddress as `0x${string}`, BigInt(amount)]
    });

    return {
      to: poolAddress,
      data,
      value: "0"
    };
  }

  static generateSwapPayload(chain: SupportedChain, amountIn: string, amountOutMin: string, path: string[], to: string, deadline: string) {
    const routerAddress = getAddresses(chain).router as `0x${string}`;
    const resolvedPath = path.map(p => this.resolveTokenAddress(chain, p));
    
    // Agent might pass a small number like "1800" (30 mins) instead of a full timestamp.
    let validDeadline = BigInt(deadline);
    if (validDeadline < 1000000000n) {
      validDeadline = BigInt(Math.floor(Date.now() / 1000)) + validDeadline;
    }

    // Apply a 5% slippage to amountOutMin to avoid reverts due to exactness
    let safeAmountOutMin = BigInt(amountOutMin);
    safeAmountOutMin = (safeAmountOutMin * 95n) / 100n;

    const data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [BigInt(amountIn), safeAmountOutMin, resolvedPath as `0x${string}`[], to as `0x${string}`, validDeadline]
    });

    return {
      to: routerAddress,
      data,
      value: "0"
    };
  }

  static generateBridgePayload(chain: SupportedChain, amount: string, destinationDomain: number, mintRecipient: string, burnToken: string) {
    const bridgeAddress = getAddresses(chain).bridge as `0x${string}`;
    const tokenAddress = this.resolveTokenAddress(chain, burnToken);
    const data = encodeFunctionData({
      abi: BRIDGE_ABI,
      functionName: 'depositForBurn',
      args: [BigInt(amount), destinationDomain, pad(mintRecipient as `0x${string}`, { size: 32 }), tokenAddress as `0x${string}`]
    });

    return {
      to: bridgeAddress,
      data,
      value: "0"
    };
  }

  static generateAddLiquidityPayload(chain: SupportedChain, tokenA: string, tokenB: string, amountA: string, amountB: string, to: string, deadline: string) {
    const routerAddress = getAddresses(chain).router as `0x${string}`;
    const tA = this.resolveTokenAddress(chain, tokenA);
    const tB = this.resolveTokenAddress(chain, tokenB);
    const data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'addLiquidity',
      args: [tA as `0x${string}`, tB as `0x${string}`, BigInt(amountA), BigInt(amountB), 0n, 0n, to as `0x${string}`, BigInt(deadline)]
    });

    return {
      to: routerAddress,
      data,
      value: "0"
    };
  }

  static generateRemoveLiquidityPayload(chain: SupportedChain, tokenA: string, tokenB: string, liquidity: string, to: string, deadline: string) {
    const routerAddress = getAddresses(chain).router as `0x${string}`;
    const tA = this.resolveTokenAddress(chain, tokenA);
    const tB = this.resolveTokenAddress(chain, tokenB);
    const data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'removeLiquidity',
      args: [tA as `0x${string}`, tB as `0x${string}`, BigInt(liquidity), 0n, 0n, to as `0x${string}`, BigInt(deadline)]
    });

    return {
      to: routerAddress,
      data,
      value: "0"
    };
  }
}
