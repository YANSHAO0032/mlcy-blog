# Kafka：架构、存储、可靠性与高可用

## 1. Kafka 解决的不是“异步调用”这么简单

Kafka 经常被归类为消息队列，但它更接近一个可水平扩展、可持久化、可重复读取的分布式提交日志。

生产者不会把消息直接交给某个消费者，而是把记录追加到 Topic 的 Partition 中。消费者通过维护 offset 决定自己读到了哪里。同一份消息可以被多个 Consumer Group 独立消费，也可以在保留期内重新回放。

这使 Kafka 特别适合：

- 成交事件、行情事件和账户流水等高吞吐事件流
- 日志、埋点、审计和数据同步
- 多个下游独立订阅同一份业务事实
- 故障恢复后的历史回放和数据重算

但它并不会自动解决数据库与消息的一致性，也不会自动保证业务只执行一次。

## 2. 整体架构

```text
Producer
   |
   | 根据 key 选择 Partition
   v
Kafka Cluster
   +-- Broker 1: Partition 0 Leader, Partition 1 Follower
   +-- Broker 2: Partition 1 Leader, Partition 2 Follower
   +-- Broker 3: Partition 2 Leader, Partition 0 Follower
   |
   +-- KRaft Controller Quorum: 元数据管理和 Leader 选举
   |
   v
Consumer Group
   +-- Consumer A: Partition 0
   +-- Consumer B: Partition 1
   +-- Consumer C: Partition 2
```

### 2.1 核心角色

| 角色 | 职责 |
| --- | --- |
| Producer | 选择 Topic/Partition，批量发送消息 |
| Broker | 保存 Partition 日志并处理读写请求 |
| Topic | 一类消息的逻辑集合 |
| Partition | Topic 的物理分片，是并行和局部顺序的基本单位 |
| Replica | Partition 的副本，用于容灾 |
| Leader Replica | 处理该 Partition 的生产和消费请求 |
| Follower Replica | 从 Leader 拉取并复制日志 |
| Controller | 管理集群元数据、Broker 状态和 Partition Leader 选举 |
| Consumer Group | 一组协同消费 Topic 的消费者 |
| Offset | 消费者在某个 Partition 上的读取位置 |

现代 Kafka 集群通常使用 KRaft Controller Quorum 管理元数据。旧集群可能仍使用 ZooKeeper，但应用层的 Partition、Replica、Consumer Group 等核心模型没有因此改变。

### 2.2 Partition 为什么是 Kafka 的核心

一个 Topic 可以拆成多个 Partition：

```text
trade-events
  +-- Partition 0: BTCUSDT 相关事件
  +-- Partition 1: ETHUSDT 相关事件
  +-- Partition 2: 其他交易对事件
```

Partition 同时决定三件事：

1. **吞吐能力**：不同 Partition 可落在不同 Broker 上并行读写。
2. **消费并行度**：同一 Consumer Group 内，一个 Partition 同一时刻最多分配给一个 Consumer。
3. **顺序边界**：Kafka 只保证单 Partition 内有序，不保证 Topic 全局有序。

如果 Topic 有 12 个 Partition，而消费组有 20 个 Consumer，那么至少 8 个 Consumer 没有 Partition 可消费。增加消费者之前，必须先确认 Partition 数量和热点分布。

### 2.3 Consumer Group 的语义

同一个 Consumer Group 内，消息只会交给组内某一个消费者处理；不同 Consumer Group 则会各自收到一份。

例如成交事件可以被三个组独立消费：

```text
trade-events
  +-- market-data-group  -> 生成 K 线和最新价
  +-- risk-group         -> 风控统计
  +-- audit-group        -> 审计和离线分析
```

因此：

- 想扩容同一种业务，增加同组 Consumer。
- 想新增一种业务订阅，创建新的 Consumer Group。
- 不要让两个职责不同的应用错误地共用 group.id，否则它们会分摊消息而不是各收一份。

## 3. Kafka 如何存储消息

### 3.1 Partition 是追加日志

每个 Partition 在磁盘上是一条只追加的有序日志。消息写入后获得单调递增的 offset：

```text
offset:  100  101  102  103  104
record:   A    B    C    D    E
```

Kafka 不会因为某个消费者读完就立即删除消息。消息是否保留由 Topic 的 retention 或 compaction 策略决定，因此多个消费组可以按照自己的速度读取。

### 3.2 Segment 文件

Partition 日志不会保存在一个无限增长的大文件中，而会切分成多个 Segment。一个 Segment 通常包含：

- `.log`：消息记录
- `.index`：相对 offset 到物理位置的稀疏索引
- `.timeindex`：时间戳到 offset 的索引

读取某个 offset 时，Kafka 先定位 Segment，再通过稀疏索引缩小范围，最后顺序扫描少量数据。

Segment 化带来几个好处：

- 删除过期数据时可以直接删除整个旧 Segment
- 文件大小可控
- 索引不需要覆盖每一条消息
- 顺序追加和批量读取更高效

### 3.3 Page Cache、批量和零拷贝

Kafka 的高吞吐并不意味着“磁盘比内存快”，而是充分利用了操作系统能力：

- Producer 将多条消息合并成 Batch
- Broker 顺序追加日志
- 热数据停留在操作系统 Page Cache
- Consumer 批量拉取数据
- 文件内容可通过高效的内核数据传输路径发送到网络

吞吐优化通常来自批量、压缩和并行，而不是盲目增加线程。

### 3.4 Retention 与 Log Compaction

Kafka 有两类常见保留策略。

#### 按时间或空间保留

旧 Segment 在超过保留时间或总大小后被删除。适合：

- 行情事件
- 行为日志
- 审计流水
- 可在有限时间内回放的业务事件

#### Log Compaction

对相同 key，只保留较新的值，适合保存“某个 key 的最新状态变化历史”：

```text
user-1 -> level-1
user-2 -> level-2
user-1 -> level-3
```

压缩后会保留 `user-1 -> level-3` 和 `user-2 -> level-2`。Compaction 不是立即发生，也不能替代数据库事务。

## 4. Kafka 如何保证消息不丢

消息可靠性必须分生产端、Broker 和消费端讨论。

```text
业务事务
  -> Producer 投递
  -> Leader 落日志
  -> Follower 复制
  -> Consumer 拉取
  -> 业务处理
  -> 提交 offset
```

任何一段处理错误，都可能造成丢失、重复或乱序。

### 4.1 生产端：确认级别

`acks` 决定 Producer 需要等待什么级别的确认。

| 配置 | 含义 | 风险 |
| --- | --- | --- |
| `acks=0` | 不等待 Broker 响应 | 网络或 Broker 故障时可能直接丢失 |
| `acks=1` | Leader 写入本地日志后确认 | Leader 确认后、Follower 同步前故障可能丢失 |
| `acks=all` | 等待 ISR 中满足要求的副本确认 | 延迟略高，可靠性最好 |

关键事件通常使用：

```properties
acks=all
enable.idempotence=true
```

还需要配合 Broker/Topic 的：

```properties
min.insync.replicas=2
```

如果副本因故障只剩一个 ISR，Broker 应拒绝关键写入，而不是以降低可靠性为代价继续接受消息。

### 4.2 幂等生产者

网络超时时，Producer 无法判断消息到底没写入，还是已经写入但响应丢失。直接重试可能产生重复消息。

启用幂等生产后，Kafka 使用 Producer ID 和序列号识别同一生产会话中的重复批次，降低重试造成的重复写入。

需要注意：

- 幂等生产解决的是 Producer 到 Kafka 的重复写入。
- 它不等于业务端到端 exactly-once。
- 应用重启、跨 Topic 事务、数据库写入仍需要单独设计。

### 4.3 重试与超时

可靠生产者通常需要综合配置：

```properties
acks=all
enable.idempotence=true
delivery.timeout.ms=120000
request.timeout.ms=30000
retry.backoff.ms=100
```

不能只看 `retries`。如果总投递超时太短，Producer 仍可能在集群短暂抖动时过早失败；如果超时太长而业务没有隔离，又会拖慢请求线程。

对关键链路，发送最终失败后应写入 Outbox 或发送补偿表，并报警，而不是只记录日志。

### 4.4 Broker：副本和 ISR

每个 Partition 有一个 Leader 和若干 Follower。Follower 持续从 Leader 复制日志。与 Leader 保持同步的副本集合称为 ISR。

当 Leader 故障：

1. Controller 检测到 Broker 不可用。
2. 从合格副本中选出新的 Leader。
3. Producer 和 Consumer 刷新元数据。
4. 请求转移到新 Leader。

关键 Topic 常见思路是：

```text
replication.factor = 3
min.insync.replicas = 2
producer acks = all
```

三者需要配套。仅设置三个副本但 Producer 使用 `acks=1`，仍然可能在复制完成前丢消息。

### 4.5 消费端：业务成功后再提交 offset

最危险的消费流程是：

```text
先提交 offset -> 再处理业务
```

如果 offset 已提交而服务随后崩溃，该消息不会再次投递，业务结果就丢失了。

关键业务更适合：

```text
拉取消息
  -> 执行业务事务
  -> 事务提交成功
  -> 提交 offset
```

如果业务成功但 offset 提交失败，消息会再次消费。因此工程上通常选择：

```text
At least once + 消费端幂等
```

### 4.6 消费幂等

幂等键应来自稳定的业务标识，而不是本次消费线程生成的随机 UUID。

常见方案：

- 数据库唯一键：`event_id`、`order_id + event_type`
- 状态机条件更新：只允许合法的状态迁移
- 幂等记录表：先插入消费记录，唯一键冲突则跳过
- 账务流水唯一号：一笔业务事件只能生成一条资金流水

示例：

```sql
insert into consumed_event(event_id, consumer_group, created_at)
values (?, ?, now());
```

`event_id + consumer_group` 建立唯一索引，并与业务更新放在同一个数据库事务中。

### 4.7 数据库与 Kafka 的一致性

下面的代码存在双写窗口：

```text
数据库提交成功
Kafka 发送失败
```

反过来也有问题：

```text
Kafka 发送成功
数据库事务回滚
```

通用方案是 Transactional Outbox：

```text
本地数据库事务
  +-- 更新订单
  +-- 插入 outbox_event

后台投递任务
  +-- 扫描待发送事件
  +-- 发送 Kafka
  +-- 标记发送成功
```

它允许重复投递，因此下游仍需幂等。对于数据同步场景，也可以使用 CDC 读取数据库日志并发布事件。

## 5. 高可用不只是副本数

### 5.1 Controller 高可用

KRaft 使用 Controller Quorum 管理元数据。生产集群应使用奇数个 Controller 节点形成多数派，避免单 Controller 成为故障点。

### 5.2 Broker 和机架隔离

副本应尽量跨主机、机架或可用区部署。三个副本都在同一物理机或同一故障域，副本数再多也无法抵御整机或机房故障。

### 5.3 不洁净 Leader 选举

如果允许落后副本成为 Leader，集群可能快速恢复服务，但会截断尚未复制到该副本的数据。关键交易 Topic 通常更重视一致性，不应通过选举落后副本来换取可用性。

### 5.4 Consumer Rebalance

消费者加入、离开，Partition 数量变化或订阅变化时，会触发分区重新分配。

Rebalance 期间可能暂停消费，长时间业务处理还可能被误判为 Consumer 失活。治理重点包括：

- 单次 poll 后不要处理无限量数据
- 合理配置 `max.poll.interval.ms`
- 控制 `max.poll.records`
- 将慢 I/O 与消费线程隔离，但要维持正确的 offset 提交顺序
- 使用幂等处理承受 Rebalance 带来的重复消费

## 6. 顺序、堆积和回放

### 6.1 顺序消息

需要同一业务实体有序时，应使用稳定 key：

```text
订单事件: key = orderId
账户事件: key = accountId
交易对行情: key = symbol
```

不能同时要求“全 Topic 严格有序”和“高分区并行”。全局顺序通常意味着单 Partition，也意味着吞吐和容灾恢复速度受限。

### 6.2 消息堆积

Kafka 的核心监控指标是 Consumer Lag：

```text
Lag = Log End Offset - Consumer Committed Offset
```

排查顺序：

1. 看是所有 Partition 堆积还是单个热点 Partition。
2. 看 Consumer 是否频繁 Rebalance 或异常退出。
3. 看数据库、RPC、Redis 等下游依赖是否变慢。
4. 看单条消息处理时间和批量大小。
5. 确认 Consumer 数量是否已达到 Partition 上限。

扩容 Consumer 无法解决单热点 Partition。此时需要重新设计 key、拆 Topic，或把热点业务独立分流。

### 6.3 回放

Kafka 可以通过重置 offset 或创建新 Consumer Group 回放历史消息。

回放前必须确认：

- 业务写入是否幂等
- 是否会重复发短信、发币、返佣或推送
- 回放范围和时间窗口
- 是否与实时消费使用隔离的 group
- 是否需要限速，避免压垮数据库

对于资金和返佣业务，回放通常应先进入影子表或补偿流程，而不是直接重做不可逆操作。

## 7. Kafka 事务和 Exactly Once

Kafka 事务可以让一个 Producer 对多个 Partition 的写入原子提交，并可与消费位点提交组合成“读取 Kafka、处理、再写回 Kafka”的 exactly-once 流程。

但它不能自动覆盖外部数据库：

```text
Kafka transaction != MySQL transaction
```

如果消费 Kafka 后要更新 MySQL，仍然需要幂等、Outbox、补偿或专门的分布式一致性设计。

工程上不要把“启用了 Kafka 事务”直接写成“整个业务严格一次”。

## 8. 交易系统中的使用建议

### 适合 Kafka 的链路

- 撮合成交事实的多下游分发
- 行情 tick、深度增量、K 线计算
- 风控事件流和实时计算
- 日志、埋点、审计
- 数据仓库和搜索索引同步
- 需要长时间保留和回放的事件

### 需要谨慎的链路

- 下单命令
- 资金扣减命令
- 提现执行命令
- 不允许重复执行的外部支付操作

这些链路不是不能用 Kafka，而是必须先设计好业务状态机、幂等键、数据库事务和补偿闭环。

## 9. 与 `ex-parent` 的关系

对当前 `D:\java_workspace\ex-parent\ex-parent` checkout 进行检索，没有发现 `spring-kafka`、`kafka-clients`、`KafkaTemplate`、`@KafkaListener` 或 `bootstrap.servers` 等实际接入代码。

因此本文中的 Kafka 内容是交易系统可采用的架构方案，不代表该工程当前已使用 Kafka。该工程中能确认的消息主链路使用 RocketMQ，具体见：

- [RocketMQ：架构、存储、可靠性与项目实践](./rocketmq.md)
- [RocketMQ 与 Kafka：交易系统中的对比与选型](./rocketmq-vs-kafka.md)

## 10. 上线检查清单

### Producer

- `acks=all`
- 启用幂等生产
- 关键 Topic 设置足够的投递超时
- 发送最终失败进入 Outbox/补偿表并报警
- key 能表达顺序边界

### Broker

- 副本跨故障域部署
- `replication.factor` 与 `min.insync.replicas` 配套
- 监控 ISR 缩减、离线 Partition、磁盘水位
- retention 满足回放和合规要求
- 关键 Topic 不用不洁净选举换可用性

### Consumer

- 关闭关键链路的自动提交
- 业务成功后提交 offset
- 使用稳定业务 ID 幂等
- 重试有上限，失败进入隔离 Topic
- 监控 Lag、消费耗时和 Rebalance

## 总结

Kafka 的优势来自 Partition 并行、追加日志、批量传输、副本复制和可回放消费。它能提供高吞吐和强大的事件流能力，但“消息不丢”需要生产确认、副本策略、消费提交、业务幂等和数据库一致性共同完成。

在交易系统里，最稳妥的目标通常不是幻想所有链路天然 exactly-once，而是建立一套可证明、可重试、可对账的：

```text
至少一次投递 + 幂等处理 + 可观测补偿
```
