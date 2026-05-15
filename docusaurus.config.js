// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).

const { themes: prismThemes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'SatStacker Engine',
  tagline: 'Smart Timing for exchanges and Bitcoin platforms',
  favicon: 'img/favicon.ico',

  // Production URL of your site
  url: 'https://docs.satstacker.app',
  baseUrl: '/',

  // GitHub pages deployment config (unused but required by Docusaurus)
  organizationName: 'satstacker',
  projectName: 'satstacker-docs',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/', // serve docs at the root
        },
        blog: false, // disable the blog feature
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'SatStacker Engine',
        logo: {
          alt: 'SatStacker',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: 'https://satstacker.app',
            label: 'SatStacker',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              { label: 'Getting Started', to: '/getting-started' },
              { label: 'Changelog', to: '/changelog' },
            ],
          },
          {
            title: 'SatStacker',
            items: [
              { label: 'Website', href: 'https://satstacker.app' },
              { label: 'Status', href: 'https://api.satstacker.app/partner/v1/health' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} SatStacker.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json', 'powershell', 'python'],
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),

  plugins: [],
};

module.exports = config;
