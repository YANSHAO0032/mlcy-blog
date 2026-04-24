# 行情推送系统：基于 matching-engine 的事件流设计

## Problem

很多人把“行情推送”理解成 WebSocket 广播，但真正的交易系统里，行情推送首先是一个事件建模问题，而不是前端连接问题。

如果结合 [matching-engine](https://github.com/YANSHAO0032/matching-engine) 这种撮合引擎来看，核心问题会变成：

- 撮合引擎如何把成交、挂单、撤单、管理命令变成稳定事件流？
- 行情服务如何从这些事件构建 ticker、trade、depth、kline？
- 快照查询和增量推送如何配合？
- 如何保证 replay、snapshot restore 之后行情状态仍然一致？
- 如何避免热点交易对和慢客户端拖垮整条推送链路？

## Explanation

`matching-engine` 给了一个很好的切入点：它不是直接让 WebSocket 去读撮合内存状态，而是通过 `PublishLog` 输出 canonical event，再由下游系统自己组装行情视图。

这意味着一条更合理的行情链路应该是：

```text
Sequencer / OMS
-> Matching Engine
-> PublishLog / OrderBookLog
-> 行情事件总线
-> 行情聚合服务
-> Redis / 本地缓存 / Kafka
-> WebSocket Gateway
-> 客户端
```

### 1. 行情输入不是数据库，而是撮合事件

从 `matching-engine` README 可以看到，撮合引擎会通过 `PublishLog` 发出：

- `LogTypeMatch`
- `LogTypeOpen`
- `LogTypeReject`
- `LogTypeAdmin`
- 用户扩展事件

这就意味着，行情系统最自然的输入不是订单表，不是数据库轮询，而是引擎的事件流。

这种做法有几个好处：

- 延迟更低
- 事件顺序更清晰
- replay 更自然
- 不需要频繁查询数据库
- 行情和撮合之间职责更分离

特别是成交明细和盘口变化，本质上都是撮合结果的衍生视图，直接从引擎事件生成最合适。

### 2. PublishLog 是 canonical event 出口

`docs/design/arch.md` 明确强调：

- `PublishLog` 接收 canonical engine events
- 下游可以附加本地接收时间、持久化时间、发布时间
- 但这些本地时间不能反向污染 replay 逻辑

这对行情系统非常重要。因为行情系统会天然产生很多“观测时间”：

- 引擎事件产生时间
- 行情服务消费到时间
- 推送网关下发时间
- 客户端接收时间

如果这些时间混在一起，就很难做 replay 校验，也很难判断“到底是引擎慢，还是推送慢”。所以更合理的做法是：

- 业务事件时间由引擎 canonical event 决定
- 推送延迟、网络延迟、序列化耗时作为外部 observability metadata

### 3. 快照读和增量推送必须配套

README 里还给了一个很关键的能力：

- `QueryGetDepth`
- `QueryGetStats`

这说明引擎不仅能输出事件，还能提供只读查询接口。对于行情系统，这非常适合做“快照 + 增量”的模式。

一个典型流程可以是：

1. 用户订阅 `BTC-USDT@depth`
2. 网关先从 Query 或 Redis 拿一份最新快照
3. 返回给客户端一个 snapshot
4. 再持续推送后续增量事件

这样做比“用户一连上就只吃增量”更安全，因为：

- 新连接不需要从某个历史 offset 开始追
- 客户端本地状态更容易初始化
- 出现丢包时可以重新拉快照对齐

### 4. 行情聚合层的职责

撮合引擎只负责产出 canonical event，不应该把 ticker、kline、盘口 diff、24h 统计全部塞进引擎内部。更合理的职责分层是：

#### 撮合引擎负责

- 成交事件
- 挂单/撤单事件
- 市场管理事件
- 深度查询接口
- 确定性状态与 replay 语义

#### 行情聚合服务负责

- Trade stream
- Ticker 统计
- K 线合成
- Depth snapshot / delta
- 24h 高低开收
- 成交量和成交额累计

这样引擎保持简洁，行情层也可以单独扩展和横向拆分。

### 5. Kafka 和 Redis 在行情里的位置

如果系统规模较小，`PublishLog -> 聚合服务 -> WebSocket` 直接打通就可以。

但如果要支持：

- 多个下游消费者
- 风控订阅
- 数据落库
- K 线合成
- 多个网关实例
- 历史回放

通常会在中间加 Kafka：

```text
PublishLog -> Kafka -> 行情聚合服务 / 风控 / 数据落库 / 推送网关
```

而 Redis 更适合保存：

- 最新 ticker
- 最新 depth snapshot
- 热门交易对快照
- 在线订阅关系
- 最近一次序列号或版本号

也就是说：

- Kafka 适合承接事件流
- Redis 适合承接热点状态

### 6. 热点交易对与推送隔离

行情系统里最典型的问题是热点交易对，比如：

- `BTC-USDT`
- `ETH-USDT`
- 热门 meme 币对

这些频道的订阅量和消息频率都远高于普通交易对。如果网关层没有做订阅分组和热点隔离，就容易出现：

- 一个交易对的广播阻塞其他频道
- 同样的数据被重复序列化很多次
- 单个节点 CPU 飙升

更合理的做法是：

- 按 `market + channel` 建订阅组
- 同一份 payload 序列化一次，多连接复用
- 高热点市场单独线程池或单独节点
- 对超高频 depth 做采样或限频

### 7. Depth 推送策略

盘口数据是最容易失控的部分。

常见策略有三种：

1. 全量快照推送
2. 增量 diff 推送
3. 快照 + 增量混合

如果结合 `matching-engine` 的查询和事件模型，我更推荐第三种：

- 首次连接拉 depth snapshot
- 正常情况下推 depth diff
- 达到一定间隔或发现版本不连续时重新拉快照

这样可以兼顾：

- 初始化简单
- 网络开销可控
- 客户端状态容易修复

### 8. Replay 与行情恢复

`matching-engine` 最大的一个优势是 deterministic replay。它要求相同命令流重放后，产生相同 deterministic fields 和相同 order book state。

这对行情恢复非常有价值，因为行情系统可以有两种恢复思路：

#### 方式一：从快照恢复

- 恢复最近的 Redis / 本地缓存 / 持久化快照
- 从快照之后的事件继续追平

#### 方式二：从事件回放恢复

- 重放 `OrderBookLog`
- 重新计算 trade / ticker / kline / depth

如果 canonical event 设计稳定，第二种方式是可信的。否则“行情重建”和“线上实时状态”很容易不一致。

### 9. WebSocket 网关的边界

网关层不要承担太重的业务计算。它更适合做：

- 鉴权
- 订阅关系维护
- 心跳管理
- 广播
- 限速
- 慢客户端清理

不要在网关层直接做大量行情聚合，否则：

- 横向扩容困难
- 状态难以统一
- 代码耦合严重

更理想的方式是让网关成为“已加工行情数据的分发层”。

### 10. Crypto 场景下的特殊点

Crypto 行情系统比传统业务推送更敏感，因为它通常同时服务：

- 交易终端
- 做市系统
- 风控服务
- K 线服务
- 量化策略
- 外部行情订阅方

因此除了“推给用户看”，还要考虑：

- 事件顺序
- 时间戳语义
- 多市场隔离
- 恢复能力
- 客户端版本管理
- 对撮合核心链路零侵入

## Key Points

- 行情系统最合理的输入是撮合引擎事件流，而不是数据库轮询。
- `PublishLog` 应该作为 canonical event 出口，下游再附加观测元数据。
- `QueryGetDepth` 这类只读接口非常适合做“快照 + 增量”模型。
- Kafka 适合事件分发，Redis 适合热点快照和状态缓存。
- 热门交易对要做订阅分组、序列化复用和资源隔离。
- deterministic replay 对行情恢复和历史重建非常关键。
- WebSocket 网关应聚焦分发，不要承担过重业务计算。

## Summary

结合 `matching-engine` 来看，行情推送系统的核心不只是 WebSocket 或 Kafka，而是要先建立一条清晰的“canonical event -> 行情聚合 -> 快照/增量 -> 网关广播”链路。

真正专业的行情系统，必须做到三件事：

- 对上游撮合事件语义清晰
- 对外推送链路可扩展、可隔离
- 对故障恢复和 replay 有明确策略

只有这样，行情系统才不会变成一个临时广播层，而会成为交易基础设施的一部分。
