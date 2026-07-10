import fetch from 'node-fetch';

async function run() {
    const url = 'https://coorsamexico-operaciones-401457559403.us-central1.run.app/api/v1/turnos/get/by/ceco/rango';
    try {
        console.log('Fetching CECO 202 turnos...');
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cecoId: 202,
                fechaInicio: '2026-06-01',
                fechaFin: '2026-06-05'
            })
        });
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error fetching CECO 202:', e);
    }
}

run();
