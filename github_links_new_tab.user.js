// ==UserScript==
// @name         GitHub 仓库链接新标签页打开
// @guid         https://github.com/aisubing/github-newtab-links
// @namespace    http://tampermonkey.net/
// @version      1.2.1
// @description  在 GitHub 的个人主页的 Stars / Repositories 标签与个人主页 Overview，把仓库链接在新标签页打开，其余页面与链接保持默认。
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

  // -------------------- Scope: 仓库列表型页面 --------------------
  // 覆盖四种"一列仓库链接"的入口：
  //   1. 自己的 stars 页：'/stars'、'/stars/' 以及公开的 '/stars/<user>'
  //   2. 个人主页的 Stars 标签：'/<user>?tab=stars'（查看他人或自己的公开收藏）
  //   3. 个人主页的 Repositories 标签：'/<user>?tab=repositories'
  //   4. 个人主页 Overview：'/<user>'（Popular repositories 与活动流）
  // 用分段/URLSearchParams 而非正则判断，避免 Tampermonkey 内置解析器对正则字面量误分词。
  // 在点击那一刻读取 location，因此 Turbo/SPA 跳转后无需重新初始化即可生效。
  const pathSegs = (p) => p.split('/').filter(Boolean);

  const LISTING_TABS = ['stars', 'repositories'];

  const tabParam = () => {
    try {
      return new URLSearchParams(window.location.search).get('tab');
    } catch (_) {
      return null;
    }
  };

  // Overview 页同样是单段路径，而 GitHub 自己的 '/login'、'/settings'、'/trending'
  // 也是单段。这里用"页面里存在 ?tab=repositories 标签链接"作为个人主页的身份信号，
  // 而不是枚举保留路径——黑名单漏一项是"乱生效"，比漏判更糟。
  // 但这条信号不是单向安全的：标记缺失（GitHub 改版）就不生效，标记误现（组织主页的
  // 标签栏同样带 ?tab=repositories）就会多拦截。两个失效方向都存在。
  const isProfileOverview = (s) => {
    const tab = tabParam();
    if (s.length !== 1) return false;
    if (tab !== null && tab !== 'overview') return false;
    return !!document.querySelector('a[href*="tab=repositories"]');
  };

  const isListingPage = () => {
    const s = pathSegs(window.location.pathname);
    if (s[0] === 'stars' && s.length <= 2) return true;
    if (s.length === 1 && LISTING_TABS.includes(tabParam())) return true;
    return isProfileOverview(s);
  };

  // 列表里的项目链接必然是同源的仓库地址：恰好两段 '/owner/repo'。
  // 同源判定是必需的：docs.github.com/articles/xxx 与 avatars.githubusercontent.com/u/xxx
  // 这类外链的 pathname 同样是两段，只比段数会把它们误当成仓库。
  // '/<user>'、'/stars'、'/login' 是单段，段数不符即排除；'/owner/repo/blob/...' 段数更多。
  // 注意 '/stars/<user>' 本身就是两段，段数条件在该页挡不住任何东西——翻页、排序、
  // 筛选这些只改 query 的同路径链接，由 shouldIgnoreLink 里的"同 pathname 则忽略"兜住。
  // 排除页脚/导航，避免 '/features/xxx' 这类同样是两段的营销链接被误判。
  const isRepoLink = (a) =>
    a.host === window.location.host &&
    pathSegs(a.pathname).length === 2 &&
    !a.closest('footer, header, nav');

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
    // 覆盖面比"README 里「简体中文 | English」这类仅 hash 不同的跳转"更宽——列表页的翻页、
    // 排序、语言/类型筛选都只改 query，在 '/stars/<user>' 这种本身就是两段的路径上，
    // 段数条件挡不住它们，只有这条能。
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
      if (!isListingPage()) return;
      if (isModifiedClick(e)) return;

      const a = closestAnchor(e.target);
      if (shouldIgnoreLink(a)) return;
      if (!isRepoLink(a)) return;

      const url = a.href;
      if (!url) return;

      e.preventDefault();
      e.stopPropagation();
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    true
  );
})();
