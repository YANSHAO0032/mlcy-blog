# 从 Java 到 Rust：后端工程师的入门路线

## Problem

习惯了 Spring、JVM 和垃圾回收之后，第一次写 Rust，容易把时间花在语法对照上：`struct` 是不是类，trait 是不是接口，`Result` 是不是异常？这些对照有助于起步，但真正影响设计的是另外几个问题：数据由谁持有，函数是否修改数据，失败如何传递，并发任务如何共享状态。

这组文章从订单校验、账户状态和消息处理出发，逐步建立 Rust 的工程思路。示例用于理解语言和并发机制，涉及交易的代码都是教学模型，不能直接充当生产撮合或账务实现。

## Explanation

### 1. 先把日常开发循环跑通

安装好 Rust 工具链后，用 Cargo 创建一个命令行项目：

```bash
cargo new order-demo --edition 2024
cd order-demo
cargo run
cargo check
cargo test
cargo fmt --check
cargo clippy -- -D warnings
```

`cargo check` 适合修改过程中的快速类型检查；`cargo run` 编译并运行；`cargo test` 执行测试。`fmt` 和 `clippy` 分别负责格式检查和静态诊断。若工具链尚未安装这两个组件，可以通过 `rustup component add rustfmt clippy` 补齐。命令的详细用途见 [Cargo 官方文档](https://doc.rust-lang.org/cargo/commands/index.html)。

本系列使用 Rust 2024 edition，要求 Rust 1.85 或更高版本。edition 是项目采用的语言兼容规则，不是“编译器版本号”；项目里的具体选择写在 `Cargo.toml` 中。参见 [Rust 2024 edition 指南](https://doc.rust-lang.org/edition-guide/rust-2024/index.html)。

### 2. 用类型表达一张简化订单

把下面代码放入 `src/main.rs`，执行 `cargo run`：

```rust
#[derive(Debug, Clone, Copy)]
enum Side {
    Buy,
    Sell,
}

#[derive(Debug)]
struct Order {
    symbol: String,
    side: Side,
    price_ticks: u64,
    quantity_lots: u64,
}

impl Order {
    fn validate(&self) -> Result<(), &'static str> {
        if self.symbol.trim().is_empty() {
            return Err("symbol must not be empty");
        }
        if self.price_ticks == 0 || self.quantity_lots == 0 {
            return Err("price and quantity must be positive");
        }
        Ok(())
    }
}

fn main() {
    let orders = [
        Order {
            symbol: String::from("BTC-USDT"),
            side: Side::Buy,
            price_ticks: 60_000,
            quantity_lots: 2,
        },
        Order {
            symbol: String::from("BTC-USDT"),
            side: Side::Sell,
            price_ticks: 60_001,
            quantity_lots: 1,
        },
    ];

    for order in &orders {
        match order.validate() {
            Ok(()) => println!("accepted: {} {:?}", order.symbol, order.side),
            Err(reason) => println!("rejected: {reason}"),
        }
    }
}
```

这里有四个值得留意的细节：

- `struct` 保存字段，`impl` 定义这个类型的方法，不需要先建立继承层次。
- `Side` 限制了可表达的方向，调用方不能随意传入一个未定义的字符串。
- `&self` 表示借用订单做检查，校验方法没有取得整张订单的所有权。
- `Result<(), E>` 的成功值是 `()`，表达“校验通过但没有额外数据”。

例子中的 `ticks` 和 `lots` 是离散单位的计数。真实系统还需要交易对精度配置、范围校验、最小名义金额和溢出处理；价格与数量直接相乘也不一定就是结算资产的最小单位数量，必须按业务精度规则换算。

### 3. 哪些 Java 经验可以迁移

| Java 中的经验 | Rust 中的对应关注点 | 需要调整的习惯 |
| --- | --- | --- |
| 类、接口与组合 | `struct`、`enum`、trait | 先表达数据和行为，再决定抽象边界 |
| 对象引用传递 | 所有权移动或引用借用 | 函数签名要说明是否接管数据 |
| `null` 与 `Optional` | `Option<T>` | 明确区分“没有值”和“操作失败” |
| 异常处理 | `Result<T, E>` 与 `?` | 让可恢复失败出现在返回类型中 |
| 线程池、锁与队列 | 线程、同步原语、异步任务 | 先确认状态归属，再选择并发工具 |

这些不是严格的一一替换。例如 Rust 的 `String` 可以增长和修改，Java 的 `String` 不可变；Rust 的共享引用也不能直接等同于 Java 的对象引用。

### 4. 没有 GC，不代表没有运行时成本

Rust 的所有权规则在编译时检查，普通资源通常随所有者释放；这让资源释放时机更容易分析。基本规则见 [The Rust Book：Ownership](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)。

不过一次请求仍可能经历堆分配、引用计数、锁竞争、系统调用和磁盘等待。大型容器的析构也可能集中消耗时间。对于订单入口或行情服务，仍要用负载测试确认吞吐、P99 延迟和内存占用，不能从语言选择直接推出性能结论。

我的建议是先迁移一个边界清楚的小工具，例如订单日志校验器或行情文件解析器。它有明确输入输出，也容易和现有 Java 实现比对。等团队熟悉错误处理、部署、监控和故障排查，再评估更关键的服务。

## 阅读顺序

1. [所有权、借用与生命周期](./ownership-and-borrowing)：理解值如何流转。
2. [Option、Result 与错误边界](./error-handling)：把失败纳入接口设计。
3. [trait、泛型与业务抽象](./traits-and-generics)：建立可替换的规则接口。
4. [Arc、Mutex 与线程间通信](./concurrency)：保护进程内共享状态。
5. [Tokio 异步任务与背压](./async-tokio)：控制异步处理的容量和生命周期。

## Key Points

- 从 Cargo 的检查、运行和测试流程开始，尽早形成反馈循环。
- 用类型表达业务约束，用函数签名表达数据访问方式。
- 性能判断需要测量，语言本身不能替代容量规划和故障恢复设计。

## Summary

Java 后端经验可以帮助你理解业务边界、并发和一致性。学习 Rust 时，再把数据归属和错误传播补进设计过程，就能逐渐写出更符合 Rust 习惯的代码。
