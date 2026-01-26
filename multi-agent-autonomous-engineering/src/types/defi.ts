/**
 * DeFi-specific type definitions for the Multi-Agent Autonomous Engineering System
 * These types define the interfaces and data structures for DeFi operations and security validation
 */

import { RiskLevel, ValidationResult } from './core';

// DeFi transaction types
export interface DeFiTransaction {
  id: string;
  type: TransactionType;
  fromToken: Token;
  toToken: Token;
  amount: string; // Using string to handle BigNumber precision
  slippageTolerance: number;
  gasLimit: string;
  gasPrice: string;
  deadline: Date;
  securityAssessment: SecurityAssessment;
  simulationResult?: SimulationResult;
}

export enum TransactionType {
  SWAP = 'swap',
  ADD_LIQUIDITY = 'add_liquidity',
  REMOVE_LIQUIDITY = 'remove_liquidity',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  LEND = 'lend',
  BORROW = 'borrow',
  BRIDGE = 'bridge'
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
  securityFlags: SecurityFlag[];
  liquidityMetrics: LiquidityMetrics;
  priceData: PriceData;
}

export enum SecurityFlag {
  VERIFIED_CONTRACT = 'verified_contract',
  UNVERIFIED_CONTRACT = 'unverified_contract',
  OWNER_MINT_PRIVILEGES = 'owner_mint_privileges',
  OWNER_DRAIN_PRIVILEGES = 'owner_drain_privileges',
  TRADING_RESTRICTED = 'trading_restricted',
  HONEYPOT_DETECTED = 'honeypot_detected',
  HIGH_TRANSFER_TAX = 'high_transfer_tax',
  LIQUIDITY_UNLOCKED = 'liquidity_unlocked',
  PROXY_CONTRACT = 'proxy_contract',
  PAUSABLE = 'pausable'
}

export interface LiquidityMetrics {
  totalLiquidity: string;
  liquidityLocked: boolean;
  lockDuration?: number;
  majorHolders: TokenHolder[];
  distributionScore: number;
}

export interface TokenHolder {
  address: string;
  balance: string;
  percentage: number;
  isContract: boolean;
  isExchange: boolean;
}

export interface PriceData {
  currentPrice: string;
  priceChange24h: number;
  volume24h: string;
  marketCap: string;
  lastUpdated: Date;
  sources: PriceSource[];
}

export interface PriceSource {
  name: string;
  price: string;
  volume: string;
  timestamp: Date;
  confidence: number;
}

// Security assessment types
export interface SecurityAssessment {
  riskLevel: RiskLevel;
  rugPullRisk: RugPullAnalysis;
  honeypotDetected: boolean;
  liquidityLocked: boolean;
  ownerPrivileges: OwnerPrivilege[];
  transferTax: TransferTaxInfo;
  priceImpact: number;
  mevRisk: MEVRiskAssessment;
  recommendations: SecurityRecommendation[];
  blockingIssues: BlockingIssue[];
}

export interface RugPullAnalysis {
  riskScore: number;
  factors: RugPullFactor[];
  liquidityAnalysis: LiquidityAnalysis;
  ownershipAnalysis: OwnershipAnalysis;
}

export interface RugPullFactor {
  type: 'liquidity' | 'ownership' | 'contract' | 'trading';
  description: string;
  severity: RiskLevel;
  weight: number;
}

export interface LiquidityAnalysis {
  totalLiquidity: string;
  lockedPercentage: number;
  lockDuration: number;
  canOwnerRemove: boolean;
  majorPools: LiquidityPool[];
}

export interface LiquidityPool {
  address: string;
  token0: string;
  token1: string;
  liquidity: string;
  volume24h: string;
  fee: number;
}

export interface OwnershipAnalysis {
  ownerAddress: string;
  ownerType: 'eoa' | 'multisig' | 'contract' | 'burned';
  privileges: OwnerPrivilege[];
  renounced: boolean;
  timelock: number;
}

export enum OwnerPrivilege {
  MINT_TOKENS = 'mint_tokens',
  BURN_TOKENS = 'burn_tokens',
  PAUSE_TRADING = 'pause_trading',
  CHANGE_FEES = 'change_fees',
  BLACKLIST_ADDRESSES = 'blacklist_addresses',
  MODIFY_LIMITS = 'modify_limits',
  DRAIN_LIQUIDITY = 'drain_liquidity',
  UPGRADE_CONTRACT = 'upgrade_contract'
}

export interface TransferTaxInfo {
  buyTax: number;
  sellTax: number;
  transferTax: number;
  taxRecipient: string;
  maxTax: number;
  canChangeTax: boolean;
}

export interface MEVRiskAssessment {
  sandwichRisk: RiskLevel;
  frontrunRisk: RiskLevel;
  backrunRisk: RiskLevel;
  mitigations: MEVMitigation[];
}

export interface MEVMitigation {
  type: 'private_mempool' | 'flashloan_protection' | 'slippage_limit' | 'time_delay';
  description: string;
  effectiveness: number;
}

export interface SecurityRecommendation {
  type: 'warning' | 'suggestion' | 'requirement';
  message: string;
  action: string;
  priority: number;
}

export interface BlockingIssue {
  type: 'critical_security' | 'regulatory' | 'technical';
  message: string;
  resolution: string;
  canOverride: boolean;
}

// Transaction simulation types
export interface SimulationResult {
  success: boolean;
  gasUsed: string;
  gasPrice: string;
  outputAmount: string;
  priceImpact: number;
  slippage: number;
  route: SwapRoute[];
  warnings: SimulationWarning[];
  errors: SimulationError[];
}

export interface SwapRoute {
  protocol: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  fee: number;
  priceImpact: number;
}

export interface SimulationWarning {
  type: 'high_slippage' | 'low_liquidity' | 'price_impact' | 'gas_cost';
  message: string;
  severity: RiskLevel;
}

export interface SimulationError {
  code: string;
  message: string;
  details: string;
  recoverable: boolean;
}

// API integration types for DeFi services
export interface DeFiAPIProvider {
  name: string;
  baseUrl: string;
  apiKey?: string;
  rateLimit: RateLimit;
  endpoints: APIEndpoint[];
}

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export interface APIEndpoint {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  parameters: APIParameter[];
  responseSchema: Record<string, unknown>;
}

export interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example: unknown;
}

// Supported DeFi API providers
export enum DeFiAPIProviders {
  GOPLUS_LABS = 'goplus_labs',
  ZERO_X = '0x',
  ONE_INCH = '1inch',
  PARASWAP = 'paraswap',
  COINGECKO = 'coingecko',
  CHAINLINK = 'chainlink',
  ETHERSCAN = 'etherscan',
  THE_GRAPH = 'the_graph',
  ALCHEMY = 'alchemy',
  INFURA = 'infura',
  TENDERLY = 'tenderly'
}

// DeFi safety calculation types
export interface SlippageCalculation {
  expectedOutput: string;
  minimumOutput: string;
  slippagePercentage: number;
  priceImpact: number;
  liquidityDepth: string;
  recommendation: SlippageRecommendation;
}

export interface SlippageRecommendation {
  suggestedTolerance: number;
  reasoning: string;
  warnings: string[];
  alternatives: AlternativeRoute[];
}

export interface AlternativeRoute {
  protocol: string;
  expectedOutput: string;
  slippage: number;
  gasEstimate: string;
  confidence: number;
}

export interface PriceImpactCalculation {
  tradeSize: string;
  poolLiquidity: string;
  priceImpact: number;
  priceImpactUSD: string;
  recommendation: PriceImpactRecommendation;
}

export interface PriceImpactRecommendation {
  severity: RiskLevel;
  message: string;
  suggestedMaxTradeSize: string;
  splitTradeOptions: SplitTradeOption[];
}

export interface SplitTradeOption {
  numberOfTrades: number;
  tradeSize: string;
  totalPriceImpact: number;
  estimatedTimeMinutes: number;
  gasEstimate: string;
}

export interface GasOptimization {
  currentGasPrice: string;
  optimizedGasPrice: string;
  estimatedSavings: string;
  estimatedTime: number;
  route: OptimizedRoute;
}

export interface OptimizedRoute {
  protocol: string;
  path: string[];
  gasEstimate: string;
  outputAmount: string;
  confidence: number;
}

// Oracle and price manipulation detection
export interface OraclePriceDeviation {
  dexPrice: string;
  oraclePrice: string;
  deviation: number;
  deviationUSD: string;
  riskLevel: RiskLevel;
  recommendation: string;
}

export interface PriceManipulationDetection {
  detected: boolean;
  confidence: number;
  indicators: ManipulationIndicator[];
  timeframe: string;
  recommendation: string;
}

export interface ManipulationIndicator {
  type: 'volume_spike' | 'price_spike' | 'liquidity_drain' | 'flash_loan';
  severity: RiskLevel;
  description: string;
  timestamp: Date;
}

// Cross-chain and bridge types
export interface CrossChainTransaction {
  sourceChain: string;
  destinationChain: string;
  bridgeProtocol: string;
  sourceToken: Token;
  destinationToken: Token;
  amount: string;
  estimatedTime: number;
  fees: BridgeFees;
  securityAssessment: BridgeSecurityAssessment;
}

export interface BridgeFees {
  protocolFee: string;
  gasFeeSource: string;
  gasFeeDestination: string;
  totalFeeUSD: string;
}

export interface BridgeSecurityAssessment {
  bridgeRisk: RiskLevel;
  validatorSet: ValidatorInfo[];
  timelock: number;
  auditStatus: AuditStatus;
  insuranceCoverage: string;
}

export interface ValidatorInfo {
  address: string;
  stake: string;
  reputation: number;
  uptime: number;
}

export interface AuditStatus {
  audited: boolean;
  auditor: string;
  auditDate: Date;
  findings: AuditFinding[];
}

export interface AuditFinding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'open' | 'resolved' | 'acknowledged';
}

// Emergency response types
export interface EmergencyResponse {
  triggerId: string;
  type: EmergencyType;
  severity: RiskLevel;
  description: string;
  actions: EmergencyAction[];
  timestamp: Date;
  resolved: boolean;
}

export enum EmergencyType {
  RUG_PULL_DETECTED = 'rug_pull_detected',
  PRICE_MANIPULATION = 'price_manipulation',
  SMART_CONTRACT_EXPLOIT = 'smart_contract_exploit',
  BRIDGE_COMPROMISE = 'bridge_compromise',
  ORACLE_FAILURE = 'oracle_failure',
  LIQUIDITY_CRISIS = 'liquidity_crisis'
}

export interface EmergencyAction {
  type: 'pause_trading' | 'withdraw_liquidity' | 'alert_users' | 'contact_authorities';
  description: string;
  executed: boolean;
  timestamp: Date;
  result?: string;
}

// Compliance and regulatory types
export interface ComplianceCheck {
  jurisdiction: string;
  regulations: Regulation[];
  compliant: boolean;
  violations: ComplianceViolation[];
  recommendations: ComplianceRecommendation[];
}

export interface Regulation {
  name: string;
  type: 'securities' | 'aml' | 'kyc' | 'tax' | 'licensing';
  requirements: string[];
  penalties: string[];
}

export interface ComplianceViolation {
  regulation: string;
  description: string;
  severity: RiskLevel;
  resolution: string;
}

export interface ComplianceRecommendation {
  regulation: string;
  action: string;
  priority: number;
  deadline?: Date;
}

// Performance monitoring for DeFi operations
export interface DeFiPerformanceMetrics {
  transactionCount: number;
  successRate: number;
  averageGasUsed: string;
  averageSlippage: number;
  totalVolumeUSD: string;
  profitLoss: string;
  riskAdjustedReturn: number;
  timestamp: Date;
}

export interface DeFiAlert {
  id: string;
  type: AlertType;
  severity: RiskLevel;
  message: string;
  data: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
}

export enum AlertType {
  HIGH_SLIPPAGE = 'high_slippage',
  PRICE_IMPACT = 'price_impact',
  SECURITY_RISK = 'security_risk',
  GAS_SPIKE = 'gas_spike',
  LIQUIDITY_LOW = 'liquidity_low',
  MEV_ATTACK = 'mev_attack',
  ORACLE_DEVIATION = 'oracle_deviation'
}