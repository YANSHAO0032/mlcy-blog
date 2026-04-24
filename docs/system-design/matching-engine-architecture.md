# 撮合引擎架构设计：Actor、RingBuffer 与 Event Sourcing

## Problem

撮合引擎和普通订单系统最大的区别，不是“并发更高”，而是它对延迟、顺序、一致性和可重放性的要求都更苛刻。一个真正可用的撮合引擎，必须解决这些问题：

- 如何让订单进入引擎后按确定顺序执行？
- 如何避免多线程竞争导致状态不一致？
- 如何在高吞吐下维持低延迟？
- 如何支持多交易对并行处理？
- 如何让引擎状态可回放、可审计、可恢复？

我比较喜欢 [matching-engine](https://github.com/YANSHAO0032/matching-engine) 的原因，是它不是只写了一个“能撮合”的 demo，而是围绕事件顺序、热路径、低分配、Snapshot/Restore 和 Deterministic Replay 做了比较完整的设计。

## Explanation

这个项目的核心思路可以概括成：

```text
Single Thread Actor + RingBuffer + In-Memory OrderBook + Event Sourcing
```

### 1. Single Thread Actor

项目采用单消费者 Actor 模式处理状态变更。官方 README 中明确提到：

- 通过单个固定 goroutine 处理所有状态修改
- 所有 mutation 串行进入同一条事件循环
- 避免锁竞争和上下文切换
- 保持 CPU cache locality

这个设计对撮合引擎非常重要。因为撮合本质上是一个强顺序状态机：订单簿、撮合结果、剩余数量、成交事件必须严格按输入顺序推进。相比“多个线程一起改 OrderBook”，单线程 Actor 更容易保证：

- 顺序确定
- 无锁热路径
- 无竞争状态写入
- 更容易做 replay

### 2. RingBuffer / Disruptor 模式

`matching-engine` 使用共享 RingBuffer / Disruptor 模式承接命令队列。这个模式的价值不是“看起来高级”，而是：

- 顺序写入
- 固定大小缓冲区
- 降低分配
- 减少线程间同步成本
- 让 Producer 和单消费者之间以高吞吐低延迟方式交互

对于交易场景，这种设计比“请求直接打到锁保护的共享 Map”更可控。上游只负责把命令写入 RingBuffer，下游 Actor 统一消费并修改状态。

### 3. 多市场支持

README 里还提到一个很实用的点：单个 `MatchingEngine` 实例可以管理多个 Market，例如 `BTC-USDT`、`ETH-USDT`。

这说明它不是把“单一 OrderBook”硬编码，而是把市场管理做成了一层显式抽象。再结合管理命令：

- Create
- Suspend
- Resume
- UpdateConfig

你可以看出它不仅在做撮合，还在做一个更完整的交易对生命周期控制模型。

### 4. 事件溯源与可重放

我觉得这个仓库最值得博客讲解的，不是性能词汇，而是它明确提出了事件语义边界。

在 `docs/design/arch.md` 里，它强调：

- 每个命令必须带上上游分配的 `Timestamp`
- 每个命令必须带上非空 `CommandID`
- 引擎不能用本地 `time.Now()` 生成参与 replay 的业务时间
- 重放同一命令流，必须产生相同的状态和相同的确定性日志

这其实是在定义撮合引擎的“deterministic contract”。它的意义非常大：

- 便于审计
- 便于重建状态
- 便于故障恢复
- 便于多环境验证
- 便于把引擎变成事件驱动系统中的核心状态机

如果没有这个约束，很多撮合系统虽然“能跑”，但无法可靠回放，也无法解释线上状态是怎么来的。

### 5. 管理命令也进入 canonical event path

这个项目一个很细的设计点是：不仅下单、撤单、改单是事件，市场管理命令也进入同一条 canonical event stream。

这样做的好处是：

- 市场创建和暂停也能重放
- 运维操作可审计
- 状态恢复更完整
- 多市场行为保持统一事件模型

对生产级系统来说，这是比“临时写几个管理 API”更成熟的思路。

## 为什么这种架构适合 Crypto 场景

Crypto 场景特别适合这种设计，因为交易系统通常同时具备：

- 高频下单
- 高频撤单
- 行情广播
- 账户异步记账
- 多市场并行
- 审计和回放需求

撮合链路本身最怕的就是：

- 锁竞争
- 状态竞态
- 顺序不一致
- 行为不可复现

而 `Single Thread Actor + RingBuffer + Event Sourcing` 刚好在这些问题上给出比较一致的答案。

## Key Points

- 撮合引擎首先是顺序状态机，其次才是高并发系统。
- Single Thread Actor 能显著降低锁竞争和状态不一致风险。
- RingBuffer 适合构建高吞吐、低分配的命令入口。
- 多市场管理说明项目抽象不只是单个 OrderBook。
- `CommandID + Timestamp` 是 deterministic replay 的关键前提。
- 管理命令进入 canonical event stream，能提升审计和恢复能力。

## Summary

如果把撮合引擎只理解为“买卖单撮合”，会低估它的工程复杂度。`matching-engine` 更值得学习的地方，在于它把撮合引擎当成一个可重放、可审计、强顺序、低延迟的状态机系统来设计。

对 Java 后端工程师来说，这类架构思路完全可以迁移到自己的系统中：即使用 Java 重写实现，Single Writer、事件日志、命令幂等、状态快照和回放契约依然是构建专业交易系统的核心方法论。
