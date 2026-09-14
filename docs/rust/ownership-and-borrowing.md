# Rust 所有权、借用与生命周期：让数据流转更清晰

## Problem

一段订单数据要经过入口校验、风控和消息发送。Java 中通常把同一个对象引用传给多个方法；换成 Rust 后，编译器可能提示“值已经移动”或者“不能同时进行可变和不可变借用”。

理解这些提示的关键，是先区分三种需求：把数据交给下一步、临时读取数据、独占修改数据。函数参数可以直接表达这三种关系。

## Explanation

### 1. 所有权移动表达责任交接

对于 `String` 这样的非 `Copy` 类型，按值赋值或传参通常会转移所有权。调用方交出值之后，就不能继续通过原来的变量使用它。规则和内存管理背景见 [The Rust Book：Ownership](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)。

```rust
fn enqueue(payload: String) -> usize {
    // 本例只统计长度，模拟消费一个拥有所有权的消息。
    payload.len()
}

fn main() {
    let payload = String::from("order-1001");
    let bytes = enqueue(payload);
    assert_eq!(bytes, 10);

    // 取消下面的注释会报错：payload 已经移动到 enqueue。
    // println!("{payload}");
}
```

这里的 move 不等于对字符串内容做一次深拷贝，也不意味着一定要产生某种可观察的内存搬运。它首先是语言层面的归属变化，具体机器代码可以由编译器优化。

`u64`、`bool` 等实现了 `Copy` 的类型可以隐式复制；`String::clone()` 则会复制字符串内容。不要看到移动报错就加 `clone()`：如果函数只是读取数据，借用通常更符合接口意图。

### 2. 借用区分读取和修改

下面的完整例子先读取交易对，再原地规范化它，最后把所有权交给下游：

```rust
fn is_supported(symbol: &str) -> bool {
    symbol == "btc-usdt" || symbol == "BTC-USDT"
}

fn normalize(symbol: &mut str) {
    symbol.make_ascii_uppercase();
}

fn publish(symbol: String) {
    println!("publish: {symbol}");
}

fn main() {
    let mut symbol = String::from("btc-usdt");
    let view = symbol.as_str();
    assert!(is_supported(view));
    // view 的最后一次使用在上一行，共享借用可以在这里结束。

    normalize(&mut symbol);
    assert_eq!(symbol, "BTC-USDT");
    publish(symbol);
}
```

对于同一数据，存在有效使用重叠时，共享借用 `&T` 可以有多个，独占借用 `&mut T` 只能有一个，二者不能重叠。借用常常可以在最后一次使用后结束，不必一直延续到整个代码块结尾。参见 [The Rust Book：References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)。

只读字符串参数通常优先使用 `&str`，这样既可以接受字符串字面量，也可以接受 `String` 的切片。这里规范化只修改 ASCII 字节，不改变长度，因此 `&mut str` 足够；如果要追加字符、改变容量，则需要拥有字符串或借用 `&mut String`。

### 3. 生命周期标注描述引用关系

函数返回引用时，调用方需要知道：返回值借用了谁，它能使用多久？生命周期标注表达的是这种约束，并不会延长任何数据的实际存活时间。参见 [The Rust Book：Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html)。

```rust
fn choose_symbol<'a>(primary: &'a str, fallback: &'a str) -> &'a str {
    if primary.is_empty() {
        fallback
    } else {
        primary
    }
}

fn main() {
    let configured = String::from("BTC-USDT");
    let fallback = String::from("ETH-USDT");
    let selected = choose_symbol(&configured, &fallback);
    assert_eq!(selected, "BTC-USDT");
}
```

因为函数可能返回任意一个输入，结果的有效使用范围受两个输入共同约束。标注 `'a` 并不要求两个字符串同时创建或同时销毁，而是要求本次借用存在共同有效的范围。

如果数据是在函数内部临时构造的，就应该返回 `String` 等拥有所有权的值，不能返回指向局部字符串的引用。给它加上 `'static` 也修复不了这个问题。

### 4. 在订单链路中安排数据归属

| 环节 | 示例参数 | 设计意图 |
| --- | --- | --- |
| 参数校验 | `&Order` | 读取，不接管订单 |
| 填充规范化字段 | `&mut Order` | 在当前阶段独占修改 |
| 投递到处理队列 | `Order` | 将订单交给消费者持有 |
| 跨任务共享不可变配置 | `Arc<Config>` | 多个持有者共享同一份配置 |

这张表是接口设计建议，不要求所有系统采用同一套流水线。比如需要审计原始请求时，可以分别保存原始输入和规范化后的业务对象，避免修改覆盖审计证据。

还要区分内存中的所有权和业务上的处理责任。把 `Order` 移进队列，不代表消息已经落盘，也不代表消费者完成了幂等入账。后者仍依赖确认协议、持久化和业务状态机。

## Key Points

- 按值传递、共享借用和独占借用分别表达交接、读取和修改。
- 优先根据接口语义解决借用错误，再判断是否确实需要复制。
- 生命周期标注约束引用的有效范围，不会让对象活得更久。
- 所有权解决内存层面的归属问题，业务一致性需要额外设计。

## Summary

设计 Rust 接口时，先回答“谁需要继续持有这份数据”。数据流明确之后，所有权和生命周期往往会自然落在合适的位置。下一篇讨论 [如何用 Result 表达失败](./error-handling)。
