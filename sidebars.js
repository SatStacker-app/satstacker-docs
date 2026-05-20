// @ts-check

let apiSidebar;
try {
  apiSidebar = require('./docs/api/sidebar.ts');
} catch (e) {
  console.warn('API sidebar not generated yet. Run `npm run gen-api-docs`.');
  apiSidebar = { default: [] };
}

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'index',
    'getting-started',
    'verify-key',
    'authentication',
    'concepts',
    'smart-timing',
    'webhooks',
    'environments',
    'errors',
    'rate-limits',
    'changelog',
    {
      type: 'category',
      label: 'API Reference',
      link: {
        type: 'generated-index',
        title: 'SatStacker Engine API',
        description: 'Complete reference for the SatStacker Engine Partner API.',
        slug: '/api/satstacker-engine-api',
      },
      items: apiSidebar.default ?? apiSidebar,
    },
  ],
};

module.exports = sidebars;