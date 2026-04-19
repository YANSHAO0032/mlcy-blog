# Java 集合体系

## Problem

Java 集合是后端开发里最常用的基础能力之一。无论是订单缓存、交易对配置、用户订阅关系，还是风控规则匹配，都离不开 `List`、`Set`、`Map` 和并发集合。面试中也经常会追问：不同集合底层结构是什么？如何选型？线程安全吗？扩容和遍历有哪些坑？

## Explanation

Java 集合框架可以从两个核心接口理解：`Collection` 和 `Map`。

`Collection` 表示一组元素，下面主要分为 `List`、`Set` 和 `Queue`。`List` 关注有序和可重复，常见实现是 `ArrayList`、`LinkedList`；`Set` 关注不重复，常见实现是 `HashSet`、`LinkedHashSet`、`TreeSet`；`Queue` 关注队列语义，常见实现包括 `ArrayDeque`、`PriorityQueue` 和阻塞队列。

`Map` 表示键值对映射，最常见的是 `HashMap`、`LinkedHashMap`、`TreeMap` 和 `ConcurrentHashMap`。它不继承 `Collection`，但在业务系统中使用频率非常高，尤其适合缓存配置、索引数据和聚合统计。

理解集合不能只背 API，更重要的是理解底层数据结构和访问模式。数组适合随机访问，链表适合局部插入删除，哈希表适合快速定位，红黑树适合有序查找，堆适合优先级调度。

## Collection 体系

### List

`List` 的特点是有序、可重复、可通过下标访问。

`ArrayList` 底层是动态数组，随机访问快，尾部追加快，但中间插入和删除需要移动元素。日常开发中如果没有特殊需求，优先选择 `ArrayList`。

`LinkedList` 底层是双向链表，理论上适合频繁插入删除，但真实业务中由于缓存局部性差、对象分散、额外指针开销大，很多场景并不比 `ArrayList` 更快。除非确实需要双端队列能力，否则不要默认选择它。

### Set

`Set` 的特点是不允许重复元素。

`HashSet` 底层基于 `HashMap`，元素会作为 `HashMap` 的 key 存储，所以它依赖 `hashCode` 和 `equals` 判断是否重复。

`LinkedHashSet` 在 `HashSet` 的基础上维护插入顺序，适合既要去重又要保留顺序的场景。

`TreeSet` 底层是红黑树，元素会按自然顺序或自定义比较器排序，适合需要有序集合、范围查询的场景。

### Queue

`Queue` 关注先进先出、优先级或阻塞等待。

`ArrayDeque` 是更推荐的双端队列实现，通常比 `Stack` 和 `LinkedList` 更适合作为栈或队列使用。

`PriorityQueue` 基于堆结构，适合 Top N、延迟任务、优先级调度等场景。

阻塞队列如 `ArrayBlockingQueue`、`LinkedBlockingQueue`、`DelayQueue` 常用于生产者消费者模型，也是线程池和异步任务编排中的重要基础。

## Map 体系

### HashMap

`HashMap` 是最常用的 key-value 容器，底层是数组、链表和红黑树。查询通常接近 `O(1)`，但依赖良好的哈希分布。它线程不安全，不能在多线程写入场景直接使用。

### LinkedHashMap

`LinkedHashMap` 在 `HashMap` 基础上维护双向链表，可以按插入顺序或访问顺序遍历。它常用于实现简单 LRU 缓存。

### TreeMap

`TreeMap` 基于红黑树实现，key 会保持有序。它适合需要排序、范围查找、按价格或时间窗口查询的场景，但单次访问复杂度是 `O(log n)`。

### ConcurrentHashMap

`ConcurrentHashMap` 是高并发场景下常用的线程安全 Map。JDK 8 之后它通过 CAS、`synchronized`、数组、链表和红黑树实现并发控制。它适合读多写多的共享映射场景，但复合操作仍然要注意原子性，比如 “先判断再写入” 应优先使用 `computeIfAbsent`。

## 常见选型

| 场景 | 推荐集合 | 原因 |
| --- | --- | --- |
| 普通有序列表 | `ArrayList` | 随机访问快，内存连续，综合性能好 |
| 去重 | `HashSet` | 基于哈希，查询和插入通常较快 |
| 去重且保留顺序 | `LinkedHashSet` | 兼顾去重和插入顺序 |
| 有序 key-value | `TreeMap` | 支持排序和范围查询 |
| 简单 LRU | `LinkedHashMap` | 支持访问顺序 |
| 并发共享 Map | `ConcurrentHashMap` | 支持并发读写 |
| 双端队列 | `ArrayDeque` | 比 `Stack` 和 `LinkedList` 更推荐 |
| 优先级任务 | `PriorityQueue` | 堆结构适合优先级排序 |

## Crypto 后端中的使用场景

在 crypto 交易系统里，集合选型会直接影响延迟和内存表现。

行情订阅关系可以用 `ConcurrentHashMap<String, Set<Session>>` 维护交易对和 WebSocket 连接的映射，但内部 `Set` 也要考虑并发安全。

风控规则可以按规则类型或币种用 `Map` 做索引，避免每次请求都全量扫描规则列表。

撮合或行情聚合里的 Top N 场景，可以用 `PriorityQueue` 维护局部排序，但真正低延迟撮合通常会使用更专业的数据结构。

资产账户模块中，资金流水和余额变动不应该只依赖内存集合，集合最多用于批量处理、聚合和临时索引，最终状态必须落库并具备审计能力。

## Key Points

- `Collection` 关注单值元素，`Map` 关注 key-value 映射。
- `ArrayList` 是多数列表场景的默认选择，不要因为“插入删除”就盲目选择 `LinkedList`。
- `HashSet` 依赖 `hashCode` 和 `equals`，自定义对象必须正确重写。
- `HashMap` 线程不安全，多线程共享写入要用 `ConcurrentHashMap` 或外部同步。
- `TreeMap`、`TreeSet` 适合有序和范围查询，但性能不是 `O(1)`。
- 并发集合只能保证单个方法的线程安全，复合业务逻辑仍要考虑原子性。

## Interview Questions

### ArrayList 和 LinkedList 怎么选？

大多数场景优先 `ArrayList`。它底层数组连续，随机访问快，CPU 缓存友好。`LinkedList` 虽然插入删除不需要移动数组，但查找节点需要遍历，而且每个节点都有额外对象和指针开销。

### HashSet 如何保证元素不重复？

`HashSet` 底层使用 `HashMap`。元素作为 key 存储，value 是固定占位对象。判断重复时先比较哈希，再通过 `equals` 判断对象是否相等。

### HashMap 为什么线程不安全？

多线程同时写入时，可能出现数据覆盖、状态不可见、扩容竞争等问题。即使 JDK 8 已经改善了早期链表环问题，也不代表它可以并发写。

### ConcurrentHashMap 一定能保证业务原子性吗？

不能。它能保证单个方法内部的线程安全，但多个方法组合仍可能不是原子操作。例如先 `get` 再 `put` 存在竞态，应使用 `putIfAbsent`、`computeIfAbsent` 或更高层的锁。

## Summary

Java 集合的核心不是记住所有实现类，而是根据访问模式选择合适的数据结构。写业务代码时要关注有序性、去重、查询复杂度、内存开销和线程安全；写高并发 crypto 后端时，还要进一步关注延迟、热点 key、批量处理和状态一致性。
