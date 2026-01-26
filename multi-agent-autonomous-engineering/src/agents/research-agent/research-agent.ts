/**
 * Knowledge & Research Agent Implementation
 * Gathers knowledge, researches solutions, and provides contextual information
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseAgentImpl, BaseAgentConfig } from '../../core/base-agent';
import { AgentType, AgentId, RiskLevel } from '../../types/core';
import {
  ResearchAgent,
  ResearchQuery,
  ResearchResult,
  KnowledgeBase,
  KnowledgeEntry,
  BestPractice,
  PatternRecommendation,
  Documentation,
  TechnologyAnalysis,
  CompetitorAnalysis,
  TrendAnalysis
} from '../../types/agents';

export interface ResearchAgentConfig extends BaseAgentConfig {
  maxSearchResults: number;
  cacheEnabled: boolean;
  cacheTTLMs: number;
  trustedSources: string[];
  enableAISearch: boolean;
  enableCodeSearch: boolean;
}

// Knowledge categories
type KnowledgeCategory = 
  | 'best-practices'
  | 'patterns'
  | 'security'
  | 'performance'
  | 'architecture'
  | 'testing'
  | 'defi'
  | 'blockchain';

// Built-in knowledge base
const BUILT_IN_KNOWLEDGE: Record<KnowledgeCategory, KnowledgeEntry[]> = {
  'best-practices': [
    {
      id: 'bp-001',
      category: 'best-practices',
      title: 'SOLID Principles',
      content: 'Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, Dependency Inversion',
      tags: ['oop', 'design', 'architecture'],
      confidence: 95,
      sources: ['Clean Code', 'SOLID Principles'],
      lastUpdated: new Date()
    },
    {
      id: 'bp-002',
      category: 'best-practices',
      title: 'DRY Principle',
      content: "Don't Repeat Yourself - Every piece of knowledge must have a single, unambiguous representation",
      tags: ['design', 'maintainability'],
      confidence: 95,
      sources: ['The Pragmatic Programmer'],
      lastUpdated: new Date()
    },
    {
      id: 'bp-003',
      category: 'best-practices',
      title: 'Error Handling',
      content: 'Use exceptions for exceptional cases, validate inputs early, provide meaningful error messages',
      tags: ['error-handling', 'resilience'],
      confidence: 90,
      sources: ['Clean Code'],
      lastUpdated: new Date()
    }
  ],
  'patterns': [
    {
      id: 'pat-001',
      category: 'patterns',
      title: 'Factory Pattern',
      content: 'Creates objects without exposing instantiation logic, referring to the newly created object through a common interface',
      tags: ['creational', 'design-pattern'],
      confidence: 95,
      sources: ['Design Patterns: GoF'],
      lastUpdated: new Date()
    },
    {
      id: 'pat-002',
      category: 'patterns',
      title: 'Observer Pattern',
      content: 'Defines one-to-many dependency between objects so that when one changes state, all dependents are notified',
      tags: ['behavioral', 'design-pattern', 'event-driven'],
      confidence: 95,
      sources: ['Design Patterns: GoF'],
      lastUpdated: new Date()
    },
    {
      id: 'pat-003',
      category: 'patterns',
      title: 'Repository Pattern',
      content: 'Mediates between domain and data mapping layers, acting like an in-memory collection of domain objects',
      tags: ['data-access', 'architecture'],
      confidence: 90,
      sources: ['Patterns of Enterprise Application Architecture'],
      lastUpdated: new Date()
    }
  ],
  'security': [
    {
      id: 'sec-001',
      category: 'security',
      title: 'Input Validation',
      content: 'Always validate and sanitize user input. Use allowlists over denylists. Validate on server side.',
      tags: ['security', 'validation', 'owasp'],
      confidence: 98,
      sources: ['OWASP'],
      lastUpdated: new Date()
    },
    {
      id: 'sec-002',
      category: 'security',
      title: 'Authentication Best Practices',
      content: 'Use strong password policies, implement MFA, secure session management, use secure token storage',
      tags: ['security', 'authentication', 'owasp'],
      confidence: 95,
      sources: ['OWASP'],
      lastUpdated: new Date()
    },
    {
      id: 'sec-003',
      category: 'security',
      title: 'Secure Communication',
      content: 'Use TLS 1.3, implement certificate pinning for mobile, use HSTS, secure all API endpoints',
      tags: ['security', 'encryption', 'tls'],
      confidence: 95,
      sources: ['OWASP', 'NIST'],
      lastUpdated: new Date()
    }
  ],
  'performance': [
    {
      id: 'perf-001',
      category: 'performance',
      title: 'Database Optimization',
      content: 'Use indexes strategically, optimize queries, implement connection pooling, consider caching',
      tags: ['database', 'performance', 'optimization'],
      confidence: 90,
      sources: ['High Performance MySQL'],
      lastUpdated: new Date()
    },
    {
      id: 'perf-002',
      category: 'performance',
      title: 'Caching Strategies',
      content: 'Implement multi-level caching (L1/L2), use cache invalidation strategies, consider CDN for static assets',
      tags: ['caching', 'performance'],
      confidence: 90,
      sources: ['Designing Data-Intensive Applications'],
      lastUpdated: new Date()
    }
  ],
  'architecture': [
    {
      id: 'arch-001',
      category: 'architecture',
      title: 'Microservices',
      content: 'Decompose by business capability, implement API gateway, use service mesh for communication',
      tags: ['microservices', 'distributed-systems'],
      confidence: 85,
      sources: ['Building Microservices'],
      lastUpdated: new Date()
    },
    {
      id: 'arch-002',
      category: 'architecture',
      title: 'Event-Driven Architecture',
      content: 'Use message queues for decoupling, implement event sourcing, consider CQRS for complex domains',
      tags: ['event-driven', 'messaging', 'cqrs'],
      confidence: 85,
      sources: ['Enterprise Integration Patterns'],
      lastUpdated: new Date()
    }
  ],
  'testing': [
    {
      id: 'test-001',
      category: 'testing',
      title: 'Test Pyramid',
      content: 'Many unit tests, fewer integration tests, even fewer E2E tests. Fast feedback at lower levels.',
      tags: ['testing', 'tdd'],
      confidence: 90,
      sources: ['Succeeding with Agile'],
      lastUpdated: new Date()
    },
    {
      id: 'test-002',
      category: 'testing',
      title: 'Property-Based Testing',
      content: 'Generate random inputs to find edge cases. Useful for pure functions and data transformations.',
      tags: ['testing', 'property-based'],
      confidence: 85,
      sources: ['fast-check documentation'],
      lastUpdated: new Date()
    }
  ],
  'defi': [
    {
      id: 'defi-001',
      category: 'defi',
      title: 'AMM Mechanics',
      content: 'Automated Market Makers use constant product formula (x*y=k). Price impact proportional to trade size.',
      tags: ['defi', 'amm', 'liquidity'],
      confidence: 95,
      sources: ['Uniswap Whitepaper'],
      lastUpdated: new Date()
    },
    {
      id: 'defi-002',
      category: 'defi',
      title: 'Flash Loan Protection',
      content: 'Use TWAP oracles, implement minimum holding periods, check for same-block manipulation',
      tags: ['defi', 'security', 'flash-loans'],
      confidence: 90,
      sources: ['DeFi Security Best Practices'],
      lastUpdated: new Date()
    },
    {
      id: 'defi-003',
      category: 'defi',
      title: 'Reentrancy Prevention',
      content: 'Use checks-effects-interactions pattern, ReentrancyGuard, and pull over push for payments',
      tags: ['defi', 'security', 'solidity'],
      confidence: 95,
      sources: ['OpenZeppelin'],
      lastUpdated: new Date()
    },
    {
      id: 'defi-004',
      category: 'defi',
      title: 'Slippage Protection',
      content: 'Always implement minAmountOut, use deadline parameter, calculate expected slippage',
      tags: ['defi', 'trading', 'protection'],
      confidence: 95,
      sources: ['Uniswap V3 Documentation'],
      lastUpdated: new Date()
    }
  ],
  'blockchain': [
    {
      id: 'bc-001',
      category: 'blockchain',
      title: 'Gas Optimization',
      content: 'Pack storage variables, use events for non-essential data, minimize external calls',
      tags: ['blockchain', 'solidity', 'optimization'],
      confidence: 90,
      sources: ['Ethereum Yellow Paper'],
      lastUpdated: new Date()
    },
    {
      id: 'bc-002',
      category: 'blockchain',
      title: 'Smart Contract Upgradability',
      content: 'Use proxy patterns (UUPS, Transparent), separate storage from logic, plan for migrations',
      tags: ['blockchain', 'solidity', 'upgrades'],
      confidence: 85,
      sources: ['OpenZeppelin Upgrades'],
      lastUpdated: new Date()
    }
  ]
};

// Pattern recommendations based on context
const PATTERN_RECOMMENDATIONS: PatternRecommendation[] = [
  {
    pattern: 'Circuit Breaker',
    applicability: ['distributed-systems', 'microservices', 'api'],
    description: 'Prevents cascading failures by failing fast when a service is unavailable',
    implementation: 'Use libraries like opossum (Node.js) or resilience4j (Java)',
    tradeoffs: ['Added complexity', 'Needs monitoring', 'Provides resilience']
  },
  {
    pattern: 'CQRS',
    applicability: ['complex-domain', 'event-sourcing', 'high-read-write-ratio'],
    description: 'Separates read and write operations for better scalability',
    implementation: 'Separate read and write models, use event bus for synchronization',
    tradeoffs: ['Eventual consistency', 'More complex', 'Better scalability']
  },
  {
    pattern: 'Saga',
    applicability: ['distributed-transactions', 'microservices', 'long-running'],
    description: 'Manages distributed transactions through a sequence of local transactions',
    implementation: 'Choreography (events) or Orchestration (central coordinator)',
    tradeoffs: ['No ACID', 'Compensation logic needed', 'Better for distributed']
  },
  {
    pattern: 'Event Sourcing',
    applicability: ['audit-trail', 'temporal-queries', 'defi'],
    description: 'Store all changes as events, derive current state from event history',
    implementation: 'Append-only event store, event handlers for projections',
    tradeoffs: ['Storage growth', 'Complexity', 'Full audit trail']
  }
];

export class ResearchAgentImpl extends BaseAgentImpl implements ResearchAgent {
  private researchConfig: ResearchAgentConfig;
  private knowledgeBase: KnowledgeBase;
  private searchCache: Map<string, { result: ResearchResult; timestamp: number }> = new Map();
  private researchHistory: ResearchResult[] = [];

  constructor(config: Partial<ResearchAgentConfig> = {}) {
    const fullConfig: ResearchAgentConfig = {
      id: config.id || uuidv4(),
      name: config.name || 'Knowledge & Research Agent',
      type: AgentType.RESEARCH_AGENT,
      version: config.version || '1.0.0',
      capabilities: [
        'knowledge_retrieval',
        'pattern_recommendation',
        'best_practice_guidance',
        'technology_analysis',
        'trend_analysis',
        'documentation_search'
      ],
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      timeoutMs: config.timeoutMs || 30000,
      enableSandbox: config.enableSandbox ?? false,
      maxSearchResults: config.maxSearchResults || 20,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTLMs: config.cacheTTLMs || 3600000, // 1 hour
      trustedSources: config.trustedSources || [
        'OWASP',
        'OpenZeppelin',
        'MDN',
        'TypeScript Docs',
        'Ethereum Docs'
      ],
      enableAISearch: config.enableAISearch ?? true,
      enableCodeSearch: config.enableCodeSearch ?? true
    };

    super(fullConfig);
    this.researchConfig = fullConfig;
    this.knowledgeBase = this.initializeKnowledgeBase();
  }

  protected async onInitialize(): Promise<void> {
    this.emit('research-agent-initialized');
  }

  protected async onShutdown(): Promise<void> {
    this.searchCache.clear();
    this.researchHistory = [];
  }

  protected async onHealthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message?: string; lastCheck: Date }> {
    return {
      status: 'healthy',
      message: `Knowledge entries: ${this.knowledgeBase.entries.length}`,
      lastCheck: new Date()
    };
  }

  protected async handleRequest(message: Record<string, unknown>): Promise<unknown> {
    const action = message['action'] as string;
    const payload = message['payload'] as Record<string, unknown>;
    
    switch (action) {
      case 'research':
        return this.research(payload['query'] as any);
      case 'get_best_practices':
        return this.getBestPractices(payload['topic'] as string);
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

  private initializeKnowledgeBase(): KnowledgeBase {
    const entries: KnowledgeEntry[] = [];
    
    for (const category of Object.keys(BUILT_IN_KNOWLEDGE) as KnowledgeCategory[]) {
      entries.push(...BUILT_IN_KNOWLEDGE[category]);
    }

    return {
      entries,
      lastUpdated: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Research a topic and return findings
   * Requirement 6.1: Knowledge gathering
   */
  public async research(query: ResearchQuery): Promise<ResearchResult> {
    // Check cache first
    const cacheKey = this.getCacheKey(query);
    if (this.researchConfig.cacheEnabled) {
      const cached = this.searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.researchConfig.cacheTTLMs) {
        return cached.result;
      }
    }

    const startTime = Date.now();
    const findings: KnowledgeEntry[] = [];
    const bestPractices: BestPractice[] = [];
    const patterns: PatternRecommendation[] = [];

    // Search knowledge base
    const knowledgeResults = this.searchKnowledgeBase(query);
    findings.push(...knowledgeResults);

    // Get relevant best practices
    const practiceResults = this.findBestPractices(query);
    bestPractices.push(...practiceResults);

    // Get pattern recommendations
    const patternResults = this.recommendPatterns(query);
    patterns.push(...patternResults);

    // Search documentation if enabled
    let documentation: Documentation[] = [];
    if (this.researchConfig.enableCodeSearch) {
      documentation = await this.searchDocumentation(query);
    }

    // Analyze technologies if relevant
    let technologyAnalysis: TechnologyAnalysis | undefined;
    if (query.context?.technologies) {
      technologyAnalysis = await this.analyzeTechnologies(query.context.technologies);
    }

    const result: ResearchResult = {
      queryId: uuidv4(),
      query: query.query,
      findings,
      bestPractices,
      patterns,
      documentation,
      technologyAnalysis,
      confidence: this.calculateConfidence(findings),
      sources: this.extractSources(findings, documentation),
      timestamp: new Date(),
      duration: Date.now() - startTime
    };

    // Cache result
    if (this.researchConfig.cacheEnabled) {
      this.searchCache.set(cacheKey, { result, timestamp: Date.now() });
    }

    this.researchHistory.push(result);
    this.emit('research-complete', result);

    return result;
  }

  /**
   * Get best practices for a topic
   * Requirement 6.2: Best practice guidance
   */
  public async getBestPractices(topic: string): Promise<BestPractice[]> {
    const practices: BestPractice[] = [];

    // Search all categories for relevant best practices
    for (const entry of this.knowledgeBase.entries) {
      if (this.isRelevant(entry, topic)) {
        practices.push({
          title: entry.title,
          description: entry.content,
          category: entry.category,
          applicability: entry.tags,
          examples: this.getExamples(entry),
          references: entry.sources
        });
      }
    }

    // Add topic-specific best practices
    const topicPractices = this.getTopicSpecificPractices(topic);
    practices.push(...topicPractices);

    return practices.slice(0, this.researchConfig.maxSearchResults);
  }

  /**
   * Recommend patterns based on context
   * Requirement 6.3: Pattern recommendation
   */
  public async recommendPatterns(query: ResearchQuery): Promise<PatternRecommendation[]> {
    const recommendations: PatternRecommendation[] = [];
    const queryLower = query.query.toLowerCase();
    const tags = query.context?.tags || [];

    for (const pattern of PATTERN_RECOMMENDATIONS) {
      const relevanceScore = this.calculatePatternRelevance(pattern, queryLower, tags);
      
      if (relevanceScore > 0.3) {
        recommendations.push({
          ...pattern,
          relevanceScore
        });
      }
    }

    // Sort by relevance
    return recommendations
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 5);
  }

  /**
   * Analyze technology stack
   * Requirement 6.4: Technology analysis
   */
  public async analyzeTechnologies(technologies: string[]): Promise<TechnologyAnalysis> {
    const analysis: TechnologyAnalysis = {
      technologies: [],
      compatibility: [],
      recommendations: [],
      risks: [],
      trends: []
    };

    for (const tech of technologies) {
      const techAnalysis = this.analyzeTechnology(tech);
      analysis.technologies.push(techAnalysis);
    }

    // Check compatibility
    analysis.compatibility = this.checkCompatibility(technologies);

    // Generate recommendations
    analysis.recommendations = this.generateTechRecommendations(technologies);

    // Identify risks
    analysis.risks = this.identifyTechRisks(technologies);

    // Add trend information
    analysis.trends = this.getTechTrends(technologies);

    return analysis;
  }

  /**
   * Perform trend analysis
   */
  public async analyzeTrends(domain: string): Promise<TrendAnalysis> {
    const trends: TrendAnalysis = {
      domain,
      currentTrends: [],
      emergingTechnologies: [],
      decliningTechnologies: [],
      recommendations: [],
      timestamp: new Date()
    };

    // Add domain-specific trends
    if (domain.toLowerCase().includes('defi') || domain.toLowerCase().includes('blockchain')) {
      trends.currentTrends = [
        { name: 'Layer 2 Solutions', momentum: 'rising', description: 'Scaling solutions like Optimism, Arbitrum' },
        { name: 'Account Abstraction', momentum: 'rising', description: 'ERC-4337 and smart contract wallets' },
        { name: 'Cross-chain Bridges', momentum: 'stable', description: 'Interoperability between chains' },
        { name: 'MEV Protection', momentum: 'rising', description: 'Flashbots, private mempools' }
      ];

      trends.emergingTechnologies = ['zkSync', 'EigenLayer', 'Intents', 'Coprocessors'];
      trends.decliningTechnologies = ['Proof of Work', 'Single-chain DeFi'];
    } else if (domain.toLowerCase().includes('web') || domain.toLowerCase().includes('frontend')) {
      trends.currentTrends = [
        { name: 'Server Components', momentum: 'rising', description: 'React Server Components, partial hydration' },
        { name: 'Edge Computing', momentum: 'rising', description: 'Edge functions, distributed computing' },
        { name: 'AI Integration', momentum: 'rising', description: 'LLM-powered features' }
      ];

      trends.emergingTechnologies = ['Bun', 'HTMX', 'Islands Architecture', 'Qwik'];
    }

    trends.recommendations = this.getTrendRecommendations(trends);

    return trends;
  }

  /**
   * Search the knowledge base
   */
  public searchKnowledge(query: string, filters?: { category?: string; tags?: string[] }): KnowledgeEntry[] {
    let results = this.knowledgeBase.entries;

    // Apply category filter
    if (filters?.category) {
      results = results.filter(e => e.category === filters.category);
    }

    // Apply tag filter
    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter(e => 
        filters.tags!.some(tag => e.tags.includes(tag))
      );
    }

    // Score by relevance
    const scored = results.map(entry => ({
      entry,
      score: this.calculateRelevance(entry, query)
    }));

    // Sort and return
    return scored
      .filter(s => s.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .map(s => s.entry)
      .slice(0, this.researchConfig.maxSearchResults);
  }

  /**
   * Add knowledge to the base
   */
  public async addKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'lastUpdated'>): Promise<void> {
    const newEntry: KnowledgeEntry = {
      ...entry,
      id: uuidv4(),
      lastUpdated: new Date()
    };

    this.knowledgeBase.entries.push(newEntry);
    this.knowledgeBase.lastUpdated = new Date();

    this.emit('knowledge-added', newEntry);
  }

  // Private helper methods

  private getCacheKey(query: ResearchQuery): string {
    return `${query.query}-${JSON.stringify(query.context || {})}`;
  }

  private searchKnowledgeBase(query: ResearchQuery): KnowledgeEntry[] {
    return this.searchKnowledge(query.query, {
      category: query.context?.category,
      tags: query.context?.tags
    });
  }

  private findBestPractices(query: ResearchQuery): BestPractice[] {
    const practices: BestPractice[] = [];
    const queryTerms = query.query.toLowerCase().split(/\s+/);

    // Search best practices knowledge
    const bpEntries = BUILT_IN_KNOWLEDGE['best-practices'];
    
    for (const entry of bpEntries) {
      if (queryTerms.some(term => 
        entry.title.toLowerCase().includes(term) ||
        entry.content.toLowerCase().includes(term) ||
        entry.tags.some(tag => tag.includes(term))
      )) {
        practices.push({
          title: entry.title,
          description: entry.content,
          category: entry.category,
          applicability: entry.tags,
          examples: [],
          references: entry.sources
        });
      }
    }

    return practices;
  }

  private async searchDocumentation(query: ResearchQuery): Promise<Documentation[]> {
    // Simulated documentation search
    // In a real implementation, this would search actual documentation
    const docs: Documentation[] = [];

    const queryLower = query.query.toLowerCase();

    if (queryLower.includes('typescript') || queryLower.includes('type')) {
      docs.push({
        title: 'TypeScript Handbook',
        url: 'https://www.typescriptlang.org/docs/',
        summary: 'Official TypeScript documentation covering types, interfaces, and advanced patterns',
        relevance: 0.9
      });
    }

    if (queryLower.includes('defi') || queryLower.includes('smart contract')) {
      docs.push({
        title: 'OpenZeppelin Contracts',
        url: 'https://docs.openzeppelin.com/contracts/',
        summary: 'Secure smart contract development library',
        relevance: 0.95
      });
      docs.push({
        title: 'Solidity Documentation',
        url: 'https://docs.soliditylang.org/',
        summary: 'Official Solidity language documentation',
        relevance: 0.9
      });
    }

    if (queryLower.includes('security')) {
      docs.push({
        title: 'OWASP Security Guidelines',
        url: 'https://owasp.org/www-project-web-security-testing-guide/',
        summary: 'Web application security testing guide',
        relevance: 0.85
      });
    }

    return docs;
  }

  private isRelevant(entry: KnowledgeEntry, topic: string): boolean {
    const topicLower = topic.toLowerCase();
    const topicTerms = topicLower.split(/\s+/);

    return topicTerms.some(term =>
      entry.title.toLowerCase().includes(term) ||
      entry.content.toLowerCase().includes(term) ||
      entry.tags.some(tag => tag.toLowerCase().includes(term)) ||
      entry.category.toLowerCase().includes(term)
    );
  }

  private calculateRelevance(entry: KnowledgeEntry, query: string): number {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
    
    let score = 0;

    // Title match (highest weight)
    for (const term of queryTerms) {
      if (entry.title.toLowerCase().includes(term)) {
        score += 0.4;
      }
    }

    // Tag match
    for (const term of queryTerms) {
      if (entry.tags.some(tag => tag.toLowerCase().includes(term))) {
        score += 0.3;
      }
    }

    // Content match
    for (const term of queryTerms) {
      if (entry.content.toLowerCase().includes(term)) {
        score += 0.2;
      }
    }

    // Category match
    if (queryTerms.some(term => entry.category.toLowerCase().includes(term))) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  private calculatePatternRelevance(pattern: PatternRecommendation, query: string, tags: string[]): number {
    let score = 0;

    // Check query match
    if (query.includes(pattern.pattern.toLowerCase())) {
      score += 0.5;
    }

    // Check applicability match
    for (const app of pattern.applicability) {
      if (query.includes(app) || tags.includes(app)) {
        score += 0.2;
      }
    }

    // Check description match
    const queryTerms = query.split(/\s+/);
    for (const term of queryTerms) {
      if (pattern.description.toLowerCase().includes(term)) {
        score += 0.1;
      }
    }

    return Math.min(score, 1);
  }

  private getExamples(entry: KnowledgeEntry): string[] {
    // Return examples based on category
    const examples: Record<string, string[]> = {
      'patterns': ['See GoF Design Patterns book for implementations'],
      'security': ['OWASP provides sample vulnerable and secure code'],
      'defi': ['Check Uniswap and Aave repositories for examples']
    };

    return examples[entry.category] || [];
  }

  private getTopicSpecificPractices(topic: string): BestPractice[] {
    const topicLower = topic.toLowerCase();
    const practices: BestPractice[] = [];

    if (topicLower.includes('api')) {
      practices.push({
        title: 'RESTful API Design',
        description: 'Use proper HTTP methods, status codes, and resource naming',
        category: 'api',
        applicability: ['rest', 'web-services'],
        examples: ['GET /users, POST /users, GET /users/:id'],
        references: ['REST API Design Rulebook']
      });
    }

    if (topicLower.includes('database')) {
      practices.push({
        title: 'Database Indexing',
        description: 'Index columns used in WHERE, JOIN, and ORDER BY clauses',
        category: 'database',
        applicability: ['sql', 'performance'],
        examples: ['CREATE INDEX idx_user_email ON users(email)'],
        references: ['Use The Index, Luke!']
      });
    }

    return practices;
  }

  private analyzeTechnology(tech: string): any {
    const techLower = tech.toLowerCase();
    
    const analyses: Record<string, any> = {
      typescript: {
        name: 'TypeScript',
        category: 'language',
        maturity: 'mature',
        adoption: 'high',
        strengths: ['Type safety', 'IDE support', 'Large ecosystem'],
        weaknesses: ['Build step required', 'Learning curve'],
        alternatives: ['JavaScript', 'Flow']
      },
      react: {
        name: 'React',
        category: 'frontend',
        maturity: 'mature',
        adoption: 'very-high',
        strengths: ['Component model', 'Large ecosystem', 'Community'],
        weaknesses: ['Boilerplate', 'State management complexity'],
        alternatives: ['Vue', 'Svelte', 'Angular']
      },
      solidity: {
        name: 'Solidity',
        category: 'smart-contracts',
        maturity: 'mature',
        adoption: 'high',
        strengths: ['EVM support', 'Large ecosystem', 'Auditing tools'],
        weaknesses: ['Security pitfalls', 'Limited expressiveness'],
        alternatives: ['Vyper', 'Rust (Solana)', 'Move']
      }
    };

    return analyses[techLower] || {
      name: tech,
      category: 'unknown',
      maturity: 'unknown',
      note: 'Limited information available'
    };
  }

  private checkCompatibility(technologies: string[]): any[] {
    const compatibility: any[] = [];
    const techLower = technologies.map(t => t.toLowerCase());

    // Check common compatibility issues
    if (techLower.includes('typescript') && techLower.includes('javascript')) {
      compatibility.push({
        technologies: ['TypeScript', 'JavaScript'],
        compatible: true,
        notes: 'TypeScript compiles to JavaScript, fully compatible'
      });
    }

    if (techLower.includes('react') && techLower.includes('vue')) {
      compatibility.push({
        technologies: ['React', 'Vue'],
        compatible: false,
        notes: 'Not recommended to mix in same project'
      });
    }

    return compatibility;
  }

  private generateTechRecommendations(technologies: string[]): string[] {
    const recommendations: string[] = [];
    const techLower = technologies.map(t => t.toLowerCase());

    if (techLower.includes('typescript')) {
      recommendations.push('Enable strict mode in tsconfig.json');
      recommendations.push('Use ESLint with TypeScript plugin');
    }

    if (techLower.includes('react')) {
      recommendations.push('Consider using React Query for server state');
      recommendations.push('Use React.memo for performance optimization');
    }

    if (techLower.includes('solidity')) {
      recommendations.push('Use OpenZeppelin contracts for standard implementations');
      recommendations.push('Run Slither for static analysis');
      recommendations.push('Get professional audit before mainnet deployment');
    }

    return recommendations;
  }

  private identifyTechRisks(technologies: string[]): any[] {
    const risks: any[] = [];
    const techLower = technologies.map(t => t.toLowerCase());

    if (techLower.includes('solidity')) {
      risks.push({
        technology: 'Solidity',
        risk: 'Smart contract vulnerabilities',
        severity: 'high',
        mitigation: 'Professional security audit'
      });
    }

    if (techLower.some(t => t.includes('beta') || t.includes('alpha'))) {
      risks.push({
        technology: 'Pre-release software',
        risk: 'API changes, bugs',
        severity: 'medium',
        mitigation: 'Version pinning, thorough testing'
      });
    }

    return risks;
  }

  private getTechTrends(technologies: string[]): any[] {
    const trends: any[] = [];

    for (const tech of technologies) {
      trends.push({
        technology: tech,
        trend: 'stable',
        forecast: 'Continued adoption expected'
      });
    }

    return trends;
  }

  private getTrendRecommendations(trends: TrendAnalysis): string[] {
    const recommendations: string[] = [];

    for (const trend of trends.currentTrends) {
      if (trend.momentum === 'rising') {
        recommendations.push(`Consider adopting ${trend.name}: ${trend.description}`);
      }
    }

    if (trends.emergingTechnologies.length > 0) {
      recommendations.push(`Evaluate emerging technologies: ${trends.emergingTechnologies.slice(0, 3).join(', ')}`);
    }

    return recommendations;
  }

  private calculateConfidence(findings: KnowledgeEntry[]): number {
    if (findings.length === 0) return 0;
    
    const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;
    return Math.round(avgConfidence);
  }

  private extractSources(findings: KnowledgeEntry[], docs: Documentation[]): string[] {
    const sources = new Set<string>();

    for (const finding of findings) {
      for (const source of finding.sources) {
        sources.add(source);
      }
    }

    for (const doc of docs) {
      sources.add(doc.title);
    }

    return Array.from(sources);
  }
}

// Factory function
export function createResearchAgent(config?: Partial<ResearchAgentConfig>): ResearchAgentImpl {
  return new ResearchAgentImpl(config);
}
