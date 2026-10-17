# pi-durable 源码导读

一本为「对 pi 一无所知」的读者写的中文十讲，围绕 [pi](https://github.com/earendil-works/pi) 仓库的
`packages/durable`（@earendil-works/pi-durable）逐层展开：它解决什么问题、commit / Entry /
Document / Task / Submission 这些概念到底是什么、四个存储后端怎么选、工具与扩展怎么写、
以及崩溃后凭什么能续跑。所有结论引用真实源码路径与行号，另有三个可交互演示。

## 阅读

直接打开 [本站](https://jjack27.github.io/pi-durable-book/)（自动进入 `zh/`），
或本地双击 `zh/index.html` —— 无构建、无服务器、无外部依赖。

- 10 章，由浅入深；每章末尾小测，≥ 80% 标记「学够了」（软门槛）
- 明暗双主题；进度保存在浏览器 localStorage
- 第 6/7/10 章含交互演示（原子提交、崩溃续跑、消息排队）

## 章节

1. 认识 pi-durable：它解决什么问题
2. 核心概念词汇表（commit 到底是什么）
3. 第一个程序：Quick Start 逐行精读
4. 持久化与恢复：四种存储后端
5. Harness 与 Conversation：API 全景
6. Commit 深挖：Tx 事务面与 Document 文档系统
7. Task：持久状态机与所有权
8. 工具与执行环境
9. 扩展、注册表与 Agent 配置
10. 提交队列、观看、压缩与错误模型

## 目录结构

```
zh/               本书（中文）
  index.html      目录仪表盘（入口）
  01-…~10-…html   各章
  assets/         共享样式与脚本（含交互演示）
```

书由 personal-book-forger 技能生成，源码结论对准 pi-durable 1.3.0。
