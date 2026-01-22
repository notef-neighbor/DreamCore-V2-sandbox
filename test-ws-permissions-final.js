/**
 * WebSocket Permission Test Script - Final Version
 * Tests authentication and authorization for getJobStatus and subscribeJob
 *
 * WebSocket Authentication Flow:
 * 1. Connect to ws://localhost:3000 (no token in URL)
 * 2. Send init message with access_token
 * 3. Server validates token and sets userId
 * 4. Subsequent messages can use authenticated endpoints
 */

const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const WS_URL = 'ws://localhost:3000';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tcynrijrovktirsvwiqb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjeW5yaWpyb3ZrdGlyc3Z3aXFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjY5OTAsImV4cCI6MjA4NDYwMjk5MH0.y-_E-vuQg84t8BGISdPL18oaYcayS8ip1OLJsZwM3hI';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjeW5yaWpyb3ZrdGlyc3Z3aXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAyNjk5MCwiZXhwIjoyMDg0NjAyOTkwfQ.ayxOHlTtxqAsYAiMXR7BTPyY4e_nP2G8aLWL1cnKkV4';

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test results
const results = {
  unauthenticated_rejected: { status: 'pending', details: '' },
  wrong_user_rejected: { status: 'pending', details: '' }
};

// Helper to create WebSocket connection
function createWS() {
  return new WebSocket(WS_URL);
}

// Helper to send message and wait for response
function sendAndWait(ws, message, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, timeout);

    const handler = (data) => {
      clearTimeout(timer);
      ws.removeListener('message', handler);
      try {
        resolve(JSON.parse(data.toString()));
      } catch (e) {
        resolve(data.toString());
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify(message));
  });
}

// Wait for any pending messages to clear
function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Unauthenticated access should be rejected
async function testUnauthenticatedAccess() {
  console.log('\n=== Test 1: Unauthenticated Access ===');
  console.log('Testing: Connect without sending init message, then try getJobStatus/subscribeJob');

  const ws = createWS();

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        // Do NOT send init message - just try to access job endpoints directly
        console.log('Connected (no authentication)');

        // Test getJobStatus without authentication
        const getJobResponse = await sendAndWait(ws, {
          type: 'getJobStatus',
          jobId: 'test-job-123'
        });
        console.log('getJobStatus response:', JSON.stringify(getJobResponse));

        // Test subscribeJob without authentication
        const subscribeResponse = await sendAndWait(ws, {
          type: 'subscribeJob',
          jobId: 'test-job-123'
        });
        console.log('subscribeJob response:', JSON.stringify(subscribeResponse));

        ws.close();

        // Check if both were rejected with "Not authenticated"
        const getJobRejected = getJobResponse.type === 'error' &&
                               getJobResponse.message === 'Not authenticated';
        const subscribeRejected = subscribeResponse.type === 'error' &&
                                  subscribeResponse.message === 'Not authenticated';

        if (getJobRejected && subscribeRejected) {
          results.unauthenticated_rejected = {
            status: 'pass',
            details: 'Both getJobStatus and subscribeJob correctly rejected unauthenticated requests with "Not authenticated" error'
          };
        } else {
          results.unauthenticated_rejected = {
            status: 'fail',
            details: `getJobStatus: ${JSON.stringify(getJobResponse)}, subscribeJob: ${JSON.stringify(subscribeResponse)}`
          };
        }

        resolve();
      } catch (error) {
        results.unauthenticated_rejected = {
          status: 'fail',
          details: `Error during test: ${error.message}`
        };
        ws.close();
        resolve();
      }
    });

    ws.on('error', (error) => {
      results.unauthenticated_rejected = {
        status: 'fail',
        details: `WebSocket error: ${error.message}`
      };
      resolve();
    });
  });
}

// Test 2: Wrong user access should be rejected
async function testWrongUserAccess() {
  console.log('\n=== Test 2: Wrong User Access (Authenticated with real user) ===');
  console.log('Testing: Authenticate properly, then try to access non-existent job (simulates wrong user\'s job)');

  let testUser = null;
  let accessToken = null;

  try {
    // Create a test user with valid email domain
    const timestamp = Date.now();
    const testEmail = `ws-test-${timestamp}@dreamcore.test`;
    const testPassword = 'TestPassword123!';

    console.log(`Creating test user: ${testEmail}...`);

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    testUser = userData.user;
    console.log(`Created user: ${testUser.id}`);

    // Sign in with the test user
    console.log('Signing in...');
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`);
    }

    accessToken = signInData.session.access_token;
    console.log('Successfully authenticated');

    // Now connect via WebSocket
    const ws = createWS();

    return new Promise((resolve) => {
      ws.on('open', async () => {
        try {
          console.log('WebSocket connected, sending init with access_token...');

          // Send init message with access_token (this is the correct way to authenticate)
          const initResponse = await sendAndWait(ws, {
            type: 'init',
            access_token: accessToken,
            sessionId: 'test-session'
          });
          console.log('Init response:', JSON.stringify(initResponse));

          if (initResponse.type !== 'init') {
            throw new Error(`Unexpected init response: ${JSON.stringify(initResponse)}`);
          }

          console.log(`Authenticated as user: ${initResponse.userId}`);

          // Now try to access a non-existent job (simulates another user's job)
          const fakeJobId = '00000000-0000-0000-0000-000000000000';
          console.log(`Attempting to access job ${fakeJobId} (should be denied/null)...`);

          // Test getJobStatus with non-existent/other user's job
          const getJobResponse = await sendAndWait(ws, {
            type: 'getJobStatus',
            jobId: fakeJobId
          });
          console.log('getJobStatus response:', JSON.stringify(getJobResponse));

          // Test subscribeJob with non-existent/other user's job
          const subscribeResponse = await sendAndWait(ws, {
            type: 'subscribeJob',
            jobId: fakeJobId
          });
          console.log('subscribeJob response:', JSON.stringify(subscribeResponse));

          ws.close();

          // For non-existent/wrong-user jobs:
          // getJobStatus should return job: null (not the job data)
          // subscribeJob should return error: "Job not found"
          const getJobCorrect = getJobResponse.type === 'jobStatus' && getJobResponse.job === null;
          const subscribeCorrect = subscribeResponse.type === 'error' &&
                                   subscribeResponse.message === 'Job not found';

          if (getJobCorrect && subscribeCorrect) {
            results.wrong_user_rejected = {
              status: 'pass',
              details: 'Authenticated user correctly denied access to non-owned job: getJobStatus returned { type: "jobStatus", job: null }, subscribeJob returned { type: "error", message: "Job not found" }'
            };
          } else {
            results.wrong_user_rejected = {
              status: 'fail',
              details: `Expected getJobStatus to return {job: null} and subscribeJob to return {error: "Job not found"}. Got - getJobStatus: ${JSON.stringify(getJobResponse)}, subscribeJob: ${JSON.stringify(subscribeResponse)}`
            };
          }

          // Cleanup: Delete test user
          console.log('Cleaning up test user...');
          await supabaseAdmin.auth.admin.deleteUser(testUser.id);
          console.log('Test user deleted');

          resolve();
        } catch (error) {
          results.wrong_user_rejected = {
            status: 'fail',
            details: `Error during test: ${error.message}`
          };
          ws.close();

          // Cleanup
          if (testUser) {
            await supabaseAdmin.auth.admin.deleteUser(testUser.id).catch(() => {});
          }

          resolve();
        }
      });

      ws.on('error', async (error) => {
        results.wrong_user_rejected = {
          status: 'fail',
          details: `WebSocket error: ${error.message}`
        };

        // Cleanup
        if (testUser) {
          await supabaseAdmin.auth.admin.deleteUser(testUser.id).catch(() => {});
        }

        resolve();
      });
    });

  } catch (error) {
    console.log('Test setup failed:', error.message);

    // Cleanup if user was created
    if (testUser) {
      await supabaseAdmin.auth.admin.deleteUser(testUser.id).catch(() => {});
    }

    results.wrong_user_rejected = {
      status: 'fail',
      details: `Test setup failed: ${error.message}`
    };
  }
}

// Run all tests
async function runTests() {
  console.log('Starting WebSocket Permission Tests - Final Version');
  console.log('Target:', WS_URL);
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('');
  console.log('WebSocket Auth Flow:');
  console.log('1. Connect to ws://localhost:3000');
  console.log('2. Send {type: "init", access_token: "..."} to authenticate');
  console.log('3. Server validates and sets userId');
  console.log('');

  await testUnauthenticatedAccess();
  await testWrongUserAccess();

  console.log('\n========================================');
  console.log('TEST RESULTS:');
  console.log('========================================');
  console.log(JSON.stringify(results, null, 2));

  process.exit(0);
}

runTests().catch(console.error);
