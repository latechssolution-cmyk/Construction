
const BASE = process.env.NEXTAUTH_URL || process.env.BASE_URL || "https://construction00.netlify.app";
let cookies = "";

async function login() {
  const csrfResp = await fetch(`${BASE}/api/auth/csrf`);
  const csrfCookies = csrfResp.headers.getSetCookie?.() ?? [];
  const csrfToken = (await csrfResp.json()).csrfToken;

  const csrfCookie = csrfCookies.find(c => c.includes(csrfToken));
  const callbackCookie = csrfCookies.find(c => c.startsWith("authjs.callback-url"));
  const preCookies = [csrfCookie, callbackCookie].filter(Boolean)
    .map(c => c.split(";")[0]).join("; ");

  const r = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: preCookies },
    body: `csrfToken=${csrfToken}&email=admin%40constructionlatech.com&password=Admin%401234&redirect=false&json=true`,
  });
  const setCookie = r.headers.getSetCookie?.() ?? [];
  cookies = setCookie.map(c => c.split(";")[0]).join("; ");
  const sess = await (await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookies } })).json();
  return sess?.user;
}

async function testAi() {
  console.log("Logging in...");
  const user = await login();
  console.log("Logged in as:", user?.email);

  const fd = new globalThis.FormData();
  fd.append("message", "Hello, can you help me estimate brickwork?");
  fd.append("history", "[]");

  console.log("Sending AI request...");
  const r = await fetch(`${BASE}/api/ai-chat`, {
    method: "POST",
    headers: {
      cookie: cookies,
    },
    body: fd,
  });

  console.log("Status:", r.status);
  const text = await r.text();
  console.log("Response:", text);
}

testAi().catch(console.error);
