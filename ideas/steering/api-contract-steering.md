---
inclusion: always
---

# API Contract Steering

## API Contract Compliance Rules

You MUST treat OpenAPI specifications and Postman collections as the single source of truth for all API implementations.

### Contract-First Development

**CRITICAL RULES:**
- Read API schemas before writing any code
- Match request/response formats exactly as specified
- Never invent or assume endpoints not in the contract
- Update code to satisfy contract tests
- Treat failing Postman tests as blocking errors

### OpenAPI Specification Compliance

**For any API endpoint implementation:**
1. **Schema Validation**: All request/response must match OpenAPI schema
2. **HTTP Methods**: Use only methods specified in the contract
3. **Status Codes**: Return only status codes defined in the specification
4. **Headers**: Include all required headers as specified
5. **Authentication**: Implement auth exactly as documented

### Postman Collection Integration

**Test-Driven API Development:**
- All Postman tests must pass before deployment
- Use collection variables for environment configuration
- Implement pre-request scripts for authentication
- Validate response schemas in test scripts
- Maintain test coverage for all endpoints

### DeFi API Security Requirements

**For DeFi-related endpoints:**
- All transaction endpoints require security validation
- Implement slippage and price impact calculations
- Add rug pull and honeypot detection
- Require human approval for high-risk operations
- Log all API calls for audit trail

### Blockchain API Compliance

**For blockchain wallet endpoints:**
- Private keys never transmitted in API calls
- All transaction data validated before broadcast
- OAuth tokens handled securely
- Session management follows security protocols
- Gas optimization without security compromise

### Multi-Agent API Coordination

**Agent-to-Agent API Communication:**
- Use standardized message formats
- Implement proper error handling and retries
- Maintain audit trails for all agent communications
- Follow rate limiting and circuit breaker patterns
- Ensure API versioning compatibility

### Error Handling Standards

**API Error Response Format:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional context for debugging",
    "timestamp": "ISO_8601_timestamp",
    "trace_id": "unique_trace_identifier"
  }
}
```

### Validation Workflow

**Before any API deployment:**
1. Validate against OpenAPI schema
2. Run complete Postman collection
3. Security scan for vulnerabilities
4. Performance testing under load
5. Human approval for production deployment

### Contract Updates

**When API contracts change:**
- Update OpenAPI specification first
- Regenerate client SDKs if applicable
- Update Postman collection tests
- Run regression test suite
- Document breaking changes

This steering ensures all API implementations strictly adhere to contract specifications while maintaining the security and compliance standards required for autonomous financial operations.