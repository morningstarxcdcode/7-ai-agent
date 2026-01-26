/**
 * DeFi API Client
 * Integrates with GoPlus Labs, 0x, 1inch, DeFiLlama, and CoinGecko APIs
 * for comprehensive DeFi security validation and market data
 * 
 * Requirements: Multi-Agent Platform API Integration
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// API Configuration
export interface DeFiAPIConfig {
  goPlusApiKey?: string;
  etherscanApiKey?: string;
  alchemyApiKey?: string;
  rateLimitPerMinute?: number;
}

// Token Security Types
export interface TokenSecurityResult {
  contractAddress: string;
  chainId: string;
  isHoneypot: boolean;
  isOpenSource: boolean;
  isProxy: boolean;
  isMintable: boolean;
  hasSelfDestruct: boolean;
  canTakeBackOwnership: boolean;
  ownerChangeBalance: boolean;
  hiddenOwner: boolean;
  externalCall: boolean;
  buyTax: number;
  sellTax: number;
  isAntiWhale: boolean;
  antiWhaleModifiable: boolean;
  tradingCooldown: boolean;
  personalSlippageModifiable: boolean;
  blacklistFunction: boolean;
  whitelistFunction: boolean;
  isPausable: boolean;
  cannotBuy: boolean;
  cannotSellAll: boolean;
  isInDex: boolean;
  dexInfo: DexInfo[];
  holderCount: number;
  lpHolderCount: number;
  totalSupply: string;
  lpTotalSupply: string;
  creatorAddress: string;
  ownerAddress: string;
  creatorPercent: number;
  ownerPercent: number;
  riskScore: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
}

export interface DexInfo {
  name: string;
  liquidity: string;
  pair: string;
}

// Swap Quote Types
export interface SwapQuoteParams {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount?: string;
  buyAmount?: string;
  slippagePercentage?: number;
  takerAddress?: string;
}

export interface SwapQuoteResult {
  price: string;
  guaranteedPrice: string;
  estimatedPriceImpact: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
  protocolFee: string;
  minimumProtocolFee: string;
  buyAmount: string;
  sellAmount: string;
  sources: SwapSource[];
  orders: SwapOrder[];
  allowanceTarget: string;
}

export interface SwapSource {
  name: string;
  proportion: string;
}

export interface SwapOrder {
  makerToken: string;
  takerToken: string;
  makerAmount: string;
  takerAmount: string;
  fillData: unknown;
  source: string;
}

// Protocol TVL Types
export interface ProtocolTVL {
  id: string;
  name: string;
  address: string | null;
  symbol: string;
  url: string;
  logo: string;
  chains: string[];
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h: number | null;
  change_1d: number | null;
  change_7d: number | null;
  tokenBreakdowns?: Record<string, number>;
}

// Yield Data Types
export interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  rewardTokens: string[] | null;
  pool: string;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  ilRisk: 'no' | 'yes';
  exposure: 'single' | 'multi';
  predictions: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: number;
  } | null;
  poolMeta: string | null;
  underlyingTokens: string[] | null;
}

// API Client Class
export class DeFiAPIClient {
  private config: DeFiAPIConfig;
  private httpClient: AxiosInstance;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private rateLimitInterval: number;

  // API Base URLs
  private readonly GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1';
  private readonly ZEROX_BASE = 'https://api.0x.org';
  private readonly ONEINCH_BASE = 'https://api.1inch.dev/swap/v6.0';
  private readonly DEFILLAMA_BASE = 'https://api.llama.fi';
  private readonly COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

  // Chain ID mapping
  private readonly CHAIN_IDS: Record<string, string> = {
    ethereum: '1',
    bsc: '56',
    polygon: '137',
    arbitrum: '42161',
    optimism: '10',
    base: '8453',
    avalanche: '43114',
    fantom: '250'
  };

  constructor(config: DeFiAPIConfig = {}) {
    this.config = {
      rateLimitPerMinute: 60,
      ...config
    };

    this.rateLimitInterval = 60000 / (this.config.rateLimitPerMinute || 60);

    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Rate limiting helper
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.rateLimitInterval - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Make API request with error handling
   */
  private async request<T>(
    url: string, 
    config?: AxiosRequestConfig
  ): Promise<T> {
    await this.rateLimit();
    
    try {
      const response = await this.httpClient.request<T>({
        url,
        ...config
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `API request failed: ${error.response?.status} - ${error.response?.statusText}`
        );
      }
      throw error;
    }
  }

  // ==========================================
  // GoPlus Labs API - Token Security
  // ==========================================

  /**
   * Check token security using GoPlus Labs API
   */
  async checkTokenSecurity(
    contractAddress: string,
    chainId: string = '1'
  ): Promise<TokenSecurityResult> {
    const response = await this.request<{ result: Record<string, any> }>(
      `${this.GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${contractAddress}`
    );

    const data = response.result[contractAddress.toLowerCase()];
    
    if (!data) {
      throw new Error(`Token not found: ${contractAddress}`);
    }

    // Calculate risk score
    const riskFactors = [
      { condition: data.is_honeypot === '1', weight: 100 },
      { condition: data.is_open_source === '0', weight: 20 },
      { condition: data.is_proxy === '1', weight: 10 },
      { condition: data.is_mintable === '1', weight: 30 },
      { condition: data.can_take_back_ownership === '1', weight: 40 },
      { condition: data.owner_change_balance === '1', weight: 50 },
      { condition: data.hidden_owner === '1', weight: 30 },
      { condition: parseFloat(data.buy_tax || '0') > 10, weight: 20 },
      { condition: parseFloat(data.sell_tax || '0') > 10, weight: 20 },
      { condition: data.cannot_buy === '1', weight: 100 },
      { condition: data.cannot_sell_all === '1', weight: 80 }
    ];

    const riskScore = riskFactors.reduce((score, factor) => 
      factor.condition ? score + factor.weight : score, 0
    );

    const normalizedRiskScore = Math.min(100, riskScore);
    
    let riskLevel: TokenSecurityResult['riskLevel'];
    if (normalizedRiskScore >= 80) riskLevel = 'critical';
    else if (normalizedRiskScore >= 60) riskLevel = 'high';
    else if (normalizedRiskScore >= 40) riskLevel = 'medium';
    else if (normalizedRiskScore >= 20) riskLevel = 'low';
    else riskLevel = 'safe';

    const warnings: string[] = [];
    if (data.is_honeypot === '1') warnings.push('Token is a honeypot - DO NOT TRADE');
    if (data.is_open_source === '0') warnings.push('Contract is not open source');
    if (data.is_proxy === '1') warnings.push('Token uses proxy contract - can be upgraded');
    if (data.is_mintable === '1') warnings.push('Token supply can be increased');
    if (data.owner_change_balance === '1') warnings.push('Owner can modify balances');
    if (parseFloat(data.buy_tax || '0') > 5) warnings.push(`High buy tax: ${data.buy_tax}%`);
    if (parseFloat(data.sell_tax || '0') > 5) warnings.push(`High sell tax: ${data.sell_tax}%`);
    if (data.cannot_sell_all === '1') warnings.push('Cannot sell all tokens');
    if (data.is_blacklisted === '1') warnings.push('Token has blacklist function');

    return {
      contractAddress,
      chainId,
      isHoneypot: data.is_honeypot === '1',
      isOpenSource: data.is_open_source === '1',
      isProxy: data.is_proxy === '1',
      isMintable: data.is_mintable === '1',
      hasSelfDestruct: data.selfdestruct === '1',
      canTakeBackOwnership: data.can_take_back_ownership === '1',
      ownerChangeBalance: data.owner_change_balance === '1',
      hiddenOwner: data.hidden_owner === '1',
      externalCall: data.external_call === '1',
      buyTax: parseFloat(data.buy_tax || '0'),
      sellTax: parseFloat(data.sell_tax || '0'),
      isAntiWhale: data.is_anti_whale === '1',
      antiWhaleModifiable: data.anti_whale_modifiable === '1',
      tradingCooldown: data.trading_cooldown === '1',
      personalSlippageModifiable: data.personal_slippage_modifiable === '1',
      blacklistFunction: data.is_blacklisted === '1',
      whitelistFunction: data.is_whitelisted === '1',
      isPausable: data.transfer_pausable === '1',
      cannotBuy: data.cannot_buy === '1',
      cannotSellAll: data.cannot_sell_all === '1',
      isInDex: data.is_in_dex === '1',
      dexInfo: data.dex || [],
      holderCount: parseInt(data.holder_count || '0'),
      lpHolderCount: parseInt(data.lp_holder_count || '0'),
      totalSupply: data.total_supply || '0',
      lpTotalSupply: data.lp_total_supply || '0',
      creatorAddress: data.creator_address || '',
      ownerAddress: data.owner_address || '',
      creatorPercent: parseFloat(data.creator_percent || '0'),
      ownerPercent: parseFloat(data.owner_percent || '0'),
      riskScore: normalizedRiskScore,
      riskLevel,
      warnings
    };
  }

  /**
   * Check if address is malicious
   */
  async checkMaliciousAddress(address: string, chainId: string = '1'): Promise<{
    isMalicious: boolean;
    riskType: string[];
    note: string;
  }> {
    const response = await this.request<{ result: Record<string, any> }>(
      `${this.GOPLUS_BASE}/address_security/${chainId}?address=${address}`
    );

    const data = response.result;
    const riskTypes: string[] = [];
    
    if (data.honeypot_related_address === '1') riskTypes.push('honeypot_related');
    if (data.phishing_activities === '1') riskTypes.push('phishing');
    if (data.blackmail_activities === '1') riskTypes.push('blackmail');
    if (data.stealing_attack === '1') riskTypes.push('stealing_attack');
    if (data.fake_kyc === '1') riskTypes.push('fake_kyc');
    if (data.malicious_mining_activities === '1') riskTypes.push('malicious_mining');
    if (data.darkweb_transactions === '1') riskTypes.push('darkweb');
    if (data.cybercrime === '1') riskTypes.push('cybercrime');
    if (data.money_laundering === '1') riskTypes.push('money_laundering');
    if (data.financial_crime === '1') riskTypes.push('financial_crime');

    return {
      isMalicious: riskTypes.length > 0,
      riskType: riskTypes,
      note: data.note || ''
    };
  }

  // ==========================================
  // DeFiLlama API - TVL and Protocol Data
  // ==========================================

  /**
   * Get list of all protocols with TVL
   */
  async getProtocols(): Promise<ProtocolTVL[]> {
    return this.request<ProtocolTVL[]>(`${this.DEFILLAMA_BASE}/protocols`);
  }

  /**
   * Get TVL for a specific protocol
   */
  async getProtocolTVL(protocolSlug: string): Promise<{
    tvl: number;
    chainTvls: Record<string, number>;
    tokens: Record<string, number>;
  }> {
    const response = await this.request<any>(
      `${this.DEFILLAMA_BASE}/protocol/${protocolSlug}`
    );
    
    return {
      tvl: response.tvl,
      chainTvls: response.chainTvls || {},
      tokens: response.tokens || {}
    };
  }

  /**
   * Get yield farming pools
   */
  async getYieldPools(chain?: string): Promise<YieldPool[]> {
    const response = await this.request<{ data: YieldPool[] }>(
      `${this.DEFILLAMA_BASE}/pools`
    );

    if (chain) {
      return response.data.filter(pool => 
        pool.chain.toLowerCase() === chain.toLowerCase()
      );
    }

    return response.data;
  }

  /**
   * Get top yield opportunities
   */
  async getTopYields(
    options: {
      minTvl?: number;
      minApy?: number;
      maxApy?: number;
      chain?: string;
      stableOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<YieldPool[]> {
    const {
      minTvl = 1000000,
      minApy = 0,
      maxApy = 1000,
      chain,
      stableOnly = false,
      limit = 20
    } = options;

    const pools = await this.getYieldPools(chain);

    return pools
      .filter(pool => {
        if (pool.tvlUsd < minTvl) return false;
        if (pool.apy < minApy || pool.apy > maxApy) return false;
        if (stableOnly && !pool.stablecoin) return false;
        return true;
      })
      .sort((a, b) => b.apy - a.apy)
      .slice(0, limit);
  }

  // ==========================================
  // CoinGecko API - Price Data
  // ==========================================

  /**
   * Get token price by contract address
   */
  async getTokenPrice(
    contractAddress: string,
    platform: string = 'ethereum'
  ): Promise<{
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
    usd_market_cap: number;
  }> {
    const response = await this.request<Record<string, any>>(
      `${this.COINGECKO_BASE}/simple/token_price/${platform}` +
      `?contract_addresses=${contractAddress}` +
      `&vs_currencies=usd` +
      `&include_24hr_change=true` +
      `&include_24hr_vol=true` +
      `&include_market_cap=true`
    );

    const data = response[contractAddress.toLowerCase()];
    
    if (!data) {
      throw new Error(`Price not found for token: ${contractAddress}`);
    }

    return {
      usd: data.usd,
      usd_24h_change: data.usd_24h_change,
      usd_24h_vol: data.usd_24h_vol,
      usd_market_cap: data.usd_market_cap
    };
  }

  /**
   * Get multiple token prices
   */
  async getTokenPrices(
    contractAddresses: string[],
    platform: string = 'ethereum'
  ): Promise<Record<string, {
    usd: number;
    usd_24h_change: number;
  }>> {
    const addresses = contractAddresses.join(',');
    
    return this.request<Record<string, any>>(
      `${this.COINGECKO_BASE}/simple/token_price/${platform}` +
      `?contract_addresses=${addresses}` +
      `&vs_currencies=usd` +
      `&include_24hr_change=true`
    );
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Comprehensive security check for a DeFi operation
   */
  async performSecurityCheck(params: {
    tokenAddress: string;
    chainId?: string;
    minLiquidity?: number;
    maxTax?: number;
  }): Promise<{
    safe: boolean;
    riskLevel: string;
    details: TokenSecurityResult;
    recommendations: string[];
  }> {
    const { 
      tokenAddress, 
      chainId = '1', 
      minLiquidity = 100000,
      maxTax = 10 
    } = params;

    const security = await this.checkTokenSecurity(tokenAddress, chainId);
    const recommendations: string[] = [];

    // Add recommendations based on findings
    if (security.isHoneypot) {
      recommendations.push('CRITICAL: Do not interact with this token - it is a honeypot');
    }
    if (!security.isOpenSource) {
      recommendations.push('Exercise caution - contract source code is not verified');
    }
    if (security.isMintable) {
      recommendations.push('Token supply can be inflated - monitor for sudden mints');
    }
    if (security.buyTax > maxTax || security.sellTax > maxTax) {
      recommendations.push(`High taxes detected - consider smaller positions`);
    }
    if (security.ownerChangeBalance) {
      recommendations.push('Owner can modify balances - extreme risk');
    }
    if (security.holderCount < 100) {
      recommendations.push('Low holder count - potential for manipulation');
    }

    const safe = security.riskLevel === 'safe' || security.riskLevel === 'low';

    return {
      safe,
      riskLevel: security.riskLevel,
      details: security,
      recommendations
    };
  }

  /**
   * Get API statistics
   */
  getStats(): {
    requestCount: number;
    rateLimitPerMinute: number;
  } {
    return {
      requestCount: this.requestCount,
      rateLimitPerMinute: this.config.rateLimitPerMinute || 60
    };
  }
}

// Factory function
export function createDeFiAPIClient(config?: DeFiAPIConfig): DeFiAPIClient {
  return new DeFiAPIClient(config);
}

// Export singleton instance for convenience
export const deFiAPI = createDeFiAPIClient();
