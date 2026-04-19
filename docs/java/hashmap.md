# HashMap 与 ConcurrentHashMap 专题

## Problem

`HashMap` 和 `ConcurrentHashMap` 是 Java 后端开发中使用频率最高的两个 Map 实现。它们看起来都是 key-value 容器，但底层结构、扩容方式、并发语义和工程使用边界完全不同。

面试和实际开发中常见问题包括：

- `HashMap` 为什么查询快？
- `HashMap` 的 put 和 get 过程是什么？
- 为什么容量必须是 2 的幂？
- 什么时候扩容？扩容时元素如何迁移？
- JDK 8 为什么引入红黑树？
- `HashMap` 为什么线程不安全？
- `ConcurrentHashMap` 如何保证并发安全？
- `ConcurrentHashMap` 的 `size` 为什么不一定是强一致？
- `computeIfAbsent` 有哪些使用细节？

## HashMap 核心结构

JDK 8 之后，`HashMap` 的核心结构是：

```text
数组 table + 链表 Node + 红黑树 TreeNode
```

数组负责定位桶位，链表负责处理哈希冲突，红黑树负责优化极端冲突下的查询性能。

简化结构可以理解为：

```java
transient Node<K,V>[] table;
transient int size;
int threshold;
final float loadFactor;
```

每个节点大致包含：

```java
static class Node<K,V> {
    final int hash;
    final K key;
    V value;
    Node<K,V> next;
}
```

关键字段含义：

| 字段 | 含义 |
| --- | --- |
| `table` | 存储桶数组 |
| `size` | 当前键值对数量 |
| `loadFactor` | 负载因子，默认 `0.75` |
| `threshold` | 扩容阈值，通常是 `capacity * loadFactor` |
| `modCount` | 结构修改次数，用于 fail-fast |

## HashMap 的哈希计算

`HashMap` 并不是直接使用 `key.hashCode()` 定位数组下标，而是先做扰动：

```java
hash = h ^ (h >>> 16)
```

这样做的目的是让高 16 位也参与低位运算。因为数组下标计算通常是：

```java
index = (n - 1) & hash
```

当数组长度 `n` 比较小时，只会用到 hash 的低位。如果低位分布不好，就容易发生大量冲突。扰动函数可以让高位信息混入低位，降低冲突概率。

## 为什么容量是 2 的幂

当容量是 2 的幂时，`hash % n` 可以优化成：

```java
(n - 1) & hash
```

位运算比取模更快，而且当 `n` 是 2 的幂时，`n - 1` 的二进制低位全是 `1`，可以更均匀地保留 hash 的低位信息。

例如容量是 `16`：

```text
n     = 10000
n - 1 = 01111
```

通过 `hash & 01111` 就能得到 `0 ~ 15` 的数组下标。

## put 流程

`HashMap.put(k, v)` 的核心流程可以概括为：

1. 如果 table 为空，先初始化数组。
2. 计算 key 的 hash。
3. 通过 `(n - 1) & hash` 定位桶位。
4. 如果桶位为空，直接放入新节点。
5. 如果桶位不为空，比较 hash 和 key。
6. 如果 key 已存在，覆盖 value。
7. 如果是链表，追加到链表尾部。
8. 如果是红黑树，按树节点插入。
9. 插入后 size 增加，如果超过阈值则扩容。
10. 链表长度达到树化阈值时尝试树化。

注意：JDK 8 的链表插入采用尾插法，JDK 7 是头插法。头插法在并发扩容时更容易出现链表环问题。

## get 流程

`HashMap.get(k)` 的核心流程：

1. 计算 key 的 hash。
2. 定位桶位 `(n - 1) & hash`。
3. 先比较桶位第一个节点。
4. 如果第一个节点不是目标 key，再遍历链表或红黑树。
5. 找到返回 value，找不到返回 `null`。

因此 `HashMap` 平均查询复杂度接近 `O(1)`，但在大量冲突且未树化时会退化为 `O(n)`。树化后最坏情况可以降到 `O(log n)`。

## 扩容机制

扩容触发条件：

```text
size > threshold
```

默认容量是 `16`，默认负载因子是 `0.75`，所以默认阈值是：

```text
16 * 0.75 = 12
```

当第 13 个元素插入时，会触发扩容。每次扩容容量通常变为原来的 2 倍。

JDK 8 的扩容迁移有一个重要优化：元素新位置只可能是原位置或原位置 + oldCap。

原因是容量翻倍后，参与下标计算的二进制位只多了一位：

```text
old index = hash & (oldCap - 1)
new index = hash & (newCap - 1)
```

如果 `hash & oldCap == 0`，元素仍在原位置；否则移动到 `oldIndex + oldCap`。

这个设计避免了重新计算完整 hash，也保留了原链表的相对顺序。

## 树化与退化

JDK 8 引入红黑树是为了防止极端哈希冲突导致链表过长。

相关阈值：

| 常量 | 默认值 | 含义 |
| --- | --- | --- |
| `TREEIFY_THRESHOLD` | `8` | 链表长度达到 8 时尝试树化 |
| `UNTREEIFY_THRESHOLD` | `6` | 节点数量减少到 6 时退化为链表 |
| `MIN_TREEIFY_CAPACITY` | `64` | table 容量至少 64 才允许树化 |

为什么链表长度达到 8 不一定马上树化？

如果数组容量还小于 64，`HashMap` 会优先扩容，而不是树化。因为冲突可能只是容量太小导致的，扩容后元素分散，链表长度自然会下降。

## 为什么树化阈值是 8

这是一个概率和性能之间的折中。负载因子为 `0.75` 且哈希分布正常时，单个桶中出现 8 个节点的概率非常低。达到 8 往往说明哈希冲突已经比较严重，继续使用链表会影响查询性能。

退化阈值是 6，而不是 7 或 8，是为了避免链表和红黑树之间频繁来回转换。

## null key 和 null value

`HashMap` 允许一个 `null` key，也允许多个 `null` value。

`null` key 的 hash 视为 `0`，通常放在 table 的第 0 个桶。

`ConcurrentHashMap` 不允许 `null` key 和 `null` value，这一点非常重要。

原因是并发场景下，`map.get(key) == null` 无法区分：

- key 不存在
- key 存在但 value 是 null

为了避免语义歧义，`ConcurrentHashMap` 禁止 null。

## HashMap 为什么线程不安全

`HashMap` 线程不安全主要体现在：

- 多线程 put 可能覆盖彼此写入。
- 扩容过程中并发迁移可能导致数据异常。
- 一个线程 put 后，另一个线程不一定马上可见。
- `size` 更新不是原子操作。
- 遍历时结构被修改会触发 fail-fast。

JDK 7 中，`HashMap` 在并发扩容时由于头插法可能形成链表环，导致 get 时死循环。JDK 8 改为尾插法，降低了这个风险，但并不意味着 `HashMap` 可以并发写。

结论很简单：多线程共享写入不要使用普通 `HashMap`。

## fail-fast 机制

`HashMap` 的迭代器是 fail-fast 的。迭代时会记录 `expectedModCount`，如果遍历过程中发现 `modCount` 被其他结构性修改改变，就抛出：

```text
ConcurrentModificationException
```

fail-fast 不是并发安全机制，只是一种尽早失败的错误检测机制。不能依赖它保证线程安全。

## HashMap 工程实践

### 初始化容量

如果能预估元素数量，建议提前设置容量，避免频繁扩容。

例如预计放入 1000 个元素，负载因子 0.75，那么需要容量至少：

```text
1000 / 0.75 = 1334
```

实际容量会向上取 2 的幂，也就是 `2048`。

### key 必须稳定

作为 Map key 的对象，参与 `hashCode` 和 `equals` 的字段不要在放入 Map 后修改。否则可能出现放进去之后再也查不到的问题。

### 重写 equals 必须重写 hashCode

如果两个对象通过 `equals` 判断相等，它们的 `hashCode` 必须相等。否则 HashMap 的查找语义会被破坏。

### 不要滥用可变对象作为 key

例如使用 `List`、普通 DTO 作为 key 时要非常谨慎。如果对象内容变化，hash 结果变化，Map 内部桶位不会自动调整。

## ConcurrentHashMap 核心结构

JDK 8 的 `ConcurrentHashMap` 和 `HashMap` 类似，也使用：

```text
数组 + 链表 + 红黑树
```

但它针对并发做了大量设计：

- 使用 CAS 初始化 table。
- 空桶插入时使用 CAS。
- 桶位已有节点时使用 `synchronized` 锁住桶头节点。
- 扩容时多个线程可以协助迁移。
- 使用 `sizeCtl` 控制初始化和扩容状态。
- 使用 `CounterCell` 降低 size 统计竞争。

JDK 7 的 `ConcurrentHashMap` 使用 Segment 分段锁；JDK 8 取消了 Segment 锁分段模型，改成更细粒度的桶级别同步。

## ConcurrentHashMap put 流程

JDK 8 中 `ConcurrentHashMap.put` 大致流程：

1. 不允许 key 或 value 为 null。
2. 计算 spread hash。
3. 如果 table 未初始化，先初始化。
4. 如果目标桶为空，使用 CAS 插入。
5. 如果当前桶正在迁移，帮助扩容。
6. 如果桶不为空，使用 `synchronized` 锁住桶头节点。
7. 在链表或红黑树中插入或覆盖节点。
8. 插入后更新计数。
9. 如果达到扩容条件，触发扩容。

它不是给整个 Map 加一把大锁，而是尽量只锁当前桶，降低锁竞争。

## ConcurrentHashMap get 流程

`get` 操作基本不加锁：

1. 计算 hash。
2. 定位桶位。
3. 如果桶头就是目标 key，直接返回。
4. 如果桶正在迁移，根据 forwarding node 查新表。
5. 如果是链表或红黑树，继续查找。

因为节点的关键字段使用了 volatile 或安全发布机制，所以读线程能看到相对可靠的状态。

## sizeCtl 的作用

`sizeCtl` 是 `ConcurrentHashMap` 中非常关键的控制字段。

它在不同状态下含义不同：

| 状态 | 含义 |
| --- | --- |
| `sizeCtl < 0` | table 正在初始化或扩容 |
| `sizeCtl == 0` | 使用默认容量初始化 |
| `sizeCtl > 0` | 下一次扩容阈值 |

初始化和扩容时，线程会通过 CAS 修改 `sizeCtl`，避免多个线程重复初始化，同时也能协调多个线程协助迁移。

## ConcurrentHashMap 扩容

`ConcurrentHashMap` 的扩容不是单线程独占完成的。扩容时会创建新 table，然后多个线程通过 transfer 任务协助迁移不同区间的桶。

迁移完成的桶会放置一个特殊节点 `ForwardingNode`。如果其他线程访问到这个桶，说明该桶已经迁移或正在迁移，它可以去新表查找，或者帮助迁移。

这种设计降低了单个线程扩容带来的长时间停顿，适合高并发场景。

## size 统计为什么复杂

`ConcurrentHashMap.size()` 在高并发下很难做到低成本强一致。

JDK 8 使用类似 `LongAdder` 的设计：

- 低竞争时更新 baseCount。
- 高竞争时更新 CounterCell。
- 统计 size 时汇总 baseCount 和多个 CounterCell。

因此 `size()` 在并发修改时只是一个近似瞬时值，不适合做强一致业务判断。

例如不要写：

```java
if (map.size() < limit) {
    map.put(key, value);
}
```

这不是原子操作，并发下可能突破 limit。

## computeIfAbsent 使用细节

`computeIfAbsent` 常用于缓存初始化：

```java
value = map.computeIfAbsent(key, k -> loadFromDb(k));
```

它能避免 “先 get 再 put” 的竞态问题。但使用时要注意：

- mapping function 不要太慢，否则会阻塞同桶位上的其他更新。
- 不要在 mapping function 中递归更新同一个 map。
- mapping function 可能在某些竞争场景下被多次尝试，不要依赖外部副作用。
- 如果计算结果为 null，不会插入 map。

在 crypto 后端里，可以用它维护交易对配置、WebSocket 订阅分组、币种维度缓存等，但不要把复杂远程调用直接塞进去。

## HashMap vs ConcurrentHashMap

| 对比项 | HashMap | ConcurrentHashMap |
| --- | --- | --- |
| 线程安全 | 否 | 是 |
| null key/value | 允许 | 不允许 |
| 底层结构 | 数组 + 链表 + 红黑树 | 数组 + 链表 + 红黑树 |
| 写入并发 | 不支持 | 支持 |
| 读操作 | 无锁但非线程安全 | 通常无锁 |
| 扩容 | 单线程迁移 | 多线程协助迁移 |
| size | 普通 int | baseCount + CounterCell |
| 适用场景 | 单线程或外部同步 | 多线程共享访问 |

## 常见面试题

### HashMap 为什么用红黑树而不是 AVL 树？

红黑树在查询、插入、删除之间有更好的综合平衡。AVL 树更严格平衡，查询略优，但旋转维护成本更高。HashMap 的树化主要是防止极端冲突，不是为了做极致有序查询，所以红黑树更合适。

### HashMap 链表长度到 8 一定树化吗？

不一定。如果 table 容量小于 64，会优先扩容，而不是树化。

### HashMap 为什么负载因子默认是 0.75？

这是时间和空间的折中。负载因子太低会浪费空间，太高会增加冲突概率。`0.75` 在空间利用率和查询性能之间比较均衡。

### ConcurrentHashMap 为什么不允许 null？

为了避免并发语义歧义。`get` 返回 null 时必须明确表示 key 不存在，而不是 key 存在但 value 是 null。

### ConcurrentHashMap 的读为什么通常不加锁？

因为它通过 volatile、CAS 和安全发布保证读线程能看到可用状态。读操作只需要沿着 table、链表或树查找，不需要阻塞写线程。

### ConcurrentHashMap 能完全替代锁吗？

不能。它只能保证 Map 内部单个操作的线程安全。涉及多个 key、多步骤状态转换、跨资源一致性时，仍然需要锁、事务、状态机或其他并发控制手段。

## Key Points

- `HashMap` 的核心是哈希定位、冲突处理、扩容和树化。
- 容量为 2 的幂是为了用位运算快速定位桶位。
- JDK 8 扩容时元素只会留在原位置或移动到 `oldIndex + oldCap`。
- `HashMap` 允许 null，`ConcurrentHashMap` 不允许 null。
- `HashMap` 不适合多线程共享写入。
- JDK 8 `ConcurrentHashMap` 使用 CAS + synchronized + 协助扩容。
- `ConcurrentHashMap.size()` 在并发修改下不适合做强一致判断。
- `computeIfAbsent` 很有用，但不要在计算函数里放重逻辑或副作用。

## Summary

`HashMap` 适合单线程或外部同步场景，它的性能来自哈希定位和数组访问；`ConcurrentHashMap` 适合多线程共享访问，它通过 CAS、桶级锁、volatile 和协助扩容降低并发竞争。

真正掌握这两个类，不是背“数组 + 链表 + 红黑树”，而是理解哈希分布、扩容迁移、树化条件、并发可见性和业务原子性边界。在 crypto 后端这类高并发、强一致、重资金安全的系统中，Map 可以提升访问性能，但绝不能替代数据库事务、幂等流水和审计机制。
