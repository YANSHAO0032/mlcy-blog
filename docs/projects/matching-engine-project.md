# matching-engine 项目拆解：OrderBook、SkipList 与 Iceberg

## Problem

很多人写撮合引擎博客时只讲“价格优先、时间优先”，但真正落到代码里，问题会变成：

- 价格档位怎么组织？
- 同价位 FIFO 怎么维护？
- 高撤单场景怎么保证删除效率？
- Iceberg Order 怎么做隐藏数量和补量？
- 快照和恢复怎么做？
- Replay 如何保持 deterministic？

`matching-engine` 这个项目的价值，在于它把这些实现细节都设计成了比较清晰的结构。

## Explanation

### 1. Price Level：SkipList + PriceMap + FIFO

`docs/design/structure.md` 提到，队列层目前采用的是：

- `orderedPrices *structure.PooledSkiplist`
- `priceList map[udecimal.Decimal]*priceUnit`
- 每个价格档位内部再维护 intrusive linked-list FIFO

这个拆分非常典型，也很实用：

- SkipList 负责有序价格索引
- HashMap 负责按价格快速定位 price level
- 链表负责同价格下的时间优先队列

对应职责很清晰：

- `orderedPrices`：维护价格顺序
- `priceList`：维护价格档位聚合状态
- `head / tail`：维护同价位 FIFO

这比“一个大链表从头扫到尾”要专业得多，也更贴近真正撮合系统的数据组织方式。

### 2. 为什么选 SkipList

在 `structure.md` 里，作者明确给出选择 SkipList 的原因：

- 更好的删除性能
- 更低分配开销
- 有序遍历更自然
- 适合 best-price lookup 和 depth iteration

这点很重要。撮合系统里撤单往往很多，如果价格层结构不适合删除，高撤单负载会直接把性能拖下来。

项目里买盘和卖盘还做了不同排序：

- bid 使用 descending skiplist
- ask 使用 ascending ordering

这样就能让最佳买价和最佳卖价都在最容易取到的位置。

### 3. Price-Time Priority 的落地方式

价格优先、时间优先在口头上很简单，但工程上需要拆成两层：

1. 不同价格之间的优先级
2. 同价格下订单进入顺序

这个项目把这两层分开实现：

- 价格层交给 SkipList
- 时间层交给 priceUnit 的 FIFO 链表

这种分层方式有两个好处：

- 逻辑更清晰
- 可以单独优化价格层和时间层

### 4. Iceberg Order

`docs/design/iceberg.md` 是这个项目很值得学习的一部分。

它定义了：

- `Size`：总量
- `VisibleSize`：可见量上限
- `HiddenSize`：剩余隐藏量
- `VisibleLimit`：展示上限

它的运行规则很清楚：

- taker 撮合时使用完整剩余数量
- resting remainder 才拆成 visible + hidden
- visible 被吃完后，如果 hidden 还在，就触发 replenishment
- replenishment 后订单会重新挂到同价格档位尾部

这意味着补量会丢失原先时间优先级，这是符合交易语义的。项目文档还专门强调：

- replenishment uses triggering command timestamp
- 不允许用本地 wall-clock time 替代 canonical time

这和 replay 语义是完全一致的。

### 5. Snapshot / Restore

README 里展示了 `TakeSnapshot` 和 `RestoreFromSnapshot` 能力。这个设计对于撮合引擎非常关键，因为纯内存引擎如果没有快照恢复能力，进程重启就要完全依赖全量事件回放，恢复窗口会很长。

Snapshot 的工程价值：

- 启动恢复更快
- 可以定期做状态落点
- 和事件流结合后能实现“快照 + 增量 replay”
- 故障恢复和压测验证都更方便

### 6. PublishLog 和 Event Stream

项目里 `PublishLog` 的职责边界定义得也很明确：

- 引擎内部产出 canonical event
- 下游可以给这些 event 附加观测时间、落库时间、网络发布时间
- 但这些本地时间不能反向污染 replay 语义

这个边界意识很重要。否则系统做着做着就会把“业务事件”和“观测元数据”混在一起，最终很难回放，也很难审计。

## 我觉得这个项目最值得学的地方

如果从 Java 后端工程师视角看，我认为它最值得借鉴的不是语言实现，而是这几条方法论：

- 引擎状态修改必须单写者串行化
- 热路径尽量低分配、低锁竞争
- 价格层和 FIFO 层职责分离
- 事件流必须有 canonical time 和 idempotent identity
- Snapshot、Replay、Management Commands 都属于系统完整性的一部分

很多项目只做了“撮合逻辑”，但这个仓库更接近“可运行、可恢复、可审计、可扩展”的引擎骨架。

## 对 Java 体系的启发

如果用 Java 重做类似项目，可以考虑这些映射：

| matching-engine 思路 | Java 侧实现方向 |
| --- | --- |
| Single Actor | 单线程 EventLoop / Disruptor Consumer |
| RingBuffer | LMAX Disruptor / 高性能 MPSC 队列 |
| SkipList | `ConcurrentSkipListMap` 或自定义价格层结构 |
| Intrusive FIFO | 双向链表 / 对象池 / 数组索引结构 |
| Event Sourcing | 事件日志 + Snapshot + Replay |
| Deterministic Timestamp | 上游 Sequencer 分配逻辑时间 |

注意，Java 里不应该机械照搬数据结构，而应该保持架构原则一致：

- 单写者
- 顺序事件
- 显式状态机
- 快照恢复
- 日志可重放

## Key Points

- OrderBook 设计要把价格排序和同价位 FIFO 拆开。
- SkipList 非常适合价格层有序维护和 best-price 查询。
- 高撤单场景下，删除性能和分配开销是关键指标。
- Iceberg Order 的核心不是“隐藏数量”，而是 deterministic replenishment。
- Snapshot + Restore + Replay 决定引擎是否真正可运维。
- 业务事件和观测元数据必须分层，避免污染 canonical event model。

## Summary

`matching-engine` 这个项目最吸引我的地方，是它不是停留在算法题层面的“撮合逻辑”，而是把撮合系统真正需要的几个工程要素都纳入进来了：价格档位结构、FIFO、公平性、低延迟、快照恢复、事件流边界、管理命令和 deterministic replay。
