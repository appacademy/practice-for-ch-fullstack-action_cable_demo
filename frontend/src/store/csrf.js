export const storeCSRFToken = response => {
  const csrfToken = response.headers.get("X-CSRF-Token");
  if (csrfToken) localStorage.setItem("X-CSRF-Token", csrfToken);
}

const csrfAPIFetch = async (url, { data, headers = {}, ...options } = {}) => {
  headers = {
    ...headers,
    'X-CSRF-Token': localStorage.getItem("X-CSRF-Token"),
    'Content-Type': 'application/json'
  };

  let response = await fetch(`/api/${url}`, {
    ...options,
    body: JSON.stringify(data),
    headers
  });

  const success = response.ok;

  storeCSRFToken(response);
  if (response.headers.get('content-type').includes('application/json')) {
    response = await response.json();
  }

  return success ? response : Promise.reject(response);
};

export default csrfAPIFetch;
