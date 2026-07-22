# G1 与 ZGC 垃圾回收器文章设计

## 1. 目标

围绕 `ex-parent` 工程构建 JVM 垃圾回收器专题，补充 G1、ZGC 以及两者选型对比三篇文章，并保留现有 `gc-tuning` 作为 GC 排障总览。文章面向 Java 后端工程师，重点回答收集器如何工作、什么时候选择、如何配置和如何验证，而不是罗列参数。

## 2. 项目事实与写作边界

当前按项目实际构建环境确认，文章统一以 JDK 21 为基线：

- `ex-parent` 真实构建使用 JDK 21。
- G1 和 ZGC 的参数、日志、监控指标与调优建议均按照 JDK 21 的行为展开。
- 工程当前没有统一提交显式的 `-XX:+UseG1GC`、`-XX:+UseZGC` 或 `-Xlog:gc` 启动参数，文章中的参数均属于可复现实验和生产评估模板。
- 工程包含订单服务、RocketMQ 消费者、WebSocket 推送服务和多个显式线程池。
- `exchange-order-service` 使用较大的订单消费线程池；`exchange-ws-push` 维护 WebSocket 连接、订阅映射并消费 RocketMQ 消息。

正文必须区分两类信息：

1. “当前工程”：只陈述可以从源码、POM 或 Dockerfile 直接确认的事实。
2. “调优建议”：以 JDK 21 运行时为前提，提供 G1 或 ZGC 的实验配置，并明确配置需要通过压测和线上指标验证。

不写入仓库中出现的真实地址、账号、密钥或环境敏感信息。

## 3. 文章结构

### 3.1 G1 垃圾收集器

文件：`docs/jvm/g1.md`

内容包括：

- G1 解决的服务端问题，以及与传统分代收集器的关系。
- Heap、Region、Eden、Survivor、Old Region 和 Humongous Object 的组织方式。
- Young GC、并发标记、Remark、Cleanup、Mixed GC 和 Full GC 的流程。
- Remembered Set、写屏障、跨 Region 引用与增量回收的作用。
- `MaxGCPauseMillis` 的含义、目标与现实边界，解释它不是硬性停顿 SLA。
- 结合订单服务、MQ 消费和 WebSocket 推送说明临时对象、积压对象、缓存和大对象风险。
- 以现代 JDK 为前提的最小配置模板：固定堆、G1、GC 日志、暂停目标和容器内存预留。
- 日志与指标：暂停 P99、Young/Mixed/Full GC、堆占用、晋升、Humongous Region、并发周期。
- 常见误区：只调年轻代、盲目降低暂停目标、把 Full GC 当成唯一指标、忽略堆外内存。

### 3.2 ZGC 垃圾收集器

文件：`docs/jvm/zgc.md`

内容包括：

- ZGC 的目标：超低停顿与大堆规模下的并发回收。
- Colored Pointer、Load Barrier、重定位和并发标记/重定位的基本关系。
- ZGC 与 G1 的停顿模型、吞吐开销、堆规模和运维复杂度差异。
- JDK 21 下 ZGC 已属于可执行的服务端收集器，文章重点讨论启用条件、资源成本、压测方法和生产观测。
- ZGC 的实验配置、GC 日志格式、软最大堆 `-XX:SoftMaxHeapSize` 的使用边界，以及不应照抄的参数。
- 结合交易 API、WebSocket 和消息消费场景，分析低停顿收益与分配速率、CPU、堆容量、对象生命周期之间的关系。
- ZGC 诊断路径：停顿、分配速率、回收周期、并发线程、堆水位、容器 RSS 和直接内存。
- 落地风险：JDK 21 运行时兼容性、监控字段变化、容器内存预算、吞吐回退和压测方法。

### 3.3 G1 与 ZGC 对比

文件：`docs/jvm/g1-vs-zgc.md`

内容包括：

- 架构、内存组织、停顿阶段、整理方式、吞吐、CPU 和堆规模的对比表。
- 以 `ex-parent` 的 JDK 21 构建环境为基线，设计先观测、再压测、最后选择收集器的路线。
- 按服务类型选择：普通 API/订单服务、WebSocket 推送、消息消费、批处理任务。
- 配置模板对比，并明确模板只是压测起点。
- 可靠的压测矩阵：请求分布、消息积压、连接数、堆大小、CPU 限额、P99/P999、吞吐和 RSS。
- 常见排障场景：频繁 Young GC、Mixed GC 跟不上、Full GC、分配速率过高、堆外 OOM 和容器被杀。
- 最终决策表，避免用“G1 一定更快”或“ZGC 一定更好”替代基于指标的选择。

## 4. 导航与兼容性

在 `docs/.vitepress/config.ts` 的 JVM sidebar 中保留 `GC 调优入门`，并按“总览、G1、ZGC、G1 vs ZGC”顺序加入三篇文章。现有文章中的通用诊断内容不重复搬运，专题文章通过链接或简短回顾承接。

## 5. 验证标准

- `npm run docs:build` 成功完成。
- `git diff --check` 无空白错误。
- 新增三篇页面均生成对应 HTML 页面。
- 文章中没有把 `ex-parent` 当前未配置的 G1/ZGC 参数写成现状。
- 文章中的命令、参数和日志格式均与 JDK 21 对齐。
- 导航链接可解析，VitePress 不报告死链接。
