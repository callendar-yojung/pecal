const baseUrl = process.env.TEST_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://pecal.site';
const accessToken = process.env.TEST_ACCESS_TOKEN;
const refreshToken = process.env.TEST_REFRESH_TOKEN;

if (!accessToken || !refreshToken) {
  console.error('[refresh-test] Missing TEST_ACCESS_TOKEN or TEST_REFRESH_TOKEN');
  process.exit(1);
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Client-Platform': 'test',
    'X-Client-Name': 'refresh-smoke-script',
    'X-App-Version': 'test',
  };
}

async function parseJsonSafe(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function callMe(token) {
  const response = await fetch(`${baseUrl}/api/auth/external/me`, {
    headers: authHeaders(token),
  });
  return {
    status: response.status,
    data: await parseJsonSafe(response),
  };
}

async function callRefresh(token) {
  const response = await fetch(`${baseUrl}/api/auth/external/refresh`, {
    method: 'POST',
    headers: authHeaders(''),
    body: JSON.stringify({ refresh_token: token }),
  });
  return {
    status: response.status,
    data: await parseJsonSafe(response),
  };
}

async function callLogout(token, currentRefreshToken) {
  const response = await fetch(`${baseUrl}/api/auth/external/logout`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ refresh_token: currentRefreshToken }),
  });
  return {
    status: response.status,
    data: await parseJsonSafe(response),
  };
}

async function main() {
  console.log(`[refresh-test] baseUrl=${baseUrl}`);

  const beforeMe = await callMe(accessToken);
  console.log('[refresh-test] me(before)', beforeMe);
  if (beforeMe.status !== 200) {
    throw new Error(`Expected /me before refresh to be 200, got ${beforeMe.status}`);
  }

  const refreshed = await callRefresh(refreshToken);
  console.log('[refresh-test] refresh(current)', refreshed);
  if (refreshed.status !== 200) {
    throw new Error(`Expected refresh with current token to be 200, got ${refreshed.status}`);
  }

  const nextAccessToken = refreshed.data?.accessToken;
  const nextRefreshToken = refreshed.data?.refreshToken;
  if (!nextAccessToken || !nextRefreshToken) {
    throw new Error('Refresh response did not include accessToken and refreshToken');
  }

  const afterMe = await callMe(nextAccessToken);
  console.log('[refresh-test] me(after)', afterMe);
  if (afterMe.status !== 200) {
    throw new Error(`Expected /me after refresh to be 200, got ${afterMe.status}`);
  }

  const oldRefreshAgain = await callRefresh(refreshToken);
  console.log('[refresh-test] refresh(old token again)', oldRefreshAgain);
  if (oldRefreshAgain.status === 200) {
    throw new Error('Old refresh token still works after rotation');
  }

  const logout = await callLogout(nextAccessToken, nextRefreshToken);
  console.log('[refresh-test] logout', logout);
  if (logout.status !== 200) {
    throw new Error(`Expected logout to be 200, got ${logout.status}`);
  }

  const refreshAfterLogout = await callRefresh(nextRefreshToken);
  console.log('[refresh-test] refresh(after logout)', refreshAfterLogout);
  if (refreshAfterLogout.status === 200) {
    throw new Error('Refresh token still works after logout');
  }

  console.log('[refresh-test] PASS');
}

main().catch((error) => {
  console.error('[refresh-test] FAIL', error);
  process.exit(1);
});
