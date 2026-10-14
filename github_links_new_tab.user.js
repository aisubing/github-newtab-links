// ==UserScript==
// @name         GitHub 仓库链接新标签页打开
// @namespace    http://tampermonkey.net/
// @version      2.0.3
// @description  在 GitHub 全站把仓库链接（同源、两段路径 作者/仓库）在新标签页打开；修饰键点击与其余链接一律保持浏览器默认行为。
// @match        https://github.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/aisubing/github-newtab-links
// @downloadURL  https://raw.githubusercontent.com/aisubing/github-newtab-links/main/github_links_new_tab.user.js
// @updateURL    https://raw.githubusercontent.com/aisubing/github-newtab-links/main/github_links_new_tab.user.js
// ==/UserScript==

(function () {
  'use strict';

  // -------------------- Link handling --------------------
  const isModifiedClick = (e) =>
    e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

  const closestAnchor = (el) => (el && el.closest ? el.closest('a[href]') : null);

  const pathSegs = (p) => p.split('/').filter(Boolean);

  // -------------------- 仓库链接判定：全站生效 --------------------
  // 2.0 起不再区分页面：任何 github.com 页面上指向 '/owner/repo' 的同源链接都按仓库链接处理。
  // GitHub 自身也有一批两段式路由（/topics/x、/orgs/x、/settings/x……），靠保留前缀名单排除。
  // 这些名字全部被 GitHub 保留，不可能存在同名用户/组织，排除它们不会漏掉真实仓库；
  // 名单漏写一条的后果只是那一类站点链接被误新开（轻度误伤），比漏掉仓库链接可接受。
  const RESERVED_FIRST = new Set([
    'topics', 'orgs', 'users', 'sponsors', 'settings', 'features',
    'collections', 'marketplace', 'apps', 'advisories', 'organizations',
    'blog', 'readme', 'site-policy', 'site-admin', 'codespaces',
  ]);

  // 个人主页下与仓库同形的固定子页：/<user>/followers、/<user>/following。
  // 这两个路由被站点页面占据，仓库名不可能叫这两个名字。
  const RESERVED_SECOND = new Set(['followers', 'following']);

  // 恰好两段 '/owner/repo' 的同源链接即仓库链接。
  // 同源判定是必需的：docs.github.com/articles/xxx 与 avatars.githubusercontent.com/u/xxx
  // 这类外链的 pathname 同样是两段，只比段数会把它们误当成仓库。
  // '/<user>'、'/login'、'/topics' 是单段，'/owner/repo/blob/...' 段数更多，段数不符即排除。
  // 排除页头/导航/页脚：那里的两段链接是 '/features/xxx'、'/organizations/new' 这类
  // 站点入口，不是仓库。
  const isRepoLink = (a) => {
    if (a.host !== window.location.host) return false;
    const segs = pathSegs(a.pathname);
    if (segs.length !== 2) return false;
    if (RESERVED_FIRST.has(segs[0].toLowerCase())) return false;
    if (RESERVED_SECOND.has(segs[1].toLowerCase())) return false;
    return !a.closest('footer, header, nav');
  };

  const shouldIgnoreLink = (a) => {
    if (!a) return true;

    const href = a.getAttribute('href');
    if (!href || href.startsWith('javascript:')) return true;
    if (a.hasAttribute('download')) return true;

    const role = a.getAttribute('role');
    if (role === 'button') return true;

    // 纯锚点（仅 # 或 #xxx）：当前页内跳转，不新开标签
    if (href.startsWith('#')) return true;

    const normalizePath = (p) => (p || '').replace(/\/+$/, '');

    // 同路径链接：目标与当前页同 origin、同 path（尾部 / 忽略），query 或 hash 不同也算同路径。
    // 仓库页顶部的仓库面包屑、列表页的翻页/排序/筛选——'/stars/<user>'、'/topics/<x>'
    // 本身就是两段路径，段数条件挡不住它们——以及 README 里「简体中文 | English」这类
    // 仅 query/hash 不同的跳转，都靠这条排除。
    try {
      const u = new URL(a.href);
      const cur = window.location;
      if (u.origin === cur.origin && normalizePath(u.pathname) === normalizePath(cur.pathname)) return true;
    } catch (_) {}

    return false;
  };

  window.addEventListener(
    'click',
    (e) => {
      // 只拦真实用户点击：页面脚本用 element.click() 合成的导航（GitHub 偶用）不受影响
      if (!e.isTrusted) return;
      if (isModifiedClick(e)) return;

      const a = closestAnchor(e.target);
      if (shouldIgnoreLink(a)) return;
      if (!isRepoLink(a)) return;

      const url = a.href;
      if (!url) return;

      e.preventDefault();
      e.stopPropagation();
      // 注意：features 里带 noopener 时 window.open 恒返回 null，无法据此区分
      // "已打开"与"被拦截"。因此这里不带 noopener，拿到窗口引用后手动置空 opener
      // （等效切断反向引用）；返回 null 才是真被拦截，此时退回当前页跳转。
      const w = window.open(url, '_blank');
      if (w) {
        try { w.opener = null; } catch (_) {}
      } else {
        window.location.assign(url);
      }
    },
    true
  );
})();
