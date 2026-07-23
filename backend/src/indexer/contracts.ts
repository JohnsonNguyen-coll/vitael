import { parseAbi, type Address } from "viem";

export const CONTRACTS = {
  lendingPool: "0xEa282eea5bC90905C15Df05Ca43eeA967BcDe49f",
  oracle: "0x514E944009CC86a62d2b44a9911D58fB03E8DcDd",
  dexFactory: "0xdE6b2AEf32FE1e675060dBC47BC2dF049052494E",
  cctpTokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  cctpMessageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
} as const satisfies Record<string, Address>;

export type Token = { address: Address; symbol: string; decimals: number };

export const TOKENS: readonly Token[] = [
  { address: "0x3600000000000000000000000000000000000000", symbol: "USDC", decimals: 6 },
  { address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", symbol: "EURC", decimals: 6 },
  { address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", symbol: "cirBTC", decimals: 8 },
] as const;

export const tokenByAddress = new Map(TOKENS.map((token) => [token.address.toLowerCase(), token]));

export const lendingAbi = parseAbi([
  "event Supplied(address indexed user, address indexed asset, uint256 amount, uint256 shares)",
  "event Withdrawn(address indexed user, address indexed asset, uint256 amount, uint256 shares)",
  "event CollateralDeposited(address indexed user, address indexed asset, uint256 amount)",
  "event CollateralWithdrawn(address indexed user, address indexed asset, uint256 amount)",
  "event Borrowed(address indexed user, address indexed asset, uint256 amount)",
  "event Repaid(address indexed user, address indexed asset, uint256 amount)",
  "event Liquidated(address indexed borrower, address indexed liquidator, address indexed collateralAsset, address debtAsset, uint256 repaidAmount, uint256 seizedCollateral)",
  "function assetStates(address) view returns (uint256 totalBorrowed, uint256 totalReserves, uint256 borrowIndex, uint256 lastAccruedTime, uint256 totalShares)",
  "function exchangeRate(address) view returns (uint256)",
]);

export const factoryAbi = parseAbi([
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
]);

export const pairAbi = parseAbi([
  "event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)",
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
]);

export const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
export const oracleAbi = parseAbi(["function getAssetPrice(address asset) view returns (uint256)"]);

export const cctpAbi = parseAbi([
  "event MessageSent(bytes message)",
  "function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData)",
]);
