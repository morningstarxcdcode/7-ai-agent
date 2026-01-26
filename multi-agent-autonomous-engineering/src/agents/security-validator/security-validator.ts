/**
 * Security & DeFi Validator Agent Implementation
 * Validates code security, DeFi-specific vulnerabilities, and compliance
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, DeFi Safety
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseAgentImpl, BaseAgentConfig } from '../../core/base-agent';
import { AgentType, AgentId, RiskLevel } from '../../types/core';
import {
  SecurityValidatorAgent,
  Code,
  CodeFile,
  SecurityReport,
  Vulnerability,
  Mitigation,
  ComplianceCheck,
  ComplianceReport,
  DeFiSafetyCheck,
  DeFiSafetyReport,
  SlippageCalculation,
  RugPullIndicator,
  MEVRisk
} from '../../types/agents';

export interface SecurityValidatorConfig extends BaseAgentConfig {
  severityThreshold: RiskLevel;
  defiValidationEnabled: boolean;
  maxSlippagePercent: number;
  mevProtectionRequired: boolean;
  auditTrailEnabled: boolean;
  complianceFrameworks: string[];
}

// Security vulnerability patterns
const SECURITY_PATTERNS: Array<{
  id: string;
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  cwe?: string;
  mitigation: string;
}> = [
  // Critical vulnerabilities
  {
    id: 'SEC001',
    name: 'SQL Injection',
    pattern: /(?:execute|query)\s*\([^)]*\+[^)]*\)|(?:execute|query)\s*\([^)]*\$\{[^}]*\}[^)]*\)/i,
    severity: 'critical',
    category: 'injection',
    description: 'Potential SQL injection vulnerability detected',
    cwe: 'CWE-89',
    mitigation: 'Use parameterized queries or prepared statements'
  },
  {
    id: 'SEC002',
    name: 'Command Injection',
    pattern: /(?:exec|spawn|system)\s*\([^)]*\+[^)]*\)|(?:exec|spawn|system)\s*\([^)]*\$\{[^}]*\}[^)]*\)/i,
    severity: 'critical',
    category: 'injection',
    description: 'Potential command injection vulnerability detected',
    cwe: 'CWE-78',
    mitigation: 'Sanitize user input and avoid shell commands'
  },
  {
    id: 'SEC003',
    name: 'Hardcoded Secrets',
    pattern: /(?:password|secret|api[_-]?key|private[_-]?key|token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    severity: 'critical',
    category: 'secrets',
    description: 'Hardcoded secret or credential detected',
    cwe: 'CWE-798',
    mitigation: 'Use environment variables or secure vault'
  },
  // High severity
  {
    id: 'SEC004',
    name: 'XSS Vulnerability',
    pattern: /innerHTML\s*=|document\.write\s*\(|\.html\s*\([^)]*\+/i,
    severity: 'high',
    category: 'xss',
    description: 'Potential cross-site scripting vulnerability',
    cwe: 'CWE-79',
    mitigation: 'Sanitize user input and use safe DOM manipulation'
  },
  {
    id: 'SEC005',
    name: 'Path Traversal',
    pattern: /(?:readFile|writeFile|appendFile|open)\s*\([^)]*\+[^)]*\)/i,
    severity: 'high',
    category: 'path-traversal',
    description: 'Potential path traversal vulnerability',
    cwe: 'CWE-22',
    mitigation: 'Validate and sanitize file paths'
  },
  {
    id: 'SEC006',
    name: 'Insecure Randomness',
    pattern: /Math\.random\s*\(\)/,
    severity: 'high',
    category: 'cryptography',
    description: 'Insecure random number generation',
    cwe: 'CWE-330',
    mitigation: 'Use crypto.randomBytes() for security-critical operations'
  },
  // Medium severity
  {
    id: 'SEC007',
    name: 'Missing Input Validation',
    pattern: /req\.(?:body|query|params)\.\w+(?!\s*(?:\?\.|&&|\|\|))/,
    severity: 'medium',
    category: 'validation',
    description: 'User input used without validation',
    cwe: 'CWE-20',
    mitigation: 'Validate and sanitize all user inputs'
  },
  {
    id: 'SEC008',
    name: 'Insecure Cookie',
    pattern: /cookie[^;]*(?!.*(?:httpOnly|secure|sameSite))/i,
    severity: 'medium',
    category: 'session',
    description: 'Cookie without security flags',
    cwe: 'CWE-614',
    mitigation: 'Set httpOnly, secure, and sameSite flags'
  },
  // Low severity
  {
    id: 'SEC009',
    name: 'Console Log in Production',
    pattern: /console\.(?:log|debug|info)\s*\(/,
    severity: 'low',
    category: 'information-disclosure',
    description: 'Debug logging in production code',
    mitigation: 'Remove or disable debug logging in production'
  }
];

// DeFi-specific vulnerability patterns
const DEFI_PATTERNS: Array<{
  id: string;
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  mitigation: string;
}> = [
  {
    id: 'DEFI001',
    name: 'Reentrancy',
    pattern: /\.call\{value:.*\}.*\(.*\)[\s\S]{0,200}(?:balances?|amount|total)\s*[-+]=?/i,
    severity: 'critical',
    category: 'reentrancy',
    description: 'State change after external call - reentrancy vulnerability',
    mitigation: 'Use ReentrancyGuard or checks-effects-interactions pattern'
  },
  {
    id: 'DEFI002',
    name: 'Unchecked Return Value',
    pattern: /\.(?:call|send|transfer)\s*\([^)]*\)\s*(?!;?\s*(?:require|if|assert|bool))/,
    severity: 'critical',
    category: 'error-handling',
    description: 'External call return value not checked',
    mitigation: 'Always check return values: require(success, "Call failed")'
  },
  {
    id: 'DEFI003',
    name: 'Flash Loan Attack Vector',
    pattern: /(?:flashLoan|flashBorrow)[\s\S]*(?:getReserves|price|oracle)/i,
    severity: 'critical',
    category: 'flash-loan',
    description: 'Potential flash loan attack vector',
    mitigation: 'Use time-weighted average prices (TWAP) for price oracles'
  },
  {
    id: 'DEFI004',
    name: 'Missing Slippage Protection',
    pattern: /(?:swap|exchange|trade)[\s\S]{0,300}(?!minAmount|slippage|deadline)/i,
    severity: 'high',
    category: 'slippage',
    description: 'Swap operation without slippage protection',
    mitigation: 'Add minAmountOut parameter and deadline check'
  },
  {
    id: 'DEFI005',
    name: 'Centralization Risk',
    pattern: /onlyOwner|require\s*\(\s*msg\.sender\s*==\s*owner/,
    severity: 'medium',
    category: 'centralization',
    description: 'Centralized control - single point of failure',
    mitigation: 'Implement multi-sig or governance for critical functions'
  },
  {
    id: 'DEFI006',
    name: 'Integer Overflow/Underflow',
    pattern: /(?:\+\+|\-\-|\+=|\-=|\*=)(?!.*(?:SafeMath|unchecked|0\.8))/,
    severity: 'high',
    category: 'arithmetic',
    description: 'Potential integer overflow/underflow',
    mitigation: 'Use Solidity 0.8+ or SafeMath library'
  },
  {
    id: 'DEFI007',
    name: 'Front-Running Vulnerability',
    pattern: /(?:approve|transfer|swap)[\s\S]{0,100}(?!deadline|nonce)/i,
    severity: 'high',
    category: 'mev',
    description: 'Transaction may be front-run',
    mitigation: 'Add deadline parameter and consider commit-reveal schemes'
  },
  {
    id: 'DEFI008',
    name: 'Oracle Manipulation',
    pattern: /(?:getPrice|latestAnswer|getReserves)[\s\S]{0,50}(?!twap|average)/i,
    severity: 'high',
    category: 'oracle',
    description: 'Price oracle may be manipulated',
    mitigation: 'Use TWAP oracles and multiple price sources'
  },
  {
    id: 'DEFI009',
    name: 'Rug Pull Indicator',
    pattern: /(?:mint|burn)\s*\([^)]*\)[\s\S]{0,50}onlyOwner|withdraw[\s\S]{0,50}(?:all|total)/i,
    severity: 'critical',
    category: 'rug-pull',
    description: 'Contract has rug pull indicators',
    mitigation: 'Review token economics and owner privileges'
  }
];

// Compliance frameworks
const COMPLIANCE_RULES: Record<string, Array<{
  id: string;
  name: string;
  check: (code: string) => boolean;
  description: string;
}>> = {
  'OWASP': [
    {
      id: 'OWASP-A01',
      name: 'Broken Access Control',
      check: (code) => /(?:isAdmin|isOwner|role)\s*=/.test(code) && !/require|assert|modifier/.test(code),
      description: 'Check for proper access control implementation'
    },
    {
      id: 'OWASP-A02',
      name: 'Cryptographic Failures',
      check: (code) => /md5|sha1|des|rc4/i.test(code),
      description: 'Check for weak cryptographic algorithms'
    },
    {
      id: 'OWASP-A03',
      name: 'Injection',
      check: (code) => /execute|query|eval|exec/.test(code) && /\+|\$\{/.test(code),
      description: 'Check for injection vulnerabilities'
    }
  ],
  'SOC2': [
    {
      id: 'SOC2-CC6.1',
      name: 'Logical Access Controls',
      check: (code) => !/authentication|authorization|rbac|role/i.test(code),
      description: 'Logical access security controls'
    },
    {
      id: 'SOC2-CC6.6',
      name: 'System Operations',
      check: (code) => !/logging|audit|monitor/i.test(code),
      description: 'System operations security'
    }
  ],
  'DEFI': [
    {
      id: 'DEFI-001',
      name: 'Reentrancy Protection',
      check: (code) => /\.call\{/.test(code) && !/ReentrancyGuard|nonReentrant|mutex/i.test(code),
      description: 'Check for reentrancy protection'
    },
    {
      id: 'DEFI-002',
      name: 'Slippage Protection',
      check: (code) => /swap|exchange/i.test(code) && !/minAmount|slippage/i.test(code),
      description: 'Check for slippage protection'
    },
    {
      id: 'DEFI-003',
      name: 'Access Control',
      check: (code) => /onlyOwner/.test(code) && !/multi-?sig|timelock|governance/i.test(code),
      description: 'Check for decentralized access control'
    }
  ]
};

export class SecurityValidatorAgentImpl extends BaseAgentImpl implements SecurityValidatorAgent {
  private securityConfig: SecurityValidatorConfig;
  private scanHistory: SecurityReport[] = [];
  private defiReports: DeFiSafetyReport[] = [];

  constructor(config: Partial<SecurityValidatorConfig> = {}) {
    const fullConfig: SecurityValidatorConfig = {
      id: config.id || uuidv4(),
      name: config.name || 'Security & DeFi Validator Agent',
      type: AgentType.SECURITY_VALIDATOR,
      version: config.version || '1.0.0',
      capabilities: [
        'vulnerability_scanning',
        'defi_validation',
        'compliance_checking',
        'slippage_calculation',
        'rug_pull_detection',
        'mev_risk_analysis'
      ],
      maxConcurrentTasks: config.maxConcurrentTasks || 2,
      timeoutMs: config.timeoutMs || 60000,
      enableSandbox: config.enableSandbox ?? true,
      severityThreshold: config.severityThreshold || RiskLevel.MEDIUM,
      defiValidationEnabled: config.defiValidationEnabled ?? true,
      maxSlippagePercent: config.maxSlippagePercent || 3.0,
      mevProtectionRequired: config.mevProtectionRequired ?? true,
      auditTrailEnabled: config.auditTrailEnabled ?? true,
      complianceFrameworks: config.complianceFrameworks || ['OWASP', 'DEFI']
    };

    super(fullConfig);
    this.securityConfig = fullConfig;
  }

  protected async onInitialize(): Promise<void> {
    this.emit('security-validator-initialized');
  }

  protected async onShutdown(): Promise<void> {
    this.scanHistory = [];
    this.defiReports = [];
  }

  protected async onHealthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message?: string; lastCheck: Date }> {
    return {
      status: 'healthy',
      message: `Scans performed: ${this.scanHistory.length}`,
      lastCheck: new Date()
    };
  }

  protected async handleRequest(message: Record<string, unknown>): Promise<unknown> {
    const action = message['action'] as string;
    const payload = message['payload'] as Record<string, unknown>;
    
    switch (action) {
      case 'scan_vulnerabilities':
        return this.scanVulnerabilities(payload['code'] as any);
      case 'check_compliance':
        return this.checkCompliance(payload['code'] as any, payload['frameworks'] as string[]);
      case 'validate_defi':
        return this.validateDeFiSafety(payload['code'] as any);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  protected async handleEvent(message: Record<string, unknown>): Promise<void> {
    this.emit('event-received', message);
  }

  protected async handleError(message: Record<string, unknown>): Promise<void> {
    this.emit('error-received', message);
  }

  /**
   * Scan code for security vulnerabilities
   * Requirement 5.1: Comprehensive vulnerability scanning
   */
  public async scanVulnerabilities(code: Code): Promise<SecurityReport> {
    const vulnerabilities: Vulnerability[] = [];
    const mitigations: Mitigation[] = [];

    for (const file of code.files) {
      // General security patterns
      const secVulns = this.scanSecurityPatterns(file);
      vulnerabilities.push(...secVulns);

      // DeFi-specific patterns
      if (this.securityConfig.defiValidationEnabled && this.isDeFiFile(file)) {
        const defiVulns = this.scanDeFiPatterns(file);
        vulnerabilities.push(...defiVulns);
      }

      // Custom security checks
      const customVulns = await this.runCustomSecurityChecks(file);
      vulnerabilities.push(...customVulns);
    }

    // Generate mitigations for each vulnerability
    for (const vuln of vulnerabilities) {
      const mitigation = this.generateMitigation(vuln);
      mitigations.push(mitigation);
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(vulnerabilities);

    const report: SecurityReport = {
      scanId: uuidv4(),
      timestamp: new Date(),
      code: code,
      vulnerabilities,
      mitigations,
      riskScore,
      summary: this.generateSummary(vulnerabilities),
      recommendations: this.generateRecommendations(vulnerabilities),
      passed: riskScore <= this.getRiskThreshold()
    };

    this.scanHistory.push(report);
    this.emit('security-scan-complete', report);

    return report;
  }

  /**
   * Check compliance with frameworks
   * Requirement 5.3: Compliance verification
   */
  public async checkCompliance(code: Code, frameworks: string[]): Promise<ComplianceReport> {
    const checks: ComplianceCheck[] = [];
    const frameworksToCheck = frameworks.length > 0 ? frameworks : this.securityConfig.complianceFrameworks;

    for (const framework of frameworksToCheck) {
      const rules = COMPLIANCE_RULES[framework] || [];
      
      for (const rule of rules) {
        const codeContent = code.files.map(f => f.content).join('\n');
        const passed = !rule.check(codeContent);
        
        checks.push({
          framework,
          ruleId: rule.id,
          ruleName: rule.name,
          description: rule.description,
          passed,
          severity: passed ? 'info' : 'warning',
          details: passed ? 'Check passed' : `Compliance issue detected: ${rule.description}`
        });
      }
    }

    const passedChecks = checks.filter(c => c.passed).length;
    const totalChecks = checks.length;

    const report: ComplianceReport = {
      reportId: uuidv4(),
      timestamp: new Date(),
      frameworks: frameworksToCheck,
      checks,
      overallScore: totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100,
      passed: passedChecks === totalChecks,
      gaps: checks.filter(c => !c.passed).map(c => ({
        framework: c.framework,
        rule: c.ruleName,
        remediation: `Address ${c.description}`
      }))
    };

    this.emit('compliance-check-complete', report);
    return report;
  }

  /**
   * Validate DeFi safety requirements
   * Requirement: DeFi-specific safety validation
   */
  public async validateDeFiSafety(code: Code): Promise<DeFiSafetyReport> {
    if (!this.securityConfig.defiValidationEnabled) {
      return this.createEmptyDeFiReport();
    }

    const checks: DeFiSafetyCheck[] = [];
    
    // Slippage analysis
    const slippageAnalysis = await this.analyzeSlippage(code);
    checks.push(...slippageAnalysis.checks);

    // Rug pull detection
    const rugPullAnalysis = await this.detectRugPullIndicators(code);
    checks.push(...rugPullAnalysis.checks);

    // MEV risk analysis
    const mevAnalysis = await this.analyzeMEVRisk(code);
    checks.push(...mevAnalysis.checks);

    // Oracle safety
    const oracleAnalysis = await this.analyzeOracleSafety(code);
    checks.push(...oracleAnalysis.checks);

    // Access control analysis
    const accessAnalysis = await this.analyzeAccessControl(code);
    checks.push(...accessAnalysis.checks);

    const report: DeFiSafetyReport = {
      reportId: uuidv4(),
      timestamp: new Date(),
      checks,
      slippageAnalysis,
      rugPullIndicators: rugPullAnalysis.indicators,
      mevRisks: mevAnalysis.risks,
      overallSafetyScore: this.calculateSafetyScore(checks),
      recommendations: this.generateDeFiRecommendations(checks),
      passed: checks.every(c => c.passed || c.severity !== 'critical')
    };

    this.defiReports.push(report);
    this.emit('defi-validation-complete', report);

    return report;
  }

  /**
   * Calculate slippage for a swap operation
   * Requirement: DeFi slippage calculation
   */
  public async calculateSlippage(params: {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    poolLiquidity: bigint;
    currentPrice: number;
  }): Promise<SlippageCalculation> {
    const { tokenIn, tokenOut, amountIn, poolLiquidity, currentPrice } = params;

    // Constant product AMM formula: x * y = k
    // Price impact = amountIn / (poolLiquidity + amountIn)
    const priceImpact = Number(amountIn * BigInt(10000) / (poolLiquidity + amountIn)) / 100;
    
    // Expected output based on current price
    const expectedOutput = Number(amountIn) * currentPrice;
    
    // Actual output accounting for price impact
    const actualOutput = expectedOutput * (1 - priceImpact / 100);
    
    // Slippage percentage
    const slippagePercent = ((expectedOutput - actualOutput) / expectedOutput) * 100;

    // Recommended minimum output (with buffer)
    const recommendedMinOutput = actualOutput * 0.995; // 0.5% buffer

    const isAcceptable = slippagePercent <= this.securityConfig.maxSlippagePercent;

    return {
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      expectedOutput: expectedOutput.toString(),
      estimatedActualOutput: actualOutput.toString(),
      priceImpact,
      slippagePercent,
      recommendedMinOutput: recommendedMinOutput.toString(),
      isAcceptable,
      warnings: isAcceptable ? [] : [
        `Slippage ${slippagePercent.toFixed(2)}% exceeds threshold ${this.securityConfig.maxSlippagePercent}%`
      ]
    };
  }

  /**
   * Detect rug pull indicators
   * Requirement: DeFi rug pull detection
   */
  public async detectRugPull(contractCode: string): Promise<RugPullIndicator[]> {
    const indicators: RugPullIndicator[] = [];

    // Check for honeypot indicators
    if (/function\s+(?:buy|transfer)[\s\S]*revert|return\s+false/i.test(contractCode)) {
      indicators.push({
        type: 'honeypot',
        severity: 'critical',
        description: 'Potential honeypot - transfers may be blocked',
        confidence: 85,
        evidence: 'Transfer function contains revert conditions'
      });
    }

    // Check for unlimited minting
    if (/function\s+mint[\s\S]*(?:onlyOwner|internal)[\s\S]*_mint/i.test(contractCode)) {
      indicators.push({
        type: 'unlimited-mint',
        severity: 'high',
        description: 'Owner can mint unlimited tokens',
        confidence: 90,
        evidence: 'Unrestricted mint function found'
      });
    }

    // Check for hidden fees
    if (/fee\s*=|tax\s*=|(?:buy|sell)Fee/i.test(contractCode) && 
        !/constant|immutable/.test(contractCode)) {
      indicators.push({
        type: 'modifiable-fees',
        severity: 'high',
        description: 'Fees can be modified after deployment',
        confidence: 80,
        evidence: 'Mutable fee variables detected'
      });
    }

    // Check for blacklist functionality
    if (/blacklist|blocklist|ban|exclude/i.test(contractCode)) {
      indicators.push({
        type: 'blacklist',
        severity: 'medium',
        description: 'Contract has blacklist functionality',
        confidence: 95,
        evidence: 'Blacklist/blocklist function or mapping found'
      });
    }

    // Check for pause functionality without timelock
    if (/pause|emergency/i.test(contractCode) && !/timelock/i.test(contractCode)) {
      indicators.push({
        type: 'pausable-no-timelock',
        severity: 'medium',
        description: 'Contract can be paused without timelock',
        confidence: 85,
        evidence: 'Pause functionality without timelock protection'
      });
    }

    // Check for withdraw all funds
    if (/withdraw[\s\S]{0,100}(?:address\(this\)\.balance|token\.balanceOf)/i.test(contractCode)) {
      indicators.push({
        type: 'drain-funds',
        severity: 'critical',
        description: 'Owner can drain all funds',
        confidence: 90,
        evidence: 'Function to withdraw all contract funds found'
      });
    }

    return indicators;
  }

  /**
   * Analyze MEV risk
   * Requirement: DeFi MEV protection
   */
  public async analyzeMEV(transaction: {
    type: string;
    value: bigint;
    data: string;
  }): Promise<MEVRisk> {
    const risks: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check transaction type
    if (/swap|exchange|trade/i.test(transaction.type)) {
      risks.push('Swap transactions are susceptible to sandwich attacks');
      riskLevel = 'high';
    }

    // Check value
    if (transaction.value > BigInt('1000000000000000000')) { // > 1 ETH
      risks.push('High-value transaction increases MEV incentive');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Check for deadline
    if (!/deadline/i.test(transaction.data)) {
      risks.push('No deadline protection detected');
      riskLevel = 'high';
    }

    // Check for slippage protection
    if (!/minAmount|slippage/i.test(transaction.data)) {
      risks.push('No slippage protection detected');
      riskLevel = 'critical';
    }

    return {
      transactionType: transaction.type,
      riskLevel,
      risks,
      recommendations: this.getMEVRecommendations(risks),
      estimatedMEVExposure: this.estimateMEVExposure(transaction, riskLevel)
    };
  }

  // Private helper methods

  private scanSecurityPatterns(file: CodeFile): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    for (const pattern of SECURITY_PATTERNS) {
      const matches = file.content.matchAll(new RegExp(pattern.pattern, 'gm'));
      
      for (const match of matches) {
        vulnerabilities.push({
          id: uuidv4(),
          patternId: pattern.id,
          name: pattern.name,
          severity: pattern.severity,
          category: pattern.category,
          description: pattern.description,
          file: file.path,
          line: this.getLineNumber(file.content, match.index || 0),
          snippet: this.getSnippet(file.content, match.index || 0),
          cwe: pattern.cwe,
          mitigation: pattern.mitigation
        });
      }
    }

    return vulnerabilities;
  }

  private scanDeFiPatterns(file: CodeFile): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    for (const pattern of DEFI_PATTERNS) {
      const matches = file.content.matchAll(new RegExp(pattern.pattern, 'gm'));
      
      for (const match of matches) {
        vulnerabilities.push({
          id: uuidv4(),
          patternId: pattern.id,
          name: pattern.name,
          severity: pattern.severity,
          category: `defi-${pattern.category}`,
          description: pattern.description,
          file: file.path,
          line: this.getLineNumber(file.content, match.index || 0),
          snippet: this.getSnippet(file.content, match.index || 0),
          mitigation: pattern.mitigation
        });
      }
    }

    return vulnerabilities;
  }

  private async runCustomSecurityChecks(file: CodeFile): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    // Check for eval usage
    if (/\beval\s*\(/.test(file.content)) {
      vulnerabilities.push({
        id: uuidv4(),
        patternId: 'CUSTOM001',
        name: 'Dangerous eval Usage',
        severity: 'critical',
        category: 'code-execution',
        description: 'Use of eval() can lead to code injection',
        file: file.path,
        line: this.getLineNumber(file.content, file.content.indexOf('eval')),
        mitigation: 'Avoid eval() - use safer alternatives like JSON.parse()'
      });
    }

    // Check for prototype pollution
    if (/\[.*\]\s*=\s*.*__proto__|Object\.assign\s*\([^,]*,\s*(?:req\.body|req\.query)/i.test(file.content)) {
      vulnerabilities.push({
        id: uuidv4(),
        patternId: 'CUSTOM002',
        name: 'Prototype Pollution',
        severity: 'high',
        category: 'prototype-pollution',
        description: 'Potential prototype pollution vulnerability',
        file: file.path,
        line: 1,
        mitigation: 'Use Object.create(null) or validate object keys'
      });
    }

    return vulnerabilities;
  }

  private isDeFiFile(file: CodeFile): boolean {
    const defiIndicators = [
      /\.sol$/i,
      /swap|liquidity|pool|stake|yield|farm|vault|token|uniswap|aave|compound/i,
      /pragma\s+solidity/i,
      /erc20|erc721|erc1155/i
    ];

    return defiIndicators.some(pattern => 
      pattern.test(file.path) || pattern.test(file.content)
    );
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private getSnippet(content: string, index: number, context: number = 50): string {
    const start = Math.max(0, index - context);
    const end = Math.min(content.length, index + context);
    return content.substring(start, end).trim();
  }

  private generateMitigation(vuln: Vulnerability): Mitigation {
    return {
      vulnerabilityId: vuln.id,
      description: vuln.mitigation || `Address ${vuln.name} vulnerability`,
      effort: this.estimateEffort(vuln.severity),
      priority: this.mapSeverityToPriority(vuln.severity),
      codeExample: this.getCodeExample(vuln)
    };
  }

  private estimateEffort(severity: string): 'low' | 'medium' | 'high' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  private mapSeverityToPriority(severity: string): number {
    switch (severity) {
      case 'critical': return 1;
      case 'high': return 2;
      case 'medium': return 3;
      default: return 4;
    }
  }

  private getCodeExample(vuln: Vulnerability): string {
    const examples: Record<string, string> = {
      'SQL Injection': 'Use parameterized queries: db.query("SELECT * FROM users WHERE id = ?", [userId])',
      'Reentrancy': 'Use ReentrancyGuard: modifier nonReentrant() { require(!locked); locked = true; _; locked = false; }',
      'Missing Slippage Protection': 'Add minimum amount: function swap(uint amountIn, uint minAmountOut, uint deadline)'
    };

    return examples[vuln.name] || 'See security documentation for remediation guidance';
  }

  private calculateRiskScore(vulnerabilities: Vulnerability[]): number {
    const weights = { critical: 100, high: 50, medium: 20, low: 5 };
    
    const totalWeight = vulnerabilities.reduce((sum, v) => {
      return sum + (weights[v.severity as keyof typeof weights] || 0);
    }, 0);

    // Score from 0-100 where 100 is most risky
    return Math.min(100, totalWeight);
  }

  private getRiskThreshold(): number {
    const thresholds = {
      [RiskLevel.LOW]: 80,
      [RiskLevel.MEDIUM]: 50,
      [RiskLevel.HIGH]: 30,
      [RiskLevel.CRITICAL]: 10
    };

    return thresholds[this.securityConfig.severityThreshold] || 50;
  }

  private generateSummary(vulnerabilities: Vulnerability[]): string {
    const critical = vulnerabilities.filter(v => v.severity === 'critical').length;
    const high = vulnerabilities.filter(v => v.severity === 'high').length;
    const medium = vulnerabilities.filter(v => v.severity === 'medium').length;
    const low = vulnerabilities.filter(v => v.severity === 'low').length;

    return `Found ${vulnerabilities.length} vulnerabilities: ${critical} critical, ${high} high, ${medium} medium, ${low} low`;
  }

  private generateRecommendations(vulnerabilities: Vulnerability[]): string[] {
    const recommendations: string[] = [];

    if (vulnerabilities.some(v => v.category === 'injection')) {
      recommendations.push('Implement input validation and parameterized queries');
    }

    if (vulnerabilities.some(v => v.category === 'secrets')) {
      recommendations.push('Move secrets to environment variables or secure vault');
    }

    if (vulnerabilities.some(v => v.category.includes('defi'))) {
      recommendations.push('Review DeFi security best practices and consider professional audit');
    }

    return recommendations;
  }

  private createEmptyDeFiReport(): DeFiSafetyReport {
    return {
      reportId: uuidv4(),
      timestamp: new Date(),
      checks: [],
      slippageAnalysis: { checks: [] },
      rugPullIndicators: [],
      mevRisks: [],
      overallSafetyScore: 100,
      recommendations: [],
      passed: true
    };
  }

  private async analyzeSlippage(code: Code): Promise<{ checks: DeFiSafetyCheck[] }> {
    const checks: DeFiSafetyCheck[] = [];

    for (const file of code.files) {
      if (/swap|exchange/i.test(file.content)) {
        const hasSlippageProtection = /minAmount|slippage|minOut/i.test(file.content);
        
        checks.push({
          checkId: 'SLIPPAGE001',
          name: 'Slippage Protection',
          passed: hasSlippageProtection,
          severity: hasSlippageProtection ? 'info' : 'high',
          description: hasSlippageProtection 
            ? 'Slippage protection implemented'
            : 'Missing slippage protection in swap operation',
          file: file.path
        });
      }
    }

    return { checks };
  }

  private async detectRugPullIndicators(code: Code): Promise<{ checks: DeFiSafetyCheck[]; indicators: RugPullIndicator[] }> {
    const checks: DeFiSafetyCheck[] = [];
    let allIndicators: RugPullIndicator[] = [];

    for (const file of code.files) {
      if (this.isDeFiFile(file)) {
        const indicators = await this.detectRugPull(file.content);
        allIndicators = [...allIndicators, ...indicators];

        const hasCriticalIndicators = indicators.some(i => i.severity === 'critical');
        
        checks.push({
          checkId: 'RUGPULL001',
          name: 'Rug Pull Risk Assessment',
          passed: !hasCriticalIndicators,
          severity: hasCriticalIndicators ? 'critical' : 'info',
          description: hasCriticalIndicators
            ? `Found ${indicators.length} rug pull indicators`
            : 'No critical rug pull indicators found',
          file: file.path
        });
      }
    }

    return { checks, indicators: allIndicators };
  }

  private async analyzeMEVRisk(code: Code): Promise<{ checks: DeFiSafetyCheck[]; risks: MEVRisk[] }> {
    const checks: DeFiSafetyCheck[] = [];
    const risks: MEVRisk[] = [];

    for (const file of code.files) {
      if (/swap|exchange|trade/i.test(file.content)) {
        const hasDeadline = /deadline/i.test(file.content);
        const hasSlippage = /minAmount|slippage/i.test(file.content);

        const riskLevel = !hasDeadline && !hasSlippage ? 'critical' 
          : !hasDeadline || !hasSlippage ? 'high' : 'low';

        checks.push({
          checkId: 'MEV001',
          name: 'MEV Protection',
          passed: riskLevel === 'low',
          severity: riskLevel,
          description: `MEV protection: deadline=${hasDeadline}, slippage=${hasSlippage}`,
          file: file.path
        });

        if (riskLevel !== 'low') {
          risks.push({
            transactionType: 'swap',
            riskLevel,
            risks: [
              !hasDeadline ? 'Missing deadline protection' : '',
              !hasSlippage ? 'Missing slippage protection' : ''
            ].filter(Boolean),
            recommendations: this.getMEVRecommendations([]),
            estimatedMEVExposure: '0'
          });
        }
      }
    }

    return { checks, risks };
  }

  private async analyzeOracleSafety(code: Code): Promise<{ checks: DeFiSafetyCheck[] }> {
    const checks: DeFiSafetyCheck[] = [];

    for (const file of code.files) {
      if (/oracle|getPrice|latestAnswer/i.test(file.content)) {
        const usesTWAP = /twap|average|accumulator/i.test(file.content);
        const usesMultipleSources = /chainlink.*uniswap|multiple.*oracles?/i.test(file.content);

        checks.push({
          checkId: 'ORACLE001',
          name: 'Oracle Manipulation Protection',
          passed: usesTWAP || usesMultipleSources,
          severity: usesTWAP || usesMultipleSources ? 'info' : 'high',
          description: usesTWAP ? 'Uses TWAP oracle' 
            : usesMultipleSources ? 'Uses multiple price sources'
            : 'Single-block price oracle may be manipulated',
          file: file.path
        });
      }
    }

    return { checks };
  }

  private async analyzeAccessControl(code: Code): Promise<{ checks: DeFiSafetyCheck[] }> {
    const checks: DeFiSafetyCheck[] = [];

    for (const file of code.files) {
      if (/onlyOwner|owner\(\)/i.test(file.content)) {
        const hasMultiSig = /multi-?sig|gnosis/i.test(file.content);
        const hasTimelock = /timelock/i.test(file.content);
        const hasGovernance = /governance|dao|vote/i.test(file.content);

        const isDecentralized = hasMultiSig || hasTimelock || hasGovernance;

        checks.push({
          checkId: 'ACCESS001',
          name: 'Decentralized Access Control',
          passed: isDecentralized,
          severity: isDecentralized ? 'info' : 'medium',
          description: isDecentralized
            ? 'Has decentralized access control mechanisms'
            : 'Single owner control - consider adding multi-sig or timelock',
          file: file.path
        });
      }
    }

    return { checks };
  }

  private calculateSafetyScore(checks: DeFiSafetyCheck[]): number {
    if (checks.length === 0) return 100;

    const weights = { critical: 0, high: 0.5, medium: 0.75, low: 0.9, info: 1 };
    const passedWeight = checks.reduce((sum, c) => {
      return sum + (c.passed ? 1 : (weights[c.severity as keyof typeof weights] || 0.5));
    }, 0);

    return Math.round((passedWeight / checks.length) * 100);
  }

  private generateDeFiRecommendations(checks: DeFiSafetyCheck[]): string[] {
    const recommendations: string[] = [];

    const failedChecks = checks.filter(c => !c.passed);
    
    for (const check of failedChecks) {
      if (check.checkId.includes('SLIPPAGE')) {
        recommendations.push('Add minAmountOut parameter and deadline to swap functions');
      }
      if (check.checkId.includes('RUGPULL')) {
        recommendations.push('Review and limit owner privileges, consider adding timelock');
      }
      if (check.checkId.includes('MEV')) {
        recommendations.push('Implement deadline and slippage protection for MEV resistance');
      }
      if (check.checkId.includes('ORACLE')) {
        recommendations.push('Use TWAP oracles and multiple price sources');
      }
      if (check.checkId.includes('ACCESS')) {
        recommendations.push('Implement multi-sig or governance for critical functions');
      }
    }

    return [...new Set(recommendations)];
  }

  private getMEVRecommendations(risks: string[]): string[] {
    return [
      'Add deadline parameter to transactions',
      'Implement slippage protection with minAmountOut',
      'Consider using private transaction pools (Flashbots)',
      'Use commit-reveal schemes for sensitive operations'
    ];
  }

  private estimateMEVExposure(transaction: any, riskLevel: string): string {
    // Simplified estimation
    const value = BigInt(transaction.value || 0);
    const multipliers = { low: 0.001, medium: 0.01, high: 0.05, critical: 0.1 };
    const multiplier = multipliers[riskLevel as keyof typeof multipliers] || 0.01;
    
    return (Number(value) * multiplier).toString();
  }
}

// Factory function
export function createSecurityValidatorAgent(config?: Partial<SecurityValidatorConfig>): SecurityValidatorAgentImpl {
  return new SecurityValidatorAgentImpl(config);
}
