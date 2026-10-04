# 参与拾序 / Contributing to Shixu

欢迎帮助拾序变得更好用。问题反馈、文档修正、无障碍改进和代码贡献都很有帮助。

## 中文

1. Fork 仓库，创建描述清晰的分支。
2. 按 [README](README.md) 安装依赖并启动。推荐 Windows x64、Node.js 24。
3. 保持改动聚焦。日期、重复、提醒或数据格式变化，请补充覆盖实际边界的测试。
4. 提交前运行 `npm test` 与 `npm run dist`。界面变化请检查昼夜主题、键盘操作和较窄窗口。
5. 在 Pull Request 中说明使用场景、行为变化和验证方式；界面改动可附使用示例数据的截图。

报告问题时，请提供版本、Windows 版本、复现步骤、预期与实际结果。不要提交真实日程、AppData 内容、访问令牌或未经脱敏的日志。请使用虚构数据复现。

界面保持温和、清晰和易读；每日打卡与整件事完成须保持区分。导入与存储的改动应保留用户已有记录。涉及架构和发行流程可参考 [架构说明](docs/ARCHITECTURE.md)。

## English

1. Fork the repository and create a descriptively named branch.
2. Follow the [README](README.en.md) setup. Windows x64 and Node.js 24 are recommended.
3. Keep changes focused. Add meaningful boundary tests when changing dates, recurrence, reminders, or data formats.
4. Run `npm test` and `npm run dist`. For interface changes, check both themes, keyboard use, and narrower windows.
5. Describe the user scenario, resulting behavior, and validation in your pull request. Use fictional records in screenshots.

For bug reports, include app and Windows versions, reproduction steps, and expected versus actual behavior. Never commit personal schedules, AppData contents, access tokens, or unsanitized logs.

Keep the interface calm and readable. Preserve the distinction between daily check-in and whole-task completion, and protect existing records when changing import or storage behavior. See [architecture notes](docs/ARCHITECTURE.md) for implementation and release details.

Contributions are distributed under the repository's [MIT license](LICENSE).
