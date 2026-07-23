---
layout: home
title: 慕黎尘渊
titleTemplate: Crypto 交易系统与 Java 后端
---
<div class="obsidian-home">
  <aside class="profile-panel" aria-label="作者资料">
    <div class="profile-panel__visual">
      <img src="/logo.png" alt="慕黎尘渊 Logo">
      <span>MLCY / ENGINEERING NOTES</span>
    </div>
    <div class="profile-panel__body">
      <p class="profile-panel__eyebrow">Crypto · Java · Architecture</p>
      <h1>慕黎尘渊</h1>
      <p class="profile-panel__role">现货交易系统负责人</p>
      <p class="profile-panel__intro">记录订单、撮合、资金、消息与 JVM 背后的工程判断，让复杂系统经得起真实流量和故障。</p>
      <blockquote>君子藏器于身，待时而动。</blockquote>
      <dl class="profile-panel__facts">
        <div><dt>方向</dt><dd>交易系统 / 分布式架构</dd></div>
        <div><dt>关注</dt><dd>一致性 / 低延迟 / 稳定性</dd></div>
        <div><dt>运行时</dt><dd>Java 21 / Spring</dd></div>
      </dl>
      <nav class="profile-panel__links" aria-label="快速入口">
        <a href="/mlcy-blog/spot-system/overview">现货系统</a>
        <a href="/mlcy-blog/system-design/crypto-trading-system">架构设计</a>
      </nav>
    </div>
  </aside>
  <main class="home-feed">
    <header class="home-feed__header">
      <div>
        <p class="home-kicker">FIELD NOTES / 2026</p>
        <h2>写在交易系统的一线</h2>
      </div>
      <p>从业务约束出发，讨论架构选择、可靠性边界和生产故障恢复。</p>
    </header>
    <a class="featured-story" href="/mlcy-blog/spot-system/overview">
      <div class="featured-story__meta">
        <span>FEATURED</span>
        <span>SPOT TRADING</span>
      </div>
      <div class="featured-story__content">
        <p>专题总览</p>
        <h2>现货交易系统：从订单入口到资金对账</h2>
        <span>把接入、订单、撮合、账户、行情与风控拆成可治理的业务边界。</span>
      </div>
      <span class="featured-story__arrow" aria-hidden="true">↗</span>
    </a>
    <section class="article-section" aria-labelledby="latest-articles">
      <div class="section-heading">
        <div>
          <p class="home-kicker">LATEST WRITING</p>
          <h2 id="latest-articles">近期深度文章</h2>
        </div>
        <span>04 ARTICLES</span>
      </div>
      <div class="article-stream">
        <a class="article-entry" href="/mlcy-blog/middleware/rocketmq-vs-kafka">
          <span class="article-entry__index">01</span>
          <div class="article-entry__body">
            <div class="article-entry__meta"><span>MESSAGING</span><span>架构与可靠性</span></div>
            <h3>RocketMQ 与 Kafka：架构、存储与高可用</h3>
            <p>结合真实工程配置，分析两种消息队列如何落盘、复制、确认，以及消息不丢失的完整链路。</p>
          </div>
          <span class="article-entry__arrow" aria-hidden="true">→</span>
        </a>
        <a class="article-entry" href="/mlcy-blog/jvm/g1-vs-zgc">
          <span class="article-entry__index">02</span>
          <div class="article-entry__body">
            <div class="article-entry__meta"><span>JVM / JDK 21</span><span>性能治理</span></div>
            <h3>G1 与 ZGC：交易系统中的垃圾收集器选择</h3>
            <p>比较停顿目标、吞吐成本、并发阶段与资源开销，给出面向低延迟服务的选择依据。</p>
          </div>
          <span class="article-entry__arrow" aria-hidden="true">→</span>
        </a>
        <a class="article-entry" href="/mlcy-blog/system-design/matching-engine-architecture">
          <span class="article-entry__index">03</span>
          <div class="article-entry__body">
            <div class="article-entry__meta"><span>TRADING</span><span>低延迟架构</span></div>
            <h3>撮合引擎架构：确定性、分片与故障恢复</h3>
            <p>围绕交易对路由、内存状态、事件顺序和恢复流程，拆解撮合核心链路。</p>
          </div>
          <span class="article-entry__arrow" aria-hidden="true">→</span>
        </a>
        <a class="article-entry" href="/mlcy-blog/database/asset-accounting">
          <span class="article-entry__index">04</span>
          <div class="article-entry__body">
            <div class="article-entry__meta"><span>DATABASE</span><span>资金安全</span></div>
            <h3>资产账户一致性：流水、快照、幂等与对账</h3>
            <p>资金系统不是简单扣减数字，而是构建一条可以核验、补偿和审计的证据链。</p>
          </div>
          <span class="article-entry__arrow" aria-hidden="true">→</span>
        </a>
      </div>
    </section>
    <section class="topic-section" aria-labelledby="topic-directory">
      <div class="section-heading">
        <div>
          <p class="home-kicker">SYSTEM MAP</p>
          <h2 id="topic-directory">现货负责人内容地图</h2>
        </div>
      </div>
      <div class="topic-directory">
        <a href="/mlcy-blog/spot-system/order-lifecycle"><span>01</span><strong>下单链路与订单状态机</strong><small>Order Flow</small></a>
        <a href="/mlcy-blog/spot-system/account-ledger"><span>02</span><strong>账户资金与流水一致性</strong><small>Asset Safety</small></a>
        <a href="/mlcy-blog/spot-system/matching-routing"><span>03</span><strong>撮合路由与多节点治理</strong><small>Routing</small></a>
        <a href="/mlcy-blog/spot-system/symbol-launch"><span>04</span><strong>币对生命周期与上币</strong><small>Operations</small></a>
        <a href="/mlcy-blog/projects/market-data-push"><span>05</span><strong>行情事件流与推送</strong><small>Market Data</small></a>
        <a href="/mlcy-blog/projects/growth-rebate-system"><span>06</span><strong>代理增长与返佣结算</strong><small>Growth</small></a>
      </div>
    </section>
  </main>
</div>
