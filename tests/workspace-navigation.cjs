'use strict';
// Shell behavior only: run the complete source with small DOM/controller stand-ins.
// Browser geometry, CSS transitions and real feature-controller data need browser QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/platform-shell.js'), 'utf8');

function setup({mobile = false, hash = '#general-4'} = {}) {
 const listeners = {}, mediaListeners = [], microtasks = [], focusCalls = [];
 const calls = {generalMount: 0, generalDestroy: 0, dataMount: 0, dataDestroy: 0, pageWrites: 0, scroll: 0};
 const media = {matches: mobile, addEventListener(type, callback) { assert.equal(type, 'change'); mediaListeners.push(callback); }};
 const document = {activeElement: null, addEventListener(type, callback) { (listeners[type] ||= []).push(callback); }};
 let sidebar, page, root;
 class Node {
  constructor(name, parent = null) {
   this.name = name; this.parentElement = parent; this.children = []; this.attrs = {}; this.events = {};
   this.hidden = false; this.inert = false; this.visibility = 'visible'; this.dataset = {}; this.scrollTop = 0;
   parent?.children.push(this);
  }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  contains(node) { return Boolean(node && (node === this || this.contains(node.parentElement))); }
  closest(selector) {
   if (selector === '[inert]') return this.inert ? this : this.parentElement?.closest(selector) || null;
   if (selector === 'a[href^="#"],button[data-scenario]') return this.route ? this : null;
   throw Error('Unexpected closest selector: ' + selector);
  }
  getClientRects() {
   for (let node = this; node; node = node.parentElement) if (node.hidden) return [];
   if (sidebar?.contains(this) && (media.matches ? !document.body.classList.contains('navigation-open') : document.body.classList.contains('navigation-collapsed'))) return [];
   return [{}];
  }
  focus(options) {
   const allowed = this.getClientRects().length > 0 && !this.closest('[inert]') && this.visibility !== 'hidden';
   focusCalls.push({node: this, allowed, preventScroll: Boolean(options?.preventScroll)});
   if (!allowed) return;
   document.activeElement = this;
   if (!options?.preventScroll) root.scrollY = 0;
  }
  addEventListener(type, callback) { (this.events[type] ||= []).push(callback); }
  click() { this.onclick?.(); }
  set innerHTML(value) {
   this.html = value;
   if (this === page) {
    calls.pageWrites++;
    this.children = [];
    this.heading = new Node('heading', this);
    this.view = new Node('view', this);
    this.field = new Node('field', this.view);
    this.field.value = '';
    this.view.selectedDocument = 'initial';
   }
  }
  get innerHTML() { return this.html || ''; }
 }
 const body = document.body = new Node('body'), classNames = new Set();
 body.classList = {toggle(name, enabled) { enabled ? classNames.add(name) : classNames.delete(name); }, contains(name) { return classNames.has(name); }};
 const toggle = new Node('toggle', body), brand = new Node('brand', body), scrim = new Node('scrim', body);
 sidebar = new Node('sidebar', body);
 const main = new Node('main', body); page = new Node('page', main);
 const first = new Node('first-link', sidebar), last = new Node('last-link', sidebar);
 first.route = last.route = true;
 // These selectors can match hidden descendants; the real handler must exclude them.
 const invisible = new Node('invisible-link', sidebar); invisible.visibility = 'hidden';
 const hidden = new Node('hidden-link', sidebar); hidden.hidden = true;
 const inertGroup = new Node('inert-group', sidebar); inertGroup.inert = true;
 const inertChild = new Node('inert-link', inertGroup);
 sidebar.querySelector = selector => { assert.equal(selector, 'a[href]'); return first; };
 sidebar.querySelectorAll = () => [first, last, invisible, hidden, inertChild];
 const nodes = new Map([
  ['#navigation-toggle', toggle], ['#workspace-navigation', sidebar], ['aside', sidebar],
  ['#navigation-scrim', scrim], ['#main-content', main], ['#page', page], ['.brand', brand]
 ]);
 for (const selector of ['.skip-link', '#platform-navigation', '#knowledge-cases', '#current-location', '#message', '#connection', 'aside nav', '.workspace-info', '.workspace', '.aside-note']) nodes.set(selector, new Node(selector, body));
 document.querySelector = selector => selector === '#page h1' ? page.heading : nodes.get(selector) || null;
 const general = {mount(host) { calls.generalMount++; host.innerHTML = '<general>'; }, destroy() { calls.generalDestroy++; }};
 const data = {mount(host) { calls.dataMount++; host.innerHTML = '<lineage>'; }, destroy() { calls.dataDestroy++; }};
 const location = {hash};
 root = {
  location, scrollY: 0, matchMedia() { return media; }, queueMicrotask(fn) { microtasks.push(fn); },
  addEventListener(type, callback) { (listeners[type] ||= []).push(callback); },
  scrollTo(x, y) { calls.scroll++; this.scrollY = y; },
  KnowHowGeneralKnowledge: {createController() { return general; }},
  KnowHowKBLineage: {createController() { return data; }},
  KnowHowKBCatalog: {createProvider() { return {}; }}
 };
 vm.runInNewContext(source, {window: root, document, location, getComputedStyle: node => ({visibility: node.visibility}), sampleDemo: {deactivate() {}, activate() { page.innerHTML = '<company>'; }}}, {filename: 'platform-shell.js'});
 function key(key, options = {}) {
  const event = {key, shiftKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...options};
  for (const callback of listeners.keydown || []) callback(event);
  return event;
 }
 function resize(isMobile) { media.matches = isMobile; for (const callback of mediaListeners) callback({matches: isMobile}); }
 function route(next) { location.hash = next; for (const callback of listeners.hashchange || []) callback(); }
 function snapshot() { return {view: page.view, field: page.field, value: page.field.value, selected: page.view.selectedDocument, scrollY: root.scrollY, scrollTop: page.view.scrollTop, hash: location.hash, calls: {...calls}}; }
 function editPage() { page.field.value = 'unsaved question'; page.view.selectedDocument = 'selected-document'; page.view.scrollTop = 147; root.scrollY = 512; }
 function assertSafeFocus() { assert(!document.activeElement?.closest('[inert]'), 'focus must not remain in inert content'); assert(focusCalls.every(call => call.allowed), 'handlers must not try to focus hidden/inert controls'); }
 return {body, document, root, toggle, sidebar, main, scrim, first, last, brand, page, calls, focusCalls, nodes, key, resize, route, snapshot, editPage, assertSafeFocus, sidebarClick(target) { for (const callback of sidebar.events.click || []) callback({target}); while (microtasks.length) microtasks.shift()(); }};
}

function assertNavigation(h, {expanded, mobileOpen = false, desktopCollapsed = false}) {
 assert.equal(h.toggle.getAttribute('aria-expanded'), String(expanded));
 assert.equal(h.sidebar.inert, !expanded);
 assert.equal(h.main.inert, mobileOpen);
 assert.equal(h.scrim.hidden, !mobileOpen);
 assert.equal(h.body.classList.contains('navigation-open'), mobileOpen);
 assert.equal(h.body.classList.contains('navigation-collapsed'), desktopCollapsed);
 h.assertSafeFocus();
}

test('desktop collapse preserves DOM, unsaved input, selection, scroll and controller lifetime', () => {
 for (const hash of ['#general-4', '#data']) {
  const h = setup({hash}); h.editPage(); const before = h.snapshot();
  assertNavigation(h, {expanded: true});
  h.toggle.click();
  assertNavigation(h, {expanded: false, desktopCollapsed: true});
  assert.equal(h.toggle.getAttribute('aria-label'), '작업 메뉴 펼치기');
  assert.deepEqual(h.snapshot(), before);
  h.toggle.click();
  assertNavigation(h, {expanded: true});
  assert.equal(h.toggle.getAttribute('aria-label'), '작업 메뉴 접기');
  assert.deepEqual(h.snapshot(), before);
  assert(h.focusCalls.slice(-2).every(call => call.preventScroll));
 }
});

test('desktop route changes retain the collapsed preference without trapping main keyboard use', () => {
 const h = setup(); h.toggle.click(); h.route('#data');
 assert.equal(h.calls.dataMount, 1);
 assertNavigation(h, {expanded: false, desktopCollapsed: true});
 assert.equal(h.key('Tab').defaultPrevented, false);
 h.toggle.click(); h.page.field.focus({preventScroll: true});
 assert.equal(h.key('Escape').defaultPrevented, false, 'Escape in main belongs to the feature UI');
 h.first.focus({preventScroll: true}); assert.equal(h.key('Escape').defaultPrevented, true);
 assertNavigation(h, {expanded: false, desktopCollapsed: true});
 assert.equal(h.document.activeElement, h.toggle);
});

test('mobile overlay, Escape and scrim preserve page state and return focus', () => {
 const h = setup({mobile: true}); h.editPage(); const before = h.snapshot();
 assertNavigation(h, {expanded: false});
 assert.equal(h.key('Tab').defaultPrevented, false, 'closed menu does not trap focus');
 h.toggle.click();
 assertNavigation(h, {expanded: true, mobileOpen: true});
 assert.equal(h.document.activeElement, h.first);
 assert.equal(h.toggle.getAttribute('aria-label'), '작업 메뉴 닫기');
 assert.deepEqual(h.snapshot(), before);
 assert.equal(h.key('Escape').defaultPrevented, true);
 assertNavigation(h, {expanded: false});
 assert.equal(h.document.activeElement, h.toggle);
 assert.deepEqual(h.snapshot(), before);
 h.toggle.click(); h.scrim.click();
 assertNavigation(h, {expanded: false});
 assert.equal(h.document.activeElement, h.toggle);
 assert.deepEqual(h.snapshot(), before);
});

test('mobile tab wrap excludes hidden/inert controls and recovers focus outside the drawer', () => {
 const h = setup({mobile: true}); h.toggle.click();
 h.last.focus({preventScroll: true}); h.key('Tab'); assert.equal(h.document.activeElement, h.toggle);
 h.key('Tab', {shiftKey: true}); assert.equal(h.document.activeElement, h.last);
 h.brand.focus({preventScroll: true}); h.key('Tab', {shiftKey: true}); assert.equal(h.document.activeElement, h.last);
 h.brand.focus({preventScroll: true}); h.key('Tab'); assert.equal(h.document.activeElement, h.toggle);
 assert.equal(h.key('Escape', {defaultPrevented: true}).defaultPrevented, true);
 assertNavigation(h, {expanded: true, mobileOpen: true});
 h.assertSafeFocus();
});

test('breakpoint changes clear overlay locks, keep desktop preference, and evacuate hidden focus', () => {
 for (const collapsed of [false, true]) {
  const h = setup(); if (collapsed) h.toggle.click();
  else h.first.focus({preventScroll: true});
  h.resize(true);
  assertNavigation(h, {expanded: false});
  assert.equal(h.document.activeElement, h.toggle);
  h.editPage(); const before = h.snapshot();
  h.toggle.click(); h.resize(false);
  assertNavigation(h, {expanded: !collapsed, desktopCollapsed: collapsed});
  assert.deepEqual(h.snapshot(), before);
  if (collapsed) assert.equal(h.document.activeElement, h.toggle);
  h.resize(true); assertNavigation(h, {expanded: false});
  h.resize(false); assertNavigation(h, {expanded: !collapsed, desktopCollapsed: collapsed});
 }
});

test('mobile route and same-route menu actions close the overlay and unlock main', () => {
 const h = setup({mobile: true}); h.toggle.click(); h.route('#data');
 assertNavigation(h, {expanded: false});
 assert.equal(h.document.activeElement, h.page.heading);
 h.toggle.click(); h.sidebarClick(h.first);
 assertNavigation(h, {expanded: false});
 assert.equal(h.document.activeElement, h.page.heading);
 assert.equal(h.calls.dataMount, 1, 'same-route drawer close must not remount the feature');
});
