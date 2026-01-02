# Blockchain Wallet Platform API Contracts

This directory contains API contracts for the Blockchain Wallet Platform, focusing on non-custodial wallet operations and autonomous coding capabilities.

## Collection Mapping

Based on the Postman workspace "7 agent after rnach hacks", the following collections should be imported here:

### Wallet Operations
- **Contract Testing**: Smart contract and wallet interaction validation
- **Integration Testing**: OAuth, wallet, and blockchain integration testing
- **Mock Data Generation**: Test data for wallet operations and transactions

### API Contract Files Structure
```
api-contracts/
├── README.md (this file)
├── openapi/
│   ├── wallet-core-api.yaml
│   ├── authentication-api.yaml
│   ├── transaction-api.yaml
│   └── business-card-api.yaml
├── postman/
│   ├── contract-testing.postman_collection.json
│   ├── integration-testing.postman_collection.json
│   └── mock-data-generation.postman_collection.json
└── schemas/
    ├── wallet-operation.schema.json
    ├── transaction-metadata.schema.json
    ├── oauth-session.schema.json
    └── business-card.schema.json
```

## Blockchain-Specific API Requirements

### Authentication Endpoints
- Google OAuth integration API
- JWT token management API
- Session lifecycle API
- Security validation API

### Wallet Management Endpoints
- Non-custodial wallet creation API
- Transaction signing API (client-side only)
- Transaction broadcasting API
- Transaction monitoring API

### Business Card Endpoints
- IPFS storage API
- Blockchain verification API
- Sharing and verification API
- Version history API

### Autonomous Coding Endpoints
- Code generation API
- Security validation API
- Sandbox execution API
- Quality assurance API

## Security Requirements

All API contracts must enforce:
- Private keys never transmitted or stored server-side
- All transactions validated before broadcast
- OAuth tokens handled securely
- Session management with proper cleanup
- Comprehensive audit trails for all operations

## Testing Requirements

- All Postman collections must pass with 100% success rate
- Security scans must validate private key isolation
- Performance tests must meet response time requirements
- Integration tests must validate end-to-end workflows