# Spring Boot 自动装配

## Problem

为什么 Spring Boot 只要引入 starter 并写少量配置，就能自动把大量 Bean 装配好？

## Explanation

Spring Boot 的自动装配能力来自 `@SpringBootApplication` 中的 `@EnableAutoConfiguration`。启动时框架会读取自动配置类清单，再基于条件注解判断当前环境是否满足装配条件，例如类路径中是否存在某个依赖、配置文件中是否启用某个特性、容器里是否已经有同类型 Bean。

这种机制让框架在“约定优于配置”的前提下提供开箱即用体验，同时保留覆盖默认实现的能力。业务方如果需要自定义 Bean，可以通过显式声明 Bean 的方式覆盖默认装配结果。

## Key Points

- 自动装配的入口是 `@EnableAutoConfiguration`。
- 条件注解决定配置是否真正生效。
- starter 负责依赖聚合，自动配置负责行为注入。
- 自定义 Bean 时要关注是否会覆盖默认配置。

## Summary

Spring Boot 自动装配的本质，是基于条件判断动态导入配置类。理解它之后，排查 Bean 冲突和自定义 starter 都会更顺手。
