/**
 * Pinterest OAuth State Management
 * 
 * Handles encoding/decoding of OAuth state using base64url JSON.
 */

export interface PinterestOAuthState {
  brandId: string;
  workspaceId: string;
  userId: string;
  locale?: string;
}

/**
 * Encode Pinterest OAuth state to base64url string
 */
export function encodePinterestState(payload: PinterestOAuthState): string {
  try {
    const json = JSON.stringify(payload);
    return Buffer.from(json, 'utf8').toString('base64url');
  } catch (error) {
    throw new Error(`Failed to encode Pinterest state: ${error}`);
  }
}

/**
 * Decode Pinterest OAuth state from base64url string
 */
export function decodePinterestState(token: string): PinterestOAuthState {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const decoded = JSON.parse(json) as PinterestOAuthState;
    
    // Validate required fields
    if (!decoded.brandId || !decoded.workspaceId || !decoded.userId) {
      throw new Error('Invalid Pinterest state: missing required fields');
    }
    
    return decoded;
  } catch (error) {
    throw new Error(`Failed to decode Pinterest state: ${error}`);
  }
}
