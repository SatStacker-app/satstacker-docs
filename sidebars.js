// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'index',
    'getting-started',
    'authentication',
    'concepts',
    'smart-timing',
    'environments',
    'errors',
    'rate-limits',
    'changelog',
  ],
  apiSidebar: [
    {
      type: 'category',
      label: 'API Reference',
      link: {
        type: 'generated-index',
        title: 'SatStacker Engine API',
        description: 'Complete reference for the SatStacker Engine Partner API.',
        slug: '/api/satstacker-engine-api',
      },
      items: require('./docs/api/sidebar.ts'),
    },
  ],
};

export default sidebars;
