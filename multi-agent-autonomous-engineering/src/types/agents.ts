/**
 * Agent-specific type definitions for the Multi-Agent Autonomous Engineering System
 * These types define the interfaces and data structures specific to each agent type
 */

import { AgentId, RiskLevel, ValidationResult } from './core';

// Base agent interface
export interface BaseAgent {
  id: AgentId;
  name: string;
  version: string;
  status: AgentStatus;
  capabilities: string[];
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
}

export enum AgentStatus {
  INITIALIZING = 'initializing',
  READY = 'ready',
  BUSY = 'busy',
  ERROR = 'error',
  SHUTDOWN = 'shutdown'
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: Date;
}

// Intent Router Agent interfaces
export interface IntentRouterAgent extends BaseAgent {
  analyzeIntent(userInput: string): Promise<IntentAnalysis>;
  routeToAgents(intent: IntentAnalysis): Promise<AgentWorkflow>;
  orchestrateWorkflow(workflow: AgentWorkflow): Promise<ExecutionPlan>;
  monitorExecution(plan: ExecutionPlan): Promise<ExecutionStatus>;
}

export interface IntentAnalysis {
  primaryIntent: IntentCategory;
  secondaryIntents: IntentCategory[];
  complexity: ComplexityLevel;
  requiredAgents: AgentType[];
  estimatedDuration: number;
  riskLevel: RiskLevel;
  confidence: number;
  reasoning: string;
  parameters: Record<string, unknown>;
}

export interface ExecutionPlan {
  id: string;
  workflow: AgentWorkflow;
  schedule: ExecutionSchedule[];
  dependencies: ExecutionDependency[];
  estimatedCompletion: Date;
}

export interface ExecutionSchedule {
  stepId: string;
  agentId: AgentId;
  scheduledStart: Date;
  estimatedDuration: number;
  priority: number;
}

export interface ExecutionDependency {
  stepId: string;
  dependsOn: string[];
  type: 'blocking' | 'soft';
}

export interface ExecutionStatus {
  planId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  errors: ExecutionError[];
}

export interface ExecutionError {
  stepId: string;
  agentId: AgentId;
  error: string;
  timestamp: Date;
  recoverable: boolean;
}

// Product Architect Agent interfaces
export interface ProductArchitectAgent extends BaseAgent {
  generateArchitecture(requirements: Requirements): Promise<SystemArchitecture>;
  createUXFlows(userStories: UserStory[]): Promise<UXFlowDiagram>;
  specifyComponents(architecture: SystemArchitecture): Promise<ComponentSpec[]>;
  validateDesign(design: SystemDesign): Promise<ValidationResult>;
}

export interface Requirements {
  functional: FunctionalRequirement[];
  nonFunctional: NonFunctionalRequirement[];
  constraints: Constraint[];
  stakeholders: Stakeholder[];
}

export interface FunctionalRequirement {
  id: string;
  description: string;
  priority: 'must' | 'should' | 'could' | 'wont';
  acceptanceCriteria: string[];
}

export interface NonFunctionalRequirement {
  id: string;
  type: 'performance' | 'security' | 'usability' | 'reliability' | 'scalability';
  description: string;
  metrics: Metric[];
}

export interface Metric {
  name: string;
  target: number;
  unit: string;
  measurement: string;
}

export interface Constraint {
  type: 'technical' | 'business' | 'regulatory' | 'resource';
  description: string;
  impact: 'low' | 'medium' | 'high';
}

export interface Stakeholder {
  name: string;
  role: string;
  interests: string[];
  influence: 'low' | 'medium' | 'high';
}

export interface SystemArchitecture {
  components: Component[];
  interfaces: Interface[];
  dataFlow: DataFlowDiagram;
  deploymentModel: DeploymentSpec;
  scalabilityConsiderations: ScalabilityPlan;
  securityModel: SecurityModel;
}

export interface Component {
  id: string;
  name: string;
  type: 'service' | 'database' | 'queue' | 'cache' | 'gateway';
  responsibilities: string[];
  dependencies: string[];
  interfaces: string[];
}

export interface Interface {
  id: string;
  name: string;
  type: 'rest' | 'graphql' | 'grpc' | 'websocket' | 'message_queue';
  specification: Record<string, unknown>;
  security: SecurityRequirement[];
}

export interface SecurityRequirement {
  type: 'authentication' | 'authorization' | 'encryption' | 'validation';
  description: string;
  implementation: string;
}

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  estimatedEffort: number;
}

export interface UXFlowDiagram {
  flows: UserFlow[];
  screens: Screen[];
  interactions: Interaction[];
}

export interface UserFlow {
  id: string;
  name: string;
  steps: FlowStep[];
  entryPoints: string[];
  exitPoints: string[];
}

export interface FlowStep {
  id: string;
  name: string;
  type: 'action' | 'decision' | 'input' | 'output';
  description: string;
  nextSteps: string[];
}

export interface Screen {
  id: string;
  name: string;
  components: UIComponent[];
  navigation: NavigationOption[];
}

export interface UIComponent {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  events: string[];
}

export interface NavigationOption {
  trigger: string;
  destination: string;
  conditions?: string[];
}

export interface Interaction {
  id: string;
  type: 'click' | 'input' | 'swipe' | 'voice' | 'gesture';
  source: string;
  target: string;
  effect: string;
}

// Code Engineer Agent interfaces
export interface CodeEngineerAgent extends BaseAgent {
  generateCode(specification: CodeSpec): Promise<GeneratedCode>;
  refactorCode(codebase: Codebase, improvements: Improvement[]): Promise<RefactoredCode>;
  optimizePerformance(code: Code): Promise<OptimizedCode>;
  enforceStandards(code: Code, standards: CodingStandards): Promise<StandardizedCode>;
}

export interface CodeSpec {
  language: string;
  framework?: string;
  requirements: string[];
  constraints: string[];
  architecture: ComponentSpec;
  testRequirements: TestRequirement[];
}

export interface ComponentSpec {
  name: string;
  type: 'class' | 'function' | 'module' | 'service';
  interfaces: InterfaceSpec[];
  dependencies: string[];
  configuration: Record<string, unknown>;
}

export interface InterfaceSpec {
  name: string;
  methods: MethodSpec[];
  properties: PropertySpec[];
}

export interface MethodSpec {
  name: string;
  parameters: ParameterSpec[];
  returnType: string;
  description: string;
  examples: string[];
}

export interface ParameterSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: unknown;
}

export interface PropertySpec {
  name: string;
  type: string;
  readonly: boolean;
  description: string;
}

export interface TestRequirement {
  type: 'unit' | 'integration' | 'property' | 'performance';
  coverage: number;
  scenarios: string[];
}

export interface GeneratedCode {
  files: CodeFile[];
  dependencies: Dependency[];
  buildConfiguration: BuildConfig;
  documentation: Documentation;
  testSuggestions: TestSuggestion[];
}

export interface CodeFile {
  path: string;
  content: string;
  language: string;
  type: 'source' | 'test' | 'config' | 'documentation';
  metadata: FileMetadata;
}

export interface FileMetadata {
  author: string;
  created: Date;
  modified: Date;
  version: string;
  checksum: string;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'runtime' | 'development' | 'peer';
  source: string;
}

export interface BuildConfig {
  scripts: Record<string, string>;
  environment: Record<string, string>;
  targets: BuildTarget[];
}

export interface BuildTarget {
  name: string;
  platform: string;
  configuration: Record<string, unknown>;
}

export interface Documentation {
  readme: string;
  apiDocs: string;
  examples: Example[];
  changelog: string;
}

export interface Example {
  title: string;
  description: string;
  code: string;
  language: string;
}

export interface TestSuggestion {
  type: 'unit' | 'integration' | 'property';
  target: string;
  description: string;
  priority: number;
}

// Test Agent interfaces
export interface TestAgent extends BaseAgent {
  generateTests(code: Code, coverage: CoverageRequirements): Promise<TestSuite>;
  debugIssues(failures: TestFailure[]): Promise<DebugAnalysis>;
  applyFixes(issues: Issue[]): Promise<FixResult>;
  validateFixes(fixes: Fix[]): Promise<ValidationResult>;
}

export interface Code {
  files: CodeFile[];
  entryPoint: string;
  dependencies: Dependency[];
}

export interface CoverageRequirements {
  minimum: number;
  target: number;
  excludePatterns: string[];
  includePatterns: string[];
}

export interface TestSuite {
  unitTests: UnitTest[];
  integrationTests: IntegrationTest[];
  propertyTests: PropertyTest[];
  coverageReport: CoverageReport;
  executionPlan: TestExecutionPlan;
}

export interface UnitTest {
  id: string;
  name: string;
  target: string;
  testCases: TestCase[];
  setup?: string;
  teardown?: string;
}

export interface TestCase {
  name: string;
  inputs: Record<string, unknown>;
  expectedOutput: unknown;
  assertions: Assertion[];
}

export interface Assertion {
  type: 'equals' | 'contains' | 'throws' | 'matches';
  expected: unknown;
  message: string;
}

export interface IntegrationTest {
  id: string;
  name: string;
  components: string[];
  scenario: string;
  steps: TestStep[];
}

export interface TestStep {
  action: string;
  parameters: Record<string, unknown>;
  expectedResult: unknown;
  timeout: number;
}

export interface PropertyTest {
  id: string;
  name: string;
  property: string;
  generators: Generator[];
  iterations: number;
  shrinking: boolean;
}

export interface Generator {
  name: string;
  type: string;
  constraints: Record<string, unknown>;
}

export interface CoverageReport {
  overall: number;
  byFile: Record<string, number>;
  byFunction: Record<string, number>;
  uncoveredLines: UncoveredLine[];
}

export interface UncoveredLine {
  file: string;
  line: number;
  reason: string;
}

export interface TestExecutionPlan {
  phases: ExecutionPhase[];
  parallelism: number;
  timeout: number;
  retryPolicy: RetryPolicy;
}

export interface ExecutionPhase {
  name: string;
  tests: string[];
  dependencies: string[];
  timeout: number;
}

export interface TestFailure {
  testId: string;
  error: string;
  stackTrace: string;
  inputs: Record<string, unknown>;
  expectedOutput: unknown;
  actualOutput: unknown;
}

export interface DebugAnalysis {
  rootCause: string;
  affectedComponents: string[];
  suggestedFixes: SuggestedFix[];
  confidence: number;
}

export interface SuggestedFix {
  description: string;
  changes: CodeChange[];
  riskLevel: RiskLevel;
  testRequired: boolean;
}

export interface CodeChange {
  file: string;
  line: number;
  oldCode: string;
  newCode: string;
  reason: string;
}

export interface Issue {
  id: string;
  type: 'bug' | 'performance' | 'security' | 'style';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: CodeLocation;
  suggestedFix?: SuggestedFix;
}

export interface CodeLocation {
  file: string;
  line: number;
  column: number;
  function?: string;
}

export interface Fix {
  issueId: string;
  changes: CodeChange[];
  description: string;
  testCases: TestCase[];
}

export interface FixResult {
  appliedFixes: Fix[];
  failedFixes: FailedFix[];
  newIssues: Issue[];
  testResults: TestResult[];
}

export interface FailedFix {
  fix: Fix;
  error: string;
  reason: string;
}

export interface TestResult {
  testId: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
}

// Common types used across agents
export enum IntentCategory {
  CODE_GENERATION = 'code_generation',
  TESTING = 'testing',
  SECURITY_VALIDATION = 'security_validation',
  RESEARCH = 'research',
  SYSTEM_DESIGN = 'system_design',
  DEFI_OPERATION = 'defi_operation',
  REFACTORING = 'refactoring',
  DEBUGGING = 'debugging',
  DEPLOYMENT = 'deployment'
}

export enum AgentType {
  INTENT_ROUTER = 'intent_router',
  PRODUCT_ARCHITECT = 'product_architect',
  CODE_ENGINEER = 'code_engineer',
  TEST_AGENT = 'test_agent',
  SECURITY_VALIDATOR = 'security_validator',
  RESEARCH_AGENT = 'research_agent',
  AUDIT_AGENT = 'audit_agent'
}

export enum ComplexityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AgentWorkflow {
  id: string;
  name: string;
  initiatingAgent?: AgentId;
  participatingAgents?: AgentId[];
  steps: WorkflowStep[];
  status: string;
  dependencies: Array<{ stepId: string; dependsOn: string[] }>;
  parallelGroups: string[][];
  intent: IntentAnalysis;
  outputs?: WorkflowOutput[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface WorkflowStep {
  id: string;
  agentId?: AgentId;
  agentType: AgentType;
  action: string;
  order: number;
  timeout: number;
  required: boolean;
  inputs?: StepInput[];
  outputs?: StepOutput[];
  status?: string;
  executionTime?: number;
  retryCount?: number;
  maxRetries?: number;
  errorMessage?: string;
  parameters?: Record<string, unknown>;
}

export interface StepInput {
  name: string;
  value: unknown;
  type: string;
  required: boolean;
}

export interface StepOutput {
  name: string;
  value: unknown;
  type: string;
  timestamp: Date;
}

export interface WorkflowOutput {
  name: string;
  value: unknown;
  type: string;
  agentId: AgentId;
  stepId: string;
}

export interface Codebase {
  id: string;
  name: string;
  files: CodeFile[];
  dependencies: Dependency[];
  metadata: CodebaseMetadata;
}

export interface CodebaseMetadata {
  language: string;
  framework?: string;
  version: string;
  lastModified: Date;
  contributors: string[];
}

export interface Improvement {
  type: 'performance' | 'readability' | 'maintainability' | 'security';
  description: string;
  priority: number;
  estimatedEffort: number;
}

export interface RefactoredCode {
  originalCode: Code;
  refactoredCode: Code;
  changes: CodeChange[];
  improvements: AppliedImprovement[];
  metrics: RefactoringMetrics;
}

export interface AppliedImprovement {
  improvement: Improvement;
  applied: boolean;
  reason: string;
  impact: string;
}

export interface RefactoringMetrics {
  linesChanged: number;
  filesModified: number;
  complexityReduction: number;
  performanceImprovement: number;
}

export interface OptimizedCode {
  originalCode: Code;
  optimizedCode: Code;
  optimizations: Optimization[];
  performanceGains: PerformanceGain[];
}

export interface Optimization {
  type: 'algorithmic' | 'memory' | 'io' | 'network';
  description: string;
  location: CodeLocation;
  impact: string;
}

export interface PerformanceGain {
  metric: string;
  before: number;
  after: number;
  improvement: number;
  unit: string;
}

export interface CodingStandards {
  language: string;
  rules: CodingRule[];
  formatting: FormattingRules;
  naming: NamingConventions;
}

export interface CodingRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  autoFixable: boolean;
}

export interface FormattingRules {
  indentation: string;
  lineLength: number;
  trailingWhitespace: boolean;
  finalNewline: boolean;
}

export interface NamingConventions {
  variables: string;
  functions: string;
  classes: string;
  constants: string;
  files: string;
}

export interface StandardizedCode {
  originalCode: Code;
  standardizedCode: Code;
  violations: StandardViolation[];
  fixes: StandardFix[];
}

export interface StandardViolation {
  rule: string;
  location: CodeLocation;
  message: string;
  severity: string;
}

export interface StandardFix {
  violation: StandardViolation;
  fix: CodeChange;
  applied: boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface DataFlowDiagram {
  nodes: DataNode[];
  edges: DataEdge[];
  stores: DataStore[];
}

export interface DataNode {
  id: string;
  name: string;
  type: 'process' | 'external_entity' | 'data_store';
  description: string;
}

export interface DataEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  dataType: string;
}

export interface DataStore {
  id: string;
  name: string;
  type: 'database' | 'file' | 'cache' | 'queue';
  schema?: Record<string, unknown>;
}

export interface DeploymentSpec {
  environments: Environment[];
  infrastructure: Infrastructure[];
  scaling: ScalingPolicy[];
}

export interface Environment {
  name: string;
  type: 'development' | 'staging' | 'production';
  configuration: Record<string, unknown>;
  resources: ResourceAllocation;
}

export interface ResourceAllocation {
  cpu: string;
  memory: string;
  storage: string;
  network: string;
}

export interface Infrastructure {
  component: string;
  type: 'container' | 'vm' | 'serverless' | 'managed_service';
  configuration: Record<string, unknown>;
}

export interface ScalingPolicy {
  component: string;
  metric: string;
  threshold: number;
  action: 'scale_up' | 'scale_down';
  cooldown: number;
}

export interface ScalabilityPlan {
  horizontalScaling: ScalingStrategy[];
  verticalScaling: ScalingStrategy[];
  bottlenecks: Bottleneck[];
  recommendations: string[];
}

export interface ScalingStrategy {
  component: string;
  strategy: string;
  triggers: string[];
  limits: ScalingLimits;
}

export interface ScalingLimits {
  minInstances: number;
  maxInstances: number;
  maxCpu: number;
  maxMemory: number;
}

export interface Bottleneck {
  component: string;
  type: 'cpu' | 'memory' | 'io' | 'network' | 'database';
  description: string;
  impact: string;
  mitigation: string;
}

export interface SecurityModel {
  authentication: AuthenticationModel;
  authorization: AuthorizationModel;
  encryption: EncryptionModel;
  monitoring: SecurityMonitoring;
}

export interface AuthenticationModel {
  methods: string[];
  providers: string[];
  tokenLifetime: number;
  mfaRequired: boolean;
}

export interface AuthorizationModel {
  model: 'rbac' | 'abac' | 'acl';
  roles: Role[];
  permissions: Permission[];
  policies: Policy[];
}

export interface Role {
  name: string;
  description: string;
  permissions: string[];
  inherits?: string[];
}

export interface Permission {
  name: string;
  resource: string;
  actions: string[];
  conditions?: Record<string, unknown>;
}

export interface Policy {
  name: string;
  description: string;
  rules: PolicyRule[];
}

export interface PolicyRule {
  effect: 'allow' | 'deny';
  subjects: string[];
  resources: string[];
  actions: string[];
  conditions?: Record<string, unknown>;
}

export interface EncryptionModel {
  atRest: EncryptionConfig;
  inTransit: EncryptionConfig;
  keyManagement: KeyManagementConfig;
}

export interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  mode: string;
}

export interface KeyManagementConfig {
  provider: string;
  rotation: number;
  backup: boolean;
  hsm: boolean;
}

export interface SecurityMonitoring {
  logging: LoggingConfig;
  alerting: AlertingConfig;
  metrics: SecurityMetric[];
}

export interface LoggingConfig {
  level: string;
  retention: number;
  encryption: boolean;
  anonymization: boolean;
}

export interface AlertingConfig {
  channels: string[];
  thresholds: Record<string, number>;
  escalation: EscalationPolicy[];
}

export interface EscalationPolicy {
  level: number;
  delay: number;
  recipients: string[];
  actions: string[];
}

export interface SecurityMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description: string;
  labels: string[];
}

export interface SystemDesign {
  architecture: SystemArchitecture;
  uxFlows: UXFlowDiagram;
  components: ComponentSpec[];
  requirements: Requirements;
}

// Audit Agent Types
export interface AuditAgent extends BaseAgent {
  logAudit(entry: AuditEntryInput): string;
  logAgentAction(action: AgentAction): void;
  startExecution(planId: string, plan: ExecutionPlan): void;
  completeExecution(planId: string, status: ExecutionStatus): void;
  logResourceUsage(usage: ResourceUsage): void;
  generateAuditReport(startDate: Date, endDate: Date): Promise<AuditReport>;
  checkCompliance(entries: AuditEntry[]): ComplianceAudit;
}

export interface AuditEntryInput {
  action: string;
  actor: string;
  resource: string;
  outcome: 'success' | 'failure' | 'partial';
  details?: Record<string, unknown>;
  riskLevel?: RiskLevel;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  resource: string;
  outcome: 'success' | 'failure' | 'partial';
  details?: Record<string, unknown>;
  riskLevel?: RiskLevel;
}

export interface AuditLog {
  entries: AuditEntry[];
  startTime: Date;
  endTime: Date;
  summary: AuditSummary;
}

export interface AuditSummary {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  byActor: Record<string, number>;
  byResource: Record<string, number>;
}

export interface AgentAction {
  agentId: string;
  agentType: AgentType;
  action: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  duration: number;
  success: boolean;
  error?: string;
}

export interface ResourceUsage {
  agentId: string;
  cpuPercent: number;
  memoryMB: number;
  networkKB?: number;
  diskMB?: number;
  timestamp: Date;
}

export interface AuditReport {
  id: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: AuditReportSummary;
  entries: AuditEntry[];
  compliance: ComplianceAudit;
  recommendations: string[];
}

export interface AuditReportSummary {
  totalEntries: number;
  byOutcome: Record<string, number>;
  byActor: Record<string, number>;
  byResource: Record<string, number>;
  riskDistribution: Record<string, number>;
}

export interface ComplianceAudit {
  compliant: boolean;
  score: number;
  violations: ComplianceViolation[];
  recommendations: string[];
}

export interface ComplianceViolation {
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedEntries: string[];
}

export interface AuditFilter {
  startDate?: Date;
  endDate?: Date;
  actors?: string[];
  resources?: string[];
  outcomes?: string[];
  riskLevels?: RiskLevel[];
}

// Re-export common types from core
export type { AgentId, RiskLevel, ValidationResult } from './core';

// Additional Message Types
export interface AgentMessage {
  id: string;
  from: AgentId;
  to: AgentType;
  type: 'request' | 'response' | 'event' | 'error';
  payload: unknown;
  timestamp: Date;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentConfig {
  id?: string;
  name: string;
  type: AgentType;
  enabled: boolean;
  capabilities?: string[];
  timeout?: number;
  retryPolicy?: RetryPolicy;
  sandbox?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export enum AgentRole {
  COORDINATOR = 'coordinator',
  WORKER = 'worker',
  VALIDATOR = 'validator',
  MONITOR = 'monitor'
}

// Research Agent Types
export interface ResearchAgent extends BaseAgent {
  research(query: ResearchQuery): Promise<ResearchResult>;
  updateKnowledge(entry: KnowledgeEntry): Promise<void>;
  getBestPractices(domain: string): Promise<BestPractice[]>;
  analyzePatterns(codebase: string): Promise<PatternRecommendation[]>;
}

export interface ResearchQuery {
  topic: string;
  context?: string;
  depth?: 'basic' | 'detailed' | 'comprehensive';
  sources?: string[];
  filters?: Record<string, unknown>;
}

export interface ResearchResult {
  query: ResearchQuery;
  findings: ResearchFinding[];
  summary: string;
  confidence: number;
  sources: string[];
  timestamp: Date;
}

export interface ResearchFinding {
  title: string;
  content: string;
  relevance: number;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  domain: string;
  entries: KnowledgeEntry[];
  lastUpdated: Date;
}

export interface KnowledgeEntry {
  id: string;
  topic: string;
  content: string;
  category?: string;
  tags: string[];
  confidence: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BestPractice {
  id: string;
  domain: string;
  title: string;
  description: string;
  examples: string[];
  applicability: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface PatternRecommendation {
  pattern: string;
  description: string;
  applicability: number;
  benefits: string[];
  tradeoffs: string[];
  implementation: string;
}

export interface TechnologyAnalysis {
  name: string;
  category: string;
  maturity: 'emerging' | 'growing' | 'mature' | 'declining';
  strengths: string[];
  weaknesses: string[];
  useCases: string[];
  alternatives: string[];
  recommendation: string;
}

export interface CompetitorAnalysis {
  name: string;
  strengths: string[];
  weaknesses: string[];
  marketPosition: string;
  features: Record<string, boolean>;
  pricing?: string;
}

export interface TrendAnalysis {
  topic: string;
  direction: 'rising' | 'stable' | 'declining';
  momentum: number;
  timeframe: string;
  indicators: string[];
  prediction: string;
}