import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import contractAddressData from '../contracts/contract-address.json';
import contractAbiData from '../contracts/HackathonJudging.json';
import nftAbiData from '../contracts/WinnerNFT.json';
import { apiClient } from '../api/apiClient';

const CONTRACT_ADDRESS = contractAddressData.HackathonJudging;
const NFT_CONTRACT_ADDRESS = contractAddressData.WinnerNFT;
const CONTRACT_ABI = contractAbiData.abi;
const NFT_ABI = nftAbiData ? nftAbiData.abi : [];

export const PHASE_NAMES = ['Setup', 'Judging (Commit)', 'Revealing (Verify)', 'Finalized (Locked)'];

export const LOCAL_ACCOUNTS = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    name: 'Admin Account',
    email: 'admin@chainjudge.org',
    role: 'admin',
    color: '#f43f5e',
    bio: 'Lead Hackathon Administrator & Protocol Governance Supervisor',
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    name: 'Dr. Emily Chen',
    email: 'emily.chen@stanford.edu',
    role: 'judge',
    color: '#6366f1',
    bio: 'Associate Professor of Computer Science & Web3 Security Researcher',
  },
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    name: 'Prof. Mark Rodriguez',
    email: 'm.rodriguez@mit.edu',
    role: 'judge',
    color: '#0ea5e9',
    bio: 'Fintech Director & Distributed Systems Specialist',
  },
  {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    name: 'Ms. Priya Patel',
    email: 'priya@blockchainlabs.io',
    role: 'judge',
    color: '#10b981',
    bio: 'Venture Partner & Smart Contract Auditor',
  },
  {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926b',
    name: 'Alex Rivera',
    email: 'alex.rivera@dev.io',
    role: 'participant',
    color: '#94a3b8',
    bio: 'Full-stack Web3 Builder & Decentralized Systems Enthusiast',
  },
];

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [nftContract, setNftContract] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [networkName, setNetworkName] = useState('');
  const [chainId, setChainId] = useState(null);
  const [accountRole, setAccountRole] = useState('viewer');
  const [hackathonInfo, setHackathonInfo] = useState(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [useLocalMode, setUseLocalMode] = useState(false);
  const [selectedLocalAccount, setSelectedLocalAccount] = useState(0);
  const [dbStatus, setDbStatus] = useState('Checking...');
  const [redisStatus, setRedisStatus] = useState('Checking...');

  // Authentication & Profile State
  const [userProfile, setUserProfile] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((type, title, message, duration = 6000) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    return id;
  }, []);


  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Check MongoDB & Redis Backend Status
  useEffect(() => {
    apiClient.health().then(res => {
      setDbStatus(res.database || 'Connected');
      setRedisStatus(res.redisCache || 'Active');
    });
  }, []);

  const buildContractInstance = useCallback((signerOrProvider) => {
    try {
      const mainContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
      const winnerNft = NFT_CONTRACT_ADDRESS && NFT_ABI.length > 0
        ? new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signerOrProvider)
        : null;
      return { mainContract, winnerNft };
    } catch (err) {
      console.error('Failed to build contract instance:', err);
      return { mainContract: null, winnerNft: null };
    }
  }, []);

  const detectRole = useCallback(async (contractInstance, address) => {
    try {
      const adminAddr = await contractInstance.admin();
      if (adminAddr.toLowerCase() === address.toLowerCase()) return 'admin';
      const isJudge = await contractInstance.isAuthorizedJudge(address);
      if (isJudge) return 'judge';
      return 'participant';
    } catch {
      return 'participant';
    }
  }, []);

  const loadHackathonInfo = useCallback(async (contractInstance = contract) => {
    if (!contractInstance) return;
    setIsLoadingInfo(true);
    try {
      const info = await contractInstance.getHackathonInfo();
      const phaseNum = Number(info.phase !== undefined ? info.phase : info[3] || 0);
      setHackathonInfo({
        name: info.name || info[0],
        description: info.description || info[1],
        active: info.active !== undefined ? info.active : info[2],
        phase: phaseNum,
        phaseName: PHASE_NAMES[phaseNum] || 'Unknown',
        numProjects: Number(info.numProjects !== undefined ? info.numProjects : info[4] || 0),
        numJudges: Number(info.numJudges !== undefined ? info.numJudges : info[5] || 0),
        adminAddress: info.adminAddress || info[6],
      });
    } catch (err) {
      console.warn('Could not load hackathon info:', err.message);
    } finally {
      setIsLoadingInfo(false);
    }
  }, [contract]);

  // Restore saved auth session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('chainjudge_auth_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setUserProfile(parsed);
      } catch {}
    }
  }, []);

  const saveAuthSession = useCallback((profile) => {
    setUserProfile(profile);
    localStorage.setItem('chainjudge_auth_session', JSON.stringify(profile));
  }, []);

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) {
      addToast('error', 'No Wallet Found', 'MetaMask is not installed. Use Local Demo mode.');
      return;
    }

    setIsConnecting(true);
    try {
      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      await ethProvider.send('eth_requestAccounts', []);
      const ethSigner = await ethProvider.getSigner();
      const address = await ethSigner.getAddress();
      const network = await ethProvider.getNetwork();

      const { mainContract, winnerNft } = buildContractInstance(ethSigner);
      const role = await detectRole(mainContract, address);

      setProvider(ethProvider);
      setSigner(ethSigner);
      setAccount(address);
      setContract(mainContract);
      setNftContract(winnerNft);
      setIsConnected(true);
      setNetworkName(network.name === 'unknown' ? `Chain ${network.chainId}` : network.name);
      setChainId(Number(network.chainId));
      setAccountRole(role);
      setUseLocalMode(false);

      const existingProfiles = JSON.parse(localStorage.getItem('chainjudge_user_profiles') || '{}');
      const profile = existingProfiles[address.toLowerCase()] || {
        name: `${address.slice(0, 6)}...${address.slice(-4)}`,
        email: `${address.slice(0, 6)}@web3.eth`,
        role: role,
        bio: 'Verified Web3 Wallet User',
        walletAddress: address,
        authMethod: 'web3',
        createdAt: new Date().toISOString()
      };
      saveAuthSession(profile);

      addToast('success', 'Wallet Connected', `Authenticated as ${address.slice(0, 6)}...${address.slice(-4)}`);
      await loadHackathonInfo(mainContract);
    } catch (err) {
      const msg = err.code === 4001 ? 'Connection rejected.' : (err.message || 'Failed to connect.');
      addToast('error', 'Connection Failed', msg);
    } finally {
      setIsConnecting(false);
    }
  }, [buildContractInstance, detectRole, addToast, loadHackathonInfo, saveAuthSession]);

  const connectLocalAccount = useCallback(async (accountIndex) => {
    setIsConnecting(true);
    try {
      const localProvider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      const targetAcc = LOCAL_ACCOUNTS[accountIndex];
      const wallet = new ethers.Wallet(targetAcc.privateKey, localProvider);
      const address = wallet.address;

      const { mainContract, winnerNft } = buildContractInstance(wallet);
      const role = await detectRole(mainContract, address);

      setProvider(localProvider);
      setSigner(wallet);
      setAccount(address);
      setContract(mainContract);
      setNftContract(winnerNft);
      setIsConnected(true);
      setNetworkName('Hardhat Local (31337)');
      setChainId(31337);
      setAccountRole(role);
      setUseLocalMode(true);
      setSelectedLocalAccount(accountIndex);

      const profile = {
        name: targetAcc.name,
        email: targetAcc.email,
        role: role,
        bio: targetAcc.bio,
        walletAddress: address,
        authMethod: 'local_account',
        createdAt: new Date().toISOString()
      };
      saveAuthSession(profile);

      addToast('success', 'Account Switch', `Authenticated as: ${targetAcc.name}`);
      await loadHackathonInfo(mainContract);
    } catch (err) {
      addToast('error', 'Connection Failed', err.message || 'Could not connect to local node.');
    } finally {
      setIsConnecting(false);
    }
  }, [buildContractInstance, detectRole, addToast, loadHackathonInfo, saveAuthSession]);

  // Sign Up with Email & Persist to MongoDB API
  const signUpWithEmail = useCallback(async ({ name, email, password = 'password123', role, bio }) => {
    setIsConnecting(true);
    try {
      const targetIndex = role === 'admin' ? 0 : role === 'judge' ? 1 : 4;
      await connectLocalAccount(targetIndex);

      const newProfile = {
        name,
        email,
        role,
        bio: bio || 'Hackathon Participant & Builder',
        walletAddress: LOCAL_ACCOUNTS[targetIndex].address,
        authMethod: 'email',
        createdAt: new Date().toISOString()
      };

      // Call MongoDB API
      try {
        await apiClient.signUp({
          name,
          email,
          password,
          role,
          bio,
          walletAddress: LOCAL_ACCOUNTS[targetIndex].address
        });
      } catch (e) {
        console.warn('MongoDB API sync notice:', e.message);
      }

      saveAuthSession(newProfile);
      addToast('success', 'Account Created & Synced!', `Welcome to ChainJudge, ${name}! (MongoDB Active)`);
      setAuthModalOpen(false);
    } catch (err) {
      addToast('error', 'Sign Up Failed', err.message);
    } finally {
      setIsConnecting(false);
    }
  }, [connectLocalAccount, saveAuthSession, addToast]);

  // Log In with Email & Query MongoDB API
  const loginWithEmail = useCallback(async ({ email, password = 'password123' }) => {
    setIsConnecting(true);
    try {
      let profile = null;

      // Try MongoDB API login first
      try {
        const mongoRes = await apiClient.login({ email, password });
        if (mongoRes && mongoRes.user) {
          profile = {
            name: mongoRes.user.name,
            email: mongoRes.user.email,
            role: mongoRes.user.role,
            bio: mongoRes.user.bio,
            walletAddress: mongoRes.user.walletAddress || LOCAL_ACCOUNTS[4].address,
            authMethod: 'email',
            createdAt: new Date().toISOString()
          };
        }
      } catch (e) {
        console.warn('MongoDB API login notice:', e.message);
      }

      if (!profile) {
        const savedProfiles = JSON.parse(localStorage.getItem('chainjudge_user_profiles') || '{}');
        profile = Object.values(savedProfiles).find(p => p.email === email) || {
          name: email.split('@')[0],
          email,
          role: 'participant',
          bio: 'Registered Hackathon Participant',
          walletAddress: LOCAL_ACCOUNTS[4].address,
          authMethod: 'email',
          createdAt: new Date().toISOString()
        };
      }

      await connectLocalAccount(4);
      saveAuthSession(profile);
      addToast('success', 'Welcome Back!', `Logged in as ${profile.name}`);
      setAuthModalOpen(false);
    } catch (err) {
      addToast('error', 'Login Failed', err.message);
    } finally {
      setIsConnecting(false);
    }
  }, [connectLocalAccount, saveAuthSession, addToast]);

  const updateUserProfile = useCallback(async (updatedFields) => {
    setUserProfile(prev => {
      const next = { ...prev, ...updatedFields };
      localStorage.setItem('chainjudge_auth_session', JSON.stringify(next));

      if (next.walletAddress) {
        const savedProfiles = JSON.parse(localStorage.getItem('chainjudge_user_profiles') || '{}');
        savedProfiles[next.walletAddress.toLowerCase()] = next;
        localStorage.setItem('chainjudge_user_profiles', JSON.stringify(savedProfiles));
      }

      // Async update MongoDB
      apiClient.updateProfile({
        email: next.email,
        name: next.name,
        bio: next.bio,
        walletAddress: next.walletAddress
      }).catch(err => console.warn('MongoDB update notice:', err.message));

      addToast('success', 'Profile Updated', 'User account settings saved in MongoDB.');
      return next;
    });
  }, [addToast]);

  const logout = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setContract(null);
    setNftContract(null);
    setIsConnected(false);
    setNetworkName('');
    setChainId(null);
    setAccountRole('viewer');
    setHackathonInfo(null);
    setUserProfile(null);
    localStorage.removeItem('chainjudge_auth_session');
    addToast('info', 'Logged Out', 'Signed out of user session.');
  }, [addToast]);

  useEffect(() => {
    if (contract) loadHackathonInfo(contract);
  }, [contract, loadHackathonInfo]);

  const getReadOnlyContract = useCallback(() => {
    try {
      const readProvider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
    } catch {
      return null;
    }
  }, []);

  return (
    <Web3Context.Provider value={{
      provider,
      signer,
      account,
      contract,
      nftContract,
      isConnected,
      isConnecting,
      networkName,
      chainId,
      accountRole,
      hackathonInfo,
      isLoadingInfo,
      useLocalMode,
      selectedLocalAccount,
      userProfile,
      authModalOpen,
      profileModalOpen,
      dbStatus,
      redisStatus,
      toasts,
      contractAddress: CONTRACT_ADDRESS,
      nftContractAddress: NFT_CONTRACT_ADDRESS,
      setAuthModalOpen,
      setProfileModalOpen,
      connectMetaMask,
      connectLocalAccount,
      signUpWithEmail,
      loginWithEmail,
      updateUserProfile,
      logout,
      loadHackathonInfo,
      addToast,
      removeToast,
      getReadOnlyContract,
    }}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used within Web3Provider');
  return ctx;
}
