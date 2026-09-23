async function testFrontendFlow() {
  console.log('Logging in as nurse...');
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nurse@digiskwela.test', password: 'password123' })
  });

  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    return;
  }
  const loginData = await loginRes.json();
  const token = loginData.data.token;
  console.log('Login successful! Token received.');

  console.log('Fetching clinic records...');
  const clinicRes = await fetch('http://localhost:4000/api/clinic', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!clinicRes.ok) {
    console.error('Failed to fetch clinic records:', await clinicRes.text());
    return;
  }

  const clinicData = await clinicRes.json();
  console.log('Successfully fetched clinic records from API!');
  console.log(`Number of records: ${clinicData.data.length}`);
  
  if (clinicData.data.length > 0) {
    const sample = clinicData.data[0];
    console.log(`Sample record (Decrypted by API):`);
    console.log(`Symptoms: ${sample.symptoms}`);
    console.log(`Diagnosis: ${sample.diagnosis}`);
    console.log(`Treatments: ${sample.treatments}`);
  }
}

testFrontendFlow().catch(console.error);
