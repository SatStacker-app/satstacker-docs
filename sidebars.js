// @ts-check

const fs = require('node:fs');
const path = require('node:path');

// OpenAPI plugin versions can emit sidebar.ts or sidebar.js. An empty sidebar
// during clean/generate lets a fresh checkout bootstrap its API reference.
let apiSidebar = [];
for (const name of ['sidebar.ts', 'sidebar.js']) {
  const filename = path.join(__dirname, 'docs', 'api', name);
  if (fs.existsSync(filename)) {
    const generated = require(filename);
    apiSidebar = generated.default ?? generated;
    break;
  }
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
    'execution-contract',
    'webhooks',
    'environments',
    'sandbox-testing',
    'errors',
    'rate-limits',
    'operations',
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
      items: apiSidebar,
    },
  ],
};

module.exports = sidebars;
