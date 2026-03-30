const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

async function parseJsonResponse(response) {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function fetchBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const payload = await parseJsonResponse(response);
    return { ok: true, ...payload };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Backend unavailable',
      pipeline: { stages: [], samples: [] },
    };
  }
}

export async function runPlanPipeline(plan) {
  const response = await fetch(`${API_BASE_URL}/pipeline/run/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  return parseJsonResponse(response);
}

export async function runImagePipeline(file) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${API_BASE_URL}/pipeline/run/image`, {
    method: 'POST',
    body,
  });
  return parseJsonResponse(response);
}
