/**
 * Secret Encryption Helper
 * 
 * Provides AES-256-GCM encryption/decryption for sensitive data like
 * social account credentials. Uses a symmetric key from environment.
 * 
 * Format: <iv>:<authTag>:<ciphertext> (all base64 encoded)
 */

import crypto from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get the encryption key from environment
 * Falls back to ACCESS_TOKEN_SECRET if SECRET_ENCRYPTION_KEY is not set
 */
function getEncryptionKey(): Buffer {
  const keySource = env.SECRET_ENCRYPTION_KEY || env.ACCESS_TOKEN_SECRET;
  
  // Derive a 32-byte key using SHA-256
  return crypto.createHash("sha256").update(keySource).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * 
 * @param plainText - The string to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (base64 encoded)
 */
export function encryptSecret(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypts an encrypted string using AES-256-GCM
 * 
 * @param cipherText - The encrypted string in format: iv:authTag:ciphertext
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (invalid format, wrong key, tampered data)
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) {
    throw new Error("Cannot decrypt empty ciphertext");
  }

  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format: expected iv:authTag:ciphertext");
  }

  const [ivBase64, authTagBase64, encryptedData] = parts;
  
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Checks if a string looks like it was encrypted with our format
 * 
 * @param value - String to check
 * @returns true if it matches the encrypted format
 */
export function isEncryptedFormat(value: string): boolean {
  if (!value) return false;
  
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  
  // Basic check that parts look like base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return parts.every((part) => base64Regex.test(part));
}

