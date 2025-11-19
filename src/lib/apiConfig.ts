// API configuration - environment-aware base URL
// In production, uses relative URLs (same domain) or VITE_API_BASE_URL if set
// In development, uses localhost:3002

// Check if we're in production
const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

// Get the API base URL
const getApiBaseUrl = (): string => {
  // If custom API URL is set via environment variable, use it
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // In production, use relative URLs (same domain)
  // This works if backend is deployed on the same domain or via Vercel serverless functions
  if (isProduction) {
    return ''; // Empty string means relative URL
  }
  
  // In development, use localhost
  return 'http://localhost:3002';
};

export const API_BASE_URL = getApiBaseUrl();

