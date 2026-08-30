const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

let supabase = null;
let isSupabaseConfigured = false;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    isSupabaseConfigured = true;
    console.log('✅ Connected to Supabase Client at:', SUPABASE_URL);
  } catch (err) {
    console.warn('⚠️ Could not initialize Supabase client:', err.message);
  }
} else {
  console.warn('⚠️ SUPABASE_URL / SUPABASE_ANON_KEY not set — API will return 503.');
}

/**
 * Highest existing value of `column` in `table`, or 0 when the table is empty.
 * Used to mint the next sequential id. Counting rows is not safe here: after a
 * delete the count collides with an id that already exists and the insert fails
 * the UNIQUE constraint.
 */
async function nextId(table, column) {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .order(column, { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data && data.length ? data[0][column] : 0) + 1;
}

const supabaseService = {
  isConfigured() {
    return isSupabaseConfigured && supabase !== null;
  },

  getStatus() {
    return this.isConfigured() ? 'Supabase Database (Active)' : 'Not Configured';
  },

  getClient() {
    return supabase;
  },

  // ── User Operations ────────────────────────────────────────────────────────
  async findUserByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createUser(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email: userData.email.toLowerCase(),
        name: userData.name,
        password_hash: userData.passwordHash,
        role: userData.role || 'participant',
        wallet_address: userData.walletAddress || '',
        bio: userData.bio || '',
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateUserByEmail(email, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('email', email.toLowerCase())
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ── Project Application Operations ─────────────────────────────────────────
  async getApplications() {
    const { data, error } = await supabase
      .from('project_applications')
      .select('*')
      .order('application_id', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createApplication(appData) {
    const applicationId = await nextId('project_applications', 'application_id');
    const { data, error } = await supabase
      .from('project_applications')
      .insert([{
        application_id: applicationId,
        name: appData.name,
        description: appData.description || '',
        team_lead: appData.teamLead,
        category: appData.category || 'DeFi',
        ipfs_cid: appData.ipfsCID || '',
        applicant_wallet: appData.applicantWallet,
        status: appData.status || 'Pending',
        registered_project_id: appData.registeredProjectId || 0,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateApplicationStatus(applicationId, updates) {
    const { data, error } = await supabase
      .from('project_applications')
      .update(updates)
      .eq('application_id', Number(applicationId))
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ── Dispute Operations ─────────────────────────────────────────────────────
  async getDisputes() {
    const { data, error } = await supabase
      .from('disputes')
      .select('*')
      .order('dispute_id', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createDispute(disputeData) {
    const disputeId = await nextId('disputes', 'dispute_id');
    const { data, error } = await supabase
      .from('disputes')
      .insert([{
        dispute_id: disputeId,
        project_id: disputeData.projectId,
        raised_by: disputeData.raisedBy,
        reason: disputeData.reason,
        status: disputeData.status || 'Pending',
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateDisputeStatus(disputeId, updates) {
    const { data, error } = await supabase
      .from('disputes')
      .update(updates)
      .eq('dispute_id', Number(disputeId))
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};

module.exports = supabaseService;
