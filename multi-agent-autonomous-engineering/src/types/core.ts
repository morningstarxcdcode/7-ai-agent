/**
 * Core type definitions for the Multi-Agent Autonomous Engineering System
 * These types define the fundamental data structures and interfaces used across all agents
 */

// Unique identifiers
export type AgentId = string;
export type UserId = string;
export type SessionId = string;
export type WorkflowId = string;
export type StepId = string;
export type MessageId = string;
export type TransactionId = string;
export type CodebaseId = string;
export type HookId = string;
export type IntegrationId = string;
export type ViolationId = string;

// Enumerations
export enum AgentType {
  INTENT_ROUTER = 'intent_router',
  PRODUCT_ARCHITECT = 'product_architect',
  CODE_ENGINEER = 'code_engineer',
  TEST_AGENT = 'test_agent',
  SECURITY_VALIDATOR = 'security_validator',
  RESEARCH_AGENT = 'research_agent',
  AUDIT_AGENT = 'audit_agent'
}

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

export enum ComplexityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum WorkflowStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum StepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  EVENT = 'event',
  ERROR = 'error',
  CANCEL_STEP = 'cancel_step'
}

export enum Priority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

// Core interfaces
export interface User {
  id: UserId;
  profile: UserProfile;
  permissions: Permission[];
  sessionHistory: Session[];
  preferences: UserPreferences;
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  lastActive: Date;
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, unknown>;
}

export interface UserPreferences {
  riskTolerance: RiskLevel;
  defaultSlippageTolerance: number;
  preferredLanguages: string[];
  notificationSettings: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  securityAlerts: boolean;
}

export interface Session {
  id: SessionId;
  userId: UserId;
  startTime: Date;
  endTime?: Date;
  activities: Activity[];
  riskLevel: RiskLevel;
}

export interface Activity {
  id: string;
  type: string;
  timestamp: Date;
  description: string;
  metadata: Record<string, unknown>;
}

// Agent communication interfaces
export interface Message {
  id: MessageId;
  from: AgentId;
  to: AgentId;
  type: MessageType;
  timestamp: Date;
  payload: Record<string, unknown>;
  priority: Priority;
  correlationId?: string;
  replyTo?: MessageId;
}

export interface AgentWorkflow {
  id: WorkflowId;
  initiatingAgent: AgentId;
  participatingAgents: AgentId[];
  steps: WorkflowStep[];
  status: WorkflowStatus;
  dependencies: Dependency[];
  outputs: WorkflowOutput[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStep {
  id: StepId;
  agentId: AgentId;
  action: string;
  inputs: StepInput[];
  outputs: StepOutput[];
  status: StepStatus;
  executionTime?: number;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
}

export interface Dependency {
  stepId: StepId;
  dependsOn: StepId[];
  type: 'sequential' | 'parallel' | 'conditional';
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
  stepId: StepId;
}

// Intent analysis interfaces
export interface IntentAnalysis {
  primaryIntent: IntentCategory;
  secondaryIntents: IntentCategory[];
  complexity: ComplexityLevel;
  requiredAgents: AgentType[];
  estimatedDuration: number;
  riskLevel: RiskLevel;
  confidence: number;
  reasoning: string;
}

// Audit and compliance interfaces
export interface AuditEntry {
  id: string;
  timestamp: Date;
  agentId: AgentId;
  operation: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  reasoning: string;
  riskAssessment: RiskAssessment;
  userId?: UserId;
  sessionId?: SessionId;
}

export interface RiskAssessment {
  level: RiskLevel;
  factors: RiskFactor[];
  mitigations: string[];
  requiresApproval: boolean;
}

export interface RiskFactor {
  type: string;
  severity: RiskLevel;
  description: string;
  likelihood: number;
  impact: number;
}

// Error handling interfaces
export interface SystemError {
  code: string;
  message: string;
  details?: string;
  timestamp: Date;
  agentId?: AgentId;
  userId?: UserId;
  stackTrace?: string;
  context?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

// Configuration interfaces
export interface AgentConfig {
  id: AgentId;
  type: AgentType;
  enabled: boolean;
  maxConcurrentTasks: number;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  resources: ResourceLimits;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxExecutionTimeMs: number;
  maxNetworkRequestsPerMinute: number;
}

// Sandbox environment interfaces
export interface SandboxEnvironment {
  id: string;
  agentId: AgentId;
  isolated: boolean;
  resourceLimits: ResourceLimits;
  allowedOperations: string[];
  blockedOperations: string[];
  networkAccess: NetworkAccessConfig;
}

export interface NetworkAccessConfig {
  allowedDomains: string[];
  blockedDomains: string[];
  allowedPorts: number[];
  rateLimits: Record<string, number>;
}

// Monitoring and metrics interfaces
export interface PerformanceMetrics {
  agentId: AgentId;
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  networkRequests: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
}

export interface HealthCheck {
  agentId: AgentId;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: HealthCheckResult[];
}

export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration: number;
}