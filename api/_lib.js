import { createClient } from '@supabase/supabase-js';

// Service role client — server side only, never exposed to browser
export function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Service role client scoped to the dashboard schema
export function getDashboardClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'dashboard' }
    }
  );
}

// Verify the user's JWT and return their user_id
export async function verifyUser(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);

  const supabase = getServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ── Input validation ────────────────────────────────────────────────────────
// Cap field sizes so an authenticated user can't store oversized payloads,
// and reject non-http(s) URLs (blocks javascript:/data: reaching the client).
const LIMITS = {
  name: 200,
  description: 1000,
  url: 2000,
  serviceName: 200,
  maxServices: 50,
};

function isHttpUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u.trim()) && u.length <= LIMITS.url;
}

// Returns an error string if invalid, or null if the project payload is OK.
export function validateProjectPayload({ name, description, url, services }) {
  if (typeof name !== 'string' || !name.trim()) return 'name is required';
  if (name.length > LIMITS.name) return `name must be at most ${LIMITS.name} characters`;
  if (description != null && (typeof description !== 'string' || description.length > LIMITS.description))
    return `description must be at most ${LIMITS.description} characters`;
  if (!isHttpUrl(url)) return 'url must be a valid http(s) URL';

  if (services != null) {
    if (!Array.isArray(services)) return 'services must be an array';
    if (services.length > LIMITS.maxServices) return `at most ${LIMITS.maxServices} services allowed`;
    for (const s of services) {
      if (!s || typeof s !== 'object') return 'invalid service entry';
      if (typeof s.name !== 'string' || !s.name.trim() || s.name.length > LIMITS.serviceName)
        return 'each service needs a name (max 200 chars)';
      if (!isHttpUrl(s.url)) return 'each service needs a valid http(s) URL';
    }
  }
  return null;
}

// Returns an error string if invalid, or null if the name is OK.
export function validateName(name) {
  if (typeof name !== 'string' || !name.trim()) return 'name is required';
  if (name.length > LIMITS.name) return `name must be at most ${LIMITS.name} characters`;
  return null;
}

// Standard security headers for all responses
export function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}
