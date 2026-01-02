---
inclusion: always
---

# Production Compliance Guidelines

## Monitoring Requirements
- Track policy violations and escalate patterns
- Monitor response times and agent performance
- Log all security-sensitive operations
- Alert on unusual activity patterns

## Data Privacy
- Redact PII from all traces and logs
- Encrypt sensitive data at rest
- Limit data retention to compliance requirements
- Provide data deletion capabilities for user requests

## Security Standards
- All external API calls must use authenticated endpoints
- Rate limiting on all agent operations
- Input validation and sanitization
- Secure credential management (no secrets in logs)
- **Blockchain-specific**: Private keys never stored server-side
- **Blockchain-specific**: All transactions validated before broadcast
- **Autonomous coding**: Sandbox isolation strictly enforced
- **Autonomous coding**: Security validation required before deployment

## Blockchain Platform Compliance
- **Non-custodial Requirements**: Private keys remain client-side only
- **Transaction Auditing**: All blockchain transactions logged immutably
- **OAuth Security**: Google authentication tokens handled securely
- **Session Management**: Secure session lifecycle with proper cleanup
- **Smart Contract Security**: All contracts validated for common vulnerabilities
- **Gas Optimization**: Transaction costs optimized without security compromise

## Autonomous Coding Governance
- **Sandbox Enforcement**: All AI code generation in isolated environment
- **Quality Gates**: Minimum 80% test coverage required
- **Security Scanning**: Automated vulnerability detection mandatory
- **Human Oversight**: Production deployment requires human approval
- **Resource Monitoring**: CPU, memory, and network usage tracked
- **Audit Trail**: All autonomous operations logged with full traceability

## Compliance Reporting
- Generate audit trails for all financial operations
- Maintain evidence chain for security decisions
- Document all human approvals and rejections
- Provide compliance reports on demand

## Error Handling
- Graceful degradation when external services fail
- Clear error messages without exposing system internals
- Automatic retry with exponential backoff
- Escalation paths for critical failures

## Performance Standards
- Maximum 60 second response time for complex analysis
- Concurrent request limits to prevent resource exhaustion
- Caching of frequently accessed data
- Load balancing across agent instances

## User Communication
- Clear status updates during long-running operations
- Transparent explanation of limitations and constraints
- Educational content about security best practices
- Accessible language for non-technical users