/**
 * DeFi Safety Module Implementation
 * Provides comprehensive DeFi safety calculations and validation
 * 
 * Requirements: Task 13 - DeFi Safety Implementation
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// DeFi Safety Types
export interface SlippageParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  reserveIn: bigint;
  reserveOut: bigint;
  fee?: number; // Default 0.3% (30 basis points)
}

export interface SlippageResult {
  expectedOutput: bigint;
  minimumOutput: bigint;
  priceImpact: number; // Percentage
  slippagePercent: number;
  effectivePrice: number;
  warnings: string[];
  isAcceptable: boolean;
}

export interface RugPullCheckParams {
  contractAddress: string;
  contractCode?: string;
  tokenMetrics?: {
    totalSupply: bigint;
    ownerBalance?: bigint;
    lockedLiquidity?: bigint;
    lpTokensLocked?: boolean;
    lockDuration?: number; // Days
  };
  socialMetrics?: {
    holderCount?: number;
    topHolderPercent?: number;
    tradingDays?: number;
  };
}

export interface RugPullResult {
  riskScore: number; // 0-100, higher is riskier
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  indicators: RugPullIndicator[];
  recommendations: string[];
  canProceed: boolean;
}

export interface RugPullIndicator {
  name: string;
  detected: boolean;
  severity: 'info' | 'warning' | 'danger';
  description: string;
  weight: number;
}

export interface MEVProtectionParams {
  transactionType: 'swap' | 'addLiquidity' | 'removeLiquidity' | 'stake' | 'unstake';
  value: bigint;
  deadline?: number; // Unix timestamp
  slippageTolerance?: number; // Percentage
  usePrivatePool?: boolean;
}

export interface MEVProtectionResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  exposureEstimate: bigint;
  recommendations: MEVRecommendation[];
  protectedParams: {
    deadline: number;
    minOutput: bigint;
    useFlashbots: boolean;
  };
}

export interface MEVRecommendation {
  action: string;
  priority: 'required' | 'recommended' | 'optional';
  description: string;
}

export interface LiquidityAnalysis {
  poolAddress: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  totalLiquidity: bigint;
  price: number;
  depth: {
    buy2Percent: bigint;
    sell2Percent: bigint;
  };
  concentration: number;
  impermanentLoss?: number;
}

export interface SafetyConfig {
  maxSlippagePercent: number;
  maxPriceImpact: number;
  minLiquidityUSD: number;
  requireLockedLiquidity: boolean;
  mevProtectionEnabled: boolean;
  deadlineBufferSeconds: number;
}

const DEFAULT_CONFIG: SafetyConfig = {
  maxSlippagePercent: 3.0,
  maxPriceImpact: 5.0,
  minLiquidityUSD: 100000,
  requireLockedLiquidity: true,
  mevProtectionEnabled: true,
  deadlineBufferSeconds: 1200 // 20 minutes
};

// Rug pull detection patterns
const RUG_PULL_PATTERNS = {
  // Code patterns
  hiddenMint: /function\s+_mint\s*\([^)]*\)\s*(?:internal|private)/i,
  unlimitedMint: /mint\s*\([^)]*\)[\s\S]*(?!maxSupply|cap)/i,
  hiddenFees: /(?:buy|sell)(?:Fee|Tax)\s*=\s*(?:[5-9][0-9]|100)/i,
  pauseWithoutTimelock: /pause\s*\([^)]*\)[\s\S]*onlyOwner(?![\s\S]*timelock)/i,
  blacklistFunction: /(?:blacklist|blocklist|isBlocked|isBanned)/i,
  proxyWithoutGovernance: /delegatecall[\s\S]*(?!governance|multisig|dao)/i,
  selfDestruct: /selfdestruct|suicide/i,
  
  // Ownership patterns
  renounceOwnership: /renounceOwnership/i,
  transferOwnership: /transferOwnership/i,
  multiSig: /(?:multi-?sig|gnosis|safe)/i,
  timelock: /timelock/i
};

export class DeFiSafetyModule extends EventEmitter {
  private config: SafetyConfig;
  private analysisCache: Map<string, { result: any; timestamp: number }> = new Map();
  private readonly cacheTTL = 300000; // 5 minutes

  constructor(config: Partial<SafetyConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate slippage for a swap
   * Uses constant product AMM formula (x * y = k)
   */
  public calculateSlippage(params: SlippageParams): SlippageResult {
    const { tokenIn, tokenOut, amountIn, reserveIn, reserveOut, fee = 30 } = params;

    // Validate inputs
    if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
      throw new Error('Invalid parameters: amounts must be positive');
    }

    // Calculate fee-adjusted amount
    const feeMultiplier = 10000n - BigInt(fee);
    const amountInWithFee = amountIn * feeMultiplier / 10000n;

    // Constant product formula: (x + dx) * (y - dy) = x * y
    // dy = y * dx / (x + dx)
    const numerator = reserveOut * amountInWithFee;
    const denominator = reserveIn + amountInWithFee;
    const expectedOutput = numerator / denominator;

    // Calculate price impact
    // Price impact = (amountIn / reserveIn) * 100
    const priceImpact = Number(amountIn * 10000n / reserveIn) / 100;

    // Calculate effective price
    const spotPrice = Number(reserveOut) / Number(reserveIn);
    const executionPrice = Number(expectedOutput) / Number(amountIn);
    const slippagePercent = ((spotPrice - executionPrice) / spotPrice) * 100;

    // Calculate minimum output with tolerance
    const slippageTolerance = BigInt(Math.floor(this.config.maxSlippagePercent * 100));
    const minimumOutput = expectedOutput * (10000n - slippageTolerance) / 10000n;

    // Generate warnings
    const warnings: string[] = [];
    if (priceImpact > this.config.maxPriceImpact) {
      warnings.push(`High price impact: ${priceImpact.toFixed(2)}% exceeds ${this.config.maxPriceImpact}% threshold`);
    }
    if (slippagePercent > this.config.maxSlippagePercent) {
      warnings.push(`High slippage: ${slippagePercent.toFixed(2)}% exceeds ${this.config.maxSlippagePercent}% threshold`);
    }
    if (amountIn > reserveIn / 10n) {
      warnings.push('Trade size is >10% of pool reserves, consider splitting');
    }

    const isAcceptable = priceImpact <= this.config.maxPriceImpact && 
                         slippagePercent <= this.config.maxSlippagePercent;

    const result: SlippageResult = {
      expectedOutput,
      minimumOutput,
      priceImpact,
      slippagePercent,
      effectivePrice: executionPrice,
      warnings,
      isAcceptable
    };

    this.emit('slippage-calculated', { params, result });

    return result;
  }

  /**
   * Calculate optimal trade size to minimize slippage
   */
  public calculateOptimalTradeSize(
    reserveIn: bigint,
    reserveOut: bigint,
    targetSlippage: number
  ): bigint {
    // For slippage s, amount = reserve * s / (1 - s)
    const slippageBps = BigInt(Math.floor(targetSlippage * 100));
    const denominator = 10000n - slippageBps;
    
    return reserveIn * slippageBps / denominator;
  }

  /**
   * Detect rug pull indicators
   */
  public async detectRugPull(params: RugPullCheckParams): Promise<RugPullResult> {
    const indicators: RugPullIndicator[] = [];
    let totalWeight = 0;
    let riskWeight = 0;

    // Check code patterns if available
    if (params.contractCode) {
      const codeIndicators = this.analyzeContractCode(params.contractCode);
      indicators.push(...codeIndicators);
      
      for (const ind of codeIndicators) {
        totalWeight += ind.weight;
        if (ind.detected) riskWeight += ind.weight;
      }
    }

    // Check token metrics
    if (params.tokenMetrics) {
      const metricIndicators = this.analyzeTokenMetrics(params.tokenMetrics);
      indicators.push(...metricIndicators);

      for (const ind of metricIndicators) {
        totalWeight += ind.weight;
        if (ind.detected) riskWeight += ind.weight;
      }
    }

    // Check social metrics
    if (params.socialMetrics) {
      const socialIndicators = this.analyzeSocialMetrics(params.socialMetrics);
      indicators.push(...socialIndicators);

      for (const ind of socialIndicators) {
        totalWeight += ind.weight;
        if (ind.detected) riskWeight += ind.weight;
      }
    }

    // Calculate risk score
    const riskScore = totalWeight > 0 ? Math.round((riskWeight / totalWeight) * 100) : 50;

    // Determine risk level
    let riskLevel: RugPullResult['riskLevel'];
    if (riskScore <= 15) riskLevel = 'safe';
    else if (riskScore <= 30) riskLevel = 'low';
    else if (riskScore <= 50) riskLevel = 'medium';
    else if (riskScore <= 75) riskLevel = 'high';
    else riskLevel = 'critical';

    // Generate recommendations
    const recommendations = this.generateRugPullRecommendations(indicators, riskLevel);

    const result: RugPullResult = {
      riskScore,
      riskLevel,
      indicators,
      recommendations,
      canProceed: riskLevel === 'safe' || riskLevel === 'low'
    };

    this.emit('rugpull-checked', { params, result });

    return result;
  }

  /**
   * Analyze MEV risk and provide protection parameters
   */
  public analyzeMEVRisk(params: MEVProtectionParams): MEVProtectionResult {
    const { transactionType, value, deadline, slippageTolerance, usePrivatePool } = params;

    // Calculate base risk based on transaction type
    let baseRisk = 0;
    switch (transactionType) {
      case 'swap':
        baseRisk = 50;
        break;
      case 'addLiquidity':
        baseRisk = 30;
        break;
      case 'removeLiquidity':
        baseRisk = 40;
        break;
      case 'stake':
      case 'unstake':
        baseRisk = 20;
        break;
    }

    // Adjust based on value
    // Higher value = higher risk
    const valueThresholds = [
      { threshold: BigInt('100000000000000000000'), multiplier: 2.0 }, // 100 ETH
      { threshold: BigInt('10000000000000000000'), multiplier: 1.5 },  // 10 ETH
      { threshold: BigInt('1000000000000000000'), multiplier: 1.2 },   // 1 ETH
    ];

    let valueMultiplier = 1.0;
    for (const t of valueThresholds) {
      if (value >= t.threshold) {
        valueMultiplier = t.multiplier;
        break;
      }
    }

    // Adjust based on protections
    let protectionReduction = 0;
    if (deadline) protectionReduction += 10;
    if (slippageTolerance && slippageTolerance < 1) protectionReduction += 15;
    if (usePrivatePool) protectionReduction += 30;

    const finalRisk = Math.max(0, Math.min(100, (baseRisk * valueMultiplier) - protectionReduction));

    // Determine risk level
    let riskLevel: MEVProtectionResult['riskLevel'];
    if (finalRisk <= 20) riskLevel = 'low';
    else if (finalRisk <= 45) riskLevel = 'medium';
    else if (finalRisk <= 70) riskLevel = 'high';
    else riskLevel = 'critical';

    // Calculate exposure estimate (rough estimate of potential MEV loss)
    const exposurePercent = riskLevel === 'critical' ? 5 : riskLevel === 'high' ? 3 : riskLevel === 'medium' ? 1 : 0.5;
    const exposureEstimate = value * BigInt(Math.floor(exposurePercent * 100)) / 10000n;

    // Generate recommendations
    const recommendations: MEVRecommendation[] = [];

    if (!deadline) {
      recommendations.push({
        action: 'Add deadline',
        priority: 'required',
        description: 'Set transaction deadline to prevent stale transactions being executed at unfavorable prices'
      });
    }

    if (!slippageTolerance || slippageTolerance > 1) {
      recommendations.push({
        action: 'Reduce slippage tolerance',
        priority: 'recommended',
        description: 'Lower slippage tolerance to reduce sandwich attack profitability'
      });
    }

    if (!usePrivatePool && riskLevel !== 'low') {
      recommendations.push({
        action: 'Use private mempool',
        priority: riskLevel === 'critical' ? 'required' : 'recommended',
        description: 'Submit transaction through Flashbots or similar private mempool service'
      });
    }

    if (value > BigInt('10000000000000000000')) { // > 10 ETH
      recommendations.push({
        action: 'Split transaction',
        priority: 'optional',
        description: 'Consider splitting large transactions to reduce individual MEV exposure'
      });
    }

    // Calculate protected parameters
    const protectedDeadline = deadline || Math.floor(Date.now() / 1000) + this.config.deadlineBufferSeconds;
    const effectiveSlippage = slippageTolerance || this.config.maxSlippagePercent;
    const minOutput = value * BigInt(Math.floor((100 - effectiveSlippage) * 100)) / 10000n;

    const result: MEVProtectionResult = {
      riskLevel,
      exposureEstimate,
      recommendations,
      protectedParams: {
        deadline: protectedDeadline,
        minOutput,
        useFlashbots: riskLevel === 'high' || riskLevel === 'critical'
      }
    };

    this.emit('mev-analyzed', { params, result });

    return result;
  }

  /**
   * Analyze pool liquidity
   */
  public analyzeLiquidity(
    poolAddress: string,
    token0: string,
    token1: string,
    reserve0: bigint,
    reserve1: bigint
  ): LiquidityAnalysis {
    // Calculate total liquidity (geometric mean)
    const product = reserve0 * reserve1;
    const totalLiquidity = this.sqrt(product);

    // Calculate price
    const price = Number(reserve1) / Number(reserve0);

    // Calculate depth (how much can be traded for 2% slippage)
    const slippage2Percent = 200n; // 2% in basis points
    const buy2Percent = reserve0 * slippage2Percent / 10000n;
    const sell2Percent = reserve1 * slippage2Percent / 10000n;

    // Calculate concentration (how much of liquidity is in current price range)
    // Simplified: assume 90% is within 20% of current price
    const concentration = 0.9;

    const analysis: LiquidityAnalysis = {
      poolAddress,
      token0,
      token1,
      reserve0,
      reserve1,
      totalLiquidity,
      price,
      depth: {
        buy2Percent,
        sell2Percent
      },
      concentration
    };

    return analysis;
  }

  /**
   * Validate a DeFi transaction
   */
  public validateTransaction(params: {
    type: 'swap' | 'addLiquidity' | 'removeLiquidity';
    tokenIn?: string;
    tokenOut?: string;
    amountIn: bigint;
    amountOut?: bigint;
    reserveIn?: bigint;
    reserveOut?: bigint;
    deadline: number;
    slippageTolerance: number;
  }): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check deadline
    const now = Math.floor(Date.now() / 1000);
    if (params.deadline <= now) {
      errors.push('Transaction deadline has passed');
    } else if (params.deadline - now < 60) {
      warnings.push('Deadline is less than 1 minute away');
    }

    // Check slippage tolerance
    if (params.slippageTolerance < 0.1) {
      warnings.push('Very low slippage tolerance may cause transaction failures');
    } else if (params.slippageTolerance > 5) {
      warnings.push('High slippage tolerance increases MEV exposure');
    }

    // Check amounts
    if (params.amountIn <= 0n) {
      errors.push('Input amount must be positive');
    }

    // If reserves are provided, validate slippage
    if (params.type === 'swap' && params.reserveIn && params.reserveOut) {
      const slippageResult = this.calculateSlippage({
        tokenIn: params.tokenIn || '',
        tokenOut: params.tokenOut || '',
        amountIn: params.amountIn,
        reserveIn: params.reserveIn,
        reserveOut: params.reserveOut
      });

      if (!slippageResult.isAcceptable) {
        warnings.push(...slippageResult.warnings);
      }

      if (params.amountOut && params.amountOut > slippageResult.expectedOutput) {
        errors.push('Expected output is higher than calculated output');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Private helper methods

  private analyzeContractCode(code: string): RugPullIndicator[] {
    const indicators: RugPullIndicator[] = [];

    // Check for hidden mint
    indicators.push({
      name: 'Hidden Mint Function',
      detected: RUG_PULL_PATTERNS.hiddenMint.test(code) && !RUG_PULL_PATTERNS.renounceOwnership.test(code),
      severity: 'danger',
      description: 'Contract has hidden mint function that could inflate supply',
      weight: 25
    });

    // Check for unlimited mint
    indicators.push({
      name: 'Unlimited Minting',
      detected: RUG_PULL_PATTERNS.unlimitedMint.test(code),
      severity: 'danger',
      description: 'Contract allows unlimited token minting',
      weight: 20
    });

    // Check for high fees
    indicators.push({
      name: 'Excessive Fees',
      detected: RUG_PULL_PATTERNS.hiddenFees.test(code),
      severity: 'danger',
      description: 'Contract has excessive buy/sell fees (>50%)',
      weight: 20
    });

    // Check for blacklist
    indicators.push({
      name: 'Blacklist Function',
      detected: RUG_PULL_PATTERNS.blacklistFunction.test(code),
      severity: 'warning',
      description: 'Contract can blacklist addresses from trading',
      weight: 10
    });

    // Check for pause without timelock
    indicators.push({
      name: 'Pausable Without Timelock',
      detected: RUG_PULL_PATTERNS.pauseWithoutTimelock.test(code),
      severity: 'warning',
      description: 'Contract can be paused without timelock protection',
      weight: 10
    });

    // Check for multi-sig (positive indicator)
    indicators.push({
      name: 'Multi-Sig Protection',
      detected: !RUG_PULL_PATTERNS.multiSig.test(code),
      severity: 'info',
      description: 'No multi-sig protection detected',
      weight: 5
    });

    // Check for timelock (positive indicator)
    indicators.push({
      name: 'Timelock',
      detected: !RUG_PULL_PATTERNS.timelock.test(code),
      severity: 'info',
      description: 'No timelock protection detected',
      weight: 5
    });

    // Check for selfdestruct
    indicators.push({
      name: 'Self-Destruct',
      detected: RUG_PULL_PATTERNS.selfDestruct.test(code),
      severity: 'danger',
      description: 'Contract contains selfdestruct function',
      weight: 30
    });

    return indicators;
  }

  private analyzeTokenMetrics(metrics: NonNullable<RugPullCheckParams['tokenMetrics']>): RugPullIndicator[] {
    const indicators: RugPullIndicator[] = [];

    // Check owner balance
    if (metrics.ownerBalance && metrics.totalSupply) {
      const ownerPercent = Number(metrics.ownerBalance * 100n / metrics.totalSupply);
      indicators.push({
        name: 'High Owner Balance',
        detected: ownerPercent > 20,
        severity: ownerPercent > 50 ? 'danger' : 'warning',
        description: `Owner holds ${ownerPercent.toFixed(1)}% of supply`,
        weight: ownerPercent > 50 ? 25 : 15
      });
    }

    // Check liquidity lock
    if (metrics.lpTokensLocked !== undefined) {
      indicators.push({
        name: 'Unlocked Liquidity',
        detected: !metrics.lpTokensLocked,
        severity: 'danger',
        description: 'Liquidity pool tokens are not locked',
        weight: 20
      });
    }

    // Check lock duration
    if (metrics.lockDuration !== undefined) {
      indicators.push({
        name: 'Short Lock Duration',
        detected: metrics.lockDuration < 180, // Less than 6 months
        severity: metrics.lockDuration < 30 ? 'danger' : 'warning',
        description: `Liquidity locked for only ${metrics.lockDuration} days`,
        weight: metrics.lockDuration < 30 ? 15 : 10
      });
    }

    return indicators;
  }

  private analyzeSocialMetrics(metrics: NonNullable<RugPullCheckParams['socialMetrics']>): RugPullIndicator[] {
    const indicators: RugPullIndicator[] = [];

    // Check holder count
    if (metrics.holderCount !== undefined) {
      indicators.push({
        name: 'Low Holder Count',
        detected: metrics.holderCount < 100,
        severity: metrics.holderCount < 50 ? 'danger' : 'warning',
        description: `Only ${metrics.holderCount} holders`,
        weight: metrics.holderCount < 50 ? 15 : 10
      });
    }

    // Check top holder concentration
    if (metrics.topHolderPercent !== undefined) {
      indicators.push({
        name: 'Concentrated Holdings',
        detected: metrics.topHolderPercent > 40,
        severity: metrics.topHolderPercent > 60 ? 'danger' : 'warning',
        description: `Top 10 holders own ${metrics.topHolderPercent}%`,
        weight: metrics.topHolderPercent > 60 ? 20 : 10
      });
    }

    // Check trading age
    if (metrics.tradingDays !== undefined) {
      indicators.push({
        name: 'New Token',
        detected: metrics.tradingDays < 30,
        severity: metrics.tradingDays < 7 ? 'danger' : 'warning',
        description: `Token has only been trading for ${metrics.tradingDays} days`,
        weight: metrics.tradingDays < 7 ? 15 : 5
      });
    }

    return indicators;
  }

  private generateRugPullRecommendations(indicators: RugPullIndicator[], riskLevel: string): string[] {
    const recommendations: string[] = [];

    const dangerIndicators = indicators.filter(i => i.detected && i.severity === 'danger');
    const warningIndicators = indicators.filter(i => i.detected && i.severity === 'warning');

    if (dangerIndicators.length > 0) {
      recommendations.push('⚠️ CRITICAL: Multiple danger indicators detected. Extreme caution advised.');
    }

    for (const ind of dangerIndicators) {
      switch (ind.name) {
        case 'Hidden Mint Function':
        case 'Unlimited Minting':
          recommendations.push('Verify token supply is capped and owner cannot mint arbitrary amounts');
          break;
        case 'Excessive Fees':
          recommendations.push('Review fee structure in contract - high fees may prevent selling');
          break;
        case 'Unlocked Liquidity':
          recommendations.push('Wait for liquidity to be locked before investing significant amounts');
          break;
        case 'Self-Destruct':
          recommendations.push('Contract can be destroyed at any time - extremely high risk');
          break;
      }
    }

    for (const ind of warningIndicators) {
      switch (ind.name) {
        case 'Blacklist Function':
          recommendations.push('Contract can blacklist your address - ensure you can exit position');
          break;
        case 'Pausable Without Timelock':
          recommendations.push('Trading can be paused without warning - maintain smaller position');
          break;
        case 'Short Lock Duration':
          recommendations.push('Plan to exit before liquidity lock expires');
          break;
      }
    }

    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Consider investing only what you can afford to lose completely');
      recommendations.push('Start with a very small test transaction');
    }

    return recommendations;
  }

  private sqrt(value: bigint): bigint {
    if (value < 0n) throw new Error('Square root of negative number');
    if (value === 0n) return 0n;
    
    let z = value;
    let x = value / 2n + 1n;
    
    while (x < z) {
      z = x;
      x = (value / x + x) / 2n;
    }
    
    return z;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): SafetyConfig {
    return { ...this.config };
  }
}

// Factory function
export function createDeFiSafetyModule(config?: Partial<SafetyConfig>): DeFiSafetyModule {
  return new DeFiSafetyModule(config);
}

// Export utility functions
export const DeFiSafetyUtils = {
  /**
   * Calculate price from reserves
   */
  calculatePrice(reserve0: bigint, reserve1: bigint): number {
    return Number(reserve1) / Number(reserve0);
  },

  /**
   * Calculate required input for desired output
   */
  calculateRequiredInput(
    amountOut: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
    fee: number = 30
  ): bigint {
    const feeMultiplier = 10000n - BigInt(fee);
    const numerator = reserveIn * amountOut * 10000n;
    const denominator = (reserveOut - amountOut) * feeMultiplier;
    return numerator / denominator + 1n;
  },

  /**
   * Format bigint to human readable
   */
  formatAmount(amount: bigint, decimals: number = 18): string {
    const divisor = BigInt(10 ** decimals);
    const integerPart = amount / divisor;
    const fractionalPart = amount % divisor;
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0').slice(0, 4);
    return `${integerPart}.${fractionalStr}`;
  },

  /**
   * Parse human readable to bigint
   */
  parseAmount(amount: string, decimals: number = 18): bigint {
    const [integer, fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(integer + paddedFraction);
  }
};
