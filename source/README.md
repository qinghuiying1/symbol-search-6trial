# 符号搜索：六试次独立网站

为Xiaomi Pad 6 Pro的Edge浏览器竖屏使用制作。流程：研究编号 → 说明 → 六题 → 汇总 → 导出。每次生成独立随机配对，不设练习或预实验流程。

## 使用

1. 在线打开HTTPS网址，点击“准备离线”，等待明确显示准备完成。
2. 将平板竖放，输入研究编号，阅读说明后开始六题。浏览器支持时自动全屏。
3. 点选下方与上方任一组完全相同的一组，每题仅记录首次选择。
4. 完成后查看正确数、正确率、正确题中位反应时（毫秒），导出ZIP并转存电脑。
5. 可在记录列表按研究编号查找；支持单次与本机全部记录导出。

数据保存在此设备、此浏览器的IndexedDB中，不上传到GitHub。换浏览器、换设备不会自动同步。请保留网站数据并导出备份。生成下载不等于文件已成功转存。

## 技术

- TypeScript、Vite；M2C2 Symbol Search 0.8.35、Session 0.3.19、Core 0.3.37，依赖锁定于pnpm-lock.yaml。
- 原生400×800布局，显式 `stretch:true` 等比放大；保留上三下二卡片布局、24个符号。没有CSS二次拉伸画布。
- 六个试次，左右正确位置各三题，诱饵和非诱饵各三题。每轮独立种子，原始数据保留种子及逐题刺激。
- 题间静态等待配置200毫秒，关闭动画；浏览器显示间隔受帧调度影响，不宣称实际显示恰为200毫秒。
- 原依赖关闭动画分支使用了不一致的参数名，postinstall运行 `scripts/patch-symbol-search.mjs` 修复读取名称。
- 原始RT采用SDK刺激出现至首次点选的本机计时，不由总时间估算；不设置固定RT范围或正确率剔除阈值。
- 六题全部完成才输出完整汇总；没有正确题时中位反应时缺失。刷新、关闭、切后台、锁屏或主动退出保留未完成记录，另开新轮不拼接。旋转不重置原始RT。
- 数据库 `symbol-search-6trial`，缓存前缀 `symbol-search-6trial-static-`，Service Worker作用域为本站项目路径。不会清除其他网站或原EMA项目记录。
- 浏览器生成真XLSX（使用JSZip打包最小OOXML，无云端Excel服务）。研究编号为文本，评分为数值；JSON保留完整原始记录。

## 构建

使用Node.js 22或更高版本和pnpm：

```text
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm preview
node scripts/package-release.mjs
```

预览：`http://localhost:4176/symbol-search-6trial/`。完整发布静态文件在dist/；当前发布包只收录清单内的本次构建文件，不收录历史哈希文件或测评导出记录。不要以file://双击HTML运行。

## 发布

新仓库：qinghuiying1/symbol-search-6trial。上传发布包site内容至仓库docs目录、source内容至source目录。Pages选择main分支、/docs。预定网址：<https://qinghuiying1.github.io/symbol-search-6trial/>。

程序和材料公开托管，患者记录不进入仓库。更新保留程序与任务版本，不在正在测评时激活新版本。

## 来源与许可

任务实现复用M2C2开源SDK：<https://github.com/m2c2-project/m2c2kit/tree/main/packages/assessment-symbol-search>。保留的依赖许可见public/licenses及SDK资源目录。六题竖屏适配及技术核查不代表这个六题版本已获得特定研究人群的心理测量学验证。

操作说明及平板验收见docs/操作说明.md。技术核查使用隔离浏览器的模拟编号，与用户实际记录分开。
