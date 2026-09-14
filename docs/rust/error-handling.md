# Rust 错误处理：用 Option 和 Result 划清失败边界

## Problem

订单数量为空、格式错误、超过限制，以及数据库暂时不可用，都是失败，但处理方式并不一样。把它们全部写成 `unwrap()`，或者全部转换成一句“系统异常”，都会让调用方失去判断依据。

Rust 的 `Option` 和 `Result` 提供了一种显式表达方式。真正的工程问题是：错误在哪一层被分类，在哪一层被记录，在哪一层决定重试。

## Explanation

### 1. 缺失和失败分别建模

| 返回类型 | 表达的含义 | 示例 |
| --- | --- | --- |
| `Option<T>` | 值可能不存在 | 本地快照中没有指定订单 |
| `Result<T, E>` | 操作可能失败 | 请求数据库失败 |
| `Result<Option<T>, E>` | 查询可能失败，也可能成功但未找到 | 按订单号查询存储 |

不存在是否属于错误，由业务决定。可选备注为空可以返回 `None`；必填数量为空，则需要在边界上把 `None` 转换为明确的校验错误。`Option` 的转换方法见 [标准库 Option 文档](https://doc.rust-lang.org/std/option/enum.Option.html)。

### 2. 一个能保留错误原因的数量解析器

下面是可以直接放进 `src/main.rs` 的完整示例，数量单位是整数 lot：

```rust
use std::{error::Error, fmt, num::ParseIntError};

#[derive(Debug)]
enum QuantityError {
    Missing,
    InvalidInteger(ParseIntError),
    Zero,
    TooLarge { max: u64 },
}

impl fmt::Display for QuantityError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Missing => write!(f, "quantity is required"),
            Self::InvalidInteger(_) => write!(f, "quantity must be a valid u64"),
            Self::Zero => write!(f, "quantity must be positive"),
            Self::TooLarge { max } => write!(f, "quantity must not exceed {max}"),
        }
    }
}

impl Error for QuantityError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::InvalidInteger(source) => Some(source),
            _ => None,
        }
    }
}

fn parse_quantity(raw: Option<&str>, max: u64) -> Result<u64, QuantityError> {
    let raw = raw.ok_or(QuantityError::Missing)?;
    let quantity = raw
        .parse::<u64>()
        .map_err(QuantityError::InvalidInteger)?;

    if quantity == 0 {
        return Err(QuantityError::Zero);
    }
    if quantity > max {
        return Err(QuantityError::TooLarge { max });
    }
    Ok(quantity)
}

fn main() {
    assert_eq!(parse_quantity(Some("12"), 100).unwrap(), 12);
    assert!(matches!(parse_quantity(None, 100), Err(QuantityError::Missing)));
    assert!(matches!(
        parse_quantity(Some("abc"), 100),
        Err(QuantityError::InvalidInteger(_))
    ));
    assert!(matches!(parse_quantity(Some("0"), 100), Err(QuantityError::Zero)));
    assert!(matches!(
        parse_quantity(Some("101"), 100),
        Err(QuantityError::TooLarge { max: 100 })
    ));
    println!("quantity validation passed");
}
```

这个例子刻意没有依赖第三方错误库，目的是看清三层信息：枚举变体用于程序分支，`Display` 提供文字说明，`source()` 保留底层解析错误。标准错误接口见 [std::error::Error](https://doc.rust-lang.org/std/error/trait.Error.html)。

解析器只接受 `u64` 能表达的整数文本；负数、小数和超出 `u64` 范围的整数都会进入解析失败分支。空字符串属于格式错误，`None` 才属于字段缺失。这样的约定要在接口文档中说清楚。

### 3. `?` 负责传播，不负责恢复

在返回 `Result` 的函数中，`?` 遇到 `Ok` 就取出成功值继续执行，遇到 `Err` 则提前返回，并在需要时通过兼容的错误转换传播出去。本例用 `map_err` 显式将解析错误归入业务错误。参见 [The Rust Book：Recoverable Errors with Result](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html)。

`?` 不会自动重试，不会撤销已经发送的网络请求，也不会替你恢复被修改的业务状态。资源离开作用域时可能触发清理逻辑，但事务回滚的具体行为由数据库驱动和事务 API 决定，需要单独确认。

### 4. 在服务边界上决定响应和重试

对于一个订单接口，可以把错误处理职责安排为：

- 领域层返回“数量无效”“余额不足”“状态不允许”等稳定的业务分类。
- 基础设施层保留超时、连接断开和存储错误等原因。
- 接口层将分类映射为公开错误码，并记录请求标识、订单标识和必要上下文。

不要让客户端依赖 `Display` 字符串做判断，它可能随文案调整而变化。错误日志也不必层层重复打印；可以在负责处理该失败的边界集中记录，并保留来源链。

重试要同时满足“失败可能恢复”和“重复执行可控”。数据库连接暂时不可用可能适合重试；订单参数非法通常不适合。请求超时尤其需要谨慎：调用方没有收到结果，不等于服务端没有执行，应先结合幂等键和结果查询处理不确定状态。

### 5. `unwrap()` 应该出现在哪里

示例在断言中使用 `unwrap()`，是因为固定输入的成功本来就是要验证的前提。如果这个前提被破坏，测试式示例应直接失败。

对于用户输入、网络返回、文件内容等外部数据，应返回或处理错误。`expect()` 可以补充 panic 信息，但不会把 panic 变成可恢复错误。启动时缺失不可替代的配置，可以选择报错退出；要把这种策略与请求处理阶段区分开。

## Key Points

- 区分值缺失、业务拒绝和基础设施故障。
- 用类型支持调用方分支，用错误来源保留诊断信息。
- `?` 简化传播；恢复、补偿和重试仍属于业务设计。
- 超时结果不确定时，先考虑幂等与查询，再决定重试。

## Summary

好的错误类型能帮助调用方选择正确动作。把错误分类放在合适的层，把恢复策略放在有足够上下文的边界，比把所有失败都转成字符串更容易维护。接下来可以阅读 [trait 与泛型](./traits-and-generics)，把规则校验抽象为明确的行为接口。
