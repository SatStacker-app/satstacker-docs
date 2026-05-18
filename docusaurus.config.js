// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).

const { themes: prismThemes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'SatStacker Engine',
  tagline: 'Smart Timing for exchanges and Bitcoin platforms',
  favicon: 'img/icon-1024.png',

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
          docItemComponent: '@theme/ApiItem',
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
          src: 'img/icon-1024.png',
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
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),

  plugins: [
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api',
        docsPluginId: 'classic',
        config: {
          satstackerEngine: {
            specPath: 'openapi/partner-api.json',
            outputDir: 'docs/api',
            sidebarOptions: {
              groupPathsBy: 'tag',
            },
          },
        },
      },
    ],

    function webpackFallbackPlugin() {
      return {
        name: 'webpack-fallback-plugin',
        configureWebpack() {
          return {
            resolve: {
              fallback: {
                path: require.resolve('path-browserify'),
              },
            },
          };
        },
      };
    },
  ],

  themes: ['docusaurus-theme-openapi-docs'],
};

module.exports = config;
