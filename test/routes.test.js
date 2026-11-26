'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { classify, isServiceUrl, isFacebookUrl, isCallUrl, downloadTarget, homeUrlFor } = require('../src/routes');

// ---- Facebook Messenger

const cases = {
  allowed: [
    'https://www.facebook.com/messages/',
    'https://www.facebook.com/messages/t/123456',
    'https://www.facebook.com/messages/e2ee/t/789',
    'https://www.facebook.com/t/123',
    'https://www.facebook.com/login/?next=x',
    'https://www.facebook.com/login.php?next=https%3A%2F%2Fwww.facebook.com%2Fmessages%2F',
    'https://www.facebook.com/login/device-based/regular/login/',
    'https://www.facebook.com/checkpoint/1501092823525282/',
    'https://www.facebook.com/messenger_media/?attachment_id=1&message_id=mid.x&thread_id=2',
    'https://www.facebook.com/photo/?fbid=123&set=a.1',
    'https://www.facebook.com/photo.php?fbid=123',
    'https://www.messenger.com/',
    'https://accountscenter.facebook.com/',
    'https://accountscenter.facebook.com/password_and_security/two_factor',
    'about:blank',
  ],
  feed: [
    'https://www.facebook.com/',
    'https://www.facebook.com/?sk=h_chr',
    'https://www.facebook.com/home.php',
    'https://www.facebook.com/watch/?v=1',
    'https://www.facebook.com/reel/123',
    'https://www.facebook.com/marketplace/',
  ],
  external: [
    'https://www.facebook.com/some.user',
    'https://www.facebook.com/messagesfoo',
    'https://www.facebook.com/tags',
    'https://www.facebook.com/r.php',
    'https://l.facebook.com/l.php?u=https://example.com',
    'https://example.com/',
    'https://chat.zalo.me/',
    'https://web.telegram.org/a/',
    'http://www.facebook.com/messages/',
    'not a url',
    // Content that could impersonate a login page in a window without an address bar.
    'data:text/html,<form>password</form>',
    'blob:https://www.facebook.com/0b1c',
    'file:///etc/passwd',
    'about:srcdoc',
    'https://www.facebook.com.evil.example/messages/',
    'https://accountscenter.facebook.com.evil.example/',
    'https://evilfacebook.com/messages/',
  ],
};

const facebookOrigins = {
  true: [
    'https://www.facebook.com', 'https://www.facebook.com/messages/t/1',
    'https://facebook.com', 'https://accountscenter.facebook.com/x',
    'https://www.messenger.com/', 'https://messenger.com',
  ],
  false: [
    'http://www.facebook.com', 'https://facebook.com.evil.example', 'https://evilfacebook.com',
    'https://fbcdn.net.evil.example', 'https://example.com', 'https://chat.zalo.me',
    'https://web.telegram.org/a/', 'data:text/html,x', 'about:blank', '', undefined, 'not a url',
  ],
};

for (const [want, urls] of Object.entries(facebookOrigins)) {
  for (const url of urls) {
    test(`isFacebookUrl(${JSON.stringify(url)}) === ${want}`, () => assert.strictEqual(isFacebookUrl(url), want === 'true'));
  }
}

for (const [want, urls] of Object.entries(cases)) {
  for (const url of urls) {
    test(`messenger ${want}: ${url}`, () => assert.strictEqual(classify(url, 'messenger'), want));
  }
}

const downloads = [
  ['https://cdn.fbsbx.com/v/t59.2708-21/file.pdf?_nc_cat=1&oh=x', 'https://cdn.fbsbx.com/v/t59.2708-21/file.pdf?_nc_cat=1&oh=x'],
  ['blob:https://www.facebook.com/7b5c0a1e-1111-2222-3333-444455556666', 'blob:https://www.facebook.com/7b5c0a1e-1111-2222-3333-444455556666'],
  ['https://l.facebook.com/l.php?u=https%3A%2F%2Fcdn.fbsbx.com%2Fv%2Fdoc.docx&h=AT0', 'https://cdn.fbsbx.com/v/doc.docx'],
  // Not Facebook files: never downloaded with the Messenger session.
  ['blob:https://evil.example/123', null],
  ['blob:https://chat.zalo.me/123', null],
  ['https://dl-chat-s.zdn.vn/file.pdf', null],
  ['https://fbsbx.com.evil.example/x.pdf', null],
  ['http://cdn.fbsbx.com/x.pdf', null],
  ['https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2Fx.pdf', null],
  ['https://www.facebook.com/messages/', null],
  ['data:text/html,x', null],
  [undefined, null],
];
for (const [url, want] of downloads) {
  test(`messenger downloadTarget(${JSON.stringify(url)})`, () => assert.strictEqual(downloadTarget(url, 'messenger'), want));
}

const calls = [
  ['https://www.facebook.com/groupcall/ROOM:123/?call_id=1', true],
  ['https://www.facebook.com/videocall/incall/?peer_id=1', true],
  ['https://www.facebook.com/messenger_call/', true],
  ['https://www.facebook.com/rtc/x', true],
  // Chats, other Facebook pages and look-alikes are not call pages.
  ['https://www.facebook.com/messages/t/123', false],
  ['https://www.facebook.com/groupcalls', false],
  ['https://apps.facebook.com/groupcall/', false],
  ['http://www.facebook.com/groupcall/', false],
  ['https://www.facebook.com.evil.example/groupcall/', false],
  ['about:blank', false],
];
for (const [url, want] of calls) {
  test(`isCallUrl(${url})`, () => assert.strictEqual(isCallUrl(url, 'messenger'), want));
}

// ---- Zalo Web

test('zalo: homeUrl, origins, classification, downloads and call isolation', () => {
  assert.strictEqual(homeUrlFor('zalo'), 'https://chat.zalo.me/');
  for (const ok of [
    'https://chat.zalo.me/',
    'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
    'https://accounts.zalo.me/security',
    'https://oauth.zaloapp.com/v4/auth',
    'about:blank',
  ]) {
    assert.strictEqual(classify(ok, 'zalo'), 'allowed', ok);
  }
  for (const ext of [
    'https://www.facebook.com/messages/',
    'https://web.telegram.org/a/',
    'https://vnexpress.net/',
    'http://chat.zalo.me/',
    'https://chat.zalo.me.evil.example/',
    'https://evilzalo.me/',
    'data:text/html,x',
    'blob:https://chat.zalo.me/123',
  ]) {
    assert.strictEqual(classify(ext, 'zalo'), 'external', ext);
  }
  assert.strictEqual(isServiceUrl('https://chat.zalo.me/', 'zalo'), true);
  assert.strictEqual(isServiceUrl('https://id.zalo.me/account', 'zalo'), true);
  assert.strictEqual(isServiceUrl('https://www.facebook.com/', 'zalo'), false);
  assert.strictEqual(isServiceUrl('https://zalo.me.evil.example/', 'zalo'), false);

  assert.strictEqual(downloadTarget('https://dl-chat-s.zdn.vn/file.pdf', 'zalo'), 'https://dl-chat-s.zdn.vn/file.pdf');
  assert.strictEqual(downloadTarget('https://f1-zpg-r.zadn.vn/photo.jpg', 'zalo'), 'https://f1-zpg-r.zadn.vn/photo.jpg');
  assert.strictEqual(downloadTarget('blob:https://chat.zalo.me/abc', 'zalo'), 'blob:https://chat.zalo.me/abc');
  assert.strictEqual(downloadTarget('https://zdn.vn.evil.example/file.pdf', 'zalo'), null);
  assert.strictEqual(downloadTarget('https://cdn.fbsbx.com/file.pdf', 'zalo'), null);
  assert.strictEqual(downloadTarget('blob:https://www.facebook.com/abc', 'zalo'), null);
  assert.strictEqual(isCallUrl('https://chat.zalo.me/', 'zalo'), false);
});

// ---- Telegram Web

test('telegram: homeUrl, origins, classification, downloads and call isolation', () => {
  assert.strictEqual(homeUrlFor('telegram'), 'https://web.telegram.org/a/');
  for (const ok of [
    'https://web.telegram.org/a/',
    'https://web.telegram.org/k/#-1001234',
    'https://webz.telegram.org/',
    'https://webk.telegram.org/',
    'about:blank',
  ]) {
    assert.strictEqual(classify(ok, 'telegram'), 'allowed', ok);
  }
  for (const ext of [
    'https://t.me/channel',
    'https://telegram.org/blog',
    'https://www.facebook.com/messages/',
    'https://chat.zalo.me/',
    'http://web.telegram.org/a/',
    'https://web.telegram.org.evil.example/a/',
    'data:text/html,x',
    'blob:https://web.telegram.org/abc',
  ]) {
    assert.strictEqual(classify(ext, 'telegram'), 'external', ext);
  }
  assert.strictEqual(isServiceUrl('https://web.telegram.org/a/', 'telegram'), true);
  assert.strictEqual(isServiceUrl('https://telegram.org/', 'telegram'), false);
  assert.strictEqual(isServiceUrl('https://web.telegram.org.evil.example/', 'telegram'), false);
  assert.strictEqual(isServiceUrl('https://chat.zalo.me/', 'telegram'), false);

  assert.strictEqual(downloadTarget('blob:https://web.telegram.org/7b5c', 'telegram'), 'blob:https://web.telegram.org/7b5c');
  assert.strictEqual(downloadTarget('blob:https://chat.zalo.me/7b5c', 'telegram'), null);
  assert.strictEqual(downloadTarget('https://cdn.fbsbx.com/file.pdf', 'telegram'), null);
  assert.strictEqual(isCallUrl('https://web.telegram.org/a/', 'telegram'), false);
});
