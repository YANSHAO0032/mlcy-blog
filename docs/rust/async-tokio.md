# Rust Tokio 实战：异步任务、有界队列与背压

## Problem

行情推送、订单接入和消息消费都包含大量等待。使用 `async` 可以让任务在等待 I/O 时让出执行资源，但把每个请求都直接 `spawn` 出去，并不会自动获得稳定的吞吐。下游变慢时，无限制创建任务可能让等待中的请求占满内存。

异步服务除了完成工作，还需要定义三个边界：任务由谁管理，队列能容纳多少数据，调用方在什么时刻可以认为操作成功。

## Explanation

### 1. async 函数返回 Future，运行时调度任务

调用 `async fn` 会得到一个 future；它需要被轮询才会推进。`.await` 在等待尚未就绪的结果时允许任务挂起；如果结果已经就绪，则可以继续执行。Tokio 提供运行时、任务调度和异步 I/O 等能力。参见 [Tokio：Async in depth](https://tokio.rs/tokio/tutorial/async)。

异步并发与 CPU 并行是不同问题。把耗时计算写进 `async fn`，不会让计算自动让出线程；同步阻塞调用也可能占住运行时工作线程。

### 2. 使用有界队列和单消费者处理命令

创建独立示例项目：

```bash
cargo new tokio-order-demo --edition 2024
cd tokio-order-demo
```

将 `Cargo.toml` 替换为以下内容。这里使用 Tokio 1.x API，并明确启用示例用到的功能；实际解析到的版本由 `Cargo.lock` 记录。

```toml
[package]
name = "tokio-order-demo"
version = "0.1.0"
edition = "2024"

[dependencies]
tokio = { version = "1", features = ["macros", "rt-multi-thread", "sync"] }
```

把下面代码放进 `src/main.rs`，执行 `cargo run`：

```rust
use tokio::sync::{mpsc, oneshot};

struct Command {
    quantity_lots: u64,
    reply: oneshot::Sender<Result<u64, &'static str>>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let (tx, mut rx) = mpsc::channel::<Command>(32);

    let worker = tokio::spawn(async move {
        let mut total_lots = 0_u64;
        while let Some(command) = rx.recv().await {
            let result = if command.quantity_lots == 0 {
                Err("quantity must be positive")
            } else if let Some(next) = total_lots.checked_add(command.quantity_lots) {
                total_lots = next;
                Ok(total_lots)
            } else {
                Err("quantity total overflow")
            };
            // 调用方可能已离开；回复失败不撤销已完成的内存更新。
            let _ = command.reply.send(result);
        }
        total_lots
    });

    for quantity_lots in [2, 0, 3] {
        let (reply, response) = oneshot::channel();
        tx.send(Command { quantity_lots, reply }).await?;

        // 外层错误表示回复通道关闭；内层结果表示业务成功或拒绝。
        let result = response.await?;
        if quantity_lots == 0 {
            assert_eq!(result, Err("quantity must be positive"));
        } else {
            println!("accepted total: {}", result?);
        }
    }

    drop(tx);
    assert_eq!(worker.await?, 5);
    Ok(())
}
```

这个例子只累加有效数量，没有模拟成交和资产变更。消费者独占 `total_lots`，因此不需要额外给它加锁；`oneshot` 把每个命令的处理结果返回给对应调用方。Tokio 的通道类型和这种请求回复方式见 [Tokio：Channels](https://tokio.rs/tokio/tutorial/channels)。

### 3. 背压必须传到接入边界

有界 `mpsc` 队列装满后，`send().await` 会等待容量。示例按“发送一个、等待回复”的顺序运行，用于演示协议，本身不会把容量为 32 的队列压满。

生产接入层有很多并发请求时，仅限制队列长度还不够。如果在调用 `send` 之前就无限创建任务，等待发送的任务仍然可能增长。需要将队列容量与接入并发上限、请求大小限制、排队超时配合起来。

如果业务选择队列满时立即拒绝，可以使用 `try_send`，分别处理容量已满与消费者已关闭。不能悄悄丢掉订单命令后仍向调用方返回成功。

容量也不能只按“条数看起来不多”来设置。一条行情消息的字节数、消费者处理时间和突发持续时长，都会影响实际内存与延迟。建议同时观察队列使用量、排队时间、拒绝量和消费者处理耗时。

### 4. 区分入队、处理完成和持久化

`send` 成功只说明命令已经交给通道，不表示消费者完成业务。示例等待 `oneshot` 回复，才能知道内存更新结果；即使收到这个回复，也不代表数据已经持久化。

假设调用方等待超时并放弃回复，消费者可能已经处理命令，也可能尚未处理。丢弃等待中的 future 不等于撤销远端操作。真实订单协议应有命令标识、幂等结果记录和状态查询，并明确成功确认发生在何种持久化边界之后。

例子主动忽略 `reply.send` 的错误，是为了展示“调用方离开，但处理结果已经形成”的语义。生产实现应记录相应指标，并让调用方能够查询最终结果，而不是因回复失败再次执行命令。

### 5. 锁、阻塞与任务生命周期

对于普通内存状态，如果临界区很短并且不会跨越 `.await`，同步 `Mutex` 有时已经足够；确实需要跨异步等待持锁时，可以评估 Tokio 的异步锁。即使锁允许这样使用，也要检查串行等待是否符合吞吐要求。参见 [Tokio：Shared state](https://tokio.rs/tokio/tutorial/shared-state)。

阻塞 I/O 或同步库调用可以考虑 `spawn_blocking`；CPU 密集任务还需要限制并发，或交给专用计算线程池。已开始运行的 `spawn_blocking` 工作不能靠普通任务中止机制直接停止，关闭流程必须考虑它的退出条件。参见 [Tokio：spawn_blocking](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html)。

`tokio::spawn` 要求提交的 future 满足 `Send + 'static`。这里的 `'static` 表示不能依赖短命的外部借用，并不表示任务必须永远运行。`async move` 适合把所需数据移入任务。保留并等待 `JoinHandle` 才能观察任务是否正常结束；丢弃它会让任务脱离当前等待关系，不会自动取消。参见 [Tokio：Spawning](https://tokio.rs/tokio/tutorial/spawning) 和 [JoinHandle 文档](https://docs.rs/tokio/latest/tokio/task/struct.JoinHandle.html)。

示例在最后一个发送端被丢弃后，消费者读完剩余消息并结束，再由主任务等待它。服务化以后，还需要先停止接入，协调所有发送端退出，并为剩余任务设置清理期限和失败处置方式。

## Key Points

- 异步适合协调等待，阻塞和耗时计算仍需单独安排。
- 有界队列要与接入并发限制协同，才能控制整体资源占用。
- 入队成功、处理完成和持久化完成是不同的确认阶段。
- 调用方超时不代表业务未执行，需要幂等和结果查询。
- 管理任务句柄与关闭顺序，才能观察故障并完成清理。

## Summary

稳定的 Tokio 服务需要把容量、确认和任务退出都设计进协议。先明确这些边界，再调整并发度，才能判断性能优化是否真的改善了系统。可以继续对照 [行情推送系统](../projects/market-data-push)，把这些机制映射到订阅、热点频道和慢客户端治理。
