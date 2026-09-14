# Rust 并发编程：Arc、Mutex 与消息传递的边界

## Problem

多个线程同时更新账户余额，或者维护同一份行情订阅表，都会遇到共享状态问题。Rust 能在编译期拒绝许多不安全的跨线程访问，但它无法替你判断“两次合法操作组合起来是否符合业务规则”。

设计并发代码时，要分别回答两个问题：数据能否安全跨线程使用，以及一次业务操作应该保护多大的状态范围。

## Explanation

### 1. Send 和 Sync 描述跨线程能力

- `Send` 表示值的所有权可以安全地转移到另一个线程。
- `Sync` 表示共享引用可以安全地跨线程使用；严格定义是 `T: Sync` 当且仅当 `&T: Send`。

许多组合类型可以根据字段自动获得这些能力，但 `Rc<T>` 的引用计数不是线程安全的，不能直接用于跨线程共享。参见 [The Rust Book：Send and Sync](https://doc.rust-lang.org/book/ch16-04-extensible-concurrency-sync-and-send.html)。

这些约束防止的是相应的内存安全问题。锁顺序反转导致的死锁、请求重复处理、业务状态检查不完整，都可能发生在能够正常编译的程序中。

### 2. Arc 管归属，Mutex 管访问

`Arc<T>` 提供线程安全的引用计数共享所有权，但不会自动让内部的 `T` 支持任意并发修改。`Arc<RefCell<T>>` 也不能因此成为通用的线程安全容器。参见 [标准库 Arc 文档](https://doc.rust-lang.org/std/sync/struct.Arc.html)。

当多个线程需要修改同一个值时，可以用 `Arc<Mutex<T>>`。下面用同一把锁保护余额检查和扣减：

```rust
use std::sync::{Arc, Mutex};
use std::thread;

#[derive(Debug, PartialEq)]
enum DebitError {
    ZeroAmount,
    InsufficientFunds,
    StatePoisoned,
}

fn debit(balance: &Mutex<u64>, amount: u64) -> Result<(), DebitError> {
    if amount == 0 {
        return Err(DebitError::ZeroAmount);
    }
    let mut available = balance.lock().map_err(|_| DebitError::StatePoisoned)?;
    if *available < amount {
        return Err(DebitError::InsufficientFunds);
    }
    *available -= amount;
    Ok(())
}

fn main() {
    let balance = Arc::new(Mutex::new(100_u64));
    let mut handles = Vec::new();

    for _ in 0..2 {
        let shared = Arc::clone(&balance);
        handles.push(thread::spawn(move || debit(&shared, 80)));
    }

    let results: Vec<_> = handles
        .into_iter()
        .map(|handle| handle.join().expect("worker must finish without panic"))
        .collect();

    assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
    assert_eq!(
        results.iter().filter(|result| **result == Err(DebitError::InsufficientFunds)).count(),
        1
    );
    assert_eq!(*balance.lock().expect("state must not be poisoned"), 20);
    println!("one debit accepted, final balance: 20");
}
```

两个线程的先后顺序不确定，但结果必须满足：只有一次扣减成功，余额为 20。`MutexGuard` 在函数退出时释放锁；包括提前返回错误的路径。锁的行为和 poisoning 机制见 [标准库 Mutex 文档](https://doc.rust-lang.org/std/sync/struct.Mutex.html)。

这是进程内教学例子：没有账户流水、请求幂等键和持久化，进程退出后余额就消失。它验证互斥更新，不构成资金系统实现。

### 3. 检查和修改必须属于同一个临界区

一种常见错误是先加锁读取余额，释放锁，判断金额，然后重新加锁扣减。每次内存访问都有锁，程序仍可能在两次加锁之间插入其他扣减。

正确边界是把“余额足够”和“执行扣减”作为同一个不可分割的操作。对于多实例服务，进程内的锁无法协调所有实例，还需要数据库条件更新、事务、唯一键和幂等策略。可以对照博客中的 [账户资金与流水一致性](../spot-system/account-ledger) 阅读。

### 4. 不要把锁覆盖到慢操作上

如果持锁期间调用数据库或远程接口，网络抖动会变成其他线程的排队时间。应该先判断哪些状态需要在锁内修改，哪些外部动作可以在锁外执行，同时说明锁外失败后的恢复方式。

涉及两个账户时，按固定账户编号顺序获取锁，可以降低锁顺序反转造成死锁的风险，但仍要审视调用链上的所有锁。仅仅缩小代码块，不足以证明业务原子性。

标准库 `Mutex` 在某些持锁 panic 场景下会标记 poisoning，用于提示数据可能未完成更新。上面的例子选择返回错误；生产服务要依据状态不变量决定重建、隔离或人工检查，不能无条件忽略。poisoning 只是辅助提示，也不是检查所有 panic 场景的安全保证。

### 5. 消息传递让一个消费者持有状态

另一种模型是由单个线程或任务独占订单簿，其他执行单元通过 channel 发送命令。这样状态更新自然串行，容易明确单个分片内的处理顺序。

| 模型 | 适合的场景 | 重点观察 |
| --- | --- | --- |
| `Arc<Mutex<T>>` | 临界区短，共享状态规模可控 | 锁等待和持锁时间 |
| 读写锁 | 读写需要不同的互斥规则 | 写入延迟、竞争和实现的调度策略 |
| channel + 单消费者 | 状态归属明确，适合命令驱动 | 队列深度、排队延迟和消费者吞吐 |
| 原子变量 | 独立计数或经过论证的原子状态更新 | 内存序和多个字段之间的不变量 |

单消费者不是无限吞吐。热点交易对仍可能堵住队列；不同分片间也不会自动得到全局顺序。选择 channel 后，下一步就是设置容量和处理过载。

## Key Points

- `Send`、`Sync` 检查跨线程使用能力，业务竞态仍需设计和测试。
- `Arc` 共享所有权，`Mutex` 提供互斥访问，二者职责不同。
- 条件检查和状态修改必须放在同一业务原子边界内。
- 消息传递简化状态归属，同时引入容量和排队问题。

## Summary

Rust 并发设计的起点是状态归属和不变量。明确这些，再决定共享加锁还是单消费者处理，才能同时讨论正确性与吞吐。下一篇用 [Tokio 有界队列](./async-tokio) 展开异步处理。
