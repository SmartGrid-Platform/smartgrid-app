import axios from 'axios';

const hostname = window.location.hostname;
const protocol = window.location.protocol;
const port = window.location.port ? `:${window.location.port}` : '';

// Check if running locally
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

// In local dev, talk directly to respective microservice ports.
// In production, Nginx proxies requests to the backend server based on the sub-route.
export const AUTH_URL = isLocalhost ? `http://localhost:3001/api` : `${protocol}//${hostname}${port}/api`;
export const CONSUMER_URL = isLocalhost ? `http://localhost:3002/api` : `${protocol}//${hostname}${port}/api`;
export const METER_URL = isLocalhost ? `http://localhost:3003/api` : `${protocol}//${hostname}${port}/api`;
export const BILLING_URL = isLocalhost ? `http://localhost:3004/api` : `${protocol}//${hostname}${port}/api`;
export const ALERT_URL = isLocalhost ? `http://localhost:3005/api` : `${protocol}//${hostname}${port}/api`;
export const ASSISTANT_URL = isLocalhost ? `http://localhost:4004/api` : `${protocol}//${hostname}${port}/api`;

const createClient = (baseURL) => {
  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Request interceptor to attach JWT token
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor to handle token expiry / errors
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

export const authApi = createClient(AUTH_URL);
export const consumerApi = createClient(CONSUMER_URL);
export const meterApi = createClient(METER_URL);
export const billingApi = createClient(BILLING_URL);
export const alertApi = createClient(ALERT_URL);
export const assistantApi = createClient(ASSISTANT_URL);
