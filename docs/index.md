---
layout: home

hero:
  name: 慕黎尘渊的博客
  text: 君子藏器于身，待时而动
  tagline: 聚焦交易系统架构、代理增长结算、资产账户与行情事件流的 Crypto Java 后端实践。
  image:
    src: /logo.png
    alt: 慕黎尘渊的博客
  actions:
    - theme: brand
      text: 交易系统
      link: /system-design/crypto-trading-system
    - theme: alt
      text: 增长结算
      link: /projects/growth-rebate-system

features:
  - title: Trading System
    details: 交易系统架构、订单路由、账户流水、行情推送与风控治理。
  - title: Web3 Infrastructure
    details: 钱包、节点 RPC、区块扫描、链上确认、提现状态机和回滚处理。
  - title: Java Backend
    details: 并发、JVM、Spring、MySQL、Redis、Kafka、ES 与增长后台工程实践。
---

## 最新文章

<div class="grid-cards">
  <div class="grid-card">
    <h3><a href="/mlcy-blog/system-design/crypto-trading-system">Crypto 交易系统整体架构</a></h3>
    <p>从交易入口、订单流转、资产协同到风控与可观测性，梳理现货系统的核心边界。</p>
  </div>
  <div class="grid-card">
    <h3><a href="/mlcy-blog/projects/growth-rebate-system">代理增长与返佣结算系统</a></h3>
    <p>围绕邀请关系、返佣结算、层级统计、运营配置与风控，拆解现货业务中的增长链路。</p>
  </div>
  <div class="grid-card">
    <h3><a href="/mlcy-blog/projects/market-data-push">行情推送系统</a></h3>
    <p>基于撮合引擎事件流，拆解行情快照、增量广播、热点交易对隔离和恢复策略。</p>
  </div>
</div>

## 技术体系

<div class="grid-cards">
  <div class="grid-card">
    <h3>现货与资金</h3>
    <p>交易系统架构、订单路由、资产账户、资金流水、返佣结算与风控。</p>
  </div>
  <div class="grid-card">
    <h3>增长与运营</h3>
    <p>代理关系、邀请返佣、活动任务、报表统计、权限边界与运营自动化。</p>
  </div>
  <div class="grid-card">
    <h3>Java 基建</h3>
    <p>Spring、JVM、MySQL、Redis、Kafka、ES、WebSocket、可观测性。</p>
  </div>
</div>

## 推荐阅读

- [交易平台代理增长与返佣结算系统设计](/projects/growth-rebate-system)
- [Crypto 交易系统整体架构设计](/system-design/crypto-trading-system)
- [撮合引擎架构设计：Actor、RingBuffer 与 Event Sourcing](/system-design/matching-engine-architecture)
- [matching-engine 项目拆解：OrderBook、SkipList 与 Iceberg](/projects/matching-engine-project)
