import { defineConfig } from 'vitepress'

const sidebar = [
  {
    text: 'Java',
    collapsed: false,
    items: [
        { text: '集合', link: '/java/collection' },
      { text: 'HashMap 原理', link: '/java/hashmap' }
    ]
  },
  {
    text: 'Spring',
    collapsed: false,
    items: [{ text: 'Spring Boot 自动装配', link: '/spring/boot-autoconfiguration' }]
  },
  {
    text: 'JVM',
    collapsed: false,
    items: [{ text: 'GC 调优入门', link: '/jvm/gc-tuning' }]
  },
  {
    text: 'Database',
    collapsed: false,
    items: [{ text: 'MySQL 索引设计', link: '/database/mysql-index' }]
  },
  {
    text: 'Middleware',
    collapsed: false,
    items: [{ text: 'Redis 缓存设计', link: '/middleware/redis' }]
  },
  {
    text: 'System Design',
    collapsed: false,
    items: [{ text: '秒杀系统设计', link: '/system-design/seckill-system' }]
  },
  {
    text: 'Projects',
    collapsed: false,
    items: [{ text: '订单系统实战复盘', link: '/projects/order-system' }]
  },
  {
    text: 'Interview',
    collapsed: false,
    items: [{ text: '后端面试复盘策略', link: '/interview/backend-roadmap' }]
  },
  {
    text: 'Tools',
    collapsed: false,
    items: [{ text: 'Git 高效协作', link: '/tools/git-workflow' }]
  },
  {
    text: 'Thinking',
    collapsed: false,
    items: [{ text: '技术成长方法论', link: '/thinking/engineering-growth' }]
  }
]

export default defineConfig({
  lang: 'zh-CN',
  title: '慕黎尘渊',
  description: '君子藏器于身，待时而动',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/mlcy-blog/logo.svg' }]
  ],
  srcDir: '.',
  base: '/mlcy-blog/',
  outDir: '.vitepress/dist',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,
  markdown: {
    lineNumbers: true,
    image: {
      lazyLoading: true
    },
    config: () => {
      // Reserve for future markdown-it plugins.
    }
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Java', link: '/java/collection' },
      { text: 'Spring', link: '/spring/boot-autoconfiguration' },
      { text: 'JVM', link: '/jvm/gc-tuning' },
      { text: 'Database', link: '/database/mysql-index' },
      { text: 'Middleware', link: '/middleware/redis' },
      { text: 'System Design', link: '/system-design/seckill-system' },
      { text: 'Projects', link: '/projects/order-system' },
      { text: 'Interview', link: '/interview/backend-roadmap' },
      { text: 'Tools', link: '/tools/git-workflow' },
      { text: 'Thinking', link: '/thinking/engineering-growth' }
    ],
    sidebar,
    // search: {
    //   provider: 'local'
    // },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/YANSHAO0032/mlcy-blog' }
    ],
    footer: {
      message: 'Built with VitePress',
      copyright: 'Copyright © 2026'
    }
  }
})
