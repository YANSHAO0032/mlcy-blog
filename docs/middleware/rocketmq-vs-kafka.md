# RocketMQ 与 Kafka：架构、存储、可靠性和选型

## 1. 先说结论

RocketMQ 和 Kafka 都能做分布式消息，但产品重心不同：

- **RocketMQ** 更偏业务消息中间件，顺序、延迟、事务、重试和死信能力贴近订单与支付场景。
- **Kafka** 更偏分布式事件日志，分区吞吐、长时间保留、多下游订阅和历史回放能力突出。

交易系统不应只问“哪个吞吐更高”，而应先问：

1. 传递的是业务命令，还是已经发生的业务事实？
2. 是否需要严格顺序？
3. 是否需要延迟或事务消息？
4. 是否需要长时间保留和任意回放？
5. 下游失败时，是阻塞重试、死信处理，还是独立消费组稍后追赶？

## 2. 架构对比

| 维度 | RocketMQ | Kafka |
| --- | --- | --- |
| 路由与元数据 | NameServer 保存 Topic/Broker 路由 | KRaft Controller 管理集群元数据 |
| 存储节点 | Broker | Broker |
| 并行单位 | MessageQueue | Partition |
| 消费进度 | 按 Consumer Group 和 MessageQueue 管理 | 按 Consumer Group 和 Partition 保存 offset |
| 消费模式 | Pull 为基础，客户端可表现为 Push | Consumer 主动 poll |
| 典型定位 | 业务消息、订单、支付、延迟和事务 | 事件流、日志、行情、分析和回放 |

### RocketMQ

```text
Producer -> NameServer 查询路由 -> Broker -> Consumer Group
                                      |
                                      +-- CommitLog
                                      +-- ConsumeQueue
                                      +-- IndexFile
```

### Kafka

```text
Producer -> Partition Leader -> Follower Replicas
                                  |
                                  v
                         Consumer Group / Offset

KRaft Controller Quorum -> 元数据、Leader 选举
```

## 3. 存储模型对比

### 3.1 RocketMQ

RocketMQ 将不同 Topic 的消息统一顺序写入 CommitLog，再通过每个 Topic/MessageQueue 的 ConsumeQueue 建立逻辑索引。

优点：

- Broker 写入路径统一
- 顺序写磁盘
- MessageQueue 消费定位简单
- 支持按消息 key 建 IndexFile 查询

### 3.2 Kafka

Kafka 的每个 Partition 是独立追加日志，并切分为多个 Segment。每个 Segment 有 offset 索引和时间索引。

优点：

- Partition 天然是存储、复制和并行单位
- 按时间或空间删除旧 Segment 高效
- Consumer 可自由维护 offset
- 适合长时间保留和重放

### 3.3 核心差异

| 维度 | RocketMQ | Kafka |
| --- | --- | --- |
| 物理日志 | Broker 级共享 CommitLog | Partition 级日志 Segment |
| 消费索引 | ConsumeQueue 指向 CommitLog | Partition offset 直接定位 Segment |
| 消息查询 | IndexFile 支持按 key 查询 | 主要按 Topic/Partition/offset/时间读取 |
| 数据保留 | 以消息存储周期为主 | Retention 和 Log Compaction 能力突出 |
| 回放体验 | 可重置消费进度，但更偏业务消费 | 新建消费组或重置 offset，回放是核心能力 |

## 4. 生产端可靠性对比

### RocketMQ

关键手段：

- 同步发送并检查 `SendResult`
- 设置发送失败重试
- 发送最终失败落入 Outbox/补偿表
- 关键消息使用同步刷盘和可靠复制策略
- 为消息设置业务 key 和唯一 eventId

### Kafka

关键手段：

- `acks=all`
- `enable.idempotence=true`
- Topic 副本数通常至少为 3
- `min.insync.replicas` 与 `acks=all` 配套
- 最终投递失败进入 Outbox/补偿表

### 共同风险

两者都不能自动消除以下窗口：

```text
数据库提交成功 -> MQ 发送失败
```

也不能自动保证：

```text
MQ 发送成功 -> 数据库一定提交
```

因此关键业务仍需要 Transactional Outbox、事务消息或 CDC。

## 5. Broker 存储与副本对比

| 维度 | RocketMQ | Kafka |
| --- | --- | --- |
| 写入确认 | 受刷盘和复制方式影响 | 受 `acks`、ISR、`min.insync.replicas` 影响 |
| 副本模型 | 依部署模式采用主从、Controller 或 DLedger | Partition Leader/Follower |
| 故障切换 | 能力取决于 RocketMQ 版本和部署模式 | Controller 从合格副本中选新 Leader |
| 数据安全重点 | 刷盘 + 复制 + 自动选主 | ISR + 多副本 + `acks=all` |
| 路由高可用 | 多 NameServer | Controller Quorum |

不能用“部署了两个 Broker”代替高可用说明。必须回答：

- 两个 Broker 是否互为副本？
- Producer 成功返回前复制到几个节点？
- Leader/Master 故障后是否自动切换？
- 新节点的数据是否完整？
- 副本是否跨故障域？

## 6. 消费语义对比

### RocketMQ

Consumer 通过监听器结果告诉客户端本次消费是否成功。失败可触发稍后重试，超过次数后进入死信队列。

顺序消费失败时，可以暂停当前 MessageQueue，从而避免后续消息越过失败消息。

### Kafka

Consumer 通过 offset 表示消费进度。业务完成后提交 offset，可以实现至少一次；业务前提交则可能最多一次。

Kafka 本身没有要求应用必须采用某一种死信模型，通常由应用创建 retry Topic 和 dead-letter Topic。

### 共同结论

最实用的业务语义通常是：

```text
至少一次投递 + 幂等处理
```

MQ 层的 exactly-once 不能自动覆盖 MySQL、Redis、第三方支付、短信和链上交易。

## 7. 顺序消息对比

| 维度 | RocketMQ | Kafka |
| --- | --- | --- |
| 顺序单位 | MessageQueue | Partition |
| 路由方式 | MessageQueue Selector 或单队列 Topic | Record key 决定 Partition |
| 消费方式 | 顺序监听器锁定队列消费 | 单 Partition 内按 offset 顺序读取 |
| 队首阻塞 | 失败会阻塞该 MessageQueue | 同 Partition 失败处理不当也会阻塞进度 |
| 全局顺序 | 单 MessageQueue | 单 Partition |

交易系统常见顺序键：

- 订单状态：`orderId`
- 账户流水：`accountId`
- 撮合输入：`symbol` 或撮合分片 ID
- 提现状态：`withdrawId`

不要用全局顺序解决本来只需要局部顺序的问题。

## 8. 延迟、事务与回放

| 能力 | RocketMQ | Kafka |
| --- | --- | --- |
| 延迟消息 | 原生能力，适合业务定时触发 | 通常通过应用调度、延迟 Topic 或流处理实现 |
| 事务消息 | 原生 Half Message + 本地事务回查 | Producer Transaction，擅长 Kafka 内部读写原子性 |
| 长期回放 | 支持重置进度，但不是最突出优势 | 核心优势，可按 offset/时间回放 |
| 多下游订阅 | 多 Consumer Group | 多 Consumer Group |
| 流处理生态 | 有集成能力 | Kafka Streams、Flink 等生态成熟 |

### 选 RocketMQ 的典型理由

- 延迟关单
- 支付或订单事务消息
- 消费失败重试和死信治理
- 业务方希望使用清晰的消息状态模型

### 选 Kafka 的典型理由

- 行情和日志吞吐高
- 同一事件需要很多下游独立消费
- 要保留数天或数月并频繁回放
- 要接入实时计算、湖仓或数据平台

## 9. 端到端不丢消息

真正的“不丢”应覆盖六层。

### 9.1 业务事务层

必须确保业务状态和待发送事件不会出现双写裂缝：

```text
begin transaction
  update order
  insert outbox_event
commit
```

### 9.2 生产者层

- 同步确认或可靠异步回调
- 有界重试
- 最终失败落表
- 消息唯一 ID
- 发送结果监控

### 9.3 Broker 层

- 多副本
- 明确刷盘策略
- 明确复制确认
- 跨故障域
- 自动选主和数据截断策略可解释

### 9.4 消费者层

- 业务成功后再确认
- 业务异常不能被误判为成功
- 消费超时和服务重启允许重新投递
- 重试有上限

### 9.5 幂等层

使用数据库唯一约束兜底：

```sql
unique(event_id, consumer_group)
```

资金链路还需要唯一业务流水号和状态机条件更新。

### 9.6 补偿与对账层

任何 MQ 都可能遇到未知状态。最终可靠性来自：

- Outbox 积压扫描
- 死信告警
- 订单与撮合结果对账
- 资金流水与余额对账
- 可审计的人工补偿

如果系统没有对账和补偿，只能说“正常情况下不丢”，不能说“业务可恢复”。

## 10. 高可用对比

### 10.1 RocketMQ 高可用

需要分别保障：

- NameServer 多节点
- Broker 存储副本
- Master 故障切换
- Topic 路由刷新
- 消费进度恢复

`ex-parent` 中存在多个 NameServer 地址，但还需要结合实际 Broker 配置确认同步复制、刷盘和自动选主能力。

### 10.2 Kafka 高可用

需要分别保障：

- KRaft Controller Quorum
- Partition 多副本
- ISR 健康
- Leader 自动选举
- Consumer Group Rebalance

关键配置关系：

```text
replication.factor = 3
min.insync.replicas = 2
acks = all
```

### 10.3 CAP 取舍

网络分区时，两种 MQ 都要在“继续写入”和“拒绝可能不安全的写入”之间选择。

关键订单和资金事件通常更适合：

```text
副本不足时拒绝写入
```

而不是接受写入后承担永久丢失风险。非核心埋点则可以选择更高可用、更低确认成本的配置。

## 11. 性能与扩容

| 维度 | RocketMQ | Kafka |
| --- | --- | --- |
| 高吞吐 | 强 | 很强，尤其适合批量事件流 |
| 低延迟业务消息 | 强 | 强，但调优更偏批量吞吐 |
| 热点治理 | 拆 MessageQueue/Topic 和业务分片 | 拆 Partition/Topic 和 key |
| 消费扩容上限 | MessageQueue 数量 | Partition 数量 |
| Topic 数量治理 | 需要关注按业务拆分后的路由和元数据 | 需要关注 Partition 总量和 Controller/Broker 压力 |

性能不能只比较单条 benchmark。实际结果受以下因素影响：

- 消息大小
- 批量大小
- 压缩算法
- 副本和确认级别
- 磁盘与网络
- Topic/Partition/Queue 数量
- Consumer 下游处理速度

## 12. 结合工程的选型

### 当前工程事实

当前 checkout 中可以确认：

- 大量模块依赖 RocketMQ Client 或 RocketMQ Spring Starter
- 订单服务使用 `DefaultMQProducer`
- 订单投递失败进入重试服务
- Topic 按交易对动态创建
- 订单 Topic 采用单 MessageQueue
- WS 推送和手续费补偿使用顺序消费
- 部分环境配置多个 NameServer
- 未检索到 Kafka 客户端依赖和调用

因此，当前工程不是 RocketMQ 和 Kafka 双 MQ 并行落地，而是以 RocketMQ 为主。

### 推荐保留 RocketMQ 的链路

- 下单命令
- 撤单命令
- 撮合输入
- 手续费补偿
- 延迟关单
- 强业务语义的通知和状态推进

这些链路重视局部顺序、失败重试和业务补偿，RocketMQ 更贴近现有实现。

### 可以引入 Kafka 的链路

- 撮合成交事实的长期事件流
- 行情 tick、深度和 K 线
- 风控实时计算
- 埋点和审计
- ES、数仓、湖仓数据同步
- 需要多次回放的数据修复

引入 Kafka 不应简单替换 RocketMQ，而应明确边界：

```text
RocketMQ: 命令和业务流程推进
Kafka:    事实事件和数据流
```

## 13. 两种 MQ 共存时的治理

共存会增加复杂度，至少要统一：

- Topic 命名规范
- 事件版本
- `eventId`
- 业务 key
- Trace ID
- Schema 兼容策略
- 重试和死信规范
- 监控指标
- 数据分级和保留周期
- 生产者、消费者负责人

还要避免同一业务事实先后写入两个 MQ 形成新的双写问题。更稳妥的方式是：

```text
业务事务 -> Outbox/CDC -> 一个事实事件总线
                      -> 必要时桥接到另一种 MQ
```

## 14. 选型决策表

| 场景 | 推荐 | 原因 |
| --- | --- | --- |
| 下单、撤单、状态推进 | RocketMQ | 顺序、重试和业务消息能力直接 |
| 延迟关单 | RocketMQ | 原生延迟消息 |
| 本地事务与消息协调 | RocketMQ 或 Outbox | 事务消息适合业务状态回查 |
| 行情 tick 和深度流 | Kafka | 高吞吐、多分区、长期保留 |
| 日志、埋点、审计 | Kafka | 多下游和回放能力强 |
| 数据仓库、实时计算 | Kafka | 流处理生态成熟 |
| 瞬时 WebSocket 推送 | 两者均可 | 核心是推送状态可恢复，不以 WS 作为事实源 |
| 资金入账和返佣 | 两者均需谨慎 | 必须依赖幂等、事务、补偿和对账 |

## 15. 最终检查清单

### 选型

- 这是命令还是事实事件
- 需要局部顺序还是全局顺序
- 需要延迟、事务还是长期回放
- Consumer 数量和并行单位是否匹配

### 可靠性

- 数据库与消息是否有 Outbox/事务方案
- Producer 最终失败是否可靠落表
- Broker 副本确认是否满足 RPO
- Consumer 是否业务成功后确认
- 是否有唯一幂等键
- 是否有死信、补偿和对账

### 高可用

- 元数据节点是否多副本
- 数据副本是否跨故障域
- 故障切换是否自动
- 是否演练 Broker、网络和 Consumer 故障
- 是否监控复制延迟、消费延迟和磁盘水位

## 总结

RocketMQ 和 Kafka 的差异不是“一个快、一个慢”，而是业务模型和存储模型的侧重点不同：

```text
RocketMQ 擅长推动业务流程
Kafka 擅长沉淀和分发事件流
```

对交易系统来说，选择哪一个只是第一步。真正决定消息是否可靠的是完整链路：

```text
本地事务
+ 可靠投递
+ Broker 副本
+ 成功后确认
+ 业务幂等
+ 重试死信
+ 补偿对账
```

只有这些环节都能被监控、验证和恢复，才能说消息链路具备生产级可靠性。
