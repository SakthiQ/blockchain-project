/**
 * useWeb3 — React Context & Hook for Web3 / Blockchain Integration
 * ================================================================
 * Provides:
 *   - Wallet connection (MetaMask or local Hardhat accounts)
 *   - Provider and signer management via Ethers.js v6
 *   - Account role detection (admin / judge / viewer)
 *   - Contract instance connected to the signer
 *   - Toast notification system
 *   - Account switching for demo purposes (local Hardhat accounts)
 *
 * BLOCKCHAIN CONCEPTS DEMONSTRATED:
 *   - window.ethereum: The EIP-1193 provider injected by MetaMask
 *   - ethers.BrowserProvider: Wraps window.ethereum for Ethers.js usage
 *   - signer: The account that will sign (authorize) transactions
 *   - JsonRpcProvider: Direct connection to local Hardhat node (for demo mode)
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import contractAddressData from '../contracts/contract-address.json';
import contractAbiData from '../contracts/HackathonJudging.json';

const CONTRACT_ADDRESS = contractAddressData.HackathonJudging;
const CONTRACT_ABI = contractAbiData.abi;

// Local Hardhat development accounts (pre-funded with 10000 ETH each)
// These accounts are deterministic — same private keys every time Hardhat node starts
export const LOCAL_ACCOUNTS = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    name: 'Admin Account',
    role: 'admin',
    color: '#ff6b8a',
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    name: 'Dr. Emily Chen',
    role: 'judge',
    color: '#6c63ff',
  },
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    name: 'Prof. Mark Rodriguez',
    role: 'judge',
    color: '#00d4ff',
  },
  {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    name: 'Ms. Priya Patel',
    role: 'judge',
    color: '#00e5a0',
  },
  {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926b',
    name: 'Viewer / Student',
    role: 'viewer',
    color: '#8892b0',
  },
];

// =========================================================
// Context
// =========================================================
const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);          // Connected address
  const [contract, setContract] = useState(null);         // Contract instance
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [networkName, setNetworkName] = useState('');
  const [accountRole, setAccountRole] = useState('viewer'); // 'admin' | 'judge' | 'viewer'
  const [hackathonInfo, setHackathonInfo] = useState(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [useLocalMode, setUseLocalMode] = useState(false);  // true = local Hardhat account (no MetaMask)
  const [selectedLocalAccount, setSelectedLocalAccount] = useState(0);

  // Toast notifications
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((type, title, message, duration = 6000) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // =========================================================
  // Build contract instance
  // =========================================================
  const buildContractInstance = useCallback((signerOrProvider) => {
    try {
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
    } catch (err) {
      console.error('Failed to build contract instance:', err);
      return null;
    }
  }, []);

  // =========================================================
  // Detect admin / judge role from on-chain data
  // =========================================================
  const detectRole = useCallback(async (contractInstance, address) => {
    try {
      const adminAddr = await contractInstance.admin();
      if (adminAddr.toLowerCase() === address.toLowerCase()) return 'admin';
      const isJudge = await contractInstance.isAuthorizedJudge(address);
      if (isJudge) return 'judge';
      return 'viewer';
    } catch {
      return 'viewer';
    }
  }, []);

  // =========================================================
  // Connect via MetaMask (browser wallet)
  // =========================================================
  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) {
      addToast('error', 'No Wallet Found',
        'MetaMask is not installed. Use the Local Demo mode below to test with local Hardhat accounts.');
      return;
    }

    setIsConnecting(true);
    try {
      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      await ethProvider.send('eth_requestAccounts', []);
      const ethSigner = await ethProvider.getSigner();
      const address = await ethSigner.getAddress();
      const network = await ethProvider.getNetwork();

      const contractInstance = buildContractInstance(ethSigner);
      const role = await detectRole(contractInstance, address);

      setProvider(ethProvider);
      setSigner(ethSigner);
      setAccount(address);
      setContract(contractInstance);
      setIsConnected(true);
      setNetworkName(network.name === 'unknown' ? `Chain ${network.chainId}` : network.name);
      setAccountRole(role);
      setUseLocalMode(false);

      addToast('success', 'Wallet Connected', `Connected as ${address.slice(0, 6)}...${address.slice(-4)}`);
    } catch (err) {
      const msg = err.code === 4001
        ? 'Connection request was rejected in your wallet.'
        : (err.message || 'Failed to connect wallet.');
      addToast('error', 'Connection Failed', msg);
    } finally {
      setIsConnecting(false);
    }
  }, [buildContractInstance, detectRole, addToast]);

  // =========================================================
  // Connect via Local Hardhat Account (no MetaMask needed)
  // =========================================================
  const connectLocalAccount = useCallback(async (accountIndex) => {
    setIsConnecting(true);
    try {
      const localProvider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      const wallet = new ethers.Wallet(LOCAL_ACCOUNTS[accountIndex].privateKey, localProvider);
      const address = wallet.address;

      const contractInstance = buildContractInstance(wallet);
      const role = await detectRole(contractInstance, address);

      setProvider(localProvider);
      setSigner(wallet);
      setAccount(address);
      setContract(contractInstance);
      setIsConnected(true);
      setNetworkName('Hardhat Local');
      setAccountRole(role);
      setUseLocalMode(true);
      setSelectedLocalAccount(accountIndex);

      addToast('success', 'Local Account Connected',
        `Switched to: ${LOCAL_ACCOUNTS[accountIndex].name}`);
    } catch (err) {
      if (err.message?.includes('ECONNREFUSED') || err.message?.includes('could not detect network')) {
        addToast('error', 'Hardhat Node Not Running',
          'Please start the local blockchain first:\n  npx hardhat node');
      } else {
        addToast('error', 'Connection Failed', err.message || 'Could not connect to local node.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [buildContractInstance, detectRole, addToast]);

  // =========================================================
  // Disconnect
  // =========================================================
  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setContract(null);
    setIsConnected(false);
    setNetworkName('');
    setAccountRole('viewer');
    setHackathonInfo(null);
    addToast('info', 'Disconnected', 'Wallet disconnected.');
  }, [addToast]);

  // =========================================================
  // Load hackathon info whenever contract is available
  // =========================================================
  const loadHackathonInfo = useCallback(async () => {
    if (!contract) return;
    setIsLoadingInfo(true);
    try {
      const info = await contract.getHackathonInfo();
      setHackathonInfo({
        name: info.name,
        description: info.description,
        active: info.active,
        numProjects: Number(info.numProjects),
        numJudges: Number(info.numJudges),
        adminAddress: info.adminAddress,
      });
    } catch (err) {
      console.warn('Could not load hackathon info:', err.message);
    } finally {
      setIsLoadingInfo(false);
    }
  }, [contract]);

  useEffect(() => {
    if (contract) loadHackathonInfo();
  }, [contract, loadHackathonInfo]);

  // =========================================================
  // Handle MetaMask account changes
  // =========================================================
  useEffect(() => {
    if (!window.ethereum || useLocalMode) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== account) {
        await connectMetaMask();
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', () => window.location.reload());

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [account, useLocalMode, connectMetaMask, disconnect]);

  // =========================================================
  // Read-only provider for public data (no wallet needed)
  // =========================================================
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
      // State
      provider,
      signer,
      account,
      contract,
      isConnected,
      isConnecting,
      networkName,
      accountRole,
      hackathonInfo,
      isLoadingInfo,
      useLocalMode,
      selectedLocalAccount,
      toasts,
      // Contract config
      contractAddress: CONTRACT_ADDRESS,
      // Actions
      connectMetaMask,
      connectLocalAccount,
      disconnect,
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
