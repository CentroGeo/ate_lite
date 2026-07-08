const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiFetch = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const finalUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  let response = await fetch(finalUrl, { ...options, headers });
  
  let data;
  try {
    data = await response.json();
  } catch(e) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }

  if (!response.ok) {
    const errorMsg = data?.message || `Error ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return data;
};
