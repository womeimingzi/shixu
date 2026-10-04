<div align="center">

<img src="build/icon.png" width="88" height="88" alt="拾序的猫爪图标">

# 拾序 · Shixu

**把事情放在这里，把心思留给当下。**

一款有手绘小猫陪伴的 Windows 桌面日程软件。<br>
从课程 DDL 到每周组会，让忙碌的日子慢慢有序。

[![Windows x64](https://img.shields.io/badge/Windows-x64-8b947a?style=flat-square)](https://github.com/womeimingzi/shixu/releases/latest)
[![Release](https://img.shields.io/github/v/release/womeimingzi/shixu?color=b7775c&style=flat-square&label=release&cacheSeconds=300)](https://github.com/womeimingzi/shixu/releases/latest)
[![Checks](https://github.com/womeimingzi/shixu/actions/workflows/checks.yml/badge.svg?branch=main)](https://github.com/womeimingzi/shixu/actions/workflows/checks.yml)
[![MIT](https://img.shields.io/badge/License-MIT-c4a36b?style=flat-square)](LICENSE)

**简体中文** · [English](README.en.md)

[下载桌面版](https://github.com/womeimingzi/shixu/releases/latest) · [快速开始](#get-started) · [从源码运行](#development) · [反馈建议](https://github.com/womeimingzi/shixu/issues)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/previews/shixu-night.jpg">
  <img src="assets/previews/shixu-day.jpg" alt="拾序界面预览：手绘橘猫、每日待办、日历和截止倒计时" width="100%">
</picture>

<p align="center"><sub>奶油书桌 / 午夜手记 · 图中为使用示例数据的网页界面预览；桌面版另有原生窗口按钮。</sub></p>

## 🌿 给事情一个安放的地方

MOOC 还没刷完，报告时间记在聊天记录里，每周三的组会又快到了。拾序从这些具体的小事出发：记下截止日期，留出每天推进的时间，再让一只安静的小猫陪你完成。

**今日打卡，只代表今天前进了一点。** 一门课可以每天打卡，直到你选择「整件事完成」；每周组会完成本周这一场，下周仍会按时出现。

| 你想安排的事 | 拾序如何帮你 |
| --- | --- |
| 📚 截止前刷完课程 | 设置 DDL 与每天提醒时间，区分每日进度和整件事完成 |
| 🗓️ 参加报告、每周组会 | 记录起止时间、地点和备注，支持每周重复与单次完成 |
| 🔔 记得看提醒 | Windows 系统通知、10 分钟后再提醒、托盘后台运行 |
| ☀️ 白天专注，晚上放松 | 奶油色与暖深色主题，可跟随系统；配手绘橘猫与留白 |
| ✍️ 先记下，再整理 | Enter 快速记录、详细编辑、分类、日历筛选、截止倒计时 |
| 🗂️ 安心管理自己的记录 | 本地保存、上一版自动备份、JSON 导入导出、回收站恢复 |
| 📖 给今天留一点字 | 随手记、自动保存、选填心情、日期回看、文字搜索与恢复 |
| 🌤️ 提前准备明天 | 自选城市的今明天气、降雨概率、穿衣与带伞建议 |

<details>
<summary><strong>看看白天与夜间两种外观</strong></summary>

| 奶油书桌 · Day | 午夜手记 · Night |
| :---: | :---: |
| ![白天界面](assets/previews/shixu-day.jpg) | ![夜间界面](assets/previews/shixu-night.jpg) |

</details>

<a id="get-started"></a>

## 🐾 三步开始

1. 前往 **[Releases 下载页](https://github.com/womeimingzi/shixu/releases/latest)**，下载 `Shixu-版本号-windows-x64.zip`。
2. **完整解压**到你喜欢的位置，例如 `D:\software\Shixu`。
3. 双击猫爪图标的 **`拾序.exe`**，开始记录。

使用发行版无需安装 Node.js 或 Python，也不需要账号。请保留 exe 旁边的文件和文件夹。首次启动会生成三个可编辑、可删除的示例事项，帮助你熟悉用法。

当前发布 Windows x64 免安装版，应用界面为**简体中文**。中英文文档均已提供；英文界面尚未实现。发行包暂未做代码签名，Windows 可能显示来源提示，可用发行页的 `SHA256SUMS.txt` 核对下载文件。

### 第一次使用，推荐这样安排

- **课程**：新增待办 → 设置截止日期 → 打开每日推进 → 选择每天提醒的时间。
- **组会**：新增日程 → 设置第一次开会的日期与时间 → 选择每周重复。
- **开机陪伴**：进入「偏好设置」打开开机自启动；默认关闭，开启后会静默进入托盘。
- **确认提醒**：在「偏好设置」发送测试提醒，确认 Windows 通知能正常显示。

| 操作 | 快捷方式 |
| --- | --- |
| 保存顶部输入框里的事项 | `Enter` |
| 打开详细新建 | `Alt` + `N` |
| 关闭弹窗 | `Esc` |

默认关闭窗口会收进托盘，提醒继续运行。彻底退出请右键托盘图标 →「退出拾序（停止提醒）」。再次双击 exe 会打开已有窗口。

## 🔔 提醒什么时候出现？

| 类型 | 默认规则 |
| --- | --- |
| 每日推进 | 按你设置的时间提醒；当天打卡后不再发送当天的每日提醒 |
| 有具体时间的日程 | 开始前 10 分钟 |
| 只有日期的日程 | 当天 09:00 |
| 待办截止 | 截止前一天与当天 09:00 |
| 稍后提醒 | 点击通知打开事项后，可选择 10 分钟后再提醒 |

发送记录和稍后提醒会保存在本机，避免每次启动重复发送。电脑恢复运行时，会检查并补发仍有效的提醒。

**当前边界：** 所有日程时间固定按 UTC+8 计算；软件完全退出、电脑睡眠或关机时无法发送提醒。Windows 勿扰与通知设置也可能影响显示。当前没有手机推送、云同步、自动更新或自定义重复规则。

## 📖 随手记与窗外的天气

「我的一天」底部可以随手写一点，也可以从左侧「随手记」进入独立写作区。标题和心情都可留空，正文会自动保存；同一天可以写多篇。用日期、历史列表和搜索回看，移除的随笔仍可在偏好设置的回收站恢复。没有连续打卡或每日字数要求。

<details>
<summary><strong>看看随笔与天气的新界面</strong></summary>

| 白天写一点 | 夜晚慢慢想 |
| :---: | :---: |
| ![随笔与天气白天预览](assets/previews/shixu-journal-day.jpg) | ![随笔与天气夜间预览](assets/previews/shixu-journal-night.jpg) |

图中随笔为功能体验示例，杭州为演示城市；首次使用不会预选城市或添加示例随笔。

</details>

天气默认等待你「选择城市」。选好后显示今天与明天的温度、天气和降雨概率，并给出分层穿搭、带伞等简短建议。预报按所选城市的当地日期显示，与目前固定 UTC+8 的日程分开计算。断网时会注明缓存，过期预报不会被当成新的穿衣建议；天气目前是卡片提示，不额外发送系统通知。

天气来自 [Open-Meteo](https://open-meteo.com/)，城市数据来自 [GeoNames](https://www.geonames.org/)。查询只发送城市名称或城市中心坐标，不读取设备定位，不上传日程和随笔。该免费接口适用于非商业使用，天气数据采用 CC BY 4.0；商业分发需另行处理服务授权，见 [服务条款](https://open-meteo.com/en/terms)。穿衣建议是根据预报生成的简单参考，可以按自己的体感调整。

## 💾 记录属于你

日程与随笔保存在 **`%APPDATA%\Shixu`**，与程序目录分开。应用没有账号、遥测或记录同步服务，日常记录与日程提醒在本机完成；选用天气后会访问上述天气接口。

- `state.json`：当前日程、随笔、所选城市、偏好、提醒记录与稍后提醒。
- `state.backup.json`：上一次成功保存的版本；不是完整历史记录。
- 「偏好设置」支持打开数据目录、导出 JSON、追加导入。导入保留现有事项；同 ID 的不同内容作为新事项加入。
- 建议定期导出独立备份。网页预览使用浏览器本地存储，与桌面版不会自动同步。

更新时先退出托盘中的程序，再完整替换程序目录；本机数据目录保持独立。目前需要手动下载新版。

v0.2 会自动读取 v0.1 的记录。随笔需要新版备份格式；升级前建议导出一份备份，之后不要用 v0.1 写入新版数据目录。

<a id="development"></a>

## 🛠️ 从源码运行

建议使用 **Windows x64 + Node.js 24 + npm + Git**。

```powershell
git clone https://github.com/womeimingzi/shixu.git
cd shixu
npm ci
npm run setup:runtime
npm start
```

`setup:runtime` 确保 Electron 运行时就绪；首次安装需要联网。开发模式不设置开机自启动，该选项需要打包后使用。

```powershell
npm test             # 日期、重复、提醒、导入与存储测试
npm run dist         # Windows x64 应用 → dist/win-unpacked/
npm run package:zip  # 可分发 ZIP 与 SHA256SUMS.txt → dist/
```

只想调整外观时，运行 `npm run preview`，打开 `http://127.0.0.1:8767/handdrawn-preview.html`。网页模式用于界面预览，系统通知、托盘、自启动需要桌面版。端口被占用时，可在 PowerShell 先执行 `$env:PORT=8768`。

<details>
<summary><strong>代码库导览</strong></summary>

```text
desktop/                 Electron 主进程、系统提醒、本地存储
src/                     界面交互、双主题、日期与数据规则
assets/mascots/           手绘橘猫角色图
assets/previews/          昼夜界面示例
build/                   猫爪应用图标
tests/                   Node.js 原生测试
tools/                   预览、图标生成、打包工具
docs/                    架构、素材说明与英文使用指南
.github/workflows/       Windows 测试、构建与产物检查
handdrawn-preview.html   桌面版与网页预览共用的页面入口
```

界面使用原生 HTML / CSS / JavaScript，桌面壳使用 Electron，打包使用 electron-builder。无需前端框架或远程后端。`npm run icon` 可重新生成猫爪图标。

更多细节见 [架构说明](docs/ARCHITECTURE.md)、[素材说明](docs/ASSETS.md) 与 [贡献指南](CONTRIBUTING.md)。

</details>

## 🤝 一起让它更好用

拾序还在持续完善。欢迎通过 [Issues](https://github.com/womeimingzi/shixu/issues) 提交使用问题或想法，也欢迎改进无障碍体验、英文界面、日程时区设置与提醒规则。这些是后续方向，尚未作为现有功能提供。

提交截图或日志时，请先移除个人日程内容。参与方式见 [CONTRIBUTING.md](CONTRIBUTING.md)，版本变化见 [CHANGELOG.md](CHANGELOG.md)。

## 📄 开源协议

[MIT License](LICENSE) · Copyright © 2026 womeimingzi。你可以使用、修改和分发代码，保留协议与版权声明即可。角色与图标来源见 [素材说明](docs/ASSETS.md)，发行包中依赖组件保留各自的许可文件。

<div align="center">

<sub>A little order, every day.<br>一件一件，慢慢来。</sub>

</div>
