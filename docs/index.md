---
layout: home

hero:
  name: Crypto 现货交易系统负责人实践
  text: 从下单、撮合、资金到账户、行情、风控与运营增长
  tagline: 以真实交易所后端工程为背景，沉淀现货业务负责人需要掌握的系统边界、工程决策、故障治理和增长结算能力。
  image:
    src: /logo.png
    alt: 慕黎尘渊的博客
  actions:
    - theme: brand
      text: 现货系统地图
      link: /spot-system/overview
    - theme: alt
      text: 账户资金一致性
      link: /spot-system/account-ledger

features:
  - title: Spot Trading
    details: 下单校验、订单状态机、撮合路由、币对生命周期、盘口与成交事件。
  - title: Asset & Risk
    details: 账户锁定、资金流水、手续费、幂等、对账、补偿、风控限额与白名单。
  - title: Operation Growth
    details: 上币配置、运营后台、VIP 费率、平台币抵扣、代理返佣、统计报表与反作弊。
---

## 现货负责人内容地图

<div class="grid-cards">
  <div class="grid-card">
    <h3><a href="/mlcy-blog/spot-system/overview">现货交易系统总览</a></h3>
    <p>把接入、订单、撮合、资金、行情、风控、运营和对账拆成负责人可治理的业务边界。</p>
  </div>
  <div class="grid-card">
    <h3><a href="/mlcy-blog/spot-system/order-lifecycle">下单链路与订单状态机</a></h3>
    <p>从用户请求进入系统开始，梳理参数校验、交易权限、价格保护、资金冻结、落库和撮合投递。</p>
  </div>
  <div class="grid-card">
    <h3><a href="/mlcy-blog/spot-system/account-ledger">账户资金与流水一致性</a></h3>
    <p>资金系统不是扣数字，而是围绕账户锁、交易流水、历史快照、幂等和对账构建可信证据链。</p>
  </div>
  <div class="grid-card">
    <h3><a href="/mlcy-blog/spot-system/matching-routing">撮合路由与多节点治理</a></h3>
    <p>交易对如何绑定撮合集群，订单如何路由到确定节点，查询和撤单为什么也要走同一套路由语义。</p>
  </div>
  <div class="grid-card">
    <h3><a href="/mlcy-blog/spot-system/symbol-launch">币对生命周期与上币流程</a></h3>
    <p>上币不是新增一条配置，而是币种、账户、费率、白名单、行情、撮合、运营后台和风控的联动发布。</p>
  </div>
  <div class="grid-card">
    <h3><a href="/mlcy-blog/projects/growth-rebate-system">代理增长与返佣结算</a></h3>
    <p>从交易结果事件出发，拆解邀请关系、返佣明细、汇总统计、后台配置和防作弊治理。</p>
  </div>
</div>

## 推荐阅读路径

1. 先读 [现货交易系统总览](/spot-system/overview)，建立业务边界。
2. 再读 [下单链路与订单状态机](/spot-system/order-lifecycle)，理解主链路。
3. 接着读 [账户资金与流水一致性](/spot-system/account-ledger)，守住资损底线。
4. 然后读 [撮合路由与多节点治理](/spot-system/matching-routing)，理解低延迟链路。
5. 最后读 [币对生命周期与上币流程](/spot-system/symbol-launch) 和 [代理增长与返佣结算](/projects/growth-rebate-system)，补齐运营负责人视角。

## 技术支撑体系

<div class="grid-cards">
  <div class="grid-card">
    <h3>交易系统</h3>
    <p>订单编排、撮合引擎、行情推送、事件流、故障恢复、审计和回放。</p>
  </div>
  <div class="grid-card">
    <h3>资金与数据</h3>
    <p>MySQL 事务、锁与 MVCC、资金流水、账户快照、SQL 优化、Redis 热点状态。</p>
  </div>
  <div class="grid-card">
    <h3>Java 工程</h3>
    <p>Spring 事务边界、事件驱动、并发控制、JVM 调优、Kafka 消息和 WebSocket 推送。</p>
  </div>
</div>
