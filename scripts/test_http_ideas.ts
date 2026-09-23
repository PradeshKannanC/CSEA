import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth/password';

const BASE_URL = 'http://localhost:3000';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const cookieHeader = res.headers.get('set-cookie') || '';
  const match = cookieHeader.match(/pnp_session=([^;]+)/);
  if (!match) throw new Error(`Login failed for ${email}`);
  return `pnp_session=${match[1]}`;
}

async function testHttp() {
  console.log('Testing HTTP /api/ideas for Kavya (EcoPulse)...');
  const cookie = await login('kavya.ecopulse@student.tce.edu', 'Demo@2024');

  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  const meData = await meRes.json();
  console.log('/api/auth/me response:', JSON.stringify(meData, null, 2));

  const ideasRes = await fetch(`${BASE_URL}/api/ideas`, {
    headers: { Cookie: cookie },
  });
  const ideasData = await ideasRes.json();
  console.log('/api/ideas response:', JSON.stringify(ideasData, null, 2));
}

testHttp().catch(console.error);
