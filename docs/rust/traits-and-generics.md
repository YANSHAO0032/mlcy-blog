# Rust trait 与泛型：如何设计可替换的业务规则

## Problem

订单接入服务可能需要数量限制、交易对状态和账户权限等多种规则。从 Java 转向 Rust 时，很容易先寻找接口继承和依赖注入的直接替代品。但在 Rust 中，更有用的起点是：哪些行为需要被替换，具体类型是在编译时确定，还是必须在运行时组合？

trait 描述行为契约，泛型和 trait object 则提供不同的使用方式。它们可以共同服务于一个简单、可检查的业务边界。

## Explanation

### 1. trait 定义调用方需要的行为

下面的完整示例定义订单规则，并提供数量限制和交易对限制两种实现：

```rust
struct Order {
    symbol: String,
    quantity_lots: u64,
}

trait OrderRule {
    fn check(&self, order: &Order) -> Result<(), &'static str>;
}

struct MaxQuantity {
    max_lots: u64,
}

impl OrderRule for MaxQuantity {
    fn check(&self, order: &Order) -> Result<(), &'static str> {
        if order.quantity_lots == 0 || order.quantity_lots > self.max_lots {
            Err("quantity is outside the allowed range")
        } else {
            Ok(())
        }
    }
}

struct AllowedSymbol {
    symbol: String,
}

impl OrderRule for AllowedSymbol {
    fn check(&self, order: &Order) -> Result<(), &'static str> {
        if order.symbol == self.symbol {
            Ok(())
        } else {
            Err("symbol is not allowed")
        }
    }
}

fn validate<R: OrderRule>(rule: &R, order: &Order) -> Result<(), &'static str> {
    rule.check(order)
}

fn validate_all(
    rules: &[Box<dyn OrderRule>],
    order: &Order,
) -> Result<(), &'static str> {
    for rule in rules {
        rule.check(order)?;
    }
    Ok(())
}

fn main() {
    let order = Order {
        symbol: String::from("BTC-USDT"),
        quantity_lots: 2,
    };
    let limit = MaxQuantity { max_lots: 100 };
    assert!(validate(&limit, &order).is_ok());

    let rules: Vec<Box<dyn OrderRule>> = vec![
        Box::new(limit),
        Box::new(AllowedSymbol { symbol: String::from("BTC-USDT") }),
    ];
    assert!(validate_all(&rules, &order).is_ok());

    let rejected = Order { quantity_lots: 101, ..order };
    assert_eq!(
        validate_all(&rules, &rejected),
        Err("quantity is outside the allowed range")
    );
    println!("order rules passed");
}
```

`OrderRule` 不关心规则的字段布局，也不要求规则共享一个基类。两个结构体分别保存自己的配置，实现相同的方法契约即可。trait 还支持默认方法和约束组合，详见 [The Rust Book：Traits](https://doc.rust-lang.org/book/ch10-02-traits.html)。

这里用字符串表示错误，是为了把注意力放在行为抽象上。真实业务可以替换为上一篇介绍的 [错误枚举](./error-handling)。

### 2. 泛型适合具体类型已知的调用

`validate<R: OrderRule>` 中，`R` 在每次具体调用时由编译器确定。Rust 对泛型采用单态化，为使用到的具体类型生成相应代码，这为静态分发和内联优化提供了条件。参见 [The Rust Book：Generic Data Types](https://doc.rust-lang.org/book/ch10-01-syntax.html)。

静态分发并不保证所有函数都被内联，也不意味着性能一定优于其他设计。大量类型组合可能增加生成代码的体积；性能敏感路径仍要测量。

如果服务部署时只选择一种存储实现，或者一个计算函数只需要接受不同数值容器，泛型往往能清楚地表达约束，不必额外引入运行时注册机制。

### 3. trait object 适合运行时组合

`Vec<Box<dyn OrderRule>>` 可以容纳不同具体类型的规则。调用 `check` 时通过动态分发找到实现，因此可以根据配置组合规则列表。trait object 的工作方式见 [The Rust Book：Trait Objects](https://doc.rust-lang.org/book/ch18-02-trait-objects.html)。

示例中的 `Box` 负责拥有规则对象，并使不同大小的规则可以通过统一大小的指针放进 `Vec`。动态分发本身不要求所有使用场景都堆分配：借用已有对象时，也可以使用 `&dyn OrderRule`。

并非任意 trait 都能变成 trait object。比如带有某些泛型方法或返回 `Self` 的方法时，需要检查 dyn compatibility，必要时为相关方法加上 `Self: Sized` 等约束。具体规则见 [Rust Reference：Dyn compatibility](https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility)。

### 4. 根据变化方式选择抽象

| 需求 | 可以优先考虑 | 需要承担的成本 |
| --- | --- | --- |
| 类型在编译时确定，强调静态检查 | 泛型与 trait bound | 类型签名和代码体积可能增长 |
| 运行时混合多种实现 | `dyn Trait` | 动态分发及对象生命周期管理 |
| 业务种类是封闭且有限的集合 | `enum` 配合 `match` | 新增变体时要更新相关匹配 |
| 只有一个实现，近期没有替换需求 | 具体类型与普通函数 | 将来抽象时再调整接口 |

这些选择可以局部混用。例如规则容器采用动态分发，单条规则内部的计算仍使用具体类型，不需要把整个系统变成一种风格。

### 5. 规则接口要说明一致性边界

示例规则只读取订单和本地配置，结果在给定输入下可预测。如果规则读取实时账户余额，就要进一步说明：读取的是哪个版本，校验后余额是否可能变化，真正冻结资金时由什么条件保证一致性。

还应明确规则执行顺序。示例遇到第一个错误就返回，因此列表顺序会影响用户看到的拒绝原因。若需要一次收集全部错误，就要修改返回协议，而不是仅更换容器类型。

trait 可以提高可替换性，但不会自动提供配置快照、事务隔离或业务幂等。接口中不表达这些约束，换成任何语言都容易出问题。

## Key Points

- trait 关注行为契约，结构体各自管理状态。
- 泛型适合编译时确定类型；trait object 适合运行时组合不同实现。
- 有限业务状态可以直接用枚举，单一实现不必提前抽象。
- 可替换接口之外，还要说明规则顺序、配置版本和一致性边界。

## Summary

先找到业务中真正变化的部分，再选择泛型、trait object 或具体类型。这样抽象能够服务于需求，也更容易判断其性能和维护成本。下一篇进入 [Rust 线程与共享状态](./concurrency)。
