import { getClient, SupportedChain } from './viemClient.js';
import { encodeFunctionData, formatUnits, isAddress, pad, parseUnits, zeroAddress } from 'viem';
import {
  BRIDGE_ABI,
  ERC20_ABI,
  FACTORY_ABI,
  LENDING_POOL_ABI,
  PAIR_ABI,
  ROUTER_ABI,
} from '../contracts/abi.js';

const ARC_ADDRESSES = {
  pool: process.env.LENDING_POOL ?? '0xEa282eea5bC90905C15Df05Ca43eeA967BcDe49f',
  router: process.env.DEX_ROUTER ?? '0x4d306D129C52E88a7766dc3d70ce28d423E3b1Ef',
  factory: process.env.DEX_FACTORY ?? '0xdE6b2AEf32FE1e675060dBC47BC2dF049052494E',
  quoter: process.env.DEX_QUOTER ?? '0x0078B36f4E91D1AEbBAf4049F7468ea4B9183810',
} as const;

const CCTP_TOKEN_MESSENGER =
  process.env.BRIDGE ?? '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
const CCTP_FORWARDING_HOOK =
  '0x636374702d666f72776172640000000000000000000000000000000000000000';

const TOKENS: Partial<Record<SupportedChain, Record<string, string>>> = {
  arcTestnet: {
    USDC: '0x3600000000000000000000000000000000000000',
    EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    CIRBTC: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
  },
  sepolia: { USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' },
  arbitrumSepolia: { USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' },
  baseSepolia: { USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' },
  polygonAmoy: { USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' },
  avalancheFuji: { USDC: '0x5425890298aed601595a70AB815c96711a31Bc65' },
  optimismSepolia: { USDC: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7' },
};

function getArcAddresses(chain: SupportedChain) {
  if (chain !== 'arcTestnet') {
    throw new Error(`Vitael lending and DEX are only deployed on arcTestnet, not ${chain}`);
  }
  return ARC_ADDRESSES;
}

function normalizeDeadline(deadline: string) {
  const parsed = BigInt(deadline);
  return parsed < 1_000_000_000n
    ? BigInt(Math.floor(Date.now() / 1000)) + parsed
    : parsed;
}

function requireAddress(value: string, label: string): `0x${string}` {
  if (!isAddress(value)) throw new Error(`${label} is not a valid EVM address`);
  return value;
}

export class DefiService {
  
  static resolveTokenAddress(chain: SupportedChain, asset: string): string {
    if (isAddress(asset)) return asset;
    const tokenAddress = TOKENS[chain]?.[asset.toUpperCase()];
    if (!tokenAddress) throw new Error(`Unsupported asset ${asset} on ${chain}`);
    return tokenAddress;
  }
  
  // -- READ OPERATIONS --
  
  static async getMarkets(chain: SupportedChain) {
    const client = getClient(chain);
    const pool = getArcAddresses(chain).pool as `0x${string}`;
    const assets = await client.readContract({
      address: pool,
      abi: LENDING_POOL_ABI,
      functionName: 'getSupportedAssets',
    });
    const markets = [];

    // Keep these calls sequential to avoid bursting the public Arc RPC.
    for (const address of assets) {
      const symbol = await client.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' });
      const decimals = await client.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' });
      const supplyRate = await client.readContract({
        address: pool, abi: LENDING_POOL_ABI, functionName: 'getSupplyRate', args: [address],
      });
      const borrowRate = await client.readContract({
        address: pool, abi: LENDING_POOL_ABI, functionName: 'getBorrowRate', args: [address],
      });
      const utilization = await client.readContract({
        address: pool, abi: LENDING_POOL_ABI, functionName: 'getUtilization', args: [address],
      });
      const state = await client.readContract({
        address: pool, abi: LENDING_POOL_ABI, functionName: 'assetStates', args: [address],
      });
      const exchangeRate = await client.readContract({
        address: pool, abi: LENDING_POOL_ABI, functionName: 'exchangeRate', args: [address],
      });

      markets.push({
        asset: symbol,
        address,
        decimals,
        totalBorrowed: state[0].toString(),
        totalReserves: state[1].toString(),
        totalShares: state[4].toString(),
        totalSupplied: ((state[4] * exchangeRate) / 1_000_000_000_000_000_000n).toString(),
        supplyApy: formatUnits(supplyRate, 16),
        borrowApy: formatUnits(borrowRate, 16),
        utilization: formatUnits(utilization, 16),
        exchangeRate: exchangeRate.toString(),
      });
    }

    return markets;
  }

  static async getPools(chain: SupportedChain) {
    const client = getClient(chain);
    const factory = getArcAddresses(chain).factory as `0x${string}`;
    const count = await client.readContract({
      address: factory, abi: FACTORY_ABI, functionName: 'allPairsLength',
    });
    const pools = [];

    for (let index = 0n; index < count; index += 1n) {
      const pair = await client.readContract({
        address: factory, abi: FACTORY_ABI, functionName: 'allPairs', args: [index],
      });
      const token0 = await client.readContract({ address: pair, abi: PAIR_ABI, functionName: 'token0' });
      const token1 = await client.readContract({ address: pair, abi: PAIR_ABI, functionName: 'token1' });
      const reserves = await client.readContract({ address: pair, abi: PAIR_ABI, functionName: 'getReserves' });
      const symbol0 = await client.readContract({ address: token0, abi: ERC20_ABI, functionName: 'symbol' });
      const symbol1 = await client.readContract({ address: token1, abi: ERC20_ABI, functionName: 'symbol' });
      const decimals0 = await client.readContract({ address: token0, abi: ERC20_ABI, functionName: 'decimals' });
      const decimals1 = await client.readContract({ address: token1, abi: ERC20_ABI, functionName: 'decimals' });

      pools.push({
        pair: `${symbol0}/${symbol1}`,
        address: pair,
        token0: { address: token0, symbol: symbol0, decimals: decimals0 },
        token1: { address: token1, symbol: symbol1, decimals: decimals1 },
        reserve0: reserves[0].toString(),
        reserve1: reserves[1].toString(),
      });
    }

    return pools;
  }

  static async getLiquidityPosition(
    chain: SupportedChain,
    userAddress: string,
    tokenA: string,
    tokenB: string,
  ) {
    const client = getClient(chain);
    const factory = getArcAddresses(chain).factory as `0x${string}`;
    const user = requireAddress(userAddress, 'userAddress');
    const addressA = requireAddress(this.resolveTokenAddress(chain, tokenA), 'tokenA');
    const addressB = requireAddress(this.resolveTokenAddress(chain, tokenB), 'tokenB');
    const pair = await client.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: 'getPair',
      args: [addressA, addressB],
    });

    if (pair === zeroAddress) {
      return {
        pair,
        hasPosition: false,
        lpBalanceRaw: '0',
        lpBalance: '0',
        sharePercent: '0',
        underlying: [],
      };
    }

    const [lpBalance, totalSupply, reserves, token0, decimalsA, decimalsB] = await Promise.all([
      client.readContract({ address: pair, abi: PAIR_ABI, functionName: 'balanceOf', args: [user] }),
      client.readContract({ address: pair, abi: PAIR_ABI, functionName: 'totalSupply' }),
      client.readContract({ address: pair, abi: PAIR_ABI, functionName: 'getReserves' }),
      client.readContract({ address: pair, abi: PAIR_ABI, functionName: 'token0' }),
      client.readContract({ address: addressA, abi: ERC20_ABI, functionName: 'decimals' }),
      client.readContract({ address: addressB, abi: ERC20_ABI, functionName: 'decimals' }),
    ]);

    const [reserveA, reserveB] =
      token0.toLowerCase() === addressA.toLowerCase()
        ? [reserves[0], reserves[1]]
        : [reserves[1], reserves[0]];
    const amountA = totalSupply === 0n ? 0n : (lpBalance * reserveA) / totalSupply;
    const amountB = totalSupply === 0n ? 0n : (lpBalance * reserveB) / totalSupply;
    const sharePercentScaled =
      totalSupply === 0n ? 0n : (lpBalance * 100_000_000n) / totalSupply;
    const displayDecimals = Math.floor((decimalsA + decimalsB) / 2);

    return {
      pair,
      hasPosition: lpBalance > 0n,
      lpBalanceRaw: lpBalance.toString(),
      lpBalance: formatUnits(lpBalance, 18),
      displayBalance: formatUnits(lpBalance, displayDecimals),
      displayDecimals,
      totalSupplyRaw: totalSupply.toString(),
      sharePercent:
        lpBalance > 0n && sharePercentScaled === 0n
          ? '<0.000001'
          : formatUnits(sharePercentScaled, 6),
      underlying: [
        {
          symbol: tokenA,
          amountRaw: amountA.toString(),
          amount: formatUnits(amountA, decimalsA),
        },
        {
          symbol: tokenB,
          amountRaw: amountB.toString(),
          amount: formatUnits(amountB, decimalsB),
        },
      ],
      note: 'Use displayBalance for users. lpBalance is the canonical 18-decimal ERC-20 representation; ownership is determined by lpBalanceRaw / totalSupplyRaw.',
    };
  }

  static async getAPR(chain: SupportedChain, asset: string) {
    const client = getClient(chain);
    const pool = getArcAddresses(chain).pool as `0x${string}`;
    const token = requireAddress(this.resolveTokenAddress(chain, asset), 'asset');
    const supplyRate = await client.readContract({
      address: pool, abi: LENDING_POOL_ABI, functionName: 'getSupplyRate', args: [token],
    });
    const borrowRate = await client.readContract({
      address: pool, abi: LENDING_POOL_ABI, functionName: 'getBorrowRate', args: [token],
    });
    return {
      asset,
      address: token,
      supplyApy: formatUnits(supplyRate, 16),
      borrowApy: formatUnits(borrowRate, 16),
    };
  }

  static async getPosition(chain: SupportedChain, userAddress: string) {
    const client = getClient(chain);
    const poolAddress = getArcAddresses(chain).pool as `0x${string}`;
    const user = requireAddress(userAddress, 'userAddress');
    const data = await client.readContract({
      address: poolAddress,
      abi: LENDING_POOL_ABI,
      functionName: 'getPosition',
      args: [user]
    });
    return {
      totalCollateralUsd8: data[0].toString(),
      totalBorrowUsd8: data[1].toString(),
      healthFactor: data[2].toString()
    };
  }

  static async getHealthFactor(chain: SupportedChain, userAddress: string) {
    const position = await this.getPosition(chain, userAddress);
    return { healthFactor: position.healthFactor };
  }

  static async getBalance(chain: SupportedChain, userAddress: string, asset: string) {
    const client = getClient(chain);
    const user = requireAddress(userAddress, 'userAddress');
    if (['native', 'eth', 'arc'].includes(asset.toLowerCase()) || asset === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
      const balance = await client.getBalance({ address: user });
      return { asset, balance: balance.toString(), decimals: 18 };
    }

    const tokenAddress = requireAddress(this.resolveTokenAddress(chain, asset), 'asset');
    const balance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [user]
    });
    const decimals = await client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' });
    return { asset, address: tokenAddress, balance: balance.toString(), decimals };
  }

  static async quoteSwap(chain: SupportedChain, amountIn: string, path: string[]) {
    if (path.length < 2) throw new Error('Swap path must contain at least two assets');
    const client = getClient(chain);
    const routerAddress = getArcAddresses(chain).router as `0x${string}`;
    const resolvedPath = path.map((asset) =>
      requireAddress(this.resolveTokenAddress(chain, asset), 'path asset')
    );
    const amountsOut = await client.readContract({
      address: routerAddress,
      abi: ROUTER_ABI,
      functionName: 'getAmountsOut',
      args: [BigInt(amountIn), resolvedPath]
    });
    return {
      amountIn,
      expectedOut: amountsOut[amountsOut.length - 1].toString(),
      amounts: amountsOut.map(String),
      path: resolvedPath,
    };
  }

  static async quoteBridge(fromChain: SupportedChain, toChain: SupportedChain, amount: string) {
    const domains: Partial<Record<SupportedChain, number>> = {
      sepolia: 0,
      avalancheFuji: 1,
      optimismSepolia: 2,
      arbitrumSepolia: 3,
      baseSepolia: 6,
      polygonAmoy: 7,
      arcTestnet: 26,
    };
    const sourceDomain = domains[fromChain];
    const destinationDomain = domains[toChain];
    if (sourceDomain === undefined || destinationDomain === undefined) {
      throw new Error('Unsupported CCTP domain');
    }
    if (sourceDomain === destinationDomain) throw new Error('Source and destination chains must differ');

    const response = await fetch(
      `https://iris-api-sandbox.circle.com/v2/burn/USDC/fees/${sourceDomain}/${destinationDomain}?forward=true`,
    );
    if (!response.ok) throw new Error(`Circle fee API returned HTTP ${response.status}`);
    const feeOptions = await response.json() as Array<{
      finalityThreshold: number;
      minimumFee: number;
      forwardFee?: { med?: number };
    }>;

    return {
      fromChain,
      toChain,
      sourceDomain,
      destinationDomain,
      amount,
      amountUnit: 'USDC atomic units (6 decimals)',
      feeOptions,
    };
  }

  static async quoteAddLiquidity(chain: SupportedChain, tokenA: string, tokenB: string, amountA: string) {
    const client = getClient(chain);
    const factory = getArcAddresses(chain).factory as `0x${string}`;
    const addressA = requireAddress(this.resolveTokenAddress(chain, tokenA), 'tokenA');
    const addressB = requireAddress(this.resolveTokenAddress(chain, tokenB), 'tokenB');
    const pair = await client.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: 'getPair',
      args: [addressA, addressB],
    });
    if (pair === zeroAddress) {
      return { pair, amountA, requiredAmountB: null, note: 'New pool: choose the initial price with amountB' };
    }
    const token0 = await client.readContract({ address: pair, abi: PAIR_ABI, functionName: 'token0' });
    const reserves = await client.readContract({ address: pair, abi: PAIR_ABI, functionName: 'getReserves' });
    const [reserveA, reserveB] =
      token0.toLowerCase() === addressA.toLowerCase()
        ? [reserves[0], reserves[1]]
        : [reserves[1], reserves[0]];
    if (reserveA === 0n) throw new Error('Pool reserve is zero');
    const requiredAmountB = (BigInt(amountA) * reserveB) / reserveA;
    return { pair, amountA, requiredAmountB: requiredAmountB.toString() };
  }

  // -- WRITE PAYLOAD GENERATORS (UNSIGNED TRANSACTIONS) --

  static generateDepositPayload(chain: SupportedChain, asset: string, amount: string, onBehalfOf: string) {
    const poolAddress = getArcAddresses(chain).pool as `0x${string}`;
    const tokenAddress = requireAddress(this.resolveTokenAddress(chain, asset), 'asset');
    const sender = requireAddress(onBehalfOf, 'onBehalfOf');
    const data = encodeFunctionData({
      abi: LENDING_POOL_ABI,
      functionName: 'supply',
      args: [tokenAddress, BigInt(amount)]
    });

    return {
      to: poolAddress,
      data,
      value: "0",
      requiredSender: sender,
    };
  }

  static generateWithdrawPayload(chain: SupportedChain, asset: string, amount: string, to: string) {
    const poolAddress = getArcAddresses(chain).pool as `0x${string}`;
    const tokenAddress = requireAddress(this.resolveTokenAddress(chain, asset), 'asset');
    const sender = requireAddress(to, 'to');
    const data = encodeFunctionData({
      abi: LENDING_POOL_ABI,
      functionName: 'withdraw',
      args: [tokenAddress, BigInt(amount)]
    });

    return {
      to: poolAddress,
      data,
      value: "0",
      requiredSender: sender,
    };
  }

  static generateBorrowPayload(chain: SupportedChain, asset: string, amount: string, onBehalfOf: string) {
    const poolAddress = getArcAddresses(chain).pool as `0x${string}`;
    const tokenAddress = requireAddress(this.resolveTokenAddress(chain, asset), 'asset');
    const sender = requireAddress(onBehalfOf, 'onBehalfOf');
    const data = encodeFunctionData({
      abi: LENDING_POOL_ABI,
      functionName: 'borrow',
      args: [tokenAddress, BigInt(amount)]
    });

    return {
      to: poolAddress,
      data,
      value: "0",
      requiredSender: sender,
    };
  }

  static generateRepayPayload(chain: SupportedChain, asset: string, amount: string, onBehalfOf: string) {
    const poolAddress = getArcAddresses(chain).pool as `0x${string}`;
    const tokenAddress = requireAddress(this.resolveTokenAddress(chain, asset), 'asset');
    const sender = requireAddress(onBehalfOf, 'onBehalfOf');
    const data = encodeFunctionData({
      abi: LENDING_POOL_ABI,
      functionName: 'repay',
      args: [tokenAddress, BigInt(amount)]
    });

    return {
      to: poolAddress,
      data,
      value: "0",
      requiredSender: sender,
    };
  }

  static generateSwapPayload(chain: SupportedChain, amountIn: string, amountOutMin: string, path: string[], to: string, deadline: string) {
    if (path.length < 2) throw new Error('Swap path must contain at least two assets');
    const routerAddress = getArcAddresses(chain).router as `0x${string}`;
    const resolvedPath = path.map((asset) =>
      requireAddress(this.resolveTokenAddress(chain, asset), 'path asset')
    );
    const recipient = requireAddress(to, 'to');
    const validDeadline = normalizeDeadline(deadline);

    const data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [BigInt(amountIn), BigInt(amountOutMin), resolvedPath, recipient, validDeadline]
    });

    return {
      to: routerAddress,
      data,
      value: "0"
    };
  }

  static generateBridgePayload(
    chain: SupportedChain,
    amount: string,
    destinationDomain: number,
    mintRecipient: string,
    burnToken: string,
    destinationCaller: string = zeroAddress,
    maxFee: string = "0",
    minFinalityThreshold: number = 2000,
    hookData: string = CCTP_FORWARDING_HOOK,
  ) {
    const bridgeAddress = requireAddress(CCTP_TOKEN_MESSENGER, 'CCTP TokenMessenger');
    const tokenAddress = requireAddress(this.resolveTokenAddress(chain, burnToken), 'burnToken');
    const recipient = requireAddress(mintRecipient, 'mintRecipient');
    const caller = requireAddress(destinationCaller, 'destinationCaller');
    if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(hookData)) {
      throw new Error('hookData must be a hex byte string');
    }
    const amountAtomic = parseUnits(amount, 6);
    const maxFeeAtomic = BigInt(maxFee);
    if (amountAtomic <= 0n) throw new Error('Bridge amount must be greater than zero');
    if (maxFeeAtomic >= amountAtomic) {
      throw new Error('Bridge fee must be lower than the amount being bridged');
    }
    const data = encodeFunctionData({
      abi: BRIDGE_ABI,
      functionName: 'depositForBurnWithHook',
      args: [
        amountAtomic,
        destinationDomain,
        pad(recipient, { size: 32 }),
        tokenAddress,
        pad(caller, { size: 32 }),
        maxFeeAtomic,
        minFinalityThreshold,
        hookData as `0x${string}`,
      ]
    });

    return {
      to: bridgeAddress,
      data,
      value: "0",
      amountAtomic: amountAtomic.toString(),
      approvals: [{
        token: tokenAddress,
        amount: amountAtomic.toString(),
        spender: bridgeAddress,
      }],
    };
  }

  static async generateAddLiquidityPayload(chain: SupportedChain, tokenA: string, tokenB: string, amountA: string, amountB: string, to: string, deadline: string) {
    const client = getClient(chain);
    const factory = getArcAddresses(chain).factory as `0x${string}`;
    const tA = requireAddress(this.resolveTokenAddress(chain, tokenA), 'tokenA');
    const tB = requireAddress(this.resolveTokenAddress(chain, tokenB), 'tokenB');
    const recipient = requireAddress(to, 'to');
    normalizeDeadline(deadline);

    const pair = await client.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: 'getPair',
      args: [tA, tB],
    });
    if (pair === zeroAddress) {
      throw new Error('Liquidity pair does not exist yet');
    }

    const transactions = [
      {
        to: tA,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [pair, BigInt(amountA)],
        }),
        value: '0',
        label: `Transfer ${tokenA} to pool`,
      },
      {
        to: tB,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [pair, BigInt(amountB)],
        }),
        value: '0',
        label: `Transfer ${tokenB} to pool`,
      },
      {
        to: pair,
        data: encodeFunctionData({
          abi: PAIR_ABI,
          functionName: 'mint',
          args: [recipient],
        }),
        value: '0',
        label: 'Mint VLP tokens',
      },
    ];

    return { ...transactions[0], transactions, pair };
  }

  static async generateRemoveLiquidityPayload(chain: SupportedChain, tokenA: string, tokenB: string, liquidity: string, to: string, deadline: string) {
    const client = getClient(chain);
    const factory = getArcAddresses(chain).factory as `0x${string}`;
    const tA = requireAddress(this.resolveTokenAddress(chain, tokenA), 'tokenA');
    const tB = requireAddress(this.resolveTokenAddress(chain, tokenB), 'tokenB');
    const recipient = requireAddress(to, 'to');
    normalizeDeadline(deadline);

    const pair = await client.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: 'getPair',
      args: [tA, tB],
    });
    if (pair === zeroAddress) {
      throw new Error('Liquidity pair does not exist');
    }

    const transactions = [
      {
        to: pair,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [pair, BigInt(liquidity)],
        }),
        value: '0',
        label: 'Transfer VLP to pool',
      },
      {
        to: pair,
        data: encodeFunctionData({
          abi: PAIR_ABI,
          functionName: 'burn',
          args: [recipient],
        }),
        value: '0',
        label: `Withdraw ${tokenA} and ${tokenB}`,
      },
    ];

    return { ...transactions[0], transactions, pair };
  }
}
