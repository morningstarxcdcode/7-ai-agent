# DeFi Automation Platform API Contracts

This directory contains API contracts for the DeFi Automation Platform, organized according to the API Contract Steering guidelines.

## Collection Mapping

Based on the Postman workspace "7 agent after rnach hacks", the following collections should be imported here:

### Core DeFi Operations
- **Contract Testing**: Smart contract interaction validation
- **Integration Testing**: Cross-protocol integration validation
- **Performance Testing**: DeFi operation performance benchmarks

### API Contract Files Structure
```
api-contracts/
├── README.md (this file)
├── openapi/
│   ├── defi-core-api.yaml
│   ├── security-validation-api.yaml
│   └── agent-coordination-api.yaml
├── postman/
│   ├── contract-testing.postman_collection.json
│   ├── integration-testing.postman_collection.json
│   └── performance-testing.postman_collection.json
└── schemas/
    ├── defi-transaction.schema.json
    ├── security-assessment.schema.json
    └── agent-message.schema.json
```

## DeFi-Specific API Requirements

### Security Validation Endpoints
- Slippage calculation API
- Rug pull detection API  
- Honeypot analysis API
- Price impact assessment API
- MEV protection API

### Agent Coordination Endpoints
- Multi-agent workflow API
- Cross-agent messaging API
- Audit trail API
- Performance monitoring API

## Compliance Integration

All API contracts in this directory must:
- Follow the API Contract Steering guidelines
- Include comprehensive security validation
- Maintain audit trails for all operations
- Require human approval for high-risk operations
- Integrate with DeFi safety calculations

## Testing Requirements

- All Postman collections must achieve 100% pass rate
- OpenAPI schemas must validate successfully
- Security scans must show zero critical vulnerabilities
- Performance tests must meet established SLA requirements