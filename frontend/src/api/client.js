const API_BASE_URL = 'http://localhost:5000/api';

export const apiClient = {
  async health() {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      return await res.json();
    } catch {
      return { status: 'offline', database: 'Disconnected', redisCache: 'Disconnected' };
    }
  },

  async signUp({ name, email, password, role, bio, walletAddress }) {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, bio, walletAddress }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    return data;
  },

  async login({ email, password }) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async updateProfile({ email, name, bio, walletAddress }) {
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, bio, walletAddress }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Profile update failed');
    return data;
  },

  async getApplications() {
    try {
      const res = await fetch(`${API_BASE_URL}/applications`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async submitApplication(appData) {
    try {
      const res = await fetch(`${API_BASE_URL}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appData),
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  async getDisputes() {
    try {
      const res = await fetch(`${API_BASE_URL}/disputes`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async submitDispute(disputeData) {
    try {
      const res = await fetch(`${API_BASE_URL}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(disputeData),
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  // Redis-Cached Leaderboard API
  async getCachedLeaderboard() {
    try {
      const res = await fetch(`${API_BASE_URL}/leaderboard`);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        ...data,
        cacheStatus: res.headers.get('X-Cache') || 'MISS',
      };
    } catch {
      return null;
    }
  },

  async invalidateLeaderboardCache() {
    try {
      await fetch(`${API_BASE_URL}/leaderboard/invalidate`, { method: 'POST' });
    } catch {}
  },
};
