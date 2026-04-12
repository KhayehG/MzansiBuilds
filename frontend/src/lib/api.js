const normalizeBaseUrl = (value) => (value ? value.replace(/\/$/, '') : '');

const isLocalDevelopmentHost = (hostname) => {
  if (!hostname) return true;

  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || /^10(?:\.\d{1,3}){3}$/.test(hostname)
    || /^192\.168(?:\.\d{1,3}){2}$/.test(hostname)
    || /^172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(hostname)
  );
};

const getDefaultApiUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000';
  }

  const { protocol, hostname } = window.location;
  if (isLocalDevelopmentHost(hostname)) {
    const normalizedProtocol = protocol === 'https:' ? 'https:' : 'http:';
    return `${normalizedProtocol}//${hostname}:8000`;
  }

  return '';
};

const getDefaultWsUrl = () => {
  if (typeof window === 'undefined') {
    return 'ws://localhost:8000';
  }

  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
};

export const API_URL = normalizeBaseUrl(process.env.REACT_APP_BACKEND_URL) || getDefaultApiUrl();
export const WS_URL = normalizeBaseUrl(process.env.REACT_APP_WS_URL)
  || (API_URL ? API_URL.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://') : getDefaultWsUrl());
