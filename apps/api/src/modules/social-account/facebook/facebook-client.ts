/**
 * Facebook Graph API Client
 * 
 * Fetch-based HTTP client for Facebook Graph API requests.
 */

import { facebookConfig } from '../../../config/facebook.config.js';
import { logger } from '../../../lib/logger.js';

export const graphBaseUrl = `https://graph.facebook.com/${facebookConfig.graphVersion}`;

/**
 * Helper to make Graph API requests with access token
 */
export async function graphRequest<T = any>(
  endpoint: string,
  accessToken: string,
  params?: Record<string, any>
): Promise<T> {
  const url = new URL(`${graphBaseUrl}${endpoint}`);
  
  // Add access token and other params
  url.searchParams.set('access_token', accessToken);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  logger.debug({ url: url.toString(), endpoint }, 'Facebook Graph API request');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(
        {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
          url: url.toString(),
        },
        'Facebook Graph API error response'
      );
      
      const error: any = new Error(errorData.error?.message || `Graph API error: ${response.statusText}`);
      error.response = {
        status: response.status,
        data: errorData,
      };
      throw error;
    }

    const data = await response.json();
    return data as T;
  } catch (error: any) {
    if (error.response) {
      // Already logged above
      throw error;
    }
    
    logger.error({ error: error.message, url: url.toString() }, 'Facebook Graph API network error');
    throw error;
  }
}

/**
 * Helper for POST requests to Graph API
 */
export async function graphPost<T = any>(
  endpoint: string,
  accessToken: string,
  body?: Record<string, any>
): Promise<T> {
  const url = new URL(`${graphBaseUrl}${endpoint}`);
  url.searchParams.set('access_token', accessToken);

  logger.debug({ url: url.toString(), endpoint, body }, 'Facebook Graph API POST request');

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(
        {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
          url: url.toString(),
        },
        'Facebook Graph API POST error response'
      );
      
      const error: any = new Error(errorData.error?.message || `Graph API error: ${response.statusText}`);
      error.response = {
        status: response.status,
        data: errorData,
      };
      throw error;
    }

    const data = await response.json();
    return data as T;
  } catch (error: any) {
    if (error.response) {
      throw error;
    }
    
    logger.error({ error: error.message, url: url.toString() }, 'Facebook Graph API POST network error');
    throw error;
  }
}
