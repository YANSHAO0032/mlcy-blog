# RocketMQ：架构、存储、可靠性与项目实践

## 1. RocketMQ 的定位

RocketMQ 是面向业务消息的分布式消息中间件。它除普通消息外，还提供顺序消息、延迟消息、事务消息、消费重试和死信队列等能力，因此经常用于：

- 订单异步投递
- 交易状态推进
- 支付结果通知
- 延迟关单
- 业务补偿
- 多服务事件广播

工程中的消息链路主要使用 RocketMQ，包括订单投递、撮合结果消费、WebSocket 推送、手续费补偿和数据上报。

## 2. 整体架构

```text
Producer
   |
   | 1. 从 NameServer 获取 Topic 路由
   | 2. 选择 Broker / MessageQueue
   v
Broker Cluster
   +-- Broker A: CommitLog + ConsumeQueue + IndexFile
   +-- Broker B: CommitLog + ConsumeQueue + IndexFile
   |
   | 主从复制或基于 Controller/DLedger 的高可用复制
   v
Consumer Group
   +-- Consumer 1
   +-- Consumer 2

NameServer Cluster
   +-- 保存 Broker 注册和 Topic 路由
   +-- 节点之间通常互不复制状态
```

### 2.1 核心角色

| 角色 | 职责 |
| --- | --- |
| NameServer | 保存 Topic 路由和 Broker 注册信息 |
| Broker | 接收、持久化和投递消息 |
| Producer | 查询路由并向 Broker 发送消息 |
| Consumer | 从 Broker 拉取并处理消息 |
| Topic | 一类消息的逻辑主题 |
| MessageQueue | Topic 在 Broker 上的逻辑队列，是并行与顺序边界 |
| Producer Group | 标识一组具有相同发送职责的生产者 |
| Consumer Group | 标识一组具有相同消费职责的消费者 |

### 2.2 NameServer 为什么可以多节点部署

Broker 会定期向所有 NameServer 注册路由，客户端从任一可用 NameServer 获取 Topic 路由。NameServer 节点通常相互独立，因此增加多个地址可以消除单点查询故障。

工程的部分环境配置使用多个 NameServer 地址，说明项目已经考虑路由服务的多节点可用性。需要注意，多 NameServer 只解决路由发现问题，不等于 Broker 存储已经具备高可用。

### 2.3 MessageQueue 与顺序

RocketMQ 的 Topic 可以包含多个 MessageQueue。多个队列可以并行消费，但顺序只在单个 MessageQueue 内成立。

```text
ORDER_TOPIC_BTCUSDT
  +-- Queue 0: order-1, order-2, order-3
  +-- Queue 1: order-4, order-5, order-6
```

严格顺序通常有两种策略：

- Topic 只创建一个 MessageQueue。
- 按 `orderId`、`accountId` 或 `symbol` 选择固定 MessageQueue。

单队列最简单，但会限制吞吐。实际设计应先确定顺序边界，而不是把整个 Topic 都做成全局顺序。

## 3. RocketMQ 如何存储消息

### 3.1 CommitLog

Broker 收到消息后，先按到达顺序追加到 CommitLog。不同 Topic 和 MessageQueue 的消息共享 CommitLog 文件。

```text
CommitLog
  offset 0: Topic A / Queue 0 / Message 1
  offset 1: Topic B / Queue 1 / Message 2
  offset 2: Topic A / Queue 0 / Message 3
```

统一顺序写的好处是减少随机 I/O，让 Broker 可以高效追加消息。

### 3.2 ConsumeQueue

Consumer 不会扫描整个 CommitLog。RocketMQ 会为每个 Topic 和 MessageQueue 建立 ConsumeQueue，保存：

- 消息在 CommitLog 中的物理偏移
- 消息长度
- Tag 哈希等过滤信息

ConsumeQueue 是逻辑消费队列，可以理解为指向 CommitLog 的稀疏索引：

```text
Topic A / Queue 0 / ConsumeQueue
  -> CommitLog offset 0
  -> CommitLog offset 2
  -> CommitLog offset 8
```

### 3.3 IndexFile

IndexFile 支持按 Message Key 或 Unique Key 查询消息。它适合运维排查和消息追踪，不应替代业务数据库索引。

关键业务消息应设置可追踪的 key，例如：

```text
orderId
tradeId
withdrawId
eventId
```

这样才能回答“某个订单的消息是否到达 Broker、是否被重试、是否进入死信”。

### 3.4 Page Cache 与文件映射

RocketMQ 同样依赖顺序写、Page Cache 和内存映射文件提升吞吐。消息写入成功返回的时机，则取决于刷盘与复制策略。

## 4. 刷盘和复制

### 4.1 异步刷盘

Broker 先将消息写入内存映射区域，再由后台线程刷入磁盘。

优点：

- 延迟低
- 吞吐高

风险：

- Broker 进程或操作系统异常时，尚未刷盘的数据可能丢失

适合允许少量数据风险，或已有多副本同步保护的非核心链路。

### 4.2 同步刷盘

Broker 等待消息刷入磁盘后再向 Producer 返回成功。

优点是单机掉电场景下更可靠，代价是延迟和磁盘压力增加。资金、订单等关键消息需要结合业务 RPO、磁盘能力和复制方式决定是否使用。

### 4.3 异步复制与同步复制

传统主从架构中：

- 异步复制：Master 写入后立即确认，Slave 后台追赶。
- 同步复制：等待 Slave 同步到要求的位置后再确认。

只配置同步刷盘而使用异步复制，Master 整机永久损坏时仍可能丢失尚未复制的数据。反过来，只做同步复制而没有合理刷盘策略，也需要评估同时故障时的风险。

### 4.4 自动故障切换

RocketMQ 不同版本和部署模式的自动切换能力不同。生产设计不能只写“主从部署”，还要明确：

- Master 故障后是否自动选主
- 选主依赖 Controller、DLedger 还是外部运维
- 客户端多久刷新路由
- 故障切换期间是否允许写入
- 是否可能发生数据截断

高可用是一整套故障演练结果，而不是 Broker 数量。

## 5. RocketMQ 如何保障消息不丢

端到端链路如下：

```text
业务数据库
  -> Producer
  -> Broker CommitLog
  -> 刷盘与复制
  -> Consumer
  -> 业务数据库
  -> 消费确认
```

### 5.1 生产端使用同步发送

同步发送可以获得明确的 `SendResult`，适合订单和资金等关键事件。

`SendMessageServiceImpl` 使用：

```java
SendResult sendResult = defaultMQProducer.send(messages);
```

这是同步发送。相比单向发送，它可以知道 Broker 是否返回成功；相比异步发送，它更容易在当前调用链中执行失败补偿。

但仍要检查 `SendStatus`，不能只以“没有抛异常”判断业务完成。

### 5.2 发送重试

多个 `RocketMQConfig` 中配置：

```java
defaultMQProducer.setRetryTimesWhenSendFailed(3);
```

它可以处理短暂网络抖动或 Broker 故障。但重试会引入两个问题：

- 发送结果不确定时可能重复。
- 所有重试都失败后仍需要业务补偿。

因此重试必须与消息唯一 ID、幂等消费和最终失败落表配套。

### 5.3 发送失败落表

订单投递失败时，`SendMessageServiceImpl` 调用：

```java
iSendOrderRetryService.saveRetryOrder(symbol, orderList);
```

`SendOrderRetryServiceImpl` 将失败订单保存下来，再调用 `sendRetryMessage` 补发。这比只记录错误日志更可靠，已经具备 Outbox/补偿表的雏形。

仍应进一步确认：

- 重试记录是否与订单写入处于同一本地事务
- 是否存在唯一业务键，避免重复插入
- 补发成功后是否可靠标记完成
- 是否有最大重试次数和人工处理状态
- 是否监控最老未发送记录的年龄

如果“订单提交”和“重试表插入”不在同一个事务中，仍然存在数据库已成功但补偿记录也没写下来的窗口。

### 5.4 Broker 端持久化

Producer 收到成功响应，只能证明 Broker 按当前刷盘和复制策略完成了确认。

要达到关键消息的低 RPO，需要组合考虑：

- 同步或异步刷盘
- 同步或异步复制
- Broker 副本数量
- 自动故障切换方式
- 跨主机、机架或可用区部署

NameServer 多节点不能替代 Broker 副本。

### 5.5 消费端成功后再返回成功状态

RocketMQ Consumer 通过监听器返回值表达消费结果。

顺序消费常见返回值：

- `ConsumeOrderlyStatus.SUCCESS`
- `ConsumeOrderlyStatus.SUSPEND_CURRENT_QUEUE_A_MOMENT`

手续费补偿消费者在下游数据暂时不可用时返回：

```java
return ConsumeOrderlyStatus.SUSPEND_CURRENT_QUEUE_A_MOMENT;
```

这会暂停当前队列并稍后重试，符合“业务未完成，不确认成功”的原则。

### 5.6 项目中一个需要警惕的模式

部分消费者在单条消息处理异常时捕获异常，最终仍返回：

```java
ConsumeOrderlyStatus.SUCCESS
```

例如 WebSocket 推送链路中，异常被记录后继续处理，监听器最后返回成功。对于“在线推送”这种允许用户重连后查询最新状态的场景，这可能是有意的可用性取舍；但如果同样模式用于资金、返佣或订单落库，就会造成业务失败而 MQ 进度已经确认。

判断标准应是：

- **可丢的派生结果**：如瞬时 WebSocket 展示，可记录指标后成功确认。
- **不可丢的业务结果**：如资金入账、返佣、订单状态，失败必须重试或进入补偿。

不能用同一种异常处理策略覆盖所有 Consumer。

### 5.7 消费幂等

RocketMQ 的可靠消费通常也是至少一次。网络异常、消费超时、服务重启和主从切换都可能导致重复投递。

交易系统应使用：

- `orderId + eventType`
- `tradeId + consumerGroup`
- `withdrawId + status`
- 独立 `eventId`

作为幂等键，并通过数据库唯一索引或条件更新保证业务结果只落一次。

## 6. 重试队列和死信队列

### 6.1 并发消费失败

并发消费失败后，Broker 会根据消费组安排重试。超过最大重试次数后，消息进入死信队列。

死信队列不是垃圾箱。必须具备：

- 告警
- 消息查询
- 失败原因记录
- 人工修复
- 安全重放
- 重放后的审计记录

### 6.2 顺序消费失败

顺序消费返回挂起状态后，当前 MessageQueue 会暂停一段时间。这样可以保持后续消息不越过失败消息，但也意味着一条毒消息可能阻塞整个队列。

因此顺序消费者要避免无限重试：

1. 记录重试次数和首失败时间。
2. 可恢复错误继续重试。
3. 数据错误或永久错误转入业务隔离表。
4. 告警并允许人工修复。
5. 修复后按原顺序谨慎重放。

## 7. 顺序消息

订单生产者配置：

```java
defaultMQProducer.setDefaultTopicQueueNums(1);
```

`RMQUtil` 创建交易对 Topic 时也将读写队列数设置为 1，并标记为顺序 Topic。消费端使用 `MessageListenerOrderly`。

这形成了：

```text
交易对 Topic
  -> 单 MessageQueue
  -> 顺序发送
  -> 顺序消费
```

优点：

- 同一交易对订单容易保持严格顺序
- 模型简单，适合撮合输入

代价：

- 单交易对吞吐受单队列限制
- 队首失败会阻塞后续消息
- Topic 数量随交易对增长
- 热门交易对无法通过增加队列直接水平扩容

如果未来需要扩容，可以考虑按账户、订单或撮合分片路由，但必须与撮合引擎的状态分片方式一致。

## 8. 延迟消息和事务消息

### 8.1 延迟消息

RocketMQ 的延迟能力适合：

- 下单后超时未成交自动撤单
- 提现审核超时提醒
- 充值确认轮询
- 失败任务退避重试

延迟消息不是精确定时器。业务应允许秒级误差，并为重复触发设计幂等。

### 8.2 事务消息

RocketMQ 事务消息用于协调本地事务和消息发送：

```text
发送 Half Message
  -> 执行本地事务
  -> Commit 或 Rollback
  -> 状态不明时 Broker 回查
```

它可以减少数据库与 MQ 的双写窗口，但仍需要：

- 本地事务状态可查询
- 回查逻辑幂等
- Consumer 幂等
- 超时和异常状态监控

如果业务已经有成熟的 Outbox 表和补偿任务，不必为了“使用事务消息”再引入一套重复机制。应根据团队运维能力选择。

## 9. RocketMQ 链路

### 9.1 Topic 命名

项目的消息协议包含：

```text
EXCHANGE_ORDER_TOPIC_<SYMBOL>
EXCHANGE_MATCHING_RESULTS_<SYMBOL>
EXCHANGE_MATCHING_TRADE_<SYMBOL>
EXCHANGE_ENTRUST_ORDER_TOPIC
```

这体现了按交易对隔离订单和撮合消息的设计。

### 9.2 动态创建 Topic

`RMQUtil.createTopicBySymbol` 在新增交易对时创建订单、撮合结果和成交 Topic，并把 Topic 分配到选定 Broker。

需要特别评估：

- Topic 是否只创建在一个 Broker 上
- 是否同时创建副本
- Broker 故障时 Topic 是否仍可写
- 新交易对发布流程是否校验 Topic 路由和读写权限

代码中存在创建整个集群 Topic 的方法，但主流程使用的是选定 Broker 创建方式。上线流程应明确这与实际 Broker 高可用部署是否匹配。

### 9.3 订单投递

`SendMessageServiceImpl`：

- 使用 Protobuf 序列化
- 按交易对构造 Topic
- 同步批量发送订单
- 失败后写入订单重试服务

Protobuf 有利于降低消息体积，但消息协议升级必须保持向后兼容。新增字段优先使用可选字段，不应复用旧字段编号。

### 9.4 撮合结果和 WebSocket 推送

`SpotConsumerService` 与 `ContractConsumerService`：

- 为每个交易对或合约创建 Consumer Group
- 使用顺序监听器
- 解析撮合结果
- 向订阅用户推送成交和订单状态

推送属于派生视图，不应成为资金和订单最终状态的唯一依据。客户端断线后，应能通过订单查询接口恢复真实状态。

### 9.5 手续费补偿

`SpotTradeFeeCompensateConsumerService` 在依赖数据暂时不可用时挂起当前队列，避免错误确认。这条链路比简单捕获异常后返回成功更适合关键业务。

仍需通过 `tradeId`、`uid`、补偿类型等唯一键保证重复消费不会重复补偿。

## 10. 高可用设计

### NameServer

- 至少部署多个独立节点
- 客户端配置多个地址
- 监控 Broker 注册和 Topic 路由

### Broker

- 明确复制和选主模式
- 副本跨故障域
- 关键消息选择合适的刷盘与复制确认
- 监控复制延迟、磁盘水位、CommitLog 写入耗时

### Producer

- 同步发送关键消息
- 检查发送状态
- 设置合理超时与重试
- 最终失败可靠落表
- 为消息设置业务 key 和 eventId

### Consumer

- 业务成功后才返回成功
- 幂等处理
- 区分可恢复错误和永久错误
- 重试和死信形成闭环
- 监控消费延迟、失败次数和最老未消费时间

## 11. 上线检查清单

- NameServer 是否多节点且地址配置一致
- Topic 是否具备预期的 Broker 分布和副本
- 单队列顺序是否会成为吞吐瓶颈
- Producer 是否检查 `SendStatus`
- 最终发送失败是否进入可靠补偿表
- 补偿表是否与业务写入处于同一本地事务
- Consumer 异常时是否错误返回成功
- 消费业务是否有数据库唯一幂等键
- 顺序队列的毒消息是否有隔离方案
- 死信队列是否有人负责和可重放
- 是否监控磁盘、复制延迟、消费延迟、失败率
- 是否做过 Broker、NameServer、Consumer 故障演练

## 总结

RocketMQ 的可靠性来自同步发送、CommitLog 持久化、刷盘复制、消费重试和死信机制，但这些能力只有与业务补偿和幂等结合才完整。

工程已经具备发送重试、失败落表、单队列顺序和消费挂起重试等基础能力。下一步最值得加强的是：

```text
确认 Broker 副本策略
+ 检查发送状态
+ 统一消息唯一 ID
+ 消费幂等
+ 区分可丢推送与不可丢业务
+ 死信和补偿监控闭环
```
