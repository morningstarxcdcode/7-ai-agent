# DeFi Safety Calculations Steering

## Critical DeFi Safety Calculations

You MUST perform these calculations before any DeFi operation. These are non-negotiable safety requirements for autonomous DeFi interactions.

### 1. Slippage Calculation (MOST IMPORTANT)
**Formula**: `Slippage (%) = ((Expected Output − Actual Output) / Expected Output) × 100`

**Implementation**:
- Fetch quotes from multiple DEX aggregators (0x, 1inch, Paraswap)
- Compare best expected output vs worst case output
- Reject if slippage > user/system threshold (default: 0.5%)
- Account for price impact and liquidity depth

**APIs to Use**:
- 0x Swap API (returns priceImpact and estimatedGas)
- 1inch API (aggregated routing + price impact)
- Paraswap API (liquidity depth + impact)

### 2. Price Impact (Liquidity Depth)
**Formula**: `Price Impact ≈ Trade Size / Pool Liquidity`

**Purpose**:
- Prevent whales from draining pools
- Detect thin liquidity scams
- Validate market depth before large trades

**Data Sources**:
- Uniswap V3 SDK (pool state)
- SushiSwap Subgraph
- The Graph (free hosted subgraphs)

### 3. Rug Pull Detection (CRITICAL)
**Scoring Model**:
- Unverified contract: HIGH RISK
- Owner mint privileges: HIGH RISK  
- Liquidity unlocked: HIGH RISK
- Honeypot behavior: CRITICAL RISK

**Checks Required**:
- Can owner mint unlimited tokens?
- Can owner drain liquidity?
- Is trading restricted?
- Is contract verified on Etherscan?

**Primary API**: GoPlus Labs API (industry standard used by wallets & DEXs)
- Endpoint: `https://api.gopluslabs.io/api/v1/token_security/{chain_id}?contract_addresses={address}`
- Returns: rug pull risk, honeypot status, ownership privileges

### 4. Honeypot Detection
**Method**:
1. Simulate buy transaction using eth_call
2. Simulate sell transaction using eth_call  
3. Compare gas usage and revert behavior
4. Flag if buy succeeds but sell fails

**Implementation**:
- GoPlus honeypot endpoint
- Tenderly simulation (free tier)
- Direct eth_call with sell path testing

### 5. Liquidity Lock Check
**Why Critical**: Unlocked liquidity = instant rug risk

**Verification Steps**:
1. Check LP token holder addresses
2. Verify lock contract (Unicrypt, TeamFinance, etc.)
3. Validate lock duration and terms
4. Confirm lock cannot be bypassed

**Data Sources**:
- Etherscan API for LP token analysis
- DexTools (read-only endpoints)
- GoPlus Labs liquidity lock status

### 6. Gas Fee Estimation & Optimization
**Formula**: `Estimated Gas Cost = Gas Limit × Gas Price`

**Optimization Strategy**:
- Route transactions via gasless relayers when possible
- Use cheapest compatible chain
- Reject transactions if gas > threshold
- Implement zero base fee routing

**APIs**:
- Etherscan Gas Tracker for live gas prices
- Alchemy/Infura for gas estimates
- 0x/1inch for gas-aware routing

### 7. Transaction Simulation (BEFORE EXECUTION)
**Purpose**: Guarantee transaction will not fail

**Process**:
1. Use eth_call for static simulation
2. Simulate swap and approval transactions
3. Capture and analyze revert reasons
4. Validate expected outputs match simulation

**Tools**:
- Tenderly (limited free tier)
- eth_call (fully free via RPC)
- Foundry Anvil (local simulation)

### 8. MEV & Sandwich Attack Risk
**Risk Factors**:
- Large slippage + public mempool = HIGH RISK
- Thin liquidity + big transaction = HIGH RISK
- Popular trading pairs during high volatility = MEDIUM RISK

**Mitigation**:
- Lower slippage tolerance
- Use private RPC endpoints (Flashbots Protect)
- Split large trades into smaller chunks
- Use 0x private routing when available

### 9. Token Tax/Transfer Fee Detection
**Method**: Compare expected received vs actual received amounts

**Detection**:
```
Expected Received ≠ Actual Received = Hidden Tax Present
```

**API**: GoPlus token tax endpoint returns:
- Buy tax percentage
- Sell tax percentage  
- Transfer tax percentage
- Tax recipient addresses

### 10. Oracle Price Deviation
**Formula**: `Deviation (%) = |DEX Price − Oracle Price| / Oracle Price × 100`

**Purpose**: Prevent price manipulation attacks

**Thresholds**:
- < 2%: SAFE
- 2-5%: CAUTION  
- > 5%: HIGH RISK (reject or require human approval)

**Data Sources**:
- Chainlink price feeds (primary)
- CoinGecko API (secondary)
- Multiple DEX price aggregation

## Agent Decision Pipeline

```
Intent → Quote → Slippage → Liquidity → Rug Check → Simulation → Risk Score → Execute (testnet only)
```

## Hard Safety Rules

1. **If ANY critical check fails → auto-reject transaction**
2. **If risk = HIGH → require alternative approach**  
3. **Never bypass safety to "complete task"**
4. **All DeFi operations in sandbox/testnet only**
5. **Human approval required for mainnet transactions**

## API Rate Limiting & Fallbacks

**Rate Limit Handling**:
- Implement exponential backoff (1s, 2s, 4s, 8s)
- Use multiple API keys when available
- Cache results for repeated queries
- Graceful degradation with reduced functionality

**Fallback Strategy**:
- Primary: GoPlus Labs → Secondary: Manual contract analysis
- Primary: 0x API → Secondary: 1inch API → Tertiary: Direct DEX calls
- Primary: Tenderly → Secondary: eth_call simulation

## Compliance & Audit Requirements

**Logging Requirements**:
- Log all safety calculations with inputs/outputs
- Record API responses and timestamps
- Document risk assessment reasoning
- Maintain audit trail for all decisions

**Reporting**:
- Generate safety reports for each transaction
- Include risk scores and mitigation measures
- Document any overrides or exceptions
- Provide compliance evidence for audits

## Emergency Procedures

**If Safety System Fails**:
1. Immediately halt all DeFi operations
2. Alert human operators
3. Log failure details for investigation
4. Require manual safety verification
5. Do not resume until system is verified safe

**Critical Alerts**:
- Rug pull detected in active position
- Honeypot behavior in transaction path
- Oracle price manipulation detected
- Sandwich attack in progress
- Liquidity drain event detected

This steering ensures all DeFi operations undergo comprehensive safety validation using industry-standard APIs and calculations, maintaining the highest security standards for autonomous financial operations.