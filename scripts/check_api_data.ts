import fetch from 'node-fetch';

async function run() {
    try {
        // Authenticate as admin to get token
        const authRes = await fetch('http://localhost:8080/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@admin.com', password: 'admin123' })
        });
        const { access_token } = await authRes.json();
        const headers = { 'Authorization': `Bearer ${access_token}` };

        // Fetch vehicles
        const vRes = await fetch('http://localhost:8080/vehicles', { headers });
        const vehicles = await vRes.json();
        console.log('Vehicle keys:', Object.keys(vehicles[0] || {}));
        console.log('Vehicle currentCedisId type:', typeof vehicles[0]?.currentCedisId, vehicles[0]?.currentCedisId);
        console.log('Vehicle currentCedis:', JSON.stringify(vehicles[0]?.currentCedis));

        // Fetch maintenance logs
        const mRes = await fetch('http://localhost:8080/maintenance/logs', { headers });
        const logs = await mRes.json();
        console.log('Log keys:', Object.keys(logs[0] || {}));
        console.log('Log sample:', JSON.stringify(logs[0]));

        // Fetch scheduled events
        const sRes = await fetch('http://localhost:8080/scheduled-maintenance?status=SCHEDULED', { headers });
        const scheds = await sRes.json();
        console.log('Sched keys:', Object.keys(scheds[0] || {}));
        console.log('Sched sample:', JSON.stringify(scheds[0]));
    } catch (e) {
        console.error(e);
    }
}

run();
