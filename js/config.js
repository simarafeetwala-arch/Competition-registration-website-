// Supabase Configuration
// Keys provided by user
const SUPABASE_CONFIG = {
  url: 'https://yxzmgawbcfqmmboddwxk.supabase.co',
  publishableKey: 'sb_publishable_ztlQ2EiwuKlY9F1ss_1mEg_HBLPt98Y',
  // Authorized admin emails or passkey for Admin portal access control
  adminEmails: [
    'admin@competition.com',
    'admin@portal.io',
    'superadmin@supabase.co'
  ],
  adminPasscode: 'ADMIN2026' // Access passkey fallback for quick admin authorization
};

// Freeze configuration
if (typeof Object.freeze === 'function') {
  Object.freeze(SUPABASE_CONFIG);
}
