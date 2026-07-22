# G1 and ZGC Articles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 `ex-parent` 的 JDK 21 构建环境和订单、消息消费、WebSocket 服务特征，新增 G1、ZGC 及两者对比三篇 JVM 垃圾回收器文章。

**Architecture:** 保留 `docs/jvm/gc-tuning.md` 作为诊断总览，将收集器原理、项目场景、JDK 21 配置、指标和排障分别放入三个专题页面。通过 `docs/.vitepress/config.ts` 的 JVM sidebar 统一暴露文章，文章只描述已确认的工程事实和经过标注的评估模板。

**Tech Stack:** Markdown, VitePress 1.6.4, JDK 21 JVM terminology, ex-parent source inspection.

---

### Task 1: Write the G1 article

**Files:**
- Create: `docs/jvm/g1.md`

- [ ] **Step 1: Write the article sections**

Create a Chinese article with these concrete sections: ex-parent context, G1 goals, Region layout, allocation and object lifetime, Young GC, concurrent marking and Mixed GC, Remembered Set and barriers, pause target semantics, JDK 21 configuration template, metrics and logs, ex-parent service tuning scenarios, failure diagnosis, and a concise checklist. State that configuration snippets are evaluation templates rather than current repository settings.

- [ ] **Step 2: Check G1 terminology and project grounding**

Run `rg -n 'JDK 21|ex-parent|Region|Mixed GC|Remembered Set|MaxGCPauseMillis' docs/jvm/g1.md`. Expected: JDK 21 and project references are present; G1 terms are used consistently.

### Task 2: Write the ZGC article

**Files:**
- Create: `docs/jvm/zgc.md`

- [ ] **Step 1: Write the article sections**

Create a Chinese article with these concrete sections: ex-parent JDK 21 baseline, ZGC goals, colored pointers, load barriers, concurrent marking and relocation, pause behavior, allocation-rate and CPU trade-offs, JDK 21 configuration template, `SoftMaxHeapSize`, logs and metrics, order/MQ/WebSocket scenarios, operational risks, and an experiment checklist. Explain that ZGC reduces pause time but does not remove allocation pressure, CPU cost, or memory budgeting.

- [ ] **Step 2: Check ZGC terminology and project grounding**

Run `rg -n 'JDK 21|ex-parent|ZGC|着色指针|读屏障|SoftMaxHeapSize' docs/jvm/zgc.md`. Expected: JDK 21, project references and ZGC material are present.

### Task 3: Write the comparison article

**Files:**
- Create: `docs/jvm/g1-vs-zgc.md`

- [ ] **Step 1: Write the comparison and decision flow**

Create a Chinese article containing an architecture comparison table, pause and throughput trade-offs, heap and CPU considerations, service-by-service recommendations for API/order, RocketMQ consumers, WebSocket push, and batch work, JDK 21 configuration templates, a pressure-test matrix, common incident diagnosis, and a final decision table.

- [ ] **Step 2: Check comparison coverage**

Run `rg -n 'G1|ZGC|JDK 21|订单|RocketMQ|WebSocket|P99|P999|压测' docs/jvm/g1-vs-zgc.md`. Expected: both collectors, all project scenarios and measurable test criteria are present.

### Task 4: Update JVM navigation

**Files:**
- Modify: `docs/.vitepress/config.ts`

- [ ] **Step 1: Add the three sidebar links**

Keep `/jvm/gc-tuning` first, then add `/jvm/g1`, `/jvm/zgc`, and `/jvm/g1-vs-zgc` with Chinese labels matching the article titles.

- [ ] **Step 2: Check link targets**

Run `rg -n "jvm/(gc-tuning|g1|zgc|g1-vs-zgc)" docs/.vitepress/config.ts`. Expected: all four JVM links occur in the intended order.

### Task 5: Validate the documentation set

**Files:**
- Verify: `docs/jvm/g1.md`
- Verify: `docs/jvm/zgc.md`
- Verify: `docs/jvm/g1-vs-zgc.md`
- Verify: `docs/.vitepress/config.ts`

- [ ] **Step 1: Run whitespace validation**

Run `git diff --check`. Expected: no output and exit code 0.

- [ ] **Step 2: Build VitePress**

Run `npm run docs:build`. Expected: VitePress completes client/server bundles and page rendering without dead-link errors.

- [ ] **Step 3: Verify generated pages**

Run `Test-Path docs/.vitepress/dist/jvm/g1.html; Test-Path docs/.vitepress/dist/jvm/zgc.html; Test-Path docs/.vitepress/dist/jvm/g1-vs-zgc.html`. Expected: all three commands print `True`.

- [ ] **Step 4: Review the final diff**

Run `git diff --stat; git status --short`. Expected: only the three new articles and JVM navigation are changed or added, with no generated build output staged.

- [ ] **Step 5: Commit the documentation changes**

Run:

```powershell
git add docs/jvm/g1.md docs/jvm/zgc.md docs/jvm/g1-vs-zgc.md docs/.vitepress/config.ts
git commit -m "docs: add G1 and ZGC articles"
```

Expected: one commit containing the three articles and navigation update.
