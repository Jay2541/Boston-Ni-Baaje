// End-to-end: real Chrome at phone size, a director and a dancer using the
// built site (:5173) → local worker (:8787) → Firebase emulators.
// Run through run-all.mjs, which starts all of that first.
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { PUSH_LOG } from './worker-server.mjs';

const SITE = 'http://localhost:5173';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const PROJECT = 'boston-ni-baaje';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

export async function runE2E() {
  mkdirSync(SHOTS, { recursive: true });

  // Fresh emulator state + the board join code a director would add in the console.
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`${FS}/joinCodes/board`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: { code: { stringValue: 'board-SECRET99' } } }),
  });
  const fsDoc = async (path) => (await fetch(`${FS}/${path}`, { headers: { Authorization: 'Bearer owner' } })).json();

  // Each "phone" is its own Chrome process, like separate devices.
  const browsers = [];
  let passed = 0, failed = 0;
  const errors = [];
  const step = async (name, fn) => {
    try { await fn(); passed++; console.log('  ✓', name); }
    catch (e) { failed++; console.log('  ✗', name, '—', String(e.message).split('\n')[0]); }
  };
  const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

  async function phone(label, ua = IPHONE_UA) {
    const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
    browsers.push(b);
    const page = await b.newPage();
    await page.setUserAgent(ua);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
    page.on('dialog', (d) => d.accept()); // confirm() in Manage
    page.setDefaultTimeout(25000); // Firebase restores the login from IndexedDB on each load
    return page;
  }
  const shot = (page, name) => page.screenshot({ path: `${SHOTS}${name}.png` });
  const texts = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));
  const waitText = (page, sel, text) =>
    page.waitForFunction((s, t) => [...document.querySelectorAll(s)].some((e) => e.textContent.includes(t)), {}, sel, text);
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  // Hash-only URL changes don't reload the page, so hop through a blank page.
  async function go(page, url) {
    await page.goto('about:blank');
    await page.goto(url, { waitUntil: 'load' });
  }
  async function signUp(page, code, name, number, pin) {
    await go(page, `${SITE}/app.html#join=${code}`);
    await page.type('#join-form [name=name]', name);
    await page.type('#join-form [name=phone]', number);
    await page.type('#join-form [name=pin]', pin);
    await page.type('#join-form [name=pin2]', pin);
    await page.click('#join-form button[type=submit]');
    await page.waitForSelector('#join-done:not([hidden]), #join-error:not([hidden])');
  }
  async function openChat(page, chatId) {
    await go(page, `${SITE}/chat.html#chat=${chatId}`);
    await page.waitForSelector('#chat-log');
    await page.waitForFunction(() => !document.querySelector('#chat-log')?.textContent.includes('Loading messages'));
  }
  async function send(page, text, title) {
    if (title) await page.type('#chat-title', title);
    await page.type('#chat-input', text);
    await page.click('#chat-form button[type=submit]');
    await pause(1500); // let the write commit before "putting the phone down"
  }

  const director = await phone('director');
  const dancer = await phone('dancer');
  let uconnCode = '';

  console.log('Join flow');
  await step('join page names the group from the link', async () => {
    await go(director, `${SITE}/app.html#join=board-SECRET99`);
    const h = await director.$eval('#app-title', (e) => e.textContent);
    expect(h.includes('BNB board'), `title was "${h}"`);
    expect(await director.$eval('#install-android', (e) => e.hidden), 'Android steps should be hidden on iPhone');
    await shot(director, '01-join-board');
  });
  await step('mismatched PINs are caught before sending', async () => {
    await director.type('#join-form [name=name]', 'Dee Rector');
    await director.type('#join-form [name=phone]', '(617) 555-0001');
    await director.type('#join-form [name=pin]', '1234');
    await director.type('#join-form [name=pin2]', '9999');
    await director.click('#join-form button[type=submit]');
    await waitText(director, '#join-error', 'don’t match');
  });
  await step('director signs up with the board link', async () => {
    await signUp(director, 'board-SECRET99', 'Dee Rector', '(617) 555-0001', '1234');
    const done = await director.$eval('#join-done', (e) => e.textContent);
    expect(done.includes('(617) 555-0001'), `done text: ${done}`);
    const open = await director.$eval('#open-text', (e) => e.textContent);
    expect(open.includes('(617) 555-0001'), 'step 3 should show their number');
    await shot(director, '02-join-done');
    const m = await fsDoc('members/+16175550001');
    expect(m.fields.role.stringValue === 'director', `role was ${m.fields?.role?.stringValue}`);
  });
  await step('bad join code shows a friendly error', async () => {
    const p = await phone('stranger');
    await signUp(p, 'uconn-FAKE00', 'Nope', '6175550099', '1111');
    await waitText(p, '#join-error', 'invalid or expired');
    await p.browser().close();
  });

  console.log('Director app');
  await step('director sees Announcements, Board and all 8 team chats', async () => {
    await go(director, `${SITE}/chat.html`);
    await director.waitForSelector('.chat-row');
    const rows = await texts(director, '.chat-row strong');
    expect(rows.length === 10, `got ${rows.length}: ${rows.join(', ')}`);
    expect(rows[0] === 'Announcements' && rows.includes('Board') && rows.includes('UConn ThundeRaas'), rows.join(', '));
    const tabs = await texts(director, '.app-tab');
    expect(tabs.some((t) => t.includes('Manage')), 'Manage tab missing');
    await shot(director, '03-director-chats');
  });
  await step('director creates the UConn join link in Manage', async () => {
    await go(director, `${SITE}/chat.html#manage`);
    await director.waitForSelector('.join-link[data-target=uconn] [data-act=rotate]');
    await (await director.$('.join-link[data-target=uconn] [data-act=rotate]')).click();
    await waitText(director, '.join-link[data-target=uconn] .join-link-url', '#join=uconn-');
    const url = await director.$eval('.join-link[data-target=uconn] .join-link-url', (e) => e.textContent);
    expect(/#join=uconn-[A-Z2-9]{6}$/.test(url), url);
    uconnCode = url.split('#join=')[1];
    const board = await director.$eval('.join-link[data-target=board] .join-link-url', (e) => e.textContent);
    expect(board.endsWith('#join=board-SECRET99'), board);
  });
  await step('QR code renders for a join link', async () => {
    await (await director.$('.join-link[data-target=uconn] [data-act=qr]')).click();
    await director.waitForSelector('.join-link[data-target=uconn] .join-link-qr:not([hidden]) svg');
    await shot(director, '04-manage-links');
  });

  console.log('Dancer');
  await step('dancer signs up from the UConn link', async () => {
    await signUp(dancer, uconnCode, 'Dana Sir', '617-555-0003', '4321');
    const h = await dancer.$eval('#app-title', (e) => e.textContent);
    expect(h.includes('UConn ThundeRaas'), h);
    expect(!(await dancer.$eval('#join-done', (e) => e.hidden)), 'not done');
    await shot(dancer, '05-dancer-join-done');
  });
  await step('same number cannot sign up twice', async () => {
    const p = await phone('dup');
    await signUp(p, uconnCode, 'Imposter', '6175550003', '0000');
    await waitText(p, '#join-done', 'already has an account');
    await p.browser().close();
  });
  await step('dancer sees only Announcements + their team, no Manage tab', async () => {
    await go(dancer, `${SITE}/chat.html`);
    await dancer.waitForSelector('.chat-row');
    const rows = await texts(dancer, '.chat-row strong');
    expect(rows.join('|') === 'Announcements|UConn ThundeRaas', rows.join(', '));
    const tabs = await texts(dancer, '.app-tab');
    expect(!tabs.some((t) => t.includes('Manage')), 'dancer should not see Manage');
  });
  await step('dancer cannot open a chat they are not in via URL', async () => {
    await go(dancer, `${SITE}/chat.html#chat=team-gatech`);
    await dancer.waitForSelector('.chat-list');
  });

  console.log('Messaging');
  await step('dancer messages the team chat', async () => {
    await openChat(dancer, 'team-uconn');
    await send(dancer, 'Hi! What time is tech rehearsal?');
    await waitText(dancer, '.bubble-row.mine', 'tech rehearsal');
  });
  await step('director sees it live and replies', async () => {
    await openChat(director, 'team-uconn');
    await waitText(director, '.bubble-row.theirs', 'tech rehearsal');
    const who = await director.$eval('.bubble-row.theirs .bubble-who', (e) => e.textContent);
    expect(who === 'Dana Sir', `sender shown as "${who}"`);
    await send(director, 'Tech is at 2pm in the ballroom.');
    await waitText(director, '.bubble-row.mine', '2pm');
  });
  await step('dancer receives the reply without refreshing', async () => {
    await waitText(dancer, '.bubble-row.theirs', '2pm');
    await shot(dancer, '06-dancer-team-chat');
  });
  await step('chat list shows the latest message preview', async () => {
    await go(dancer, `${SITE}/chat.html`);
    await waitText(dancer, '.chat-row-preview', 'ballroom');
    await shot(dancer, '07-dancer-chat-list');
  });

  console.log('Announcements');
  await step('director posts an announcement', async () => {
    await openChat(director, 'announcements');
    await send(director, 'Doors open at noon. Check in at the hotel lobby.', 'Day 1');
    await waitText(director, '.announce-card', 'Doors open');
  });
  await step('dancer sees it and has no composer there', async () => {
    await openChat(dancer, 'announcements');
    await waitText(dancer, '.announce-card h3', 'Day 1');
    expect(!(await dancer.$('#chat-form')), 'dancer should not have a composer');
    await dancer.waitForSelector('.app-readonly');
    await shot(dancer, '08-dancer-announcements');
  });
  await step('announcement also shows on the public Updates page', async () => {
    const p = await phone('visitor');
    await go(p, `${SITE}/updates.html`);
    await waitText(p, '.update-card', 'Doors open');
    await p.browser().close();
  });
  await step('worker pushed each message to the right topic', async () => {
    const sends = readFileSync(PUSH_LOG, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter((l) => l.kind === 'send');
    const topics = sends.map((s) => s.topic);
    expect(topics.filter((t) => t === 'chat-team-uconn').length === 2, `topics: ${topics}`);
    const ann = sends.find((s) => s.topic === 'all');
    expect(ann?.notification.title === 'Day 1', `topics: ${topics}`);
    const dm = sends.find((s) => s.topic === 'chat-team-uconn');
    expect(dm.notification.title.startsWith('Dana Sir'), dm.notification.title);
    expect(dm.data.link.endsWith('/chat.html#chat=team-uconn'), dm.data.link);
  });

  console.log('Login (the home-screen app on iPhone)');
  const fresh = await phone('fresh');
  await step('wrong PIN shows tries left', async () => {
    await go(fresh, `${SITE}/chat.html`);
    await fresh.waitForSelector('#login-form');
    await fresh.type('#login-form [name=phone]', '(617) 555-0003');
    await fresh.type('#login-form [name=pin]', '0000');
    await fresh.click('#login-form button');
    await waitText(fresh, '#login-error', 'tries left');
    await shot(fresh, '09-login-wrong-pin');
  });
  await step('right PIN signs in to the chats', async () => {
    await fresh.$eval('#login-form [name=pin]', (e) => { e.value = ''; });
    await fresh.type('#login-form [name=pin]', '4321');
    await fresh.click('#login-form button');
    await fresh.waitForSelector('.chat-row');
  });
  await step('stays signed in after reopening', async () => {
    await go(fresh, `${SITE}/chat.html`);
    await fresh.waitForSelector('.chat-row');
  });

  console.log('Director tools');
  await step('director makes the dancer a liaison', async () => {
    await go(director, `${SITE}/chat.html#manage`);
    await director.waitForSelector('[data-uid="+16175550003"]');
    await director.select('[data-uid="+16175550003"] [name=role]', 'liaison');
    for (let i = 0; i < 20; i++) {
      if ((await fsDoc('members/+16175550003')).fields.role.stringValue === 'liaison') return;
      await pause(250);
    }
    throw new Error('role not updated');
  });
  await step('director resets the PIN; the old PIN stops working', async () => {
    await (await director.$('[data-uid="+16175550003"] [data-act=reset]')).click();
    await waitText(director, '[data-uid="+16175550003"] [data-act=reset]', 'PIN reset');
    const p = await phone('reset');
    await go(p, `${SITE}/chat.html`);
    await p.waitForSelector('#login-form');
    await p.type('#login-form [name=phone]', '6175550003');
    await p.type('#login-form [name=pin]', '4321');
    await p.click('#login-form button');
    await waitText(p, '#login-error', 'join link');
    // Re-claim with their team link and a new PIN; role is kept.
    await signUp(p, uconnCode, 'Dana Sir', '6175550003', '5555');
    await waitText(p, '#join-done', 'You’re in');
    expect((await fsDoc('members/+16175550003')).fields.role.stringValue === 'liaison', 'role should be kept');
    await p.browser().close();
  });
  await step('removing someone signs them out of the open app', async () => {
    await go(dancer, `${SITE}/chat.html`);
    await dancer.waitForSelector('.chat-row');
    await go(director, `${SITE}/chat.html#manage`);
    await director.waitForSelector('[data-uid="+16175550003"] [data-act=remove]');
    await shot(director, '10-manage-members');
    await (await director.$('[data-uid="+16175550003"] [data-act=remove]')).click();
    await waitText(dancer, '#login-error', 'removed');
    await shot(dancer, '11-dancer-removed');
  });

  console.log('Other');
  await step('Instagram in-app browser gets the "Open in Safari" banner', async () => {
    const p = await phone('insta', IPHONE_UA + ' Instagram 300.0.0');
    await go(p, `${SITE}/app.html#join=board-SECRET99`);
    await p.waitForSelector('#inapp-banner:not([hidden])');
    await shot(p, '12-instagram-banner');
    await p.browser().close();
  });
  await step('Android shows only Android steps', async () => {
    const p = await phone('android', ANDROID_UA);
    await go(p, `${SITE}/app.html`);
    expect(await p.$eval('#install-ios', (e) => e.hidden), 'iOS steps should be hidden');
    expect(await p.$eval('#step-account', (e) => e.hidden), 'no join code → no account step');
    expect(await p.$eval('#step-install .join-num', (e) => e.textContent) === '1', 'steps renumbered');
    await shot(p, '13-android-no-code');
    await p.browser().close();
  });
  await step('Teams page links to the app instead of the old login', async () => {
    const p = await phone('teams');
    await go(p, `${SITE}/teams.html`);
    expect((await p.$$('.team-card')).length === 8, 'roster');
    expect(!!(await p.$('a[href="/app.html"].btn')), 'Get the App button');
    expect(!(await p.$('#portal-login-form')), 'old login still present');
    await p.browser().close();
  });

  await Promise.all(browsers.map((b) => b.close().catch(() => {})));
  console.log(`\nEnd-to-end: ${passed} passed, ${failed} failed (screenshots in tests/shots/)`);
  if (errors.length) console.log('Page errors:\n  ' + [...new Set(errors)].join('\n  '));
  return failed === 0 && errors.length === 0;
}
