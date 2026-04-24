import { defineConfig } from 'vitepress'

const sidebar = [
  {
    text: 'Crypto Backend',
    collapsed: false,
    items: [
      { text: '交易系统架构', link: '/system-design/crypto-trading-system' },
      { text: '代理增长与返佣结算', link: '/projects/growth-rebate-system' },
      { text: '资产账户一致性', link: '/database/asset-accounting' },
      { text: '充值提现链路', link: '/middleware/wallet-deposit-withdraw' },
      { text: '行情推送系统', link: '/projects/market-data-push' }
    ]
  },
  {
    text: 'Java',
    collapsed: false,
    items: [
      { text: '集合', link: '/java/collection' },
      { text: 'HashMap&ConcurrentHashMap', link: '/java/hashmap' },
      { text: '多线程', link: '/java/multithreading' },
      { text: '锁机制', link: '/java/locks' },
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
    items: [
      { text: 'Redis 缓存设计', link: '/middleware/redis' },
      { text: 'Kafka 消息队列', link: '/middleware/kafka' },
      { text: 'Elasticsearch 检索设计', link: '/middleware/elasticsearch' }
    ]
  },
  {
    text: 'System Design',
    collapsed: false,
    items: [
      { text: '交易系统架构', link: '/system-design/crypto-trading-system' },
      { text: '撮合引擎架构设计', link: '/system-design/matching-engine-architecture' }
    ]
  },
  {
    text: 'Projects',
    collapsed: false,
    items: [
      { text: '代理增长与返佣结算', link: '/projects/growth-rebate-system' },
      { text: 'matching-engine 项目拆解', link: '/projects/matching-engine-project' }
    ]
  },
  {
    text: 'Interview',
    collapsed: false,
    items: [{ text: '后端面试复盘策略', link: '/interview/backend-roadmap' }]
  },
  {
    text: 'Tools',
    collapsed: false,
    items: [{ text: 'AI 工程工具链', link: '/tools/ai-engineering-tools' }]
  },
  {
    text: 'Thinking',
    collapsed: false,
    items: [{ text: 'AI 时代程序员成长', link: '/thinking/engineering-growth' }]
  }
]

export default defineConfig({
  lang: 'zh-CN',
  title: '慕黎尘渊',
  description: '君子藏器于身，待时而动',
  head: [
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/mlcy-blog/favicon.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '192x192', href: '/mlcy-blog/apple-touch-icon.png' }],
    ['link', { rel: 'shortcut icon', href: '/mlcy-blog/favicon.ico' }]
  ],
  srcDir: '.',
  base: '/mlcy-blog/',
  outDir: '.vitepress/dist',
  cleanUrls: true,
  lastUpdated: false,
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
    logo: '/logo.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Java', link: '/java/collection' },
      { text: 'Spring', link: '/spring/boot-autoconfiguration' },
      { text: 'JVM', link: '/jvm/gc-tuning' },
      { text: 'Database', link: '/database/mysql-index' },
      { text: 'Middleware', link: '/middleware/redis' },
      { text: 'Trading System', link: '/system-design/crypto-trading-system' },
      { text: 'Projects', link: '/projects/growth-rebate-system' },
      { text: 'Interview', link: '/interview/backend-roadmap' },
      { text: 'Tools', link: '/tools/ai-engineering-tools' },
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
