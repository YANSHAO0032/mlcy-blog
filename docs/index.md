---
layout: home

hero:
  name: 慕黎尘渊的博客
  text: 君子藏器于身，待时而动
  tagline: Crypto 行业 Java 后端工程师，专注交易系统、资产账户、链上数据同步与高可靠后端架构。
  image:
    src: /logo.png
    alt: 慕黎尘渊的博客
  actions:
    - theme: brand
      text: 交易系统
      link: /system-design/crypto-trading-system
    - theme: alt
      text: 资产一致性
      link: /database/asset-accounting

features:
  - title: Trading System
    details: 订单、撮合、账户、资金流水、风控与延迟治理。
  - title: Web3 Infrastructure
    details: 钱包、节点 RPC、区块扫描、链上确认和重组处理。
  - title: Java Backend
    details: 并发、JVM、Spring、MySQL、Redis、Kafka 与可观测性。
---

## 最新文章

<div class="grid-cards">
  <div class="grid-card">
    <h3><a href="/mlcy-blog/system-design/crypto-trading-system">Crypto 交易系统架构</a></h3>
    <p>从订单、撮合、账户、资金流水到风控，梳理交易平台核心链路。</p>
  </div>
  <div class="grid-card">
    <h3><a href="/mlcy-blog/system-design/matching-engine-architecture">撮合引擎架构设计</a></h3>
    <p>围绕 Single Thread Actor、RingBuffer、事件溯源和多市场管理拆解核心设计。</p>
  </div>
  <div class="grid-card">
    <h3><a href="/mlcy-blog/projects/matching-engine-project">matching-engine 项目拆解</a></h3>
    <p>从 SkipList、价格档位 FIFO、Iceberg、Snapshot/Restore 到 Replay 语义复盘实现细节。</p>
  </div>
</div>

## 技术体系

<div class="grid-cards">
  <div class="grid-card">
    <h3>交易与资金</h3>
    <p>订单、撮合、资产账户、资金流水、风控、清结算。</p>
  </div>
  <div class="grid-card">
    <h3>链上工程</h3>
    <p>钱包、充值提现、节点 RPC、区块扫描、事件解析、链重组。</p>
  </div>
  <div class="grid-card">
    <h3>Java 基建</h3>
    <p>Spring、JVM、MySQL、Redis、Kafka、WebSocket、可观测性。</p>
  </div>
</div>

## 推荐阅读

- [Crypto 交易系统整体架构设计](/system-design/crypto-trading-system)
- [撮合引擎架构设计：Actor、RingBuffer 与 Event Sourcing](/system-design/matching-engine-architecture)
- [matching-engine 项目拆解：OrderBook、SkipList 与 Iceberg](/projects/matching-engine-project)
- [资产账户系统的幂等与一致性设计](/database/asset-accounting)
