// ==UserScript==
// @name         GitHub 仓库链接新标签页打开
// @guid         https://github.com/aisubing/github-newtab-links
// @namespace    http://tampermonkey.net/
// @version      1.2.1
// @description  在 GitHub个人主页的Overview/Repositories/Stars页面 ，把仓库链接在新标签页打开，其余页面与链接保持默认。
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
  // 而不是枚举保留路径——万一漏掉某个保留路径，结果是"不生效"而非"乱生效"。
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
  // '/stars'、'/<user>'、'/login'、tag 筛选、排序、分页段数不同，保持默认行为。
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

    // 同页锚点：目标 URL 与当前页同 origin、同 path（忽略尾部 /），仅 hash 不同 → 不新开标签（如 README 里「简体中文 | English」）
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
