# Yuewen Export — 作家助手小说导出

非官方的本地导出工具，同时提供独立命令行和 Codex 技能插件。采用 MIT 许可证。

## 获取与运行

从本仓库的 Code → Download ZIP 下载并解压，或克隆仓库。在项目目录打开 PowerShell，执行下面的命令。建议使用 Node.js 22 或更新版本，确保 `node --version` 可以运行。无需 npm install。

Codex 本地技能插件，读取 Windows x64 作家助手（YuewenEdit）已保存的本地章节。需要 Node.js；复用本机作家助手的 SQLCipher 模块，不分发应用原生二进制。

```powershell
node ./scripts/export.cjs --list
node ./scripts/export.cjs --title '示例小说' --out './novel-exports'
```

每次独立目录，包含章节 TXT、全文.txt、保留所有章节字段的 raw.json，以及带 SHA-256 的 manifest.json。章节文件名加唯一序号，处理 Windows 文件名限制。原始正文按存储内容保留，不擅自转换 HTML 实体或富文本。

可选参数：`--book-id`、`--profile`、`--install-dir`、`--logs-dir`。书名精确匹配，多匹配拒绝导出，SQL 使用绑定参数。默认排除删除章节。

范围：本地已有、已保存的数据；不保证包含未保存编辑或云端章节。只有富文本字段而缺少 content 的章节会明确报告警告。目录顺序沿用本地 chaptersort，不推测章节数字顺序。不提供写回、同步、发布功能。

兼容性依赖作家助手内部数据库结构与密钥派生逻辑；应用升级可能需要更新插件。无法发现数据库时，先登录作家助手并打开作品。访问拒绝时使用 Codex 正常权限审批。插件代码无网络请求；通过 Codex 阅读导出文件时，内容会进入该会话。

## Codex 使用

仓库根目录包含 `.codex-plugin/plugin.json` 和 `skills/export-novel/SKILL.md`。在支持本地插件的 Codex 环境中将本目录作为插件源注册。不同客户端的插件安装入口可能不同；没有插件入口时，可让 Codex 在本项目中按上述命令执行导出，或直接使用命令行。

## 验证与限制

当前已验证 Windows x64 作家助手 5.20.0 的本地数据库读取。其他版本尚未保证兼容，不支持 macOS/Linux 上的真实数据库读取。CI 仅使用虚构文本验证导出逻辑，不包含或访问真实账户数据。

```powershell
node --check scripts/export.cjs
node --test scripts/export.test.cjs
```

插件会从本地应用日志发现账户标识，在内存中派生数据库读取密钥。不会打印密钥或上传日志。导出文件本身包含小说与本地标识，请将整个导出目录视为私密资料，不要提交到公开仓库。详见 [SECURITY.md](SECURITY.md)。

## 许可证

[MIT](LICENSE)。作家助手及其原生依赖不包含在本仓库中，也不由本项目重新许可。本项目与作家助手官方无隶属关系。
