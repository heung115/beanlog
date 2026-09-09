// config is injected by the runner on stdin; never print credentials or bodies.
import crypto from 'node:crypto';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(value, label) { if (!value) { console.error('FIXTURE_CHECK_FAILED: ' + label); throw new Error('Fixture assertion failed'); } }
async function call(base, path, method = 'GET', body, headers = {}) {
  const response = await fetch(base + path, {method, headers: {'Content-Type':'application/json', ...headers},
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), signal: AbortSignal.timeout(1500), redirect:'error'});
  const text = await response.text();
  let data; try {data = JSON.parse(text);} catch {data = {};}
  return {status: response.status, data, text, headers:[...response.headers.entries()].filter(([key]) => key !== 'date')};
}
const auth = 'http://auth:9999', mail = 'http://mail:8025';
for (let attempt = 0; ; attempt++) {
  try {if ((await call(auth, '/health')).status === 200 && (await call(mail, '/api/v1/messages')).status === 200 && (await call('http://caddy:8080', '/auth/v1/health')).status === 200) break;} catch {}
  check(attempt < 20, 'Auth/Mailpit readiness timeout');
  await sleep(500);
}
const b64 = object => Buffer.from(JSON.stringify(object)).toString('base64url');
const unsigned = b64({alg:'HS256',typ:'JWT'}) + '.' + b64({role:'service_role',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300});
const admin = unsigned + '.' + crypto.createHmac('sha256',config.jwtSecret).update(unsigned).digest('base64url');
const email = `deletion-${config.runID}@local.test`;
const created = await call(auth, '/admin/users', 'POST', {email,password:config.password,email_confirm:true}, {Authorization:`Bearer ${admin}`});
check([200,201].includes(created.status) && created.data.id, 'Synthetic account creation failed');
const userID = created.data.id;
const rate = 'deletion:' + crypto.createHmac('sha256',config.rateSecret).update('account-delete\0' + userID).digest('hex');
const headers = {'X-Beanmap-Auth-Rate-Identity':rate};
const original = await call(auth, '/token?grant_type=password', 'POST', {email,password:config.password}, headers);
check(original.status === 200 && original.data.access_token, 'Original account session failed');
const user = await call(auth, '/user', 'GET', undefined, {...headers,Authorization:`Bearer ${original.data.access_token}`});
check(user.status === 200 && user.data.id === userID && user.data.email === email && user.data.email_confirmed_at, 'Original verified account mismatch');
const before = await call(mail, '/api/v1/messages');
check(before.data.total === 0, 'Unexpected email before OTP request');
const absentEmail = `absent-${config.runID}@local.test`;
const absent = await call(auth, '/admin/users?page=1&per_page=10', 'GET', undefined, {Authorization:`Bearer ${admin}`});
check(absent.status === 200 && absent.data.users?.length === 1 && absent.data.users[0].id === userID, 'Fixture account population mismatch');
const unconfirmedEmail = `unconfirmed-${config.runID}@local.test`;
const unconfirmed = await call(auth, '/admin/users', 'POST', {email:unconfirmedEmail,password:config.password,email_confirm:false}, {Authorization:`Bearer ${admin}`});
check([200,201].includes(unconfirmed.status) && unconfirmed.data.id && !unconfirmed.data.email_confirmed_at, 'Synthetic unconfirmed account creation failed');
const publicExisting = await call('http://caddy:8080', '/auth/v1/otp', 'POST', {email,create_user:false});
const publicAbsent = await call('http://caddy:8080', '/auth/v1/otp', 'POST', {email:absentEmail,create_user:false});
check(publicExisting.status === 404 && publicAbsent.status === 404 && publicExisting.text === '' && publicExisting.text === publicAbsent.text && JSON.stringify(publicExisting.headers) === JSON.stringify(publicAbsent.headers), 'Public OTP responses distinguish actual existing/absent accounts');
const publicMagicExisting = await call('http://caddy:8080', '/auth/v1/magiclink', 'POST', {email,create_user:false});
const publicMagicAbsent = await call('http://caddy:8080', '/auth/v1/magiclink', 'POST', {email:absentEmail,create_user:false});
check(publicMagicExisting.status === 404 && publicMagicAbsent.status === 404 && publicMagicExisting.text === '' && publicMagicExisting.text === publicMagicAbsent.text && JSON.stringify(publicMagicExisting.headers) === JSON.stringify(publicMagicAbsent.headers), 'Public magiclink responses distinguish actual existing/absent accounts');
const publicRecovery = [];
for (const target of [email, email, absentEmail, absentEmail]) {
  publicRecovery.push(await call('http://caddy:8080', '/auth/v1/recover', 'POST', {email:target}));
}
check(publicRecovery.every(result => result.status === 404 && result.text === '' && JSON.stringify(result.headers) === JSON.stringify(publicRecovery[0].headers)), 'Public repeated recovery distinguishes actual existing/absent accounts');
const publicResend = [];
for (const target of [unconfirmedEmail, unconfirmedEmail, absentEmail, absentEmail]) {
  publicResend.push(await call('http://caddy:8080', '/auth/v1/resend', 'POST', {type:'signup',email:target}));
}
check(publicResend.every(result => result.status === 404 && result.text === '' && JSON.stringify(result.headers) === JSON.stringify(publicResend[0].headers)), 'Public repeated resend distinguishes actual unconfirmed/absent accounts');
const publicPassword = [];
for (const target of [email, email, absentEmail, absentEmail]) {
  publicPassword.push(await call('http://caddy:8080', '/auth/v1/token?grant_type=password', 'POST', {email:target,password:'wrong-' + config.password}));
}
check(publicPassword.every(result => result.status === 404 && result.text === '' && JSON.stringify(result.headers) === JSON.stringify(publicPassword[0].headers)), 'Public password grant distinguishes actual existing/absent accounts');
// Use a real form body: Auth FormValue could prefer this grant over the query.
const formOverride = await call('http://caddy:8080', '/auth/v1/token?grant_type=refresh_token', 'POST',
  new URLSearchParams({grant_type:'password',email,password:config.password}).toString(), {'Content-Type':'application/x-www-form-urlencoded'});
check(formOverride.status === 404 && formOverride.text === '', 'Public form body overrides canonical refresh grant');
check(original.data.refresh_token, 'Original refresh token missing');
const publicRefresh = await call('http://caddy:8080', '/auth/v1/token?grant_type=refresh_token', 'POST', {refresh_token:original.data.refresh_token});
check(publicRefresh.status === 200 && publicRefresh.data.access_token && publicRefresh.data.refresh_token && publicRefresh.data.user?.id === userID, 'Canonical public JSON refresh failed');
const refreshedUser = await call('http://caddy:8080', '/auth/v1/user', 'GET', undefined, {Authorization:`Bearer ${publicRefresh.data.access_token}`});
check(refreshedUser.status === 200 && refreshedUser.data.id === userID && refreshedUser.data.email === email, 'Public refreshed session subject mismatch');
await sleep(500);
check((await call(mail, '/api/v1/messages')).data.total === 0, 'Public boundary or refresh requests delivered unexpected email');
const otp = await call(auth, '/otp', 'POST', {email:user.data.email,create_user:false}, headers);
check(otp.status === 200, 'Internal OTP request failed');
let message;
for (let attempt=0;attempt<30;attempt++) {
  const inbox = await call(mail, '/api/v1/messages');
  if (inbox.data.total === 1) {message = inbox.data.messages?.[0];break;}
  check(!inbox.data.total || inbox.data.total === 1, 'Unexpected mail count');
  await sleep(250);
}
check(message?.ID, 'OTP mail not delivered');
const delivered = await call(mail, '/api/v1/message/' + encodeURIComponent(message.ID));
check(delivered.status === 200 && delivered.data.To?.length === 1 && delivered.data.To[0].Address === email, 'Synthetic recipient mismatch');
const code = (delivered.data.Text || delivered.data.HTML || '').match(/\b[0-9]{6}\b/)?.[0];
check(code, 'OTP missing from isolated template');
const fresh = await call(auth, '/verify', 'POST', {email:user.data.email,token:code,type:'email'}, headers);
check(fresh.status === 200 && fresh.data.access_token && fresh.data.access_token !== original.data.access_token, 'Fresh OTP session failed');
const verified = await call(auth, '/user', 'GET', undefined, {...headers,Authorization:`Bearer ${fresh.data.access_token}`});
check(verified.status === 200 && verified.data.id === userID && verified.data.email === email && verified.data.email_confirmed_at, 'Fresh verified account mismatch');
const logout = await call(auth, '/logout?scope=local', 'POST', undefined, {...headers,Authorization:`Bearer ${fresh.data.access_token}`});
check([200,204].includes(logout.status), 'Temporary session logout failed');
const retained = await call(auth, '/user', 'GET', undefined, {...headers,Authorization:`Bearer ${original.data.access_token}`});
check(retained.status === 200 && retained.data.id === userID, 'Original session was revoked');
await sleep(1100);
const recovery = await call(auth, '/recover', 'POST', {email}, headers);
check(recovery.status === 200, 'Internal password recovery request failed');
let recoveryMessage;
for (let attempt=0;attempt<30;attempt++) {
  const inbox = await call(mail, '/api/v1/messages');
  check(inbox.data.total <= 2, 'Unexpected recovery mail count');
  if (inbox.data.total === 2) {recoveryMessage = inbox.data.messages?.find(item => item.ID !== message.ID);break;}
  await sleep(250);
}
check(recoveryMessage?.ID, 'Recovery mail not delivered');
const recoveryDelivered = await call(mail, '/api/v1/message/' + encodeURIComponent(recoveryMessage.ID));
check(recoveryDelivered.status === 200 && recoveryDelivered.data.To?.length === 1 && recoveryDelivered.data.To[0].Address === email, 'Synthetic recovery recipient mismatch');
const recoveryCode = (recoveryDelivered.data.Text || recoveryDelivered.data.HTML || '').match(/\b[0-9]{6}\b/)?.[0];
check(recoveryCode, 'Recovery code missing from isolated template');
const recoverySession = await call(auth, '/verify', 'POST', {email,token:recoveryCode,type:'recovery'}, headers);
check(recoverySession.status === 200 && recoverySession.data.access_token && recoverySession.data.access_token !== original.data.access_token && recoverySession.data.user?.id === userID, 'Recovery code verification failed');
const recoveryLogout = await call(auth, '/logout?scope=local', 'POST', undefined, {...headers,Authorization:`Bearer ${recoverySession.data.access_token}`});
check([200,204].includes(recoveryLogout.status), 'Recovery session logout failed');
const retainedAfterRecovery = await call(auth, '/user', 'GET', undefined, {...headers,Authorization:`Bearer ${original.data.access_token}`});
check(retainedAfterRecovery.status === 200 && retainedAfterRecovery.data.id === userID, 'Recovery logout revoked original session');
await sleep(1100);
const legacyAbsentEmail = `legacy-${config.runID}@local.test`;
const resendAbsentEmail = `resend-${config.runID}@local.test`;
const legacyExisting = await call(auth, '/magiclink', 'POST', {email,create_user:false}, headers);
const legacyAbsent = await call(auth, '/magiclink', 'POST', {email:legacyAbsentEmail,create_user:false}, headers);
await sleep(1100);
const afterLegacy = await call(auth, '/admin/users?page=1&per_page=10', 'GET', undefined, {Authorization:`Bearer ${admin}`});
const legacyInbox = await call(mail, '/api/v1/messages');
const legacyCreatedAccount = afterLegacy.data.users?.some(user => user.email === legacyAbsentEmail) === true;
const legacyDeliveredToAbsent = legacyInbox.data.messages?.some(item => item.To?.some(to => to.Address === legacyAbsentEmail)) === true;
const resendExisting = await call(auth, '/resend', 'POST', {type:'signup',email}, headers);
const resendAbsent = await call(auth, '/resend', 'POST', {type:'signup',email:resendAbsentEmail}, headers);
await sleep(500);
const afterResend = await call(auth, '/admin/users?page=1&per_page=10', 'GET', undefined, {Authorization:`Bearer ${admin}`});
const resendInbox = await call(mail, '/api/v1/messages');
const resendCreatedAccount = afterResend.data.users?.some(user => user.email === resendAbsentEmail) === true;
const resendDeliveredToAbsent = resendInbox.data.messages?.some(item => item.To?.some(to => to.Address === resendAbsentEmail)) === true;
function safeStatus(status) {
  switch (status) {
    case 200:return 200; case 201:return 201; case 204:return 204; case 400:return 400;
    case 401:return 401; case 403:return 403; case 404:return 404; case 422:return 422;
    case 429:return 429; default:return 'unexpected';
  }
}
// Public grant fields below are literal assertion receipts: the existing/absent
// status, body and header checks above must all pass before anything is reported.
console.log(JSON.stringify({internalOtpStatus:200,mailDeliveredToSyntheticRecipient:true,
  verifyStatus:200,freshSessionMatchesOriginalSubject:true,temporarySessionLoggedOut:true,
  originalSessionRetained:true,mailCountAfterOtp:1,
  publicGateway:{existingStatus:404,absentStatus:404,emptyBodiesEqual:true,stableHeadersEqual:true,mailCountAfterDeniedRequests:0,magiclinkExistingStatus:404,magiclinkAbsentStatus:404,magiclinkEmptyBodiesEqual:true,magiclinkStableHeadersEqual:true,recoveryExistingStatuses:[404,404],recoveryAbsentStatuses:[404,404],recoveryEmptyBodiesEqual:true,recoveryStableHeadersEqual:true,resendUnconfirmedStatuses:[404,404],resendAbsentStatuses:[404,404],resendEmptyBodiesEqual:true,resendStableHeadersEqual:true,grantExistingStatuses:[404,404],grantAbsentStatuses:[404,404],grantEmptyBodiesEqual:true,grantStableHeadersEqual:true,formGrantOverrideStatus:404,canonicalJsonRefreshStatus:200,refreshedSubjectMatches:true},
  directInternalRecovery:{status:200,mailDeliveredToSyntheticRecipient:true,codeVerified:true,temporarySessionLoggedOut:true,originalSessionRetained:true},
  directInternalLegacyMagiclink:{existingStatus:safeStatus(legacyExisting.status),absentStatus:safeStatus(legacyAbsent.status),createdAbsentAccount:legacyCreatedAccount,deliveredToAbsent:legacyDeliveredToAbsent},
  directInternalResend:{existingAccountEmailConfirmed:true,existingStatus:safeStatus(resendExisting.status),absentStatus:safeStatus(resendAbsent.status),createdAbsentAccount:resendCreatedAccount,deliveredToAbsent:resendDeliveredToAbsent},
  scope:'real Auth OTP contract used by Go deletion handler; Go store/attempt behavior covered by handler tests'}));
