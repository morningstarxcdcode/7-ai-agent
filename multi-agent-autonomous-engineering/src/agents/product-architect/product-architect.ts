/**
 * Product Architect Agent Implementation
 * Generates system designs, UX flows, and technical specifications
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseAgentImpl, BaseAgentConfig } from '../../core/base-agent';
import { AgentType, AgentId, RiskLevel } from '../../types/core';
import {
  ProductArchitectAgent,
  Requirements,
  SystemArchitecture,
  UserStory,
  UXFlowDiagram,
  ComponentSpec,
  SystemDesign,
  Component,
  Interface,
  SecurityRequirement,
  DataFlowDiagram,
  DeploymentSpec,
  ScalabilityPlan,
  SecurityModel,
  UserFlow,
  FlowStep,
  Screen,
  UIComponent,
  Interaction,
  ValidationResult
} from '../../types/agents';

export interface ProductArchitectConfig extends BaseAgentConfig {
  maxComponents: number;
  enableDeFiPatterns: boolean;
  enableWeb2Compatibility: boolean;
  documentationLevel: 'minimal' | 'standard' | 'comprehensive';
}

export interface DesignDecision {
  id: string;
  category: string;
  decision: string;
  rationale: string;
  alternatives: string[];
  tradeoffs: string[];
  timestamp: Date;
}

export interface ArchitectureTemplate {
  name: string;
  components: ComponentTemplate[];
  interfaces: InterfaceTemplate[];
  patterns: string[];
}

interface ComponentTemplate {
  type: string;
  name: string;
  responsibilities: string[];
  scalability: string;
}

interface InterfaceTemplate {
  type: string;
  protocol: string;
  security: string[];
}

// DeFi-specific design patterns
const DEFI_PATTERNS = {
  MULTI_SIG_WALLET: {
    components: ['MultiSigController', 'SignatureValidator', 'TransactionQueue'],
    interfaces: ['IMultiSig', 'ISignature'],
    security: ['time_lock', 'quorum_validation', 'replay_protection']
  },
  LIQUIDITY_POOL: {
    components: ['PoolManager', 'SwapEngine', 'FeeCalculator', 'PriceOracle'],
    interfaces: ['ILiquidityPool', 'ISwap', 'IPriceOracle'],
    security: ['slippage_protection', 'sandwich_attack_prevention', 'reentrancy_guard']
  },
  YIELD_FARMING: {
    components: ['VaultController', 'StrategyManager', 'RewardDistributor', 'Harvester'],
    interfaces: ['IVault', 'IStrategy', 'IRewards'],
    security: ['impermanent_loss_protection', 'flash_loan_guard', 'access_control']
  },
  GOVERNANCE: {
    components: ['GovernanceController', 'ProposalManager', 'VotingEngine', 'Timelock'],
    interfaces: ['IGovernance', 'IProposal', 'IVote'],
    security: ['vote_delegation', 'proposal_threshold', 'execution_delay']
  }
};

// Architecture templates
const ARCHITECTURE_TEMPLATES: Record<string, ArchitectureTemplate> = {
  microservices: {
    name: 'Microservices Architecture',
    components: [
      { type: 'gateway', name: 'API Gateway', responsibilities: ['routing', 'rate_limiting', 'auth'], scalability: 'horizontal' },
      { type: 'service', name: 'Core Service', responsibilities: ['business_logic'], scalability: 'horizontal' },
      { type: 'database', name: 'Database', responsibilities: ['persistence'], scalability: 'vertical' },
      { type: 'cache', name: 'Cache Layer', responsibilities: ['caching'], scalability: 'horizontal' },
      { type: 'queue', name: 'Message Queue', responsibilities: ['async_processing'], scalability: 'horizontal' }
    ],
    interfaces: [
      { type: 'rest', protocol: 'HTTP/2', security: ['jwt', 'rate_limiting'] },
      { type: 'grpc', protocol: 'gRPC', security: ['mTLS'] },
      { type: 'message_queue', protocol: 'AMQP', security: ['encryption'] }
    ],
    patterns: ['circuit_breaker', 'retry', 'bulkhead', 'service_discovery']
  },
  monolith: {
    name: 'Modular Monolith Architecture',
    components: [
      { type: 'gateway', name: 'Web Server', responsibilities: ['request_handling'], scalability: 'vertical' },
      { type: 'service', name: 'Application Core', responsibilities: ['all_business_logic'], scalability: 'vertical' },
      { type: 'database', name: 'Database', responsibilities: ['persistence'], scalability: 'vertical' }
    ],
    interfaces: [
      { type: 'rest', protocol: 'HTTP', security: ['session', 'csrf'] }
    ],
    patterns: ['repository', 'unit_of_work', 'domain_events']
  },
  serverless: {
    name: 'Serverless Architecture',
    components: [
      { type: 'gateway', name: 'API Gateway', responsibilities: ['routing', 'auth'], scalability: 'auto' },
      { type: 'service', name: 'Lambda Functions', responsibilities: ['business_logic'], scalability: 'auto' },
      { type: 'database', name: 'DynamoDB', responsibilities: ['persistence'], scalability: 'auto' },
      { type: 'queue', name: 'SQS Queue', responsibilities: ['async_processing'], scalability: 'auto' }
    ],
    interfaces: [
      { type: 'rest', protocol: 'HTTP', security: ['api_key', 'iam'] }
    ],
    patterns: ['event_sourcing', 'saga', 'choreography']
  }
};

export class ProductArchitectAgentImpl extends BaseAgentImpl implements ProductArchitectAgent {
  private architectConfig: ProductArchitectConfig;
  private designDecisions: DesignDecision[] = [];
  private generatedArchitectures: Map<string, SystemArchitecture> = new Map();

  constructor(config: Partial<ProductArchitectConfig> = {}) {
    const fullConfig: ProductArchitectConfig = {
      id: config.id || uuidv4(),
      name: config.name || 'Product Architect Agent',
      type: AgentType.PRODUCT_ARCHITECT,
      version: config.version || '1.0.0',
      capabilities: [
        'architecture_generation',
        'ux_flow_design',
        'component_specification',
        'design_validation',
        'defi_patterns',
        'web2_compatibility'
      ],
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      timeoutMs: config.timeoutMs || 60000,
      enableSandbox: config.enableSandbox ?? true,
      maxComponents: config.maxComponents || 50,
      enableDeFiPatterns: config.enableDeFiPatterns ?? true,
      enableWeb2Compatibility: config.enableWeb2Compatibility ?? true,
      documentationLevel: config.documentationLevel || 'standard'
    };

    super(fullConfig);
    this.architectConfig = fullConfig;
  }

  protected async onInitialize(): Promise<void> {
    this.emit('product-architect-initialized');
  }

  protected async onShutdown(): Promise<void> {
    this.generatedArchitectures.clear();
    this.designDecisions = [];
  }

  protected async onHealthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message?: string; lastCheck: Date }> {
    return {
      status: 'healthy',
      message: `Architectures generated: ${this.generatedArchitectures.size}`,
      lastCheck: new Date()
    };
  }

  protected async handleRequest(message: Record<string, unknown>): Promise<unknown> {
    const action = message['action'] as string;
    const payload = message['payload'] as Record<string, unknown>;
    
    switch (action) {
      case 'generate_architecture':
        return this.generateArchitecture(payload['requirements'] as any);
      case 'create_ux_flows':
        return this.createUXFlows(payload['userStories'] as any);
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

  protected override createSandbox() {
    return undefined as any; // Simplified for base implementation
  }

  /**
   * Generate comprehensive system architecture
   * Requirement 2.1: Generate comprehensive system architecture
   */
  public async generateArchitecture(requirements: Requirements): Promise<SystemArchitecture> {
    const architectureId = uuidv4();

    // Analyze requirements to determine architecture style
    const architectureStyle = this.determineArchitectureStyle(requirements);
    const template = ARCHITECTURE_TEMPLATES[architectureStyle];

    // Generate components based on requirements
    const components = this.generateComponents(requirements, template);

    // Generate interfaces
    const interfaces = this.generateInterfaces(requirements, components);

    // Generate data flow
    const dataFlow = this.generateDataFlow(components);

    // Generate deployment specification
    const deploymentModel = this.generateDeploymentSpec(requirements, components);

    // Generate scalability plan
    const scalabilityConsiderations = this.generateScalabilityPlan(requirements, components);

    // Generate security model
    const securityModel = this.generateSecurityModel(requirements);

    const architecture: SystemArchitecture = {
      components,
      interfaces,
      dataFlow,
      deploymentModel,
      scalabilityConsiderations,
      securityModel
    };

    // Record design decision
    this.recordDesignDecision({
      category: 'architecture_style',
      decision: `Selected ${architectureStyle} architecture`,
      rationale: this.generateArchitectureRationale(requirements, architectureStyle),
      alternatives: Object.keys(ARCHITECTURE_TEMPLATES).filter(t => t !== architectureStyle),
      tradeoffs: this.identifyTradeoffs(architectureStyle)
    });

    this.generatedArchitectures.set(architectureId, architecture);
    this.emit('architecture-generated', { id: architectureId, architecture });

    return architecture;
  }

  /**
   * Create UX flows from user stories
   * Requirement 2.2: Create user journey maps and interaction designs
   */
  public async createUXFlows(userStories: UserStory[]): Promise<UXFlowDiagram> {
    const flows: UserFlow[] = [];
    const screens: Screen[] = [];
    const interactions: Interaction[] = [];
    const screenMap = new Map<string, Screen>();

    for (const story of userStories) {
      // Generate flow for each user story
      const flow = this.generateUserFlow(story);
      flows.push(flow);

      // Generate screens for each flow step
      for (const step of flow.steps) {
        if (step.type === 'input' || step.type === 'output') {
          const screen = this.generateScreen(step, story);
          if (!screenMap.has(screen.id)) {
            screenMap.set(screen.id, screen);
            screens.push(screen);
          }
        }
      }

      // Generate interactions between screens
      const flowInteractions = this.generateInteractions(flow, screens);
      interactions.push(...flowInteractions);
    }

    const uxDiagram: UXFlowDiagram = {
      flows,
      screens,
      interactions
    };

    this.emit('ux-flows-created', uxDiagram);
    return uxDiagram;
  }

  /**
   * Create detailed component specifications
   * Requirement 2.3: Produce detailed component specifications
   */
  public async specifyComponents(architecture: SystemArchitecture): Promise<ComponentSpec[]> {
    const specs: ComponentSpec[] = [];

    for (const component of architecture.components) {
      const spec = this.generateComponentSpec(component, architecture);
      specs.push(spec);
    }

    this.emit('components-specified', specs);
    return specs;
  }

  /**
   * Validate a system design
   * Requirement 2.5: Document rationale and trade-offs
   */
  public async validateDesign(design: SystemDesign): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate components
    this.validateComponents(design, errors, warnings, suggestions);

    // Validate interfaces
    this.validateInterfaces(design, errors, warnings, suggestions);

    // Validate security
    this.validateSecurity(design, errors, warnings, suggestions);

    // DeFi-specific validations
    if (this.architectConfig.enableDeFiPatterns && this.isDeFiDesign(design)) {
      this.validateDeFiPatterns(design, errors, warnings, suggestions);
    }

    const isValid = errors.length === 0;

    const result: ValidationResult = {
      valid: isValid,
      errors,
      warnings,
      suggestions,
      score: this.calculateDesignScore(errors, warnings, suggestions)
    };

    this.emit('design-validated', result);
    return result;
  }

  /**
   * Get design decisions log
   */
  public getDesignDecisions(): DesignDecision[] {
    return [...this.designDecisions];
  }

  // Private helper methods

  private determineArchitectureStyle(requirements: Requirements): string {
    const functionalReqs = requirements.functional;
    const nonFunctionalReqs = requirements.nonFunctional;

    // Check for high scalability requirements
    const highScalability = nonFunctionalReqs.some(
      req => req.type === 'scalability' && req.metrics.some(m => m.target > 10000)
    );

    // Check for performance requirements
    const highPerformance = nonFunctionalReqs.some(
      req => req.type === 'performance' && req.metrics.some(m => m.target < 100 && m.unit === 'ms')
    );

    // Check for complexity
    const isComplex = functionalReqs.length > 10 || 
      functionalReqs.some(req => req.priority === 'must' && req.acceptanceCriteria.length > 5);

    if (highScalability && isComplex) {
      return 'microservices';
    } else if (highPerformance && !isComplex) {
      return 'serverless';
    } else {
      return 'monolith';
    }
  }

  private generateComponents(requirements: Requirements, template: ArchitectureTemplate): Component[] {
    const components: Component[] = [];
    let componentIndex = 0;

    for (const templateComponent of template.components) {
      const component: Component = {
        id: `component_${componentIndex++}`,
        name: templateComponent.name,
        type: templateComponent.type as any,
        responsibilities: [...templateComponent.responsibilities],
        dependencies: [],
        interfaces: []
      };

      // Add DeFi-specific components if needed
      if (this.architectConfig.enableDeFiPatterns) {
        const isDeFiRequirement = requirements.functional.some(
          req => /defi|blockchain|smart\s*contract|token/i.test(req.description)
        );

        if (isDeFiRequirement && templateComponent.type === 'service') {
          // Add security validator component
          components.push({
            id: `component_${componentIndex++}`,
            name: 'DeFi Security Validator',
            type: 'service',
            responsibilities: ['transaction_validation', 'risk_assessment', 'slippage_calculation'],
            dependencies: [component.id],
            interfaces: ['ISecurityValidator']
          });
        }
      }

      components.push(component);
    }

    return components;
  }

  private generateInterfaces(requirements: Requirements, components: Component[]): Interface[] {
    const interfaces: Interface[] = [];
    let interfaceIndex = 0;

    // Generate REST API interface
    interfaces.push({
      id: `interface_${interfaceIndex++}`,
      name: 'REST API',
      type: 'rest',
      specification: {
        version: 'OpenAPI 3.0',
        baseUrl: '/api/v1',
        endpoints: this.generateEndpoints(requirements)
      },
      security: [
        { type: 'authentication', description: 'JWT Bearer token', implementation: 'OAuth2' },
        { type: 'authorization', description: 'Role-based access control', implementation: 'RBAC' }
      ]
    });

    // Generate WebSocket interface for real-time features
    const hasRealtime = requirements.functional.some(
      req => /real-?time|live|stream/i.test(req.description)
    );

    if (hasRealtime) {
      interfaces.push({
        id: `interface_${interfaceIndex++}`,
        name: 'WebSocket API',
        type: 'websocket',
        specification: {
          protocol: 'WSS',
          events: ['update', 'notification', 'price_change']
        },
        security: [
          { type: 'authentication', description: 'Token-based', implementation: 'JWT' }
        ]
      });
    }

    return interfaces;
  }

  private generateEndpoints(requirements: Requirements): any[] {
    const endpoints: any[] = [];
    
    for (const req of requirements.functional) {
      if (req.priority === 'must' || req.priority === 'should') {
        endpoints.push({
          path: `/${req.id.toLowerCase().replace(/_/g, '-')}`,
          methods: ['GET', 'POST'],
          description: req.description
        });
      }
    }

    return endpoints;
  }

  private generateDataFlow(components: Component[]): DataFlowDiagram {
    const flows: any[] = [];
    let flowIndex = 0;

    // Generate data flows between components
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        if (this.shouldConnect(components[i], components[j])) {
          flows.push({
            id: `flow_${flowIndex++}`,
            source: components[i].id,
            destination: components[j].id,
            dataType: 'json',
            frequency: 'on_demand'
          });
        }
      }
    }

    return {
      flows,
      externalSources: [],
      externalSinks: []
    };
  }

  private shouldConnect(comp1: Component, comp2: Component): boolean {
    // Gateway connects to services
    if (comp1.type === 'gateway' && comp2.type === 'service') return true;
    // Services connect to databases
    if (comp1.type === 'service' && comp2.type === 'database') return true;
    // Services connect to caches
    if (comp1.type === 'service' && comp2.type === 'cache') return true;
    // Services connect to queues
    if (comp1.type === 'service' && comp2.type === 'queue') return true;
    return false;
  }

  private generateDeploymentSpec(requirements: Requirements, components: Component[]): DeploymentSpec {
    return {
      environment: 'kubernetes',
      regions: ['us-east-1', 'eu-west-1'],
      replicas: this.calculateReplicas(requirements),
      resources: {
        cpu: '2 cores',
        memory: '4GB',
        storage: '100GB'
      },
      autoScaling: {
        enabled: true,
        minReplicas: 2,
        maxReplicas: 10,
        targetCPU: 70
      }
    };
  }

  private calculateReplicas(requirements: Requirements): number {
    const scalabilityReq = requirements.nonFunctional.find(r => r.type === 'scalability');
    if (scalabilityReq) {
      const metric = scalabilityReq.metrics.find(m => m.name === 'concurrent_users');
      if (metric && metric.target > 1000) return 5;
      if (metric && metric.target > 100) return 3;
    }
    return 2;
  }

  private generateScalabilityPlan(requirements: Requirements, components: Component[]): ScalabilityPlan {
    return {
      strategy: 'horizontal',
      triggers: [
        { metric: 'cpu_usage', threshold: 70, action: 'scale_up' },
        { metric: 'request_latency', threshold: 500, action: 'scale_up' },
        { metric: 'queue_depth', threshold: 100, action: 'scale_up' }
      ],
      limits: {
        maxInstances: 20,
        minInstances: 2,
        cooldownPeriod: 300
      },
      costOptimization: {
        spotInstances: true,
        reservedCapacity: 50
      }
    };
  }

  private generateSecurityModel(requirements: Requirements): SecurityModel {
    const securityReqs = requirements.nonFunctional.filter(r => r.type === 'security');
    
    return {
      authentication: {
        type: 'OAuth2',
        providers: ['Google', 'GitHub'],
        mfa: true
      },
      authorization: {
        type: 'RBAC',
        roles: ['admin', 'user', 'viewer'],
        permissions: this.generatePermissions(requirements)
      },
      encryption: {
        atRest: 'AES-256',
        inTransit: 'TLS 1.3',
        keyManagement: 'AWS KMS'
      },
      audit: {
        enabled: true,
        retention: '90 days',
        events: ['login', 'data_access', 'admin_action']
      }
    };
  }

  private generatePermissions(requirements: Requirements): any[] {
    return requirements.functional.map(req => ({
      resource: req.id,
      actions: ['read', 'write', 'delete']
    }));
  }

  private generateUserFlow(story: UserStory): UserFlow {
    const steps: FlowStep[] = [];
    let stepIndex = 0;

    // Parse acceptance criteria to generate steps
    for (const criteria of story.acceptanceCriteria) {
      const stepType = this.determineStepType(criteria);
      steps.push({
        id: `step_${stepIndex++}`,
        name: criteria.substring(0, 50),
        type: stepType,
        description: criteria,
        nextSteps: []
      });
    }

    // Link steps sequentially
    for (let i = 0; i < steps.length - 1; i++) {
      steps[i].nextSteps = [steps[i + 1].id];
    }

    return {
      id: uuidv4(),
      name: story.title,
      steps,
      entryPoints: steps.length > 0 ? [steps[0].id] : [],
      exitPoints: steps.length > 0 ? [steps[steps.length - 1].id] : []
    };
  }

  private determineStepType(criteria: string): 'action' | 'decision' | 'input' | 'output' {
    if (/\b(if|when|condition|check)\b/i.test(criteria)) return 'decision';
    if (/\b(enter|input|type|select|choose)\b/i.test(criteria)) return 'input';
    if (/\b(display|show|render|see|view)\b/i.test(criteria)) return 'output';
    return 'action';
  }

  private generateScreen(step: FlowStep, story: UserStory): Screen {
    const components: UIComponent[] = [];
    let componentIndex = 0;

    if (step.type === 'input') {
      components.push({
        id: `ui_${componentIndex++}`,
        type: 'form',
        properties: { fields: ['input_field'] },
        events: ['submit', 'change']
      });
    }

    if (step.type === 'output') {
      components.push({
        id: `ui_${componentIndex++}`,
        type: 'display',
        properties: { content: step.description },
        events: ['click']
      });
    }

    return {
      id: `screen_${step.id}`,
      name: step.name,
      components,
      navigation: []
    };
  }

  private generateInteractions(flow: UserFlow, screens: Screen[]): Interaction[] {
    const interactions: Interaction[] = [];
    let interactionIndex = 0;

    for (const step of flow.steps) {
      if (step.nextSteps.length > 0) {
        interactions.push({
          id: `interaction_${interactionIndex++}`,
          type: 'click',
          source: `screen_${step.id}`,
          target: `screen_${step.nextSteps[0]}`,
          effect: 'navigate'
        });
      }
    }

    return interactions;
  }

  private generateComponentSpec(component: Component, architecture: SystemArchitecture): ComponentSpec {
    return {
      component,
      api: this.generateComponentAPI(component),
      dataModel: this.generateDataModel(component),
      dependencies: this.resolveDependencies(component, architecture),
      configuration: this.generateConfiguration(component),
      testing: this.generateTestRequirements(component)
    };
  }

  private generateComponentAPI(component: Component): any {
    return {
      endpoints: component.responsibilities.map((resp, i) => ({
        path: `/${resp.toLowerCase().replace(/_/g, '-')}`,
        method: 'POST',
        description: `Handle ${resp}`
      }))
    };
  }

  private generateDataModel(component: Component): any {
    return {
      entities: component.responsibilities.map(resp => ({
        name: resp,
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'data', type: 'object', required: true },
          { name: 'timestamp', type: 'datetime', required: true }
        ]
      }))
    };
  }

  private resolveDependencies(component: Component, architecture: SystemArchitecture): any[] {
    return component.dependencies.map(depId => {
      const dep = architecture.components.find(c => c.id === depId);
      return {
        id: depId,
        name: dep?.name || 'Unknown',
        type: dep?.type || 'unknown'
      };
    });
  }

  private generateConfiguration(component: Component): any {
    return {
      environment: {
        LOG_LEVEL: 'info',
        TIMEOUT_MS: '30000'
      },
      secrets: ['API_KEY', 'DATABASE_URL']
    };
  }

  private generateTestRequirements(component: Component): any {
    return {
      unit: { coverage: 80 },
      integration: { required: true },
      e2e: { required: component.type === 'gateway' }
    };
  }

  private validateComponents(design: SystemDesign, errors: string[], warnings: string[], suggestions: string[]): void {
    if (!design.architecture || !design.architecture.components) {
      errors.push('Design must have architecture with components');
      return;
    }

    if (design.architecture.components.length === 0) {
      errors.push('Design must have at least one component');
    }

    if (design.architecture.components.length > this.architectConfig.maxComponents) {
      warnings.push(`Design has ${design.architecture.components.length} components, consider simplifying`);
    }

    // Check for orphaned components
    const connectedComponents = new Set<string>();
    for (const component of design.architecture.components) {
      component.dependencies.forEach(d => connectedComponents.add(d));
    }

    for (const component of design.architecture.components) {
      if (!connectedComponents.has(component.id) && component.dependencies.length === 0) {
        warnings.push(`Component ${component.name} appears to be orphaned`);
      }
    }
  }

  private validateInterfaces(design: SystemDesign, errors: string[], warnings: string[], suggestions: string[]): void {
    if (!design.architecture.interfaces || design.architecture.interfaces.length === 0) {
      warnings.push('Design should have at least one interface defined');
    }

    for (const iface of design.architecture.interfaces || []) {
      if (!iface.security || iface.security.length === 0) {
        warnings.push(`Interface ${iface.name} has no security requirements defined`);
      }
    }
  }

  private validateSecurity(design: SystemDesign, errors: string[], warnings: string[], suggestions: string[]): void {
    if (!design.architecture.securityModel) {
      errors.push('Design must have a security model');
      return;
    }

    if (!design.architecture.securityModel.authentication) {
      errors.push('Security model must define authentication');
    }

    if (!design.architecture.securityModel.encryption) {
      warnings.push('Consider adding encryption requirements');
    }
  }

  private isDeFiDesign(design: SystemDesign): boolean {
    const components = design.architecture?.components || [];
    return components.some(c => 
      /defi|blockchain|wallet|contract|token/i.test(c.name) ||
      c.responsibilities.some(r => /defi|blockchain|transaction/i.test(r))
    );
  }

  private validateDeFiPatterns(design: SystemDesign, errors: string[], warnings: string[], suggestions: string[]): void {
    // Check for security validator component
    const hasSecurityValidator = design.architecture.components.some(
      c => /security.*validator/i.test(c.name)
    );

    if (!hasSecurityValidator) {
      errors.push('DeFi design must include a Security Validator component');
    }

    // Check for audit logging
    const hasAuditComponent = design.architecture.components.some(
      c => /audit|logging/i.test(c.name)
    );

    if (!hasAuditComponent) {
      warnings.push('DeFi design should include audit logging component');
    }

    suggestions.push('Consider adding slippage protection mechanisms');
    suggestions.push('Consider implementing MEV protection');
  }

  private calculateDesignScore(errors: string[], warnings: string[], suggestions: string[]): number {
    let score = 100;
    score -= errors.length * 20;
    score -= warnings.length * 5;
    score += Math.min(suggestions.length * 2, 10); // Bonus for suggestions
    return Math.max(0, Math.min(100, score));
  }

  private recordDesignDecision(decision: Omit<DesignDecision, 'id' | 'timestamp'>): void {
    this.designDecisions.push({
      id: uuidv4(),
      timestamp: new Date(),
      ...decision
    });
  }

  private generateArchitectureRationale(requirements: Requirements, style: string): string {
    const reasons: string[] = [];

    if (style === 'microservices') {
      reasons.push('High scalability requirements detected');
      reasons.push('Complex system with multiple bounded contexts');
    } else if (style === 'serverless') {
      reasons.push('Event-driven workload pattern');
      reasons.push('Variable traffic with cost optimization needs');
    } else {
      reasons.push('Simpler deployment and maintenance');
      reasons.push('Lower operational complexity');
    }

    return reasons.join('. ');
  }

  private identifyTradeoffs(style: string): string[] {
    const tradeoffs: Record<string, string[]> = {
      microservices: [
        'Higher operational complexity',
        'Network latency between services',
        'Requires robust monitoring'
      ],
      serverless: [
        'Cold start latency',
        'Vendor lock-in risk',
        'Limited execution time'
      ],
      monolith: [
        'Limited scalability',
        'Harder to maintain as it grows',
        'Single point of failure'
      ]
    };

    return tradeoffs[style] || [];
  }
}

// Factory function
export function createProductArchitectAgent(config?: Partial<ProductArchitectConfig>): ProductArchitectAgentImpl {
  return new ProductArchitectAgentImpl(config);
}
