# Java 锁机制专题

## Problem

多线程程序中，只要多个线程同时访问共享状态，就可能出现竞态条件。锁的作用是控制并发访问，保证临界区内的数据一致性。Java 中锁机制很多：`synchronized`、`ReentrantLock`、读写锁、StampedLock、CAS、AQS、分布式锁。真正重要的是知道它们解决什么问题，以及在什么场景下不该使用。

## Explanation

锁的本质是协调多个线程对共享资源的访问。它通常解决三个问题：

- 互斥：同一时刻只允许一个线程进入临界区。
- 可见性：释放锁前的修改，对随后获得同一把锁的线程可见。
- 有序性：锁可以建立 happens-before 关系，约束重排序。

锁不是越多越安全。锁范围过大会降低吞吐，锁顺序不一致会导致死锁，锁持有时间过长会导致延迟抖动。资金系统、订单系统和行情系统对锁的使用策略也不一样。

## synchronized

`synchronized` 是 Java 内置锁，可以修饰方法或代码块。

```java
synchronized (lock) {
    // critical section
}
```

它的特点：

- 使用简单，不需要手动释放。
- 发生异常时会自动释放锁。
- 支持可重入。
- 锁对象可以是任意对象。
- 基于 JVM monitor 实现。

常见用法：

```java
public synchronized void update() {
    // lock this
}
```

```java
public static synchronized void updateGlobal() {
    // lock Class object
}
```

注意：实例同步方法锁的是 `this`，静态同步方法锁的是 `Class` 对象。

## synchronized 锁升级

JVM 为了降低锁开销，对 `synchronized` 做了优化。常见状态包括：

```text
无锁 -> 偏向锁 -> 轻量级锁 -> 重量级锁
```

现代 JDK 中偏向锁已经逐步被移除或默认关闭，但理解锁升级仍然有助于理解 JVM 对锁竞争的优化思路。

轻量级锁适合短时间竞争，重量级锁会涉及线程阻塞和唤醒，成本更高。

## ReentrantLock

`ReentrantLock` 是显式锁，需要手动释放：

```java
Lock lock = new ReentrantLock();

lock.lock();
try {
    // critical section
} finally {
    lock.unlock();
}
```

相比 `synchronized`，它提供更多能力：

- 可中断锁等待：`lockInterruptibly`
- 尝试加锁：`tryLock`
- 超时加锁：`tryLock(timeout, unit)`
- 公平锁和非公平锁
- 多个条件队列：`Condition`

在需要超时、可中断或条件队列时，`ReentrantLock` 更灵活。

## 公平锁与非公平锁

公平锁按照等待顺序获取锁，非公平锁允许后来的线程插队。

```java
new ReentrantLock(true);  // fair
new ReentrantLock(false); // non-fair
```

公平锁能减少饥饿，但吞吐量通常更低。非公平锁吞吐更好，是默认选择。大多数业务系统不需要公平锁，除非确实有强公平性要求。

## 读写锁

`ReentrantReadWriteLock` 适合读多写少场景：

- 多个读线程可以同时持有读锁。
- 写线程持有写锁时，其他读写线程都要等待。

```java
ReadWriteLock rwLock = new ReentrantReadWriteLock();

rwLock.readLock().lock();
try {
    // read
} finally {
    rwLock.readLock().unlock();
}

rwLock.writeLock().lock();
try {
    // write
} finally {
    rwLock.writeLock().unlock();
}
```

适合配置缓存、规则快照、元数据读取等读多写少场景。不适合写多或锁粒度很小的场景，否则锁维护成本可能超过收益。

## StampedLock

`StampedLock` 提供乐观读能力，适合读多写少且允许读时校验的场景。

```java
long stamp = lock.tryOptimisticRead();
Data data = readData();
if (!lock.validate(stamp)) {
    stamp = lock.readLock();
    try {
        data = readData();
    } finally {
        lock.unlockRead(stamp);
    }
}
```

注意：`StampedLock` 不可重入，使用复杂度更高。不要为了“高级”而滥用。

## CAS 与原子类

CAS 是 Compare-And-Swap，比较并交换。它是一种乐观并发控制方式。

常见原子类：

- `AtomicInteger`
- `AtomicLong`
- `AtomicReference`
- `LongAdder`
- `AtomicStampedReference`

CAS 适合竞争不高、操作简单的场景。高竞争下，CAS 可能频繁自旋失败，浪费 CPU。

## ABA 问题

CAS 的 ABA 问题指变量从 A 变成 B，又变回 A，CAS 看到还是 A，以为没有变化。

解决方式：

- 增加版本号。
- 使用 `AtomicStampedReference`。
- 使用业务状态机避免状态回退。

在资金和订单状态流转中，版本号和状态机比单纯 CAS 更可靠。

## AQS

AQS 是 AbstractQueuedSynchronizer，是很多同步器的基础，比如：

- `ReentrantLock`
- `CountDownLatch`
- `Semaphore`
- `ReentrantReadWriteLock`

AQS 内部维护一个 state 和等待队列。获取同步状态失败的线程会进入队列等待，释放同步状态时唤醒后继节点。

理解 AQS 有助于理解 Java 锁的底层，但日常开发更重要的是正确使用上层工具类。

## 死锁

死锁通常需要同时满足四个条件：

- 互斥
- 占有且等待
- 不可抢占
- 循环等待

示例：

```java
synchronized (lockA) {
    synchronized (lockB) {
        // thread 1
    }
}

synchronized (lockB) {
    synchronized (lockA) {
        // thread 2
    }
}
```

避免死锁的方法：

- 固定加锁顺序。
- 缩小锁范围。
- 使用 `tryLock` 超时退出。
- 避免持锁时调用外部接口。
- 通过线程 dump 排查锁等待链路。

## 锁粒度

锁粒度越大，代码越简单，但并发度越低；锁粒度越小，并发度越高，但复杂度和死锁风险也更高。

例如资产账户系统可以按用户或账户维度加锁，而不是全局加锁。行情订阅可以按交易对维度加锁，而不是锁住所有订阅关系。

## 分布式锁

单 JVM 内的锁只能保护当前进程。如果多个服务实例同时处理同一资源，就需要数据库锁、Redis 锁或其他分布式协调机制。

Redis 分布式锁常见要求：

- 使用唯一 value，释放时校验 owner。
- 设置合理过期时间。
- 业务执行时间不能无界超过锁 TTL。
- 加锁失败要有明确降级或重试策略。

资金核心链路不要只依赖 Redis 锁兜底。数据库唯一索引、状态机、幂等表和事务仍然是更关键的保护。

## Crypto 后端实践

### 资产账户锁

资产扣减、冻结、解冻可以按账户维度串行化，避免同一账户并发修改余额。数据库层面还应配合乐观锁或条件更新：

```sql
update account
set available = available - ?
where account_id = ?
  and available >= ?
```

应用锁不能替代数据库条件更新。

### 提现状态机锁

提现从创建、审核、签名、广播、确认到完成，每个状态只能按合法路径推进。可以通过状态条件更新保证并发安全：

```sql
update withdraw_order
set status = 'BROADCASTING'
where id = ?
  and status = 'APPROVED'
```

### 行情订阅锁

WebSocket 订阅关系可以按 channel 分段加锁，避免一个热点交易对影响所有频道。

### 区块扫描锁

多实例部署时，同一条链的同一个扫描分片应该避免重复推进。可以使用数据库任务表、租约机制或分布式锁，但最终要靠扫描高度、交易唯一键和幂等入账兜底。

## Key Points

- `synchronized` 简单可靠，适合普通临界区。
- `ReentrantLock` 更灵活，适合超时、可中断和条件队列。
- 读写锁适合读多写少，不适合写竞争严重场景。
- CAS 适合简单原子更新，高竞争下可能自旋浪费 CPU。
- 死锁通常来自锁顺序不一致和持锁调用外部资源。
- 分布式锁不能替代幂等、唯一索引、状态机和事务。

## Summary

锁的目标不是“把代码锁住”，而是在正确的粒度上保护共享状态。Java 后端工程中，锁要和线程池、数据库事务、状态机、幂等机制一起设计。对于 crypto 系统来说，涉及资金和提现的链路必须让锁成为辅助保护，而不是唯一兜底。
