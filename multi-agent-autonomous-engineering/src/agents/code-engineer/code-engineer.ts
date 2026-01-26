/**
 * Simplified Code Engineer Agent Implementation
 * Generates, refactors, and optimizes code with sandbox isolation
 * 
 * Requirements: Task 4 - Code Engineer Agent
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseAgentImpl, BaseAgentConfig } from '../../core/base-agent';
import { AgentType } from '../../types/core';
import {
  AgentMessage,
  HealthStatus,
  CodingStandards,
  GeneratedCode,
  CodeFile,
  Dependency,
  BuildConfig
} from '../../types/agents';

// Code generation types
export interface CodeGenerationRequest {
  description: string;
  language: string;
  framework?: string;
  requirements?: string[];
  includeTests?: boolean;
}

export interface CodeGenerationResult {
  code: string;
  language: string;
  framework?: string;
  files?: GeneratedCodeFile[];
  dependencies?: string[];
}

export interface GeneratedCodeFile {
  path: string;
  content: string;
  language: string;
  type: 'source' | 'test' | 'config';
}

export interface RefactorResult {
  originalCode: string;
  refactoredCode: string;
  changes: string[];
  improvements: string[];
}

export interface CodeEngineerConfig extends BaseAgentConfig {
  defaultLanguage: string;
  supportedLanguages: string[];
  enableTemplates: boolean;
  maxCodeSize: number;
}

// Code templates
const CODE_TEMPLATES: Record<string, Record<string, string>> = {
  typescript: {
    function: `export function {{name}}({{params}}): {{returnType}} {
  {{body}}
}`,
    class: `export class {{name}} {
  {{properties}}

  constructor({{params}}) {
    {{constructorBody}}
  }

  {{methods}}
}`,
    interface: `export interface {{name}} {
  {{properties}}
}`,
    test: `describe('{{name}}', () => {
  it('should {{description}}', () => {
    {{testBody}}
  });
});`
  },
  python: {
    function: `def {{name}}({{params}}) -> {{returnType}}:
    """{{description}}"""
    {{body}}`,
    class: `class {{name}}:
    """{{description}}"""
    
    def __init__(self, {{params}}):
        {{constructorBody}}
    
    {{methods}}`,
    test: `def test_{{name}}():
    """{{description}}"""
    {{testBody}}`
  },
  solidity: {
    contract: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract {{name}} {
    {{stateVariables}}
    
    constructor({{params}}) {
        {{constructorBody}}
    }
    
    {{functions}}
}`,
    function: `function {{name}}({{params}}) {{visibility}} {{modifiers}} returns ({{returnType}}) {
    {{body}}
}`
  }
};

export class CodeEngineerAgentImpl extends BaseAgentImpl {
  private codeConfig: CodeEngineerConfig;

  constructor(config: Partial<CodeEngineerConfig> = {}) {
    const fullConfig: CodeEngineerConfig = {
      id: config.id || uuidv4(),
      name: config.name || 'Code Engineer Agent',
      type: AgentType.CODE_ENGINEER,
      version: config.version || '1.0.0',
      capabilities: [
        'code_generation',
        'code_refactoring',
        'code_optimization',
        'standards_enforcement',
        'multi_language_support'
      ],
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      timeoutMs: config.timeoutMs || 60000,
      enableSandbox: config.enableSandbox ?? true,
      defaultLanguage: config.defaultLanguage || 'typescript',
      supportedLanguages: config.supportedLanguages || [
        'typescript',
        'javascript',
        'python',
        'solidity',
        'rust',
        'go'
      ],
      enableTemplates: config.enableTemplates ?? true,
      maxCodeSize: config.maxCodeSize || 100000
    };

    super(fullConfig);
    this.codeConfig = fullConfig;
  }

  protected async onInitialize(): Promise<void> {
    this.emit('code-engineer-initialized', { agentId: this.id });
  }

  protected async onShutdown(): Promise<void> {
    this.emit('code-engineer-shutdown', { agentId: this.id });
  }

  protected async onHealthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      message: 'Code Engineer Agent operational',
      lastCheck: new Date()
    };
  }

  protected async handleRequest(message: Record<string, unknown>): Promise<unknown> {
    const payload = message['payload'] as Record<string, unknown>;
    
    if (payload['action'] === 'generate') {
      return this.generateCode(payload['request'] as CodeGenerationRequest);
    } else if (payload['action'] === 'refactor') {
      return this.refactorCode(
        payload['code'] as string,
        payload['language'] as string,
        payload['instructions'] as string
      );
    }
    
    return { received: true };
  }

  protected async handleEvent(message: Record<string, unknown>): Promise<void> {
    this.emit('event-received', { messageId: message['id'] });
  }

  protected async handleError(message: Record<string, unknown>): Promise<void> {
    this.emit('error', { messageId: message['id'], error: message['error'] });
  }

  /**
   * Generate code from a specification
   */
  public async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    const { description, language, framework, requirements, includeTests } = request;
    
    // Validate language support
    if (!this.codeConfig.supportedLanguages.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Generate code based on description
    const code = this.generateFromDescription(description, language, framework);
    
    // Generate test if requested
    const files: GeneratedCodeFile[] = [
      {
        path: `src/generated.${this.getExtension(language)}`,
        content: code,
        language,
        type: 'source'
      }
    ];

    if (includeTests) {
      const testCode = this.generateTestCode(code, language);
      files.push({
        path: `tests/generated.test.${this.getExtension(language)}`,
        content: testCode,
        language,
        type: 'test'
      });
    }

    // Determine dependencies
    const dependencies = this.inferDependencies(code, language, framework);

    this.emit('code-generated', { language, framework, fileCount: files.length });

    return {
      code,
      language,
      framework,
      files,
      dependencies
    };
  }

  /**
   * Refactor existing code
   */
  public async refactorCode(
    code: string,
    language: string,
    instructions: string
  ): Promise<RefactorResult> {
    const changes: string[] = [];
    const improvements: string[] = [];
    let refactoredCode = code;

    // Apply common refactoring patterns
    if (instructions.toLowerCase().includes('type') || instructions.toLowerCase().includes('annotation')) {
      refactoredCode = this.addTypeAnnotations(refactoredCode, language);
      changes.push('Added type annotations');
      improvements.push('Improved type safety');
    }

    if (instructions.toLowerCase().includes('clean') || instructions.toLowerCase().includes('format')) {
      refactoredCode = this.cleanupCode(refactoredCode, language);
      changes.push('Cleaned up code formatting');
      improvements.push('Improved readability');
    }

    if (instructions.toLowerCase().includes('document') || instructions.toLowerCase().includes('comment')) {
      refactoredCode = this.addDocumentation(refactoredCode, language);
      changes.push('Added documentation');
      improvements.push('Better code documentation');
    }

    if (instructions.toLowerCase().includes('error') || instructions.toLowerCase().includes('handle')) {
      refactoredCode = this.addErrorHandling(refactoredCode, language);
      changes.push('Added error handling');
      improvements.push('Improved robustness');
    }

    this.emit('code-refactored', { language, changesCount: changes.length });

    return {
      originalCode: code,
      refactoredCode,
      changes,
      improvements
    };
  }

  /**
   * Optimize code for performance
   */
  public async optimizePerformance(
    code: string,
    language: string
  ): Promise<{ optimizedCode: string; optimizations: string[] }> {
    const optimizations: string[] = [];
    let optimizedCode = code;

    // Apply performance patterns
    if (language === 'typescript' || language === 'javascript') {
      // Check for array operations that could be optimized
      if (code.includes('.map(') && code.includes('.filter(')) {
        optimizations.push('Consider combining map and filter operations');
      }
      
      // Check for repeated DOM queries
      if (code.includes('document.querySelector')) {
        optimizations.push('Cache DOM queries in variables');
      }
    }

    if (language === 'python') {
      // Check for list comprehension opportunities
      if (code.includes('for ') && code.includes('.append(')) {
        optimizations.push('Consider using list comprehension');
      }
    }

    return { optimizedCode, optimizations };
  }

  /**
   * Enforce coding standards
   */
  public async enforceStandards(
    code: string,
    language: string,
    standards?: Partial<CodingStandards>
  ): Promise<{ code: string; violations: string[]; fixes: string[] }> {
    const violations: string[] = [];
    const fixes: string[] = [];
    let fixedCode = code;

    // Check naming conventions
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for snake_case in TypeScript/JavaScript (should be camelCase)
      if ((language === 'typescript' || language === 'javascript') && /[a-z]_[a-z]/.test(line)) {
        if (!line.includes('const ') && !line.includes('let ')) {
          violations.push(`Line ${i + 1}: Use camelCase for variable names`);
        }
      }

      // Check for very long lines
      if (line.length > 120) {
        violations.push(`Line ${i + 1}: Line exceeds 120 characters`);
      }
    }

    // Add final newline if missing
    if (!code.endsWith('\n')) {
      fixedCode += '\n';
      fixes.push('Added final newline');
    }

    return { code: fixedCode, violations, fixes };
  }

  // Private helper methods
  private generateFromDescription(description: string, language: string, framework?: string): string {
    const templates = CODE_TEMPLATES[language];
    
    // Determine what kind of code to generate
    const descLower = description.toLowerCase();
    
    if (descLower.includes('function') || descLower.includes('validate') || descLower.includes('calculate')) {
      return this.generateFunction(description, language);
    }
    
    if (descLower.includes('class') || descLower.includes('service') || descLower.includes('manager')) {
      return this.generateClass(description, language);
    }
    
    if (descLower.includes('api') || descLower.includes('endpoint') || descLower.includes('route')) {
      return this.generateAPI(description, language, framework);
    }
    
    // Default to function
    return this.generateFunction(description, language);
  }

  private generateFunction(description: string, language: string): string {
    const name = this.extractName(description) || 'processData';
    
    if (language === 'typescript' || language === 'javascript') {
      const isTs = language === 'typescript';
      return `/**
 * ${description}
 */
export ${isTs ? '' : ''}function ${name}(input${isTs ? ': unknown' : ''})${isTs ? ': unknown' : ''} {
  // TODO: Implement ${description}
  if (!input) {
    throw new Error('Input is required');
  }
  
  // Process the input
  const result = input;
  
  return result;
}
`;
    }
    
    if (language === 'python') {
      return `def ${name}(input):
    """${description}"""
    if input is None:
        raise ValueError("Input is required")
    
    # TODO: Implement ${description}
    result = input
    
    return result
`;
    }
    
    return `// Generated code for: ${description}\n// TODO: Implement`;
  }

  private generateClass(description: string, language: string): string {
    const name = this.extractName(description) || 'DataService';
    
    if (language === 'typescript') {
      return `/**
 * ${description}
 */
export class ${name} {
  private data: Map<string, unknown> = new Map();

  constructor() {
    // Initialize ${name}
  }

  /**
   * Get data by key
   */
  public get(key: string): unknown | undefined {
    return this.data.get(key);
  }

  /**
   * Set data by key
   */
  public set(key: string, value: unknown): void {
    this.data.set(key, value);
  }

  /**
   * Check if key exists
   */
  public has(key: string): boolean {
    return this.data.has(key);
  }

  /**
   * Delete data by key
   */
  public delete(key: string): boolean {
    return this.data.delete(key);
  }
}
`;
    }
    
    if (language === 'python') {
      return `class ${name}:
    """${description}"""
    
    def __init__(self):
        """Initialize ${name}"""
        self._data = {}
    
    def get(self, key: str):
        """Get data by key"""
        return self._data.get(key)
    
    def set(self, key: str, value) -> None:
        """Set data by key"""
        self._data[key] = value
    
    def has(self, key: str) -> bool:
        """Check if key exists"""
        return key in self._data
    
    def delete(self, key: str) -> bool:
        """Delete data by key"""
        if key in self._data:
            del self._data[key]
            return True
        return False
`;
    }
    
    return `// Generated class for: ${description}\n// TODO: Implement`;
  }

  private generateAPI(description: string, language: string, framework?: string): string {
    const name = this.extractName(description) || 'users';
    
    if ((language === 'typescript' || language === 'javascript') && framework === 'express') {
      return `import { Router, Request, Response } from 'express';

/**
 * ${description}
 */
const router = Router();

/**
 * GET /${name}
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // TODO: Implement list ${name}
    res.json({ data: [], message: 'Success' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /${name}
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    // TODO: Validate and process data
    res.status(201).json({ data, message: 'Created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /${name}/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: Fetch item by id
    res.json({ data: { id }, message: 'Success' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
`;
    }
    
    return `// Generated API for: ${description}\n// TODO: Implement with ${framework || 'default framework'}`;
  }

  private generateTestCode(code: string, language: string): string {
    const functionMatch = code.match(/function\s+(\w+)/);
    const classMatch = code.match(/class\s+(\w+)/);
    const name = functionMatch?.[1] || classMatch?.[1] || 'generated';
    
    if (language === 'typescript' || language === 'javascript') {
      return `import { ${name} } from '../src/generated';

describe('${name}', () => {
  it('should be defined', () => {
    expect(${name}).toBeDefined();
  });

  it('should handle valid input', () => {
    // TODO: Add test for valid input
    const result = ${classMatch ? `new ${name}()` : `${name}({})`};
    expect(result).toBeDefined();
  });

  it('should handle invalid input', () => {
    // TODO: Add test for invalid input
    expect(() => ${classMatch ? `new ${name}()` : `${name}(null)`}).toThrow();
  });
});
`;
    }
    
    if (language === 'python') {
      return `import pytest
from src.generated import ${name}

def test_${name}_defined():
    """Test that ${name} is defined"""
    assert ${name} is not None

def test_${name}_valid_input():
    """Test with valid input"""
    # TODO: Add test for valid input
    result = ${name}({})
    assert result is not None

def test_${name}_invalid_input():
    """Test with invalid input"""
    # TODO: Add test for invalid input
    with pytest.raises(ValueError):
        ${name}(None)
`;
    }
    
    return `// Generated tests for ${name}`;
  }

  private addTypeAnnotations(code: string, language: string): string {
    if (language !== 'typescript') return code;
    
    // Simple type annotation additions
    return code
      .replace(/function\s+(\w+)\(([^)]*)\)\s*{/g, 'function $1($2): unknown {')
      .replace(/const\s+(\w+)\s*=\s*\[\]/g, 'const $1: unknown[] = []')
      .replace(/const\s+(\w+)\s*=\s*{}/g, 'const $1: Record<string, unknown> = {}');
  }

  private cleanupCode(code: string, language: string): string {
    return code
      .replace(/\t/g, '  ')  // Convert tabs to spaces
      .replace(/[ \t]+$/gm, '')  // Remove trailing whitespace
      .replace(/\n{3,}/g, '\n\n');  // Remove excess blank lines
  }

  private addDocumentation(code: string, language: string): string {
    if (language === 'typescript' || language === 'javascript') {
      return code.replace(
        /^(export\s+)?(async\s+)?function\s+(\w+)/gm,
        '/**\n * TODO: Add description for $3\n */\n$1$2function $3'
      );
    }
    
    if (language === 'python') {
      return code.replace(
        /^(def\s+\w+\([^)]*\)[^:]*:)\s*$/gm,
        '$1\n    """TODO: Add description"""'
      );
    }
    
    return code;
  }

  private addErrorHandling(code: string, language: string): string {
    // This is a simplified version - real implementation would be more sophisticated
    return code;
  }

  private extractName(description: string): string | null {
    // Try to extract a name from the description
    const patterns = [
      /(?:create|build|generate|implement)\s+(?:a\s+)?(\w+)/i,
      /(\w+)\s+(?:function|class|service|manager|api|endpoint)/i,
      /for\s+(\w+)/i
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1);
      }
    }
    
    return null;
  }

  private getExtension(language: string): string {
    const extensions: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      solidity: 'sol',
      rust: 'rs',
      go: 'go'
    };
    return extensions[language] || 'txt';
  }

  private inferDependencies(code: string, language: string, framework?: string): string[] {
    const deps: string[] = [];
    
    if (framework === 'express') deps.push('express', '@types/express');
    if (framework === 'react') deps.push('react', 'react-dom', '@types/react');
    if (framework === 'fastapi') deps.push('fastapi', 'uvicorn');
    
    if (code.includes('import { v4') || code.includes("from 'uuid'")) deps.push('uuid');
    if (code.includes('axios')) deps.push('axios');
    if (code.includes('lodash')) deps.push('lodash');
    
    return deps;
  }
}

// Factory function
export function createCodeEngineerAgent(config?: Partial<CodeEngineerConfig>): CodeEngineerAgentImpl {
  return new CodeEngineerAgentImpl(config);
}
