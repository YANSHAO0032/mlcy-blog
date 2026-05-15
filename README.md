# 慕黎尘渊的博客

一个基于 VitePress 的技术博客，主线是 **Crypto 现货交易系统负责人实践**。

内容聚焦真实交易所后端工程中的核心问题：

- 现货下单链路与订单状态机
- 撮合路由与多节点治理
- 账户资金、流水、幂等与对账
- 币对生命周期、上币流程与运营后台
- 行情推送、WebSocket 与热点交易对治理
- 手续费、VIP、平台币抵扣、返佣与增长结算
- Java、Spring、MySQL、Redis、Kafka 等后端基础设施

## 阅读路径

1. [现货交易系统总览](docs/spot-system/overview.md)
2. [下单链路与订单状态机](docs/spot-system/order-lifecycle.md)
3. [账户资金与流水一致性](docs/spot-system/account-ledger.md)
4. [撮合路由与多节点治理](docs/spot-system/matching-routing.md)
5. [币对生命周期与上币流程](docs/spot-system/symbol-launch.md)
6. [代理增长与返佣结算系统](docs/projects/growth-rebate-system.md)
7. [行情推送系统](docs/projects/market-data-push.md)

## 本地运行

```bash
npm install
npm run docs:dev
```

## 构建

```bash
npm run docs:build
```
