/**
 * Job Permission Test - Test Item D
 * Tests job execution permissions (getJobStatus, subscribeJob)
 *
 * Test Cases:
 * D1: getJobStatus - owner only can access
 *   - Own job status retrieval -> Success
 *   - Other user's job status retrieval -> Fail (403 or 404)
 *
 * D2: subscribeJob - owner only can subscribe
 *   - Subscribe to own job -> Success
 *   - Subscribe to other user's job -> Fail
 *
 * D3: Other user's jobId is rejected
 *   - Two users test cross-access
 */

require('dotenv').config();

const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const WS_URL = 'ws://localhost:3000';
const API_URL = 'http://localhost:3000';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Test results
const results = {
  D1_getJobStatus_own: { status: 'pending', details: '' },
  D1_getJobStatus_other: { status: 'pending', details: '' },
  D2_subscribeJob_own: { status: 'pending', details: '' },
  D2_subscribeJob_other: { status: 'pending', details: '' },
  D3_http_getJobStatus_own: { status: 'pending', details: '' },
  D3_http_getJobStatus_other: { status: 'pending', details: '' }
};

// Test data
let testUser1 = null;
let testUser2 = null;
let testUser1Token = null;
let testUser2Token = null;
let testProject1 = null;
let testJob1 = null;

/**
 * Setup test users and create a test job
 */
async function setup() {
  console.log('\n=== Setting up test data ===\n');

  const timestamp = Date.now();

  // Create test user 1
  const { data: user1Data, error: user1Error } = await supabaseAdmin.auth.admin.createUser({
    email: `jobtest1_${timestamp}@dreamcore.test`,
    password: 'TestPassword123!',
    email_confirm: true
  });

  if (user1Error) {
    throw new Error(`Failed to create test user 1: ${user1Error.message}`);
  }
  testUser1 = user1Data.user;
  console.log('Created test user 1:', testUser1.id);

  // Create test user 2
  const { data: user2Data, error: user2Error } = await supabaseAdmin.auth.admin.createUser({
    email: `jobtest2_${timestamp}@dreamcore.test`,
    password: 'TestPassword123!',
    email_confirm: true
  });

  if (user2Error) {
    throw new Error(`Failed to create test user 2: ${user2Error.message}`);
  }
  testUser2 = user2Data.user;
  console.log('Created test user 2:', testUser2.id);

  // Wait for profile trigger
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Ensure profiles exist
  await supabaseAdmin.from('profiles').upsert({
    id: testUser1.id,
    email: testUser1.email,
    display_name: 'Job Test User 1'
  });
  await supabaseAdmin.from('profiles').upsert({
    id: testUser2.id,
    email: testUser2.email,
    display_name: 'Job Test User 2'
  });

  // Ensure users table entries exist
  await supabaseAdmin.from('users').upsert({ id: testUser1.id, email: testUser1.email });
  await supabaseAdmin.from('users').upsert({ id: testUser2.id, email: testUser2.email });

  // Sign in users to get tokens
  const anonClient1 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const signIn1 = await anonClient1.auth.signInWithPassword({
    email: testUser1.email,
    password: 'TestPassword123!'
  });
  if (signIn1.error) {
    throw new Error(`Sign in error for user1: ${signIn1.error.message}`);
  }
  testUser1Token = signIn1.data.session.access_token;
  console.log('Signed in as user 1');

  const anonClient2 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const signIn2 = await anonClient2.auth.signInWithPassword({
    email: testUser2.email,
    password: 'TestPassword123!'
  });
  if (signIn2.error) {
    throw new Error(`Sign in error for user2: ${signIn2.error.message}`);
  }
  testUser2Token = signIn2.data.session.access_token;
  console.log('Signed in as user 2');

  // Create a project for user 1
  const { data: projectData, error: projectError } = await supabaseAdmin
    .from('projects')
    .insert({
      user_id: testUser1.id,
      name: 'Job Test Project'
    })
    .select()
    .single();

  if (projectError) {
    throw new Error(`Failed to create project: ${projectError.message}`);
  }
  testProject1 = projectData;
  console.log('Created test project:', testProject1.id);

  // Create a job for user 1
  const { data: jobData, error: jobError } = await supabaseAdmin
    .from('jobs')
    .insert({
      user_id: testUser1.id,
      project_id: testProject1.id,
      status: 'completed',
      progress: 100,
      result: JSON.stringify({ success: true })
    })
    .select()
    .single();

  if (jobError) {
    throw new Error(`Failed to create job: ${jobError.message}`);
  }
  testJob1 = jobData;
  console.log('Created test job:', testJob1.id);

  console.log('\n=== Setup complete ===\n');
}

/**
 * Helper: Create WebSocket connection and wait for open
 */
function createAndConnectWS() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      resolve(ws);
    });

    ws.on('error', (err) => {
      reject(new Error(`WebSocket connection error: ${err.message}`));
    });

    // Timeout for connection
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.terminate();
        reject(new Error('WebSocket connection timeout'));
      }
    }, 5000);
  });
}

/**
 * Helper: Send message and wait for response
 */
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

    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      clearTimeout(timer);
      reject(new Error(`WebSocket send error: ${err.message}`));
    }
  });
}

/**
 * Helper: Safely close WebSocket
 */
function safeClose(ws) {
  try {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close();
    }
  } catch (e) {
    // Ignore close errors
  }
}

/**
 * Test D1a: getJobStatus - owner can access own job (WebSocket)
 */
async function testGetJobStatusOwn() {
  console.log('\n=== Test D1a: getJobStatus - Owner Access (WebSocket) ===');

  let ws = null;

  try {
    ws = await createAndConnectWS();
    console.log('WebSocket connected');

    // Initialize with user 1's token
    const initResponse = await sendAndWait(ws, {
      type: 'init',
      access_token: testUser1Token,
      sessionId: 'test-d1a'
    });

    if (initResponse.type !== 'init') {
      throw new Error(`Unexpected init response: ${JSON.stringify(initResponse)}`);
    }
    console.log('Authenticated as user:', initResponse.userId);

    // Get own job status
    const jobStatusResponse = await sendAndWait(ws, {
      type: 'getJobStatus',
      jobId: testJob1.id
    });

    console.log('getJobStatus response:', JSON.stringify(jobStatusResponse));

    safeClose(ws);

    // Should return jobStatus with job data
    if (jobStatusResponse.type === 'jobStatus' && jobStatusResponse.job !== null) {
      results.D1_getJobStatus_own = {
        status: 'pass',
        details: `Owner can access own job. Job ID: ${jobStatusResponse.job.id}, Status: ${jobStatusResponse.job.status}`
      };
    } else {
      results.D1_getJobStatus_own = {
        status: 'fail',
        details: `Expected job data, got: ${JSON.stringify(jobStatusResponse)}`
      };
    }
  } catch (error) {
    safeClose(ws);
    results.D1_getJobStatus_own = {
      status: 'fail',
      details: `Error: ${error.message}`
    };
  }
}

/**
 * Test D1b: getJobStatus - other user cannot access (WebSocket)
 */
async function testGetJobStatusOther() {
  console.log('\n=== Test D1b: getJobStatus - Other User Access (WebSocket) ===');

  let ws = null;

  try {
    ws = await createAndConnectWS();
    console.log('WebSocket connected');

    // Initialize with user 2's token
    const initResponse = await sendAndWait(ws, {
      type: 'init',
      access_token: testUser2Token,
      sessionId: 'test-d1b'
    });

    if (initResponse.type !== 'init') {
      throw new Error(`Unexpected init response: ${JSON.stringify(initResponse)}`);
    }
    console.log('Authenticated as user:', initResponse.userId);

    // Try to get user 1's job status
    const jobStatusResponse = await sendAndWait(ws, {
      type: 'getJobStatus',
      jobId: testJob1.id
    });

    console.log('getJobStatus response:', JSON.stringify(jobStatusResponse));

    safeClose(ws);

    // Should return jobStatus with job: null (access denied, but no leak of job existence)
    if (jobStatusResponse.type === 'jobStatus' && jobStatusResponse.job === null) {
      results.D1_getJobStatus_other = {
        status: 'pass',
        details: 'Other user cannot access job (returned job: null)'
      };
    } else if (jobStatusResponse.type === 'error') {
      results.D1_getJobStatus_other = {
        status: 'pass',
        details: `Other user denied access with error: ${jobStatusResponse.message}`
      };
    } else {
      results.D1_getJobStatus_other = {
        status: 'fail',
        details: `Expected job: null or error, got: ${JSON.stringify(jobStatusResponse)}`
      };
    }
  } catch (error) {
    safeClose(ws);
    results.D1_getJobStatus_other = {
      status: 'fail',
      details: `Error: ${error.message}`
    };
  }
}

/**
 * Test D2a: subscribeJob - owner can subscribe (WebSocket)
 */
async function testSubscribeJobOwn() {
  console.log('\n=== Test D2a: subscribeJob - Owner Subscribe (WebSocket) ===');

  let ws = null;

  try {
    ws = await createAndConnectWS();
    console.log('WebSocket connected');

    // Initialize with user 1's token
    const initResponse = await sendAndWait(ws, {
      type: 'init',
      access_token: testUser1Token,
      sessionId: 'test-d2a'
    });

    if (initResponse.type !== 'init') {
      throw new Error(`Unexpected init response: ${JSON.stringify(initResponse)}`);
    }
    console.log('Authenticated as user:', initResponse.userId);

    // Subscribe to own job
    const subscribeResponse = await sendAndWait(ws, {
      type: 'subscribeJob',
      jobId: testJob1.id
    });

    console.log('subscribeJob response:', JSON.stringify(subscribeResponse));

    safeClose(ws);

    // Should return subscribed confirmation
    if (subscribeResponse.type === 'subscribed' && subscribeResponse.jobId === testJob1.id) {
      results.D2_subscribeJob_own = {
        status: 'pass',
        details: `Owner can subscribe to own job. JobId: ${subscribeResponse.jobId}`
      };
    } else {
      results.D2_subscribeJob_own = {
        status: 'fail',
        details: `Expected subscribed response, got: ${JSON.stringify(subscribeResponse)}`
      };
    }
  } catch (error) {
    safeClose(ws);
    results.D2_subscribeJob_own = {
      status: 'fail',
      details: `Error: ${error.message}`
    };
  }
}

/**
 * Test D2b: subscribeJob - other user cannot subscribe (WebSocket)
 */
async function testSubscribeJobOther() {
  console.log('\n=== Test D2b: subscribeJob - Other User Subscribe (WebSocket) ===');

  let ws = null;

  try {
    ws = await createAndConnectWS();
    console.log('WebSocket connected');

    // Initialize with user 2's token
    const initResponse = await sendAndWait(ws, {
      type: 'init',
      access_token: testUser2Token,
      sessionId: 'test-d2b'
    });

    if (initResponse.type !== 'init') {
      throw new Error(`Unexpected init response: ${JSON.stringify(initResponse)}`);
    }
    console.log('Authenticated as user:', initResponse.userId);

    // Try to subscribe to user 1's job
    const subscribeResponse = await sendAndWait(ws, {
      type: 'subscribeJob',
      jobId: testJob1.id
    });

    console.log('subscribeJob response:', JSON.stringify(subscribeResponse));

    safeClose(ws);

    // Should return error "Job not found"
    if (subscribeResponse.type === 'error' && subscribeResponse.message === 'Job not found') {
      results.D2_subscribeJob_other = {
        status: 'pass',
        details: 'Other user denied subscription with "Job not found" error'
      };
    } else if (subscribeResponse.type === 'error') {
      results.D2_subscribeJob_other = {
        status: 'pass',
        details: `Other user denied with error: ${subscribeResponse.message}`
      };
    } else {
      results.D2_subscribeJob_other = {
        status: 'fail',
        details: `Expected error, got: ${JSON.stringify(subscribeResponse)}`
      };
    }
  } catch (error) {
    safeClose(ws);
    results.D2_subscribeJob_other = {
      status: 'fail',
      details: `Error: ${error.message}`
    };
  }
}

/**
 * Test D3a: HTTP getJobStatus - owner can access
 */
async function testHttpGetJobStatusOwn() {
  console.log('\n=== Test D3a: HTTP /api/jobs/:jobId - Owner Access ===');

  try {
    const response = await fetch(`${API_URL}/api/jobs/${testJob1.id}`, {
      headers: {
        'Authorization': `Bearer ${testUser1Token}`
      }
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(data));

    if (response.status === 200 && data.id === testJob1.id) {
      results.D3_http_getJobStatus_own = {
        status: 'pass',
        details: `Owner can access job via HTTP. Status: ${response.status}, Job ID: ${data.id}`
      };
    } else {
      results.D3_http_getJobStatus_own = {
        status: 'fail',
        details: `Expected 200 with job data, got: ${response.status} - ${JSON.stringify(data)}`
      };
    }
  } catch (error) {
    results.D3_http_getJobStatus_own = {
      status: 'fail',
      details: `Error: ${error.message}`
    };
  }
}

/**
 * Test D3b: HTTP getJobStatus - other user cannot access
 */
async function testHttpGetJobStatusOther() {
  console.log('\n=== Test D3b: HTTP /api/jobs/:jobId - Other User Access ===');

  try {
    const response = await fetch(`${API_URL}/api/jobs/${testJob1.id}`, {
      headers: {
        'Authorization': `Bearer ${testUser2Token}`
      }
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(data));

    // Should return 403 (Access denied) or 404 (not found to avoid info leak)
    if (response.status === 403 || response.status === 404) {
      results.D3_http_getJobStatus_other = {
        status: 'pass',
        details: `Other user denied access. Status: ${response.status}, Error: ${data.error}`
      };
    } else {
      results.D3_http_getJobStatus_other = {
        status: 'fail',
        details: `Expected 403 or 404, got: ${response.status} - ${JSON.stringify(data)}`
      };
    }
  } catch (error) {
    results.D3_http_getJobStatus_other = {
      status: 'fail',
      details: `Error: ${error.message}`
    };
  }
}

/**
 * Cleanup test data
 */
async function cleanup() {
  console.log('\n=== Cleanup ===');

  try {
    if (testJob1) {
      await supabaseAdmin.from('jobs').delete().eq('id', testJob1.id);
      console.log('Deleted test job');
    }

    if (testProject1) {
      await supabaseAdmin.from('projects').delete().eq('id', testProject1.id);
      console.log('Deleted test project');
    }

    if (testUser1) {
      await supabaseAdmin.from('profiles').delete().eq('id', testUser1.id);
      await supabaseAdmin.from('users').delete().eq('id', testUser1.id);
      await supabaseAdmin.auth.admin.deleteUser(testUser1.id);
      console.log('Deleted test user 1');
    }

    if (testUser2) {
      await supabaseAdmin.from('profiles').delete().eq('id', testUser2.id);
      await supabaseAdmin.from('users').delete().eq('id', testUser2.id);
      await supabaseAdmin.auth.admin.deleteUser(testUser2.id);
      console.log('Deleted test user 2');
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}

/**
 * Main
 */
async function main() {
  console.log('==========================================');
  console.log('DreamCore V2 - Job Permission Test (Item D)');
  console.log('==========================================');
  console.log(`WebSocket URL: ${WS_URL}`);
  console.log(`API URL: ${API_URL}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  try {
    await setup();

    // Run all tests
    await testGetJobStatusOwn();
    await testGetJobStatusOther();
    await testSubscribeJobOwn();
    await testSubscribeJobOther();
    await testHttpGetJobStatusOwn();
    await testHttpGetJobStatusOther();

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await cleanup();
  }

  // Output results
  console.log('\n==========================================');
  console.log('TEST RESULTS (JSON)');
  console.log('==========================================');
  console.log(JSON.stringify(results, null, 2));

  // Summary
  const passCount = Object.values(results).filter(r => r.status === 'pass').length;
  const failCount = Object.values(results).filter(r => r.status === 'fail').length;
  const pendingCount = Object.values(results).filter(r => r.status === 'pending').length;

  console.log('\n==========================================');
  console.log('SUMMARY');
  console.log('==========================================');
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Pending: ${pendingCount}`);
  console.log('');

  // Detailed result table
  console.log('Test Results:');
  console.log('------------------------------------------');
  for (const [testName, result] of Object.entries(results)) {
    const icon = result.status === 'pass' ? '[PASS]' : result.status === 'fail' ? '[FAIL]' : '[----]';
    console.log(`${icon} ${testName}`);
    console.log(`       ${result.details}`);
  }
  console.log('------------------------------------------');

  const allPass = failCount === 0 && pendingCount === 0;
  console.log(`\nOVERALL: ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED OR PENDING'}`);
  console.log('==========================================');

  process.exit(allPass ? 0 : 1);
}

main().catch(console.error);
