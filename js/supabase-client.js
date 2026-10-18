// Centralized Supabase Client and Database Operations

// Fallback seed competitions if needed
const DEFAULT_COMPETITIONS = [
  { competition_id: 1, competition_name: "Global AI Hackathon 2026", description: "Build innovative AI solutions solving real world problems using LLMs, autonomous agents, and computer vision." },
  { competition_id: 2, competition_name: "Cybersecurity CTF Invitational", description: "Test your defensive and offensive cyber security skills across web, reverse engineering, binary exploitation, and cryptography." },
  { competition_id: 3, competition_name: "Quantum Computing Challenge", description: "Design novel quantum algorithms for optimization, cryptography, and complex physical simulation problems." },
  { competition_id: 4, competition_name: "Autonomous Drone Grand Prix", description: "Develop autonomous flight paths and real-time obstacle avoidance algorithms for high-speed drone navigation." },
  { competition_id: 5, competition_name: "FinTech Algorithmic Trading Cup", description: "Develop high-frequency predictive trading strategies on historical and real-time multi-asset financial market data." },
  { competition_id: 6, competition_name: "Smart Cities IoT Innovation", description: "Create connected IoT hardware and sensor architectures for sustainable urban ecosystems and traffic management." },
  { competition_id: 7, competition_name: "GreenTech Clean Energy Sprint", description: "Pioneer software solutions for carbon footprint tracking, renewable energy grid balancing, and circular economy." },
  { competition_id: 8, competition_name: "BioTech Genome Sequencing Bowl", description: "Analyze complex genetic patterns and predict protein fold structures using modern deep learning architectures." },
  { competition_id: 9, competition_name: "AR/VR Spatial Computing Jam", description: "Craft immersive augmented and virtual reality experiences for interactive education, healthcare, and digital twins." },
  { competition_id: 10, competition_name: "RoboWars Mechatronics Arena", description: "Design, simulate, and program combat and industrial robotics mechanisms with intelligent pathfinding." },
  { competition_id: 11, competition_name: "Open Source Devcon Marathon", description: "Contribute high-impact pull requests to foundational open source developer tooling, compilers, and databases." },
  { competition_id: 12, competition_name: "Space Systems Orbital Simulation", description: "Simulate satellite orbital trajectories, collision avoidance, and telemetry systems for constellation networks." }
];

let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.error('Supabase JS library not loaded');
      return null;
    }
    supabaseInstance = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.publishableKey
    );
  }
  return supabaseInstance;
}

// Auth Helpers
async function getCurrentSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { session }, error } = await sb.auth.getSession();
  if (error) {
    console.error('Session error:', error);
    return null;
  }
  return session;
}

async function getCurrentUser() {
  const session = await getCurrentSession();
  return session ? session.user : null;
}

async function signUpUser(name, email, password, phone) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client unavailable');

  // Step 1: Sign up in Supabase Auth
  const { data, error } = await sb.auth.signUp({
    email: email.trim().toLowerCase(),
    password: password,
    options: {
      data: {
        name: name.trim(),
        phone_no: phone ? phone.trim() : ''
      }
    }
  });

  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error('Registration failed. Please try again.');

  // Step 2: Store in public.users table (per schema)
  try {
    const { error: profileError } = await sb
      .from('users')
      .upsert({
        uid: user.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone_no: phone ? phone.trim() : null
      }, { onConflict: 'uid' });

    if (profileError) {
      console.warn('Profile sync note:', profileError.message);
    }
  } catch (err) {
    console.warn('Profile write exception:', err);
  }

  // Also cache locally for seamless UX
  localStorage.setItem('comp_user_profile', JSON.stringify({
    uid: user.id,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone_no: phone ? phone.trim() : ''
  }));

  return { user, session: data.session };
}

async function signInUser(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client unavailable');

  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: password
  });

  if (error) throw error;

  // Retrieve user record from public.users table or user metadata
  if (data.user) {
    try {
      const { data: profile } = await sb
        .from('users')
        .select('*')
        .eq('uid', data.user.id)
        .maybeSingle();

      if (profile) {
        localStorage.setItem('comp_user_profile', JSON.stringify(profile));
      } else {
        // Fallback to auth metadata if record doesn't exist yet
        const meta = data.user.user_metadata || {};
        const fallbackProfile = {
          uid: data.user.id,
          name: meta.name || data.user.email.split('@')[0],
          email: data.user.email,
          phone_no: meta.phone_no || ''
        };
        // Auto-insert missing profile
        await sb.from('users').upsert(fallbackProfile, { onConflict: 'uid' });
        localStorage.setItem('comp_user_profile', JSON.stringify(fallbackProfile));
      }
    } catch (e) {
      console.warn('Profile fetch warning:', e);
    }
  }

  return data;
}

async function signOutUser() {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  localStorage.removeItem('comp_user_profile');
  sessionStorage.removeItem('admin_session_auth');
  window.location.href = 'index.html';
}

async function getUserProfile(uid) {
  // Check local cache first
  const cached = localStorage.getItem('comp_user_profile');
  if (cached) {
    try {
      const p = JSON.parse(cached);
      if (p.uid === uid) return p;
    } catch (e) {}
  }

  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('users')
    .select('*')
    .eq('uid', uid)
    .maybeSingle();

  if (error || !data) {
    // If not found in public.users, check auth session user
    const { data: authData } = await sb.auth.getUser();
    if (authData && authData.user && authData.user.id === uid) {
      const meta = authData.user.user_metadata || {};
      return {
        uid: uid,
        name: meta.name || authData.user.email.split('@')[0],
        email: authData.user.email,
        phone_no: meta.phone_no || ''
      };
    }
    return null;
  }

  localStorage.setItem('comp_user_profile', JSON.stringify(data));
  return data;
}

// Competitions Data
async function getCompetitions() {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('competitions')
        .select('*')
        .order('competition_id', { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Competitions query fallback:', err);
    }
  }
  return DEFAULT_COMPETITIONS;
}

async function getCompetitionById(id) {
  const numId = parseInt(id, 10);
  const sb = getSupabase();
  if (sb && !isNaN(numId)) {
    try {
      const { data, error } = await sb
        .from('competitions')
        .select('*')
        .eq('competition_id', numId)
        .maybeSingle();

      if (!error && data) return data;
    } catch (e) {
      console.warn('Single competition query fallback:', e);
    }
  }
  return DEFAULT_COMPETITIONS.find(c => c.competition_id === numId) || null;
}

async function addCompetition(name, description) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not connected');

  const { data, error } = await sb
    .from('competitions')
    .insert([{ competition_name: name.trim(), description: description.trim() }])
    .select();

  if (error) throw error;
  return data;
}

// Participation Data
async function applyToCompetition(uid, competitionId, note) {
  const sb = getSupabase();
  if (!sb) throw new Error('Database connection not available');

  const compId = parseInt(competitionId, 10);

  // Check if already applied
  const { data: existing } = await sb
    .from('participation')
    .select('id')
    .eq('uid', uid)
    .eq('competition_id', compId)
    .maybeSingle();

  if (existing) {
    // Update existing note
    const { data, error } = await sb
      .from('participation')
      .update({ note: note.trim() })
      .eq('id', existing.id)
      .select();

    if (error) throw error;
    return { data, updated: true };
  } else {
    // Insert new participation
    const { data, error } = await sb
      .from('participation')
      .insert([{
        uid: uid,
        competition_id: compId,
        note: note ? note.trim() : ''
      }])
      .select();

    if (error) throw error;
    return { data, created: true };
  }
}

async function getUserParticipations(uid) {
  const sb = getSupabase();
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from('participation')
      .select(`
        id,
        competition_id,
        note,
        competitions (
          competition_id,
          competition_name,
          description
        )
      `)
      .eq('uid', uid);

    if (error) {
      // Fallback manual join if foreign key embedding has permission rules
      const { data: rawParts } = await sb
        .from('participation')
        .select('*')
        .eq('uid', uid);

      if (!rawParts || rawParts.length === 0) return [];
      const comps = await getCompetitions();
      return rawParts.map(p => ({
        ...p,
        competitions: comps.find(c => c.competition_id === p.competition_id) || {
          competition_id: p.competition_id,
          competition_name: `Competition #${p.competition_id}`,
          description: ''
        }
      }));
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching participations:', err);
    return [];
  }
}

// Admin Operations: Retrieve all participations with user name, competition list/details, and note
async function getAllParticipationsWithDetails() {
  const sb = getSupabase();
  if (!sb) return [];

  try {
    // Try joined query first
    const { data, error } = await sb
      .from('participation')
      .select(`
        id,
        uid,
        competition_id,
        note,
        users (
          uid,
          name,
          email,
          phone_no
        ),
        competitions (
          competition_id,
          competition_name,
          description
        )
      `)
      .order('id', { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map(item => ({
        id: item.id,
        uid: item.uid,
        userName: item.users ? item.users.name : 'Unknown User',
        userEmail: item.users ? item.users.email : 'N/A',
        userPhone: item.users ? item.users.phone_no : 'N/A',
        competitionId: item.competition_id,
        competitionName: item.competitions ? item.competitions.competition_name : `Comp #${item.competition_id}`,
        competitionDescription: item.competitions ? item.competitions.description : '',
        note: item.note || 'No note provided'
      }));
    }

    // Fallback: Query tables individually and merge client-side
    const [partRes, userRes, compRes] = await Promise.all([
      sb.from('participation').select('*').order('id', { ascending: false }),
      sb.from('users').select('*'),
      getCompetitions()
    ]);

    const participations = partRes.data || [];
    const users = userRes.data || [];
    const comps = compRes || [];

    const userMap = new Map();
    users.forEach(u => userMap.set(u.uid, u));

    const compMap = new Map();
    comps.forEach(c => compMap.set(c.competition_id, c));

    return participations.map(p => {
      const u = userMap.get(p.uid) || {};
      const c = compMap.get(p.competition_id) || {};
      return {
        id: p.id,
        uid: p.uid,
        userName: u.name || 'Registered Applicant',
        userEmail: u.email || 'N/A',
        userPhone: u.phone_no || 'N/A',
        competitionId: p.competition_id,
        competitionName: c.competition_name || `Competition #${p.competition_id}`,
        competitionDescription: c.description || '',
        note: p.note || 'No note provided'
      };
    });
  } catch (e) {
    console.error('Admin participation fetch error:', e);
    return [];
  }
}

// Admin Authorization Check
async function isAuthorizedAdmin() {
  // Check if session passkey unlocked
  if (sessionStorage.getItem('admin_session_auth') === 'true') {
    return true;
  }

  const user = await getCurrentUser();
  if (user && user.email) {
    const emailLower = user.email.toLowerCase();
    if (SUPABASE_CONFIG.adminEmails.some(e => e.toLowerCase() === emailLower)) {
      return true;
    }
  }

  return false;
}

// Universal Navbar Initialization
async function initNavbar() {
  const navContainer = document.querySelector('.main-navbar');
  if (!navContainer) return;

  const user = await getCurrentUser();
  const profile = user ? await getUserProfile(user.id) : null;
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  const navLinks = [
    { href: 'index.html', label: 'Home' },
    { href: 'dashboard.html', label: 'Dashboard' },
    { href: 'admin.html', label: 'Admin Portal' }
  ];

  let linksHtml = navLinks.map(link => {
    const isActive = currentPath === link.href ? 'active' : '';
    return `<a href="${link.href}" class="nav-link ${isActive}">${link.label}</a>`;
  }).join('');

  let authAreaHtml = '';
  if (user) {
    const displayName = (profile && profile.name) ? profile.name : (user.email.split('@')[0]);
    const initial = displayName.charAt(0).toUpperCase();
    authAreaHtml = `
      <div class="user-pill">
        <div class="user-avatar" title="${displayName}">${initial}</div>
        <span class="user-name">${displayName}</span>
        <button class="btn btn-outline-danger btn-sm" onclick="signOutUser()">Logout</button>
      </div>
    `;
  } else {
    authAreaHtml = `
      <div class="nav-auth-buttons">
        <a href="auth.html?mode=login" class="btn btn-outline btn-sm">Sign In</a>
        <a href="auth.html?mode=register" class="btn btn-primary btn-sm glow-btn">Register</a>
      </div>
    `;
  }

  navContainer.innerHTML = `
    <div class="nav-content">
      <a href="index.html" class="nav-brand">
        <div class="brand-icon">⚡</div>
        <div class="brand-text">
          <span class="brand-title">NEXUS</span>
          <span class="brand-subtitle">COMPETITIONS</span>
        </div>
      </a>
      <div class="nav-menu" id="navMenu">
        ${linksHtml}
      </div>
      <div class="nav-actions">
        ${authAreaHtml}
        <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation" onclick="document.getElementById('navMenu').classList.toggle('nav-menu-open')">
          ☰
        </button>
      </div>
    </div>
  `;
}

// Global exposure
window.getSupabase = getSupabase;
window.getCurrentSession = getCurrentSession;
window.getCurrentUser = getCurrentUser;
window.signUpUser = signUpUser;
window.signInUser = signInUser;
window.signOutUser = signOutUser;
window.getUserProfile = getUserProfile;
window.getCompetitions = getCompetitions;
window.getCompetitionById = getCompetitionById;
window.addCompetition = addCompetition;
window.applyToCompetition = applyToCompetition;
window.getUserParticipations = getUserParticipations;
window.getAllParticipationsWithDetails = getAllParticipationsWithDetails;
window.isAuthorizedAdmin = isAuthorizedAdmin;
window.initNavbar = initNavbar;
