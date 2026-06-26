# Debug Session: viewpoint-ai-error

- Status: OPEN
- Symptom: `AI 蒸馏观点` 触发报错，待确认是前端请求、接口校验、模型调用还是响应解析失败。
- Scope: `/viewpoints/new` -> `/api/ai/extract-viewpoint` -> `lib/ai/*`

## Hypotheses

1. 前端提交的请求字段不完整，触发接口 `zod` 校验失败并返回 400。
2. DeepSeek 请求参数或模型配置不被当前接口接受，触发上游 4xx/5xx。
3. DeepSeek 返回内容不是纯 JSON，对结构化解析逻辑造成失败。
4. 前端对失败响应的解析或提示不完整，掩盖了真实后端错误信息。
5. 本地运行环境未正确加载 `.env.local`，导致请求到 AI 层时缺少关键配置。

## Evidence Log

- 已确认 `.env.local` 存在 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL=deepseek-v4-pro`。
- 已确认接口入口使用 `requestSchema` 校验 `rawText`、`author`、`platform`、`date` 四个字段。
- 用户提供真实报错:
  - `stance` 收到 `中性`
  - `time_horizon` 收到空字符串
  - `confidence` 收到数字
- 由此确认问题不在前端入参，而在模型输出值域与本地 `zod` 协议不一致。

## Next Step

- 已完成服务端兼容修复:
  - `stance` 支持中文/同义值归一化到英文枚举
  - `time_horizon` 支持空字符串映射为 `unknown`
  - `confidence` 支持数字分档和中文标签归一化
  - `prompt` 明确要求只返回英文枚举
- 已新增回归测试覆盖上述异常值场景。
