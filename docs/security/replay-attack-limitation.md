# Replay Attack Limitation & JWT Secret Rotation

## Current Implementation

### JWT Token Security
- **Stateless tokens**: JWT tokens are stateless and cannot be revoked
- **Expiry**: Tokens expire after 7 days
- **Claims**: Include issuer (`ai-apply`) and audience (`ai-apply-users`)
- **Clock tolerance**: 5 seconds to handle minor clock skew
- **Minimal payload**: Only contains `userId` to reduce exposure

### Replay Attack Risk
**Current vulnerability**: If a JWT token is compromised, an attacker can replay it until expiry (7 days).

### Mitigations in Place
1. **HTTPS**: All communications should use HTTPS to prevent token interception
2. **Rate limiting**: Limits the impact of a compromised token
3. **User ownership checks**: All database operations include user_id filtering
4. **Audit logging**: All actions are logged with request IDs for tracking

## Future Improvements

### 1. Token Blacklist (Recommended)
Implement a Redis-based token blacklist:
```javascript
// On logout or suspicious activity
await redis.setex(`blacklist:${token}`, 7*24*60*60, 'true');

// In auth middleware
if (await redis.get(`blacklist:${token}`)) {
  return res.status(401).json({ error: 'Token revoked' });
}
```

### 2. Short-lived Tokens with Refresh
- Access tokens: 15 minutes
- Refresh tokens: 7 days
- Refresh token rotation on each use

### 3. JWT Secret Rotation Strategy

#### Automated Rotation Process
1. **Generate new secret**: Use cryptographically secure random generator
2. **Dual validation period**: Accept both old and new secrets for overlap period
3. **Update environment**: Deploy new JWT_SECRET
4. **Monitor**: Ensure no authentication failures
5. **Remove old secret**: After overlap period (e.g., 7 days)

#### Implementation Example
```javascript
// In authMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRETS = [
  process.env.JWT_SECRET,           // Current secret
  process.env.JWT_SECRET_PREVIOUS   // Previous secret (during rotation)
].filter(Boolean);

function verifyToken(token) {
  for (const secret of JWT_SECRETS) {
    try {
      return jwt.verify(token, secret, {
        issuer: 'ai-apply',
        audience: 'ai-apply-users',
        clockTolerance: 5
      });
    } catch (err) {
      continue; // Try next secret
    }
  }
  throw new Error('Invalid token');
}
```

#### Rotation Checklist
- [ ] Generate new JWT_SECRET (32+ characters, cryptographically secure)
- [ ] Update environment with JWT_SECRET_PREVIOUS = old secret
- [ ] Update environment with JWT_SECRET = new secret
- [ ] Deploy to staging, test authentication
- [ ] Deploy to production
- [ ] Monitor for 7 days
- [ ] Remove JWT_SECRET_PREVIOUS from environment
- [ ] Document rotation date and secret version

### 4. Additional Security Measures

#### Token Binding
Consider binding tokens to additional context:
- User agent hash
- IP address (with allowances for dynamic IPs)
- Device fingerprint

#### Session Management
- Track active sessions per user
- Allow users to view and revoke active sessions
- Implement suspicious activity detection

## Immediate Actions Required

1. **Document current JWT_SECRET**: 
   - Record creation date
   - Schedule rotation every 90 days
   - Store securely in password manager

2. **Enable HTTPS**:
   - Ensure all endpoints use HTTPS
   - Configure HSTS headers
   - Use TLS 1.2+

3. **Monitor for suspicious activity**:
   - Multiple failed auth attempts
   - Unusual geographic locations
   - High-frequency API calls

## Testing Replay Protection

### Manual Test Steps
1. Capture a valid JWT token
2. Use token from different IP/location
3. Verify rate limiting applies
4. Check audit logs for the activity

### Automated Test
```javascript
// Test replay detection
describe('Replay Attack Protection', () => {
  test('Should limit impact of replayed token', async () => {
    const token = await getValidToken();
    
    // Simulate replay from multiple locations
    const promises = Array(100).fill().map(() => 
      request(app)
        .get('/protected-endpoint')
        .set('Authorization', `Bearer ${token}`)
    );
    
    const responses = await Promise.all(promises);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Monitoring and Alerting

Set up alerts for:
- Unusual authentication patterns
- High-frequency requests from single token
- Authentication failures from multiple IPs
- Token usage after user logout

## Compliance Notes

- **GDPR**: Token compromise must be reported within 72 hours
- **SOC2**: Maintain audit trail of all token issuances
- **ISO27001**: Document and regularly rotate secrets

## References

- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [RFC 7519 - JWT](https://tools.ietf.org/html/rfc7519)
