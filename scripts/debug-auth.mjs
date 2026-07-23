const BASE = "http://localhost:3000";

const csrfResp = await fetch(`${BASE}/api/auth/csrf`);
const csrfCookies = csrfResp.headers.getSetCookie();
const csrf = (await csrfResp.json()).csrfToken;
console.log("CSRF token:", csrf?.slice(0,20)+"...");
console.log("CSRF cookies:", csrfCookies.map(c=>c.split(";")[0]));

const loginResp = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST", redirect: "manual",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: csrfCookies.map(c => c.split(";")[0]).join("; "),
  },
  body: `csrfToken=${csrf}&email=admin%40vcc.com&password=Admin%401234&redirect=false&json=true`,
});
console.log("Login status:", loginResp.status, loginResp.headers.get("location"));
const loginCookies = loginResp.headers.getSetCookie();
console.log("Login cookies:", loginCookies.map(c=>c.split(";")[0]));

// Only send the csrf cookie that matches the token we posted (avoid MissingCSRF)
const csrfCookie = csrfCookies.find(c => c.includes(csrf));
const callbackCookie = csrfCookies.find(c => c.startsWith("authjs.callback-url"));
const preCookies = [csrfCookie, callbackCookie].filter(Boolean).map(c => c.split(";")[0]).join("; ");
console.log("Pre-login cookies (filtered):", preCookies);

const sess = await (await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: allCookies } })).json();
console.log("Session:", JSON.stringify(sess));

const api = await fetch(`${BASE}/api/clients`, { headers: { Cookie: allCookies }, redirect: "error" }).catch(e=>({status:"REDIRECT",error:e.message}));
console.log("API test:", typeof api === "object" && "status" in api ? api.status : api);
