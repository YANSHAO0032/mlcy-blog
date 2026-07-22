# Message Queue Articles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the blog with detailed Kafka, RocketMQ, and comparison articles grounded in the `ex-parent` RocketMQ implementation.

**Architecture:** Keep product-specific concepts in two focused articles and put cross-product reliability and selection guidance in a third article. Update VitePress navigation so all three pages are directly discoverable.

**Tech Stack:** Markdown, VitePress, TypeScript configuration, Apache Kafka, Apache RocketMQ

---

### Task 1: Rewrite the Kafka article

**Files:**
- Modify: `docs/middleware/kafka.md`

- [ ] Explain Kafka architecture, partitions, replicas, consumer groups, and KRaft controllers.
- [ ] Explain segment storage, indexes, page cache, retention, and compaction.
- [ ] Add producer, broker, and consumer reliability configuration.
- [ ] Add high availability, ordering, lag, replay, and transaction guidance.
- [ ] State that Kafka usage was not found in the current `ex-parent` checkout.

### Task 2: Add the RocketMQ article

**Files:**
- Create: `docs/middleware/rocketmq.md`

- [ ] Explain NameServer, Broker, Topic, MessageQueue, producer, and consumer roles.
- [ ] Explain CommitLog, ConsumeQueue, IndexFile, flush, replication, retries, and dead letters.
- [ ] Map the explanation to `RocketMQConfig`, `RMQUtil`, `SendMessageServiceImpl`, and the orderly consumers in `exchange-ws-push`.
- [ ] Identify the project's existing safeguards and the remaining reliability risks.

### Task 3: Add the comparison article

**Files:**
- Create: `docs/middleware/rocketmq-vs-kafka.md`

- [ ] Compare architecture, storage, consumption, ordering, replay, delayed messages, transactions, throughput, and operations.
- [ ] Describe end-to-end no-loss design for producer, broker, consumer, and database boundaries.
- [ ] Provide transaction-system selection guidance and production checklists.

### Task 4: Update navigation

**Files:**
- Modify: `docs/.vitepress/config.ts`

- [ ] Add RocketMQ and comparison pages to the Middleware sidebar after Kafka.

### Task 5: Verify the site

**Files:**
- Verify: `docs/middleware/kafka.md`
- Verify: `docs/middleware/rocketmq.md`
- Verify: `docs/middleware/rocketmq-vs-kafka.md`
- Verify: `docs/.vitepress/config.ts`

- [ ] Run `npm run docs:build`.
- [ ] Confirm the command exits with code 0.
- [ ] Review `git diff --check` and `git diff --stat`.
