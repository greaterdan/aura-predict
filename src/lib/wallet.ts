// Custodial wallet management
// Generates and manages Solana wallets for users

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export interface WalletData {
  publicKey: string;
  privateKey: string; // Base58 encoded
  keypair: Keypair;
}

/**
 * Generate a new Solana wallet
 */
export function generateWallet(): WalletData {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const privateKey = bs58.encode(keypair.secretKey);

  return {
    publicKey,
    privateKey,
    keypair,
  };
}

/**
 * Restore wallet from private key
 */
export function restoreWallet(privateKey: string): WalletData {
  try {
    const secretKey = bs58.decode(privateKey);
    const keypair = Keypair.fromSecretKey(secretKey);
    const publicKey = keypair.publicKey.toBase58();

    return {
      publicKey,
      privateKey,
      keypair,
    };
  } catch (error) {
    throw new Error('Invalid private key');
  }
}

/**
 * Store wallet in localStorage (for demo purposes)
 * In production, this should be stored securely on the server
 */
export function storeWallet(walletData: WalletData, userId: string): void {
  const key = `wallet_${userId}`;
  localStorage.setItem(key, JSON.stringify({
    publicKey: walletData.publicKey,
    privateKey: walletData.privateKey,
  }));
}

/**
 * Retrieve wallet from localStorage
 */
export function getStoredWallet(userId: string): WalletData | null {
  const key = `wallet_${userId}`;
  const stored = localStorage.getItem(key);
  
  if (!stored) return null;
  
  try {
    const data = JSON.parse(stored);
    return restoreWallet(data.privateKey);
  } catch (error) {
    console.error('Error restoring wallet:', error);
    return null;
  }
}

/**
 * Get or create wallet for user
 */
export function getOrCreateWallet(userId: string): WalletData {
  let wallet = getStoredWallet(userId);
  
  if (!wallet) {
    wallet = generateWallet();
    storeWallet(wallet, userId);
  }
  
  return wallet;
}

