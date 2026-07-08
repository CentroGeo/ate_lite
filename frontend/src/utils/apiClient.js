const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function cleanBackendErrorText(text, status) {
  if (!text) {
    return `Error ${status} del backend.`;
  }

  const looksLikeHtml = text.trim().startsWith('<!DOCTYPE html')
    || text.trim().startsWith('<html')
    || text.includes('<title>')
    || text.includes('<body');

  if (looksLikeHtml) {
    return `Error ${status} del backend. Revisa la terminal de Django para ver el detalle.`;
  }

  if (text.length > 500) {
    return `${text.slice(0, 500)}...`;
  }

  return text;
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http')
    ? path
    : `${API_BASE_URL}${path}`;

  const timeoutMs = options.timeoutMs || 25000;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      let message = `Error ${response.status} del backend.`;

      if (contentType.includes('application/json')) {
        const errorData = await response.json();

        message = errorData?.errors?.[0]?.message
          || errorData?.message
          || errorData?.error
          || message;
      } else {
        const errorText = await response.text();
        message = cleanBackendErrorText(errorText, response.status);
      }

      throw new Error(message);
    }

    if (!contentType.includes('application/json')) {
      throw new Error('El backend no respondió JSON válido.');
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'La consulta tardó demasiado. Reduce la combinación de filtros o intenta de nuevo.'
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
