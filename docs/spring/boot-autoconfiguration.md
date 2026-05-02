# Spring Boot 自动装配

## Problem

为什么 Spring Boot 只要引入 starter 并写少量配置，就能自动把大量 Bean 装配好？为什么有时自己明明写了配置，结果 Bean 没生效，或者被默认实现“抢走”了？

## Explanation

我理解 Spring Boot 自动装配，核心不是“帮你少写配置”，而是把一套通用基础设施的装配规则收敛成了可判断、可覆盖、可退让的约定系统。

Spring Boot 的自动装配入口来自 `@SpringBootApplication` 中的 `@EnableAutoConfiguration`。启动时，框架会加载自动配置类清单，再基于条件注解逐个判断当前环境是否满足装配条件，例如：

- 类路径里是否存在某个依赖
- 配置文件里是否启用了某个能力
- 容器中是否已经存在某类 Bean
- 当前是不是 Web 环境、响应式环境或某种特定运行模式

在 Spring Boot 3.x 之前，自动配置类主要通过 `spring.factories` 暴露；在新版本中则更多通过 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 来注册。这种变化本质上是在降低启动扫描成本，同时让自动配置声明更加清晰。

### 1. 自动装配不是“自动扫描”，而是“条件导入”

很多人第一次学自动装配时，会误以为 Spring Boot 是把 starter 里的所有配置类都扫进来。其实更准确的说法是：

```text
Starter 提供依赖
-> AutoConfiguration 提供装配规则
-> 条件注解决定是否生效
-> 业务 Bean 决定是否覆盖默认实现
```

也就是说，starter 解决的是“你依赖了什么”，自动配置解决的是“在什么条件下帮你组装什么”。

### 2. `@Conditional` 才是自动装配的灵魂

常见条件注解包括：

- `@ConditionalOnClass`
- `@ConditionalOnMissingBean`
- `@ConditionalOnProperty`
- `@ConditionalOnBean`
- `@ConditionalOnWebApplication`

其中最常见也最容易误判的是 `@ConditionalOnMissingBean`。它意味着框架默认会“退让”给业务实现。如果你自己定义了同类型 Bean，自动配置通常会失效。

这也是我对自动装配的一个核心理解：

```text
自动装配不是强行接管容器，而是在业务没有明确表达时提供一份默认答案。
```

### 3. 自动装配类本身也强调分层

一个设计得比较好的自动配置类，通常不是把所有 Bean 都塞在一个文件里，而是按能力拆分：

- 配置属性类负责接收外部配置
- 核心配置类负责装配基础 Bean
- 扩展配置类负责按场景挂接附加能力
- 条件注解负责表达启用边界

例如一个交易系统里的行情推送 starter，比较合理的结构往往是：

- `MarketPushProperties`
- `MarketPushAutoConfiguration`
- `WebSocketPushConfiguration`
- `KafkaMarketEventConfiguration`

这样业务方不仅知道“能不能用”，还知道“为什么会生效”和“该怎么覆盖”。

### 4. 排查自动装配问题，重点不是看注解，而是看条件链

很多自动装配问题，本质都不是 Spring “抽风”，而是某个条件不满足：

- 少了依赖，导致 `@ConditionalOnClass` 失败
- 配置项没开，导致 `@ConditionalOnProperty` 失败
- 业务方提前注入了 Bean，导致 `@ConditionalOnMissingBean` 失效
- Bean 加载顺序不同，导致依赖关系变化

真正排查时，我通常会先看两件事：

1. 自动配置类是否被导入
2. 导入后是哪一个条件没通过

Spring Boot 的 `--debug` 或 `ConditionEvaluationReport` 非常适合做这件事。很多“自动装配失效”的问题，看完条件报告就定位了。

### 5. 自动装配背后的工程价值，是统一基础设施接入方式

在团队工程里，自动装配最有价值的地方不是省几行代码，而是把重复接入动作标准化。

比如在一个 crypto 后端系统里，团队可能反复接入：

- Redis 客户端
- Kafka Producer / Consumer
- 统一链路日志
- 幂等拦截器
- 交易事件发布器

如果每个项目都手动装配一次，久而久之就会出现风格不一致、默认值不一致、扩展点不一致的问题。把这些能力沉淀成 starter + auto configuration，才是真正的工程复用。

### 6. 写自定义 starter 时，我最看重三个点

第一，默认值要保守。
不要一上来就开启所有线程池、所有消费者、所有重试策略。默认配置应该是“能跑起来”，而不是“把环境吃满”。

第二，扩展点要明确。
业务可以覆盖哪些 Bean，必须非常清楚。否则 starter 会从“提高效率”变成“绑架业务”。

第三，失败语义要清晰。
如果某个关键依赖不存在，或者配置不完整，应该尽早失败，而不是半成功半失败地启动。

## Key Points

- 自动装配的入口是 `@EnableAutoConfiguration`。
- 自动装配的本质是“条件导入”，不是无脑扫描。
- starter 负责依赖聚合，自动配置负责行为注入。
- `@ConditionalOnMissingBean` 体现的是“默认实现向业务实现退让”。
- 排查问题时要重点看条件链，而不是只盯着注解表面。
- 自定义 starter 的关键在于默认值、扩展点和失败语义设计。

## Summary

Spring Boot 自动装配的本质，是基于条件判断动态导入配置类，并用一整套可覆盖的约定来统一基础设施接入方式。理解它之后，排查 Bean 冲突、自定义 starter、设计团队内部组件库，都会顺手很多。
