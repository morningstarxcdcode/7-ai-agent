/**
 * Jest test setup file
 * Configures global test environment and utilities
 */

import { resetMessageBus } from '../src/core/message-bus';

// Global test timeout
jest.setTimeout(30000);

// Setup before each test
beforeEach(() => {
  // Reset message bus to ensure clean state
  resetMessageBus();
  
  // Clear any environment variables that might affect tests
  delete process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'test';
});

// Cleanup after each test
afterEach(() => {
  // Reset message bus
  resetMessageBus();
  
  // Clear any timers
  jest.clearAllTimers();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log
});

// Mock console methods in tests to reduce noise
const originalConsole = { ...console };

beforeAll(() => {
  // Only mock in test environment
  if (process.env['NODE_ENV'] === 'test') {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    // Keep console.error for debugging
  }
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Property-based testing utilities
export const PropertyTestConfig = {
  // Default number of iterations for property tests
  iterations: 100,
  
  // Seed for reproducible tests (can be overridden)
  seed: 42,
  
  // Timeout for individual property test cases
  timeout: 5000,
  
  // Enable shrinking for better counterexample reporting
  shrinking: true,
  
  // Verbose output for property test failures
  verbose: true
};

// Test utilities for agent testing
export class TestUtils {
  /**
   * Create a mock agent ID for testing
   */
  static createMockAgentId(prefix = 'test-agent'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Wait for a condition to be true with timeout
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeoutMs = 5000,
    intervalMs = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (await condition()) {
        return;
      }
      await this.sleep(intervalMs);
    }
    
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a promise that resolves after specified time
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a promise that rejects after specified time
   */
  static timeout(ms: number, message = 'Operation timed out'): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error(message)), ms)
    );
  }

  /**
   * Race a promise against a timeout
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      promise,
      this.timeout(timeoutMs, timeoutMessage)
    ]);
  }

  /**
   * Generate random string for testing
   */
  static randomString(length = 10): string {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random boolean
   */
  static randomBoolean(): boolean {
    return Math.random() < 0.5;
  }

  /**
   * Pick random element from array
   */
  static randomElement<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Create mock message payload
   */
  static createMockPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      requestId: this.randomString(),
      data: {
        test: true,
        value: this.randomInt(1, 100)
      },
      ...overrides
    };
  }

  /**
   * Validate property test result format
   */
  static validatePropertyTestResult(result: unknown): boolean {
    return (
      typeof result === 'object' &&
      result !== null &&
      'property' in result &&
      'iterations' in result &&
      'passed' in result
    );
  }
}

// Export test configuration
export const TestConfig = {
  // Default timeouts
  defaultTimeout: 5000,
  longTimeout: 30000,
  
  // Test data limits
  maxTestDataSize: 1000,
  maxIterations: 1000,
  
  // Mock configuration
  enableMocks: true,
  mockNetworkCalls: true,
  
  // Property testing
  propertyTest: PropertyTestConfig
};

// Global test matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidAgentId(): R;
      toBeValidMessage(): R;
      toHaveValidStructure(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidAgentId(received: unknown) {
    const pass = typeof received === 'string' && received.length > 0;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid agent ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid agent ID (non-empty string)`,
        pass: false,
      };
    }
  },

  toBeValidMessage(received: unknown) {
    const isObject = typeof received === 'object' && received !== null;
    const hasRequiredFields = isObject && 
      'id' in received && 
      'from' in received && 
      'to' in received && 
      'type' in received && 
      'payload' in received;
    
    const pass = isObject && hasRequiredFields;
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid message`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid message with required fields (id, from, to, type, payload)`,
        pass: false,
      };
    }
  },

  toHaveValidStructure(received: unknown) {
    const pass = typeof received === 'object' && received !== null;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to have valid structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to have valid structure (be an object)`,
        pass: false,
      };
    }
  }
});

// Export for use in tests
export { TestUtils as default };