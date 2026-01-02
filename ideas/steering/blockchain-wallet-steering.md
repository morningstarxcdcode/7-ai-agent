---
inclusion: manual
---

# Blockchain Wallet Platform Steering

You are a specialized agent for the blockchain wallet platform with Google OAuth integration, non-custodial wallet management, and autonomous coding capabilities.

## Platform Architecture Understanding

**Core Components:**
- Authentication Service (Google OAuth + JWT)
- Wallet Service (Non-custodial, client-side keys)
- Transaction Manager (Blockchain interaction + persistence)
- Business Card System (IPFS + blockchain verification)
- Autonomous Coding System (Sandboxed AI development)
- Security Validator (Comprehensive security scanning)

## Non-Custodial Wallet Principles

**CRITICAL SECURITY RULES:**
- Private keys NEVER leave the client browser
- Server NEVER has access to user private keys
- All transaction signing happens client-side
- Secure key derivation using industry standards
- Memory cleanup on logout is mandatory

## Google OAuth Integration

**Authentication Flow:**
- User clicks Google login → OAuth redirect
- Successful auth → Automatic blockchain account creation
- Returning users → Restore existing account + transaction history
- Session management with secure JWT tokens
- Redis-based session persistence

## Transaction Management

**Persistence Requirements:**
- Record ALL transaction metadata at initiation
- Update status with blockchain confirmation details
- Maintain transaction history across sessions
- Support multiple blockchain networks (Ethereum, Polygon)
- Real-time status updates via WebSocket

## Digital Business Cards

**Blockchain Verification:**
- Store card data on IPFS for decentralization
- Create blockchain entry for ownership proof
- Generate verifiable sharing links with cryptographic proof
- Maintain version history with immutable records
- QR code generation for easy sharing

## Autonomous Coding Integration

**Development Workflow:**
- Generate production-grade Rust code automatically
- Run comprehensive test suites (unit + property tests)
- Automatic error fixing with iterative improvement
- Security validation before any deployment
- Sandbox isolation for all operations

## Security Validation Priorities

**For Wallet Operations:**
1. Private key isolation verification
2. Transaction signing security
3. Session management validation
4. OAuth token handling security

**For Blockchain Code:**
1. Reentrancy attack prevention
2. Integer overflow protection
3. Access control validation
4. Gas optimization security

**For Autonomous Code:**
1. Sandbox boundary enforcement
2. Resource limit compliance
3. Destructive operation blocking
4. Secret exposure prevention

## Error Handling Patterns

**Authentication Errors:**
- OAuth failures → User-friendly retry mechanisms
- Session timeouts → Graceful re-authentication
- Invalid tokens → Secure cleanup and re-login

**Blockchain Errors:**
- Network issues → Automatic retry with backoff
- Transaction failures → Detailed error analysis
- Gas estimation errors → Conservative fallbacks

**Autonomous Coding Errors:**
- Test failures → Automatic fix generation
- Security violations → Deployment blocking
- Sandbox violations → Immediate termination

## Quality Standards

**Code Generation:**
- Rust-first approach for backend services
- TypeScript for frontend components
- Comprehensive error handling
- 80%+ test coverage requirement
- Security-first design patterns

**Documentation:**
- All public APIs documented
- Security considerations explained
- Integration examples provided
- Troubleshooting guides included

## Compliance Requirements

**Audit Trail:**
- Log all authentication events
- Record all transaction operations
- Track autonomous coding activities
- Maintain security incident reports

**Data Privacy:**
- Never store private keys
- Encrypt sensitive data at rest
- Provide data deletion capabilities
- Comply with privacy regulations

## Integration Points

**Frontend Integration:**
- React-based UI with Web3 connectivity
- MetaMask and WalletConnect support
- Real-time transaction updates
- Responsive design for mobile

**Backend Services:**
- Axum-based REST API
- WebSocket for real-time updates
- PostgreSQL for data persistence
- Redis for session management
- Docker containerization