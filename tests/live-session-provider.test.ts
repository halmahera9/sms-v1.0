import { UserRole, UserStatus } from '@prisma/client';
import {
  createSessionToken,
  verifySessionToken,
  CookieSessionProvider,
  getAuthenticatedActorContext,
  setSessionProvider,
  resetSessionProvider,
  AuthenticationError,
  AuthenticatedActorContext,
} from '../src/platform/auth/session';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message} (${detail || ''})`);
  }
}

async function runLiveSessionProviderTests() {
  console.log('================================================================');
  console.log('       LIVE SESSION PROVIDER & CRYPTO TOKEN TEST SUITE          ');
  console.log('================================================================\n');

  const validContext: AuthenticatedActorContext = {
    actorId: '11111111-1111-7111-8111-111111111111',
    tenantId: '22222222-2222-7222-8222-222222222222',
    username: 'operator_user',
    role: UserRole.OPERATOR,
    status: UserStatus.ACTIVE,
  };

  const secret = 'test-secret-key-32-characters-long!';

  try {
    // -------------------------------------------------------------
    // 1. Session Token Creation & Verification
    // -------------------------------------------------------------
    console.log('[1] Testing HMAC-SHA256 Session Token Lifecycle...');

    const token = createSessionToken(validContext, secret, 3600);
    assert(typeof token === 'string' && token.includes('.'), 'createSessionToken returns valid token string with signature delimiter');

    const verified = verifySessionToken(token, secret);
    assert(verified !== null, 'verifySessionToken successfully verifies valid token');
    assert(verified?.actorId === validContext.actorId, 'Resolved actorId matches expected UUID');
    assert(verified?.tenantId === validContext.tenantId, 'Resolved tenantId matches expected UUID');
    assert(verified?.username === validContext.username, 'Resolved username matches expected value');
    assert(verified?.role === UserRole.OPERATOR, 'Resolved role matches UserRole.OPERATOR');
    assert(verified?.status === UserStatus.ACTIVE, 'Resolved status matches UserStatus.ACTIVE');

    // -------------------------------------------------------------
    // 2. Tampering & Signature Validation
    // -------------------------------------------------------------
    console.log('\n[2] Testing Token Tamper Resistance & Security...');

    const tamperedToken = token.slice(0, -5) + 'xxxxx';
    const verifiedTampered = verifySessionToken(tamperedToken, secret);
    assert(verifiedTampered === null, 'Tampered token signature is rejected (returns null)');

    const wrongSecretVerified = verifySessionToken(token, 'wrong-secret-key-that-does-not-match');
    assert(wrongSecretVerified === null, 'Verification with wrong secret is rejected (returns null)');

    const malformedToken = 'invalid-payload-without-period';
    const verifiedMalformed = verifySessionToken(malformedToken, secret);
    assert(verifiedMalformed === null, 'Malformed token string is rejected (returns null)');

    // -------------------------------------------------------------
    // 3. Expiration Enforcement
    // -------------------------------------------------------------
    console.log('\n[3] Testing Token Expiration Handling...');

    // Token with -10 seconds TTL (already expired)
    const expiredToken = createSessionToken(validContext, secret, -10);
    const verifiedExpired = verifySessionToken(expiredToken, secret);
    assert(verifiedExpired === null, 'Expired session token is rejected (returns null)');

    // -------------------------------------------------------------
    // 4. Invalid Claims & Schema Guarding
    // -------------------------------------------------------------
    console.log('\n[4] Testing Claims Validation...');

    const invalidActorIdContext: AuthenticatedActorContext = {
      ...validContext,
      actorId: 'not-a-valid-uuid',
    };
    const invalidActorToken = createSessionToken(invalidActorIdContext, secret);
    assert(verifySessionToken(invalidActorToken, secret) === null, 'Non-UUID actorId in token is rejected');

    const invalidTenantIdContext: AuthenticatedActorContext = {
      ...validContext,
      tenantId: 'invalid-tenant-uuid',
    };
    const invalidTenantToken = createSessionToken(invalidTenantIdContext, secret);
    assert(verifySessionToken(invalidTenantToken, secret) === null, 'Non-UUID tenantId in token is rejected');

    // -------------------------------------------------------------
    // 5. Fail-Closed on Missing Authentication Secret (No Fallback)
    // -------------------------------------------------------------
    console.log('\n[5] Testing Missing Secret Behavior (Strict Fail-Closed)...');

    // Save and wipe any ambient env secrets for this test block
    const savedAuthSecret = process.env.AUTH_SECRET;
    const savedSessionSecret = process.env.SESSION_SECRET;
    delete process.env.AUTH_SECRET;
    delete process.env.SESSION_SECRET;

    try {
      // 5a. createSessionToken without secret throws error
      let createWithoutSecretThrew = false;
      try {
        createSessionToken(validContext);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('Missing required authentication secret')) {
          createWithoutSecretThrew = true;
        }
      }
      assert(createWithoutSecretThrew, 'createSessionToken throws error when no secret is configured');

      // 5b. verifySessionToken without secret returns null (fails closed)
      const verifyWithoutSecret = verifySessionToken(token);
      assert(verifyWithoutSecret === null, 'verifySessionToken returns null (fails closed) when no secret is configured');

      // 5c. CookieSessionProvider without secret returns null (fails closed)
      const unconfiguredProvider = new CookieSessionProvider();
      const unconfiguredSession = await unconfiguredProvider.getSession();
      assert(unconfiguredSession === null, 'CookieSessionProvider returns null (fails closed) when unconfigured');

    } finally {
      // Restore env
      if (savedAuthSecret !== undefined) process.env.AUTH_SECRET = savedAuthSecret;
      if (savedSessionSecret !== undefined) process.env.SESSION_SECRET = savedSessionSecret;
    }

    // -------------------------------------------------------------
    // 6. CookieSessionProvider Fail-Closed Outside HTTP Context
    // -------------------------------------------------------------
    console.log('\n[6] Testing CookieSessionProvider Default Fail-Closed in Headless Env...');

    resetSessionProvider();
    const provider = new CookieSessionProvider('banyubiru_session', secret);
    const session = await provider.getSession();
    assert(session === null, 'CookieSessionProvider fails closed (returns null) outside active HTTP request context');

    let threwAuthError = false;
    try {
      await getAuthenticatedActorContext();
    } catch (err: unknown) {
      if (err instanceof AuthenticationError) {
        threwAuthError = true;
      }
    }
    assert(threwAuthError, 'getAuthenticatedActorContext throws AuthenticationError when unauthenticated');

    // -------------------------------------------------------------
    // 7. Mock/Test Session Provider Injection Compatibility
    // -------------------------------------------------------------
    console.log('\n[7] Testing Session Provider Injection Contract (Backward Compatibility)...');

    setSessionProvider({
      getSession: async () => validContext,
    });

    const injectedContext = await getAuthenticatedActorContext();
    assert(injectedContext.actorId === validContext.actorId, 'setSessionProvider successfully overrides active session');

    // Test INACTIVE status rejection
    setSessionProvider({
      getSession: async () => ({
        ...validContext,
        status: UserStatus.INACTIVE,
      }),
    });

    let threwInactiveError = false;
    try {
      await getAuthenticatedActorContext();
    } catch (err: unknown) {
      if (err instanceof AuthenticationError && err.message.includes('tidak aktif')) {
        threwInactiveError = true;
      }
    }
    assert(threwInactiveError, 'getAuthenticatedActorContext rejects INACTIVE actor status with AuthenticationError');

  } finally {
    resetSessionProvider();
  }

  console.log('\n================================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED `);
  console.log('================================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runLiveSessionProviderTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
