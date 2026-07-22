# 消息队列文章扩展设计

## 目标

基于 `ex-parent` 工程中实际使用的 RocketMQ 代码，扩展博客的消息队列内容，并补齐 Kafka 的架构、存储、可靠性、高可用和交易系统选型知识。

## 文章结构

### Kafka 专文

`docs/middleware/kafka.md` 负责解释 Kafka 的日志型存储模型、分区和副本、生产与消费可靠性、KRaft 高可用、回放能力，以及交易和行情事件流中的使用方式。

当前 `ex-parent` checkout 未检索到 Kafka 客户端依赖、配置或调用，因此文章不会把 Kafka 描述为该工程的已落地实现。

### RocketMQ 专文

`docs/middleware/rocketmq.md` 负责解释 NameServer、Broker、Topic、MessageQueue、CommitLog、ConsumeQueue、IndexFile、刷盘、主从复制、顺序消费、重试和死信机制。

文章使用 `ex-parent` 中的以下实现作为案例：

- `DefaultMQProducer` 与同步发送
- 发送失败重试三次
- 发送失败写入重试表
- 按交易对创建 Topic
- 每个交易对使用单队列保持顺序
- `MessageListenerOrderly`
- 消费失败返回 `SUSPEND_CURRENT_QUEUE_A_MOMENT`
- 撮合成交、订单归集、WebSocket 推送和手续费补偿

### 对比与选型专文

`docs/middleware/rocketmq-vs-kafka.md` 负责从架构、存储、消费模型、可靠性、高可用、顺序、回放、延迟消息、事务消息和运维成本方面进行对比。

文章最终给出交易系统中的选型建议：

- 核心业务命令、订单状态推进、延迟任务和事务消息优先考虑 RocketMQ。
- 行情、日志、审计、埋点和可重放事件流优先考虑 Kafka。
- 同一系统可以按职责组合使用，但需要统一消息协议、消息 ID、监控和幂等规范。

## 可靠性模型

三篇文章统一采用端到端可靠性模型：

1. 数据库事务是否成功。
2. 生产端是否可靠投递。
3. Broker 是否持久化并复制。
4. 消费端是否在业务成功后确认进度。
5. 业务处理是否幂等。
6. 重试、死信、补偿和对账是否闭环。

文章明确说明：Broker 不丢消息不等于业务结果不丢，`send()` 成功也不等于数据库与 MQ 已实现原子一致。

## 导航和验证

VitePress Middleware 侧边栏新增 RocketMQ 专文和 RocketMQ/Kafka 对比入口。修改完成后运行 `npm run docs:build`，检查 Markdown、内部链接和 VitePress 配置。
