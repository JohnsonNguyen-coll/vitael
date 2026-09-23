import { calculateBridgeFee } from "./cctpFees.js";
import { CCTP_CHAINS, CCTP_TOKEN_MESSENGER, IRIS_API, type CctpChain } from "./cctpMainnet.js";
import { getClient, SupportedChain } from './viemClient.js';
import { encodeFunctionData, formatUnits, isAddress, pad, parseUnits, zeroAddress } from 'viem';
import {
  BRIDGE_ABI,
  ERC20_ABI,
  FACTORY_ABI,
  LENDING_POOL_ABI,
  PAIR_ABI,
  ROUTER_ABI,
  VAULT_ABI,
} from '../contracts/abi.js';

const ARC_ADDRESSES = {
  pool: process.env.LENDING_POOL ?? '',
  router: process.env.DEX_ROUTER ?? '',
  factory: process.env.DEX_FACTORY ?? '',
  quoter: process.env.DEX_QUOTER ?? '',
  vault: process.env.USDC_VAULT ?? '',
} as const;

const CCTP_FORWARDING_HOOK =
  '0x636374702d666f72776172640000000000000000000000000000000000000000';

const TOKENS: Partial<Record<SupportedChain, Record<string, string>>> = {
  ...Object.fromEntries(Object.entries(CCTP_CHAINS).map(([key, c]) => [key, { USDC: c.usdc }])),
  arc: {
    USDC: process.env.USDC_ADDRESS || '0x3600000000000000000000000000000000000000',
    EURC: process.env.EURC_ADDRESS || '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1',
    CIRBTC: process.env.CIRBTC_ADDRESS || '0x171A4217b86A807A64eB94757Db6849fb4bDbAA0',
  },
};

function getArcAddresses(chain: SupportedChain) {
  if (chain !== 'arc') {
    throw new Error(`Vitael lending and DEX are only deployed on Arc mainnet, not ${chain}`);
  }
  for (const [key, value] of Object.entries(ARC_ADDRESSES)) {
    if (key !== 'vault') requireAddress(value, key);
  }
  return ARC_ADDRESSES;
}

function getVaultAddress(chain: SupportedChain): `0x${string}` {
  return requireAddress(getArcAddresses(chain).vault, 'USDC_VAULT');
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

      const totalSupplied = await client.readContract({
        address: pool, abi: LENDING_POOL_ABI, functionName: 'previewRedeem', args: [address, state[4]],
      });
      const liquidity = await client.readContract({
        address: pool, abi: LENDING_POOL_ABI, functionName: 'getAvailableLiquidity', args: [address],
      });

      markets.push({
        asset: symbol,
        address,
        decimals,
        totalBorrowed: state[0].toString(),
        totalReserves: state[1].toString(),
        totalShares: state[4].toString(),
        totalSupplied: totalSupplied.toString(),
        liquidity: liquidity.toString(),
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

  static async getVaults(chain: SupportedChain) {
    const client = getClient(chain);
    const vault = getVaultAddress(chain);
    const pool = getArcAddresses(chain).pool as `0x${string}`;
    const [asset, totalAssets, totalSupply, depositCap, availableLiquidity, shutdown] = await Promise.all([
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'asset' }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'totalAssets' }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'totalSupply' }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'depositCap' }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'availableLiquidity' }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'shutdown' }),
    ]);
    const supplyRate = await client.readContract({
      address: pool, abi: LENDING_POOL_ABI, functionName: 'getSupplyRate', args: [asset],
    });
    return [{
      name: 'Vitael USDC Earn Vault', symbol: 'vUSDC-EARN', address: vault, asset,
      totalAssets: totalAssets.toString(), totalSupply: totalSupply.toString(),
      depositCap: depositCap.toString(), availableLiquidity: availableLiquidity.toString(),
      supplyApyPercent: formatUnits(supplyRate, 16), shutdown,
      strategy: 'Vitael USDC Lending', assetDecimals: 6, shareDecimals: 9,
    }];
  }

  static async getVaultPosition(chain: SupportedChain, userAddress: string) {
    const client = getClient(chain);
    const vault = getVaultAddress(chain);
    const user = requireAddress(userAddress, 'userAddress');
    const [shares, maxWithdraw] = await Promise.all([
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'balanceOf', args: [user] }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'maxWithdraw', args: [user] }),
    ]);
    const assets = await client.readContract({
      address: vault, abi: VAULT_ABI, functionName: 'convertToAssets', args: [shares],
    });
    return { vault, userAddress: user, shares: shares.toString(), assets: assets.toString(), maxWithdraw: maxWithdraw.toString(), assetDecimals: 6, shareDecimals: 9 };
  }

  static async getVaultQuote(chain: SupportedChain, action: 'deposit' | 'withdraw', amount: string, userAddress?: string) {
    const client = getClient(chain);
    const vault = getVaultAddress(chain);
    const amountAtomic = BigInt(amount);
    if (amountAtomic <= 0n) throw new Error('Vault amount must be greater than zero');
    if (action === 'deposit') {
      if (amountAtomic < 1_000_000n) throw new Error('Vault deposit must be at least 1 USDC (1000000 atomic units)');
      const shares = await client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'previewDeposit', args: [amountAtomic] });
      return { action, vault, assets: amount, expectedShares: shares.toString(), assetDecimals: 6, shareDecimals: 9 };
    }
    if (!userAddress) throw new Error('userAddress is required for a withdrawal quote');
    const position = await this.getVaultPosition(chain, userAddress);
    if (amountAtomic > BigInt(position.maxWithdraw)) throw new Error(`Amount exceeds maxWithdraw (${position.maxWithdraw})`);
    return { action, vault, assets: amount, maxWithdraw: position.maxWithdraw, assetDecimals: 6 };
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
    const domains: Partial<Record<SupportedChain, number>> = Object.fromEntries(
      Object.entries(CCTP_CHAINS).map(([key, c]) => [key, c.domain]),
    );
    const sourceDomain = domains[fromChain];
    const destinationDomain = domains[toChain];
    if (sourceDomain === undefined || destinationDomain === undefined) {
      throw new Error('Unsupported CCTP domain');
    }
    if (sourceDomain === destinationDomain) throw new Error('Source and destination chains must differ');

    const response = await fetch(
      `${IRIS_API}/v2/burn/USDC/fees/${sourceDomain}/${destinationDomain}?forward=true`,
    );
    if (!response.ok) throw new Error(`Circle fee API returned HTTP ${response.status}`);
    const feeOptions = await response.json() as Array<{
      finalityThreshold: number;
      minimumFee: number;
      forwardFee?: { med?: number };
    }>;

    if (!Array.isArray(feeOptions)) throw new Error('Invalid Circle quote response');
    const selected = feeOptions.find(f => f.finalityThreshold === 1000 && f.forwardFee?.med !== undefined);
    if (!selected) throw new Error('Forwarding is unavailable for this route');
    const amountAtomic = parseUnits(amount, 6);
    const { maxFee } = calculateBridgeFee(amountAtomic, selected);
    return {
      maxFeeAtomic: maxFee.toString(),
      minFinalityThreshold: selected.finalityThreshold,
      minimumReceivedAtomic: (amountAtomic - maxFee).toString(),
      fromChain,
      toChain,
      sourceDomain,
      destinationDomain,
      amount,
      amountUnit: 'USDC (human-readable); fees are in USDC atomic units',
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

  static generateDepositVaultPayload(chain: SupportedChain, amount: string, receiver: string) {
    const vault = getVaultAddress(chain);
    const asset = requireAddress(this.resolveTokenAddress(chain, 'USDC'), 'USDC');
    const recipient = requireAddress(receiver, 'receiver');
    const amountAtomic = BigInt(amount);
    if (amountAtomic < 1_000_000n) throw new Error('Vault deposit must be at least 1 USDC (1000000 atomic units)');
    return {
      to: vault,
      data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'deposit', args: [amountAtomic, recipient] }),
      value: '0', requiredSender: recipient,
      approvals: [{ token: asset, amount: amountAtomic.toString(), spender: vault }],
    };
  }

  static generateWithdrawVaultPayload(chain: SupportedChain, amount: string, receiver: string) {
    const vault = getVaultAddress(chain);
    const recipient = requireAddress(receiver, 'receiver');
    const amountAtomic = BigInt(amount);
    if (amountAtomic <= 0n) throw new Error('Vault amount must be greater than zero');
    return {
      to: vault,
      data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'withdraw', args: [amountAtomic, recipient, recipient] }),
      value: '0', requiredSender: recipient,
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
    const src = CCTP_CHAINS[chain as CctpChain];
    if (!src) throw new Error('Bridge supports mainnet chains only');
    if (!Object.values(CCTP_CHAINS).some(c => c.domain === destinationDomain) || src.domain === destinationDomain) {
      throw new Error('Unsupported or identical destination domain');
    }
    const bridgeAddress = requireAddress(CCTP_TOKEN_MESSENGER, 'CCTP TokenMessenger');
    const tokenAddress = requireAddress(this.resolveTokenAddress(chain, burnToken), 'burnToken');
    if (tokenAddress.toLowerCase() !== src.usdc.toLowerCase()) throw new Error('Bridge requires native mainnet USDC');
    const recipient = requireAddress(mintRecipient, 'mintRecipient');
    if (recipient === zeroAddress) throw new Error('Invalid recipient');
    const caller = requireAddress(destinationCaller, 'destinationCaller');
    if (caller !== zeroAddress || hookData !== CCTP_FORWARDING_HOOK) throw new Error('Unsupported forwarding configuration');
    if (![1000, 2000].includes(minFinalityThreshold)) throw new Error('Invalid finality threshold');
    if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(hookData)) {
      throw new Error('hookData must be a hex byte string');
    }
    const amountAtomic = parseUnits(amount, 6);
    const maxFeeAtomic = BigInt(maxFee);
    if (amountAtomic <= 0n) throw new Error('Bridge amount must be greater than zero');
    if (maxFeeAtomic < 0n || maxFeeAtomic >= amountAtomic) {
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
