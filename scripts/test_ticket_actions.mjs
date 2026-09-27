// Automated integration test for Send & Retain and Mark Resolved endpoints
import assert from 'node:assert';

async function runTests() {
  console.log('--- 1. Testing GET /api/tickets ---');
  const ticketsRes = await fetch('http://localhost:8000/api/tickets');
  assert.strictEqual(ticketsRes.status, 200, 'GET /tickets should return 200');
  const tickets = await ticketsRes.json();
  assert(Array.isArray(tickets) && tickets.length > 0, 'Tickets should be a non-empty array');
  const customerId = tickets[0].customer_id;
  console.log(`PASS: Found ${tickets.length} tickets. Testing with customer ${customerId}`);

  console.log('\n--- 2. Testing POST /api/tickets/:id/message (Send & Retain) ---');
  const testMessage = 'Hello, this is an automated support response regarding your refund.';
  const sendRes = await fetch(`http://localhost:8000/api/tickets/${customerId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: testMessage,
      memory_enabled: true
    })
  });
  assert.strictEqual(sendRes.status, 200, 'POST /message should return 200');
  const sendData = await sendRes.json();
  assert(sendData.agent_response, 'Should return agent_response');
  console.log('PASS: /message returned agent_response:', sendData.agent_response.slice(0, 100) + '...');

  console.log('\n--- 3. Testing POST /api/tickets/:id/resolve (Mark Resolved) ---');
  const resolveRes = await fetch(`http://localhost:8000/api/tickets/${customerId}/resolve`, {
    method: 'POST'
  });
  assert.strictEqual(resolveRes.status, 200, 'POST /resolve should return 200');
  const resolveData = await resolveRes.json();
  assert(resolveData.updated_risk_profile, 'Should return updated_risk_profile');
  assert(resolveData.updated_risk_profile.confidence, 'Risk profile should have confidence');
  console.log('PASS: /resolve updated risk profile to level:', resolveData.updated_risk_profile.risk_level);

  console.log('\n--- 4. Testing GET /api/tickets/:id/memory after retention & reflect ---');
  const memRes = await fetch(`http://localhost:8000/api/tickets/${customerId}/memory`);
  assert.strictEqual(memRes.status, 200, 'GET /memory should return 200');
  const memData = await memRes.json();
  assert(Array.isArray(memData.recalled_items), 'Recalled items should be an array');
  console.log(`PASS: /memory returned ${memData.recalled_items.length} recalled items.`);

  console.log('\nALL BACKEND API TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
