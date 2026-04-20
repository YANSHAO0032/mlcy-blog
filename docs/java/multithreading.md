# Java 多线程专题

## Problem

Java 多线程是后端系统的基础能力。无论是交易撮合、行情推送、链上区块扫描，还是异步风控和消息消费，都离不开线程、线程池、并发容器和任务编排。真正的难点不是“会创建线程”，而是理解线程生命周期、内存可见性、任务隔离、异常处理和吞吐延迟之间的取舍。

## Explanation

多线程的核心目标是提高资源利用率和系统吞吐量。Java 通过 `Thread`、`Runnable`、`Callable`、线程池、并发工具类和并发集合提供了完整的并发编程能力。

但线程不是越多越好。线程过少会导致 CPU 或 IO 资源利用不足，线程过多会带来上下文切换、内存占用、锁竞争和排队延迟。工程上更重要的是把任务拆清楚：CPU 密集型任务控制线程数，IO 密集型任务关注等待时间，交易和资金相关任务还要关注顺序性、幂等和隔离。

## 线程创建方式

Java 常见线程创建方式包括：

```java
new Thread(() -> {
    // task
}).start();
```

```java
ExecutorService executor = Executors.newFixedThreadPool(4);
executor.submit(() -> {
    // task
});
```

实际项目中不建议频繁手动 `new Thread`。更推荐使用线程池统一管理线程数量、队列、拒绝策略、线程命名和异常处理。

## 线程生命周期

Java 线程主要状态包括：

| 状态 | 含义 |
| --- | --- |
| `NEW` | 线程创建但未启动 |
| `RUNNABLE` | 可运行，可能正在执行或等待 CPU |
| `BLOCKED` | 等待获取 monitor 锁 |
| `WAITING` | 无限期等待其他线程唤醒 |
| `TIMED_WAITING` | 有超时时间的等待 |
| `TERMINATED` | 执行结束 |

排查线程问题时，线程状态非常关键。比如大量 `BLOCKED` 往往说明锁竞争严重，大量 `WAITING` 可能是线程池空闲或等待条件，大量 `TIMED_WAITING` 可能来自 sleep、定时等待、网络 IO 或连接池等待。

## Java 内存模型

多线程问题的本质通常来自三个方面：

- 原子性：一个操作是否不可分割。
- 可见性：一个线程修改的值，其他线程是否能及时看到。
- 有序性：代码执行顺序是否可能被编译器或 CPU 重排序。

`volatile` 可以保证可见性和一定程度的有序性，但不能保证复合操作的原子性。

```java
volatile int count = 0;
count++; // 不是原子操作
```

如果需要原子递增，应使用 `AtomicInteger`、`LongAdder` 或锁。

## happens-before

`happens-before` 是 Java 内存模型中判断可见性的核心规则。常见规则包括：

- 程序顺序规则：同一线程内，前面的操作 happens-before 后面的操作。
- volatile 规则：写 volatile 变量 happens-before 后续读同一个变量。
- 锁规则：解锁 happens-before 后续对同一把锁的加锁。
- 线程启动规则：`Thread.start()` happens-before 新线程中的操作。
- 线程终止规则：线程中所有操作 happens-before 其他线程检测到它结束。

理解这些规则，才能解释为什么加锁、volatile、线程启动和 join 可以解决可见性问题。

## 线程池

线程池用于复用线程，避免频繁创建和销毁线程。核心参数包括：

| 参数 | 含义 |
| --- | --- |
| `corePoolSize` | 核心线程数 |
| `maximumPoolSize` | 最大线程数 |
| `keepAliveTime` | 空闲线程存活时间 |
| `workQueue` | 任务队列 |
| `threadFactory` | 线程工厂 |
| `handler` | 拒绝策略 |

不建议直接使用 `Executors.newFixedThreadPool`、`newCachedThreadPool` 等快捷方法，因为它们可能隐藏无界队列或无限线程增长风险。更推荐显式创建 `ThreadPoolExecutor`。

```java
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    8,
    16,
    60,
    TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(1000),
    new NamedThreadFactory("market-worker"),
    new ThreadPoolExecutor.CallerRunsPolicy()
);
```

## 拒绝策略

常见拒绝策略：

- `AbortPolicy`：直接抛异常，默认策略。
- `CallerRunsPolicy`：由提交任务的线程执行，能形成反压。
- `DiscardPolicy`：直接丢弃任务。
- `DiscardOldestPolicy`：丢弃队列最老任务。

资金、订单、提现等关键任务不应该静默丢弃。行情推送、监控采样等可降级任务可以结合业务允许一定丢弃。

## ThreadLocal

`ThreadLocal` 为每个线程保存独立变量，常用于 traceId、用户上下文、数据库连接上下文等。

使用线程池时必须注意清理：

```java
try {
    CONTEXT.set(value);
    // business
} finally {
    CONTEXT.remove();
}
```

如果不清理，线程被复用后可能发生上下文污染，甚至导致内存泄漏。

## CompletableFuture

`CompletableFuture` 适合异步任务编排，例如并行查询多个配置、聚合多个外部接口结果。

```java
CompletableFuture<CoinConfig> coinFuture =
    CompletableFuture.supplyAsync(() -> loadCoinConfig(coin), executor);

CompletableFuture<RiskResult> riskFuture =
    CompletableFuture.supplyAsync(() -> checkRisk(userId), executor);

CompletableFuture.allOf(coinFuture, riskFuture).join();
```

注意事项：

- 显式指定线程池，避免使用默认公共线程池导致不可控。
- 给异步任务设置超时。
- 处理异常，避免异常被吞掉。
- 不要把强顺序资金操作拆成难以追踪的异步链。

## 并发工具类

常见工具类包括：

| 工具 | 用途 |
| --- | --- |
| `CountDownLatch` | 等待多个任务完成 |
| `CyclicBarrier` | 多线程互相等待到达屏障 |
| `Semaphore` | 控制并发许可数量 |
| `Exchanger` | 两个线程交换数据 |
| `Phaser` | 更灵活的阶段协调 |

例如提现广播可以用 `Semaphore` 控制同时调用节点 RPC 的并发数，避免把节点打满。

## 常见问题

### 线程数如何设置？

CPU 密集型任务通常接近 CPU 核数；IO 密集型任务可以适当增加线程数。经验公式：

```text
线程数 = CPU 核数 * (1 + IO 等待时间 / CPU 计算时间)
```

实际仍要结合压测、监控和业务延迟目标调整。

### 为什么不建议无界队列？

无界队列会让任务无限堆积，短期看没有拒绝，长期可能导致内存上涨、延迟失控、服务雪崩。更好的方式是设置有界队列和明确拒绝策略。

### 多线程异常如何处理？

线程池中的异常不会像主线程一样直接暴露。应在任务内部捕获并记录，或者通过 `Future.get()`、`afterExecute`、统一异常包装处理。

## Crypto 后端实践

在 crypto 系统中，多线程常用于：

- 区块扫描：按链或高度范围并行扫描，但要保证同一链状态推进有序。
- 行情推送：按交易对、频道、连接分组处理，避免热点交易对阻塞全局。
- 风控计算：多个规则并行计算，但最终决策要可追踪。
- 提现广播：控制并发和重试，避免节点 RPC 过载。
- 消息消费：按用户、订单或资产维度保证局部顺序。

关键原则是：可以并发处理，但状态变更要有顺序、幂等和补偿。

## Key Points

- 多线程提升吞吐，但也会引入可见性、原子性、有序性问题。
- 线程池要显式配置核心线程数、队列长度和拒绝策略。
- `volatile` 不等于原子性，复合操作需要原子类或锁。
- 使用线程池时必须清理 `ThreadLocal`。
- 异步任务要设置超时、处理异常、隔离线程池。
- 交易、资金、提现等核心链路不能只追求并发，还要保证状态一致。

## Summary

Java 多线程不是简单地“开更多线程”，而是对任务拆分、资源隔离、内存模型、异常处理和业务一致性的综合设计。对于 crypto 后端来说，多线程能力最终要服务于低延迟、高吞吐和资金安全。
