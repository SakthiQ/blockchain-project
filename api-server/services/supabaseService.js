const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

let supabase = null;
let isSupabaseConfigured = false;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    isSupabaseConfigured = true;
    console.log('✅ Connected to Supabase Client at:', SUPABASE_URL);
  } catch (err) {
    console.warn('⚠️ Could not initialize Supabase client:', err.message);
  }
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

  // User Operations
  async findUserByEmail(email) {
    if (!this.isConfigured()) return null;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    if (error || !data) return null;
    return data;
  },

  async createUser(userData) {
    if (!this.isConfigured()) return null;
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

  // Project Application Operations
  async getApplications() {
    if (!this.isConfigured()) return null;
    const { data, error } = await supabase
      .from('project_applications')
      .select('*')
      .order('application_id', { ascending: true });
    if (error) return null;
    return data;
  },

  async createApplication(appData) {
    if (!this.isConfigured()) return null;
    const { data, error } = await supabase
      .from('project_applications')
      .insert([{
        application_id: appData.applicationId,
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

  // Dispute Operations
  async getDisputes() {
    if (!this.isConfigured()) return null;
    const { data, error } = await supabase
      .from('disputes')
      .select('*')
      .order('dispute_id', { ascending: true });
    if (error) return null;
    return data;
  },

  async createDispute(disputeData) {
    if (!this.isConfigured()) return null;
    const { data, error } = await supabase
      .from('disputes')
      .insert([{
        dispute_id: disputeData.disputeId,
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
};

module.exports = supabaseService;
