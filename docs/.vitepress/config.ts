import { defineConfig } from 'vitepress'

const sidebar = [
  {
    text: 'Spot System',
    collapsed: false,
    items: [
      { text: '现货交易系统总览', link: '/spot-system/overview' },
      { text: '下单链路与订单状态机', link: '/spot-system/order-lifecycle' },
      { text: '账户资金与流水一致性', link: '/spot-system/account-ledger' },
      { text: '撮合路由与多节点治理', link: '/spot-system/matching-routing' },
      { text: '币对生命周期与上币流程', link: '/spot-system/symbol-launch' },
      { text: '代理增长与返佣结算', link: '/projects/growth-rebate-system' },
      { text: '行情推送系统', link: '/projects/market-data-push' }
    ]
  },
  {
    text: 'Trading Infrastructure',
    collapsed: false,
    items: [
      { text: '交易系统架构', link: '/system-design/crypto-trading-system' },
      { text: '撮合引擎架构设计', link: '/system-design/matching-engine-architecture' },
      { text: 'matching-engine 项目拆解', link: '/projects/matching-engine-project' },
      { text: '资产账户一致性', link: '/database/asset-accounting' }
    ]
  },
  {
    text: 'Java',
    collapsed: false,
    items: [
      { text: '集合', link: '/java/collection' },
      { text: 'HashMap&ConcurrentHashMap', link: '/java/hashmap' },
      { text: '多线程', link: '/java/multithreading' },
      { text: '锁机制', link: '/java/locks' }
    ]
  },
  {
    text: 'Spring',
    collapsed: false,
    items: [
      { text: 'Spring Boot 自动装配', link: '/spring/boot-autoconfiguration' },
      { text: 'Bean 生命周期', link: '/spring/bean-lifecycle' },
      { text: '事务边界设计', link: '/spring/transaction-boundaries' },
      { text: '事件驱动实践', link: '/spring/event-driven-spring' }
    ]
  },
  {
    text: 'Database',
    collapsed: false,
    items: [
      { text: '资产账户一致性', link: '/database/asset-accounting' },
      { text: 'MySQL 索引设计', link: '/database/mysql-index' },
      { text: 'MySQL 事务与隔离级别', link: '/database/mysql-transaction-isolation' },
      { text: 'MySQL 锁与 MVCC', link: '/database/mysql-lock-mvcc' },
      { text: 'SQL 优化实践', link: '/database/sql-optimization' }
    ]
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
    text: 'JVM',
    collapsed: false,
    items: [
      { text: 'GC 调优入门', link: '/jvm/gc-tuning' }
    ]
  },
  {
    text: 'Interview',
    collapsed: false,
    items: [
      { text: '后端面试复盘策略', link: '/interview/backend-roadmap' }
    ]
  },
  {
    text: 'Tools & Thinking',
    collapsed: false,
    items: [
      { text: 'AI 工程工具链', link: '/tools/ai-engineering-tools' },
      { text: 'AI 时代程序员成长', link: '/thinking/engineering-growth' }
    ]
  }
]

export default defineConfig({
  lang: 'zh-CN',
  title: '慕黎尘渊',
  description: 'Crypto 现货交易系统负责人实践',
  head: [
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/mlcy-blog/favicon.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '192x192', href: '/mlcy-blog/apple-touch-icon.png' }],
    ['link', { rel: 'shortcut icon', href: '/mlcy-blog/favicon.ico' }]
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
    logo: '/logo.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Spot System', link: '/spot-system/overview' },
      { text: 'Trading Infra', link: '/system-design/crypto-trading-system' },
      { text: 'Java', link: '/java/collection' },
      { text: 'Spring', link: '/spring/boot-autoconfiguration' },
      { text: 'Database', link: '/database/mysql-index' },
      { text: 'Middleware', link: '/middleware/redis' },
      { text: 'Interview', link: '/interview/backend-roadmap' }
    ],
    sidebar,
    search: {
      provider: 'local'
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/YANSHAO0032/mlcy-blog' }
    ],
    footer: {
      message: 'Built with VitePress',
      copyright: 'Copyright © 2026'
    }
  }
})
