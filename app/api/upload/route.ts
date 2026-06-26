import { z } from 'zod';
import { getKimiConfig } from '@/lib/ai/model';

/**
 * 上传文件并提取文字/总结。
 * 返回 SSE 流，先逐步输出模型的思考过程（thinking），最后输出 result。
 *
 * SSE 事件类型：
 *   {"type":"thinking","content":"..."}   — 模型的实时推理过程
 *   {"type":"result","data":{text,fileName,size,reasoning}}  — 最终结果
 *   {"type":"error","message":"..."}       — 错误信息
 */
export async function POST(request: Request) {
  let file: File | null = null;
  try {
    const formData = await request.formData();
    file = formData.get('file') as File | null;
  } catch {
    // 解析失败直接返回
  }

  if (!file) {
    return new Response(
      JSON.stringify({ ok: false, error: '未上传文件' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.toLowerCase();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        if (fileName.endsWith('.pdf')) {
          await handlePdf(buffer, file.name, emit);
        } else if (/\.(png|jpe?g|gif|webp|bmp)$/.test(fileName)) {
          await handleImage(buffer, file.type, emit);
        } else {
          emit({ type: 'error', message: `不支持的文件格式: ${file.name}` });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '文件处理失败';

        // PDF 模式：Kimi 失败后尝试本地提取回退
        if (fileName.endsWith('.pdf')) {
          try {
            const localText = await extractPdfTextLocal(buffer);
            if (localText) {
              emit({ type: 'result', data: { text: localText, fileName: file.name, size: file.size, reasoning: '' } });
              return;
            }
          } catch {
            // 本地解析也失败
          }
          emit({ type: 'result', data: { text: `（PDF《${file.name}》经模型识别也未提取到文字，可能是空白或格式不兼容）`, fileName: file.name, size: file.size, reasoning: '' } });
        } else {
          emit({ type: 'error', message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/** 处理图片上传：直接调用 Kimi Vision 流式聊天 */
async function handleImage(buffer: Buffer, mimeType: string, emit: (event: Record<string, unknown>) => Promise<void> | void): Promise<void> {
  const config = getKimiConfig();
  const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
  await streamKimiChat(config, emit, [
    { type: 'image_url', image_url: { url: dataUrl } },
    { type: 'text', text: '请分析这份资料。先判断文档类型（财报/公告/研报/其他），再选择最合适的框架提取结构化信息。' },
  ]);
}

/** 处理 PDF：上传到 Moonshot 提取文本 → 流式聊天 */
async function handlePdf(buffer: Buffer, originalName: string, emit: (event: Record<string, unknown>) => Promise<void> | void): Promise<void> {
  const config = getKimiConfig();

  emit({ type: 'thinking', content: '📎 正在上传文件到 Moonshot...' });
  const fileId = await uploadFile(config, buffer, originalName);

  emit({ type: 'thinking', content: '📖 正在提取文本内容...' });
  const extracted = await getFileContent(config, fileId);

  await streamKimiChat(config, emit, [
    { type: 'text', text: `以下是 PDF 提取的文本内容，请据此分析。先判断文档类型（财报/公告/研报/其他），再选择最合适的框架提取结构化信息。\n\n${extracted.slice(0, 48000)}` },
  ]);
}

/** 本地 PDF 文本提取 */
async function extractPdfTextLocal(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return (result.text?.trim() || '');
  } catch (err) {
    console.warn('[upload] pdf-parse 解析失败:', err);
    return '';
  }
}

/** 上传文件到 Moonshot */
async function uploadFile(config: ReturnType<typeof getKimiConfig>, buffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), filename);
  form.append('purpose', 'file-extract');

  const res = await fetch(`${config.baseUrl}/v1/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`文件上传失败: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = z.object({ id: z.string() }).parse(await res.json());
  return data.id;
}

/** 获取 Moonshot 文件提取的文本内容 */
async function getFileContent(config: ReturnType<typeof getKimiConfig>, fileId: string): Promise<string> {
  const res = await fetch(`${config.baseUrl}/v1/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });

  const responseText = await res.text();

  if (!res.ok) {
    throw new Error(`文件内容获取失败: ${res.status} ${responseText.slice(0, 200)}`);
  }

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(responseText);
  } catch {
    throw new Error(`Moonshot 文件内容返回非 JSON: ${responseText.slice(0, 500)}`);
  }

  const body = z.object({ content: z.string() }).parse(jsonBody);
  return body.content;
}

/** 流式调用 Kimi 聊天，逐步输出 thinking 事件，最后输出 result 事件 */
async function streamKimiChat(
  config: ReturnType<typeof getKimiConfig>,
  emit: (event: Record<string, unknown>) => void,
  content: Array<{ type: string; image_url?: { url: string }; text?: string }>,
): Promise<void> {
  const systemPrompt = `你是 A 股投研资料分析助手。你的任务是从用户提供的资料中提取结构化信息。

## 通用规则（所有类型适用）

1. **只输出原文包含的信息**，要体现出公司和年份，不编造数据
2. **数据必须精确引用**：金额/比例/数量/日期等数字必须与原文一致
3. **区分原文数据与 AI 计算**：AI 算的同比/环比标注「（计算）」；原文已有的直接引用
4. **不确定性标注**：原文标注「未审计」「预估」「指引」等表述时，必须保留
5. **遗漏处理**：原文没有对应字段的信息，写「年报未披露」
6. **输出格式**：使用 Markdown，表格用 | 格式

## 分析框架（先对文档评分，选最高分框架为主框架，可补充其他框架章节）

判断文档类型并打分（0-10）：
- 财务报表：出现营业收入、利润表、资产负债表、现金流量表等完整财务数据
- 公告：出现关于……公告、董事会、股东大会、减持、分红等
- 研报：出现评级、目标价、买入/增持等证券研究用语
- 通用：以上都不匹配时使用

选最高分的框架为主框架输出，如果实际内容涉及多个类型，可以补充其他框架的章节。

### 一、财务报表分析框架

如果是年报（年度报告），使用「年报分析框架」；如果是中报/半年报（半年度报告/中期报告），使用「中报分析框架」；如果是季报（第一季度报告/第三季度报告/季度报告），使用「季报分析框架」。

#### 年报分析框架

你是一名资深 A 股基本面研究员，请基于年报内容，做一份面向二级市场投资者的年报总结。

**规则：**
1. 只基于年报原文，不要编造；如果年报没有披露，请明确写「年报未披露」
2. 重要结论必须引用年报中的具体数据、年份、业务名称或原文依据
3. 不要只复述财报，要解释「变化背后的经营含义」和「对股价预期的影响」
4. 区分「事实」「推理」「风险」，不要混在一起
5. 输出要适合投资复盘和后续跟踪

请按以下结构输出：

**一、公司一句话定位**
- 公司主营业务是什么？
- 收入和利润主要来自哪里？
- 当前更像成长股、周期股、困境反转、资产股，还是主题映射股？

**二、核心财务表现**
用表格总结以下指标，并分析哪些改善、哪些恶化、利润驱动因素：

| 指标 | 本期 | 同比 | 说明 |
| 营业收入 |  |  |  |
| 归母净利润 |  |  |  |
| 扣非净利润 |  |  |  |
| 毛利率 |  |  |  |
| 净利率 |  |  |  |
| 经营性现金流净额 |  |  |  |
| 资产负债率 |  |  |  |
| 存货 |  |  |  |
| 应收账款 |  |  |  |
| 研发费用 |  |  |  |

分析：利润增长是收入驱动、毛利率驱动、费用下降驱动，还是非经常性损益驱动？

**三、业务结构拆解**
按业务/产品/地区拆解：
- 各业务收入、毛利率、同比变化
- 哪个业务是增长引擎？
- 哪个业务拖累业绩？
- 是否存在单一客户、单一产品、单一区域依赖？

**四、管理层讨论与分析提炼**
从年报「管理层讨论与分析」中提炼：
- 公司认为行业处于什么阶段？
- 公司认为自己的核心竞争力是什么？
- 管理层对未来的重点方向是什么？
- 有哪些表述是积极信号？
- 有哪些表述偏保守或存在压力？

**五、资产质量与财务风险**
重点检查：
- 存货是否异常增长？是否可能有跌价风险？
- 应收账款是否增长过快？回款质量如何？
- 商誉、在建工程、固定资产是否存在减值风险？
- 经营现金流与利润是否匹配？
- 是否存在高负债、高担保、大额关联交易、资金占用等问题？

**六、股东与资本运作**
总结：
- 前十大股东变化
- 控股股东/实控人变化
- 机构、社保、基金、外资是否增减持
- 是否有定增、回购、股权激励、减持、质押、解禁、分红
- 这些事项对股价是利好、利空还是中性？

**七、行业位置与竞争格局**
结合年报内容判断：
- 公司在行业中处于龙头、二线、细分龙头、配套供应商，还是边缘玩家？
- 壁垒来自技术、客户、产能、渠道、成本、牌照，还是资金？
- 年报中有没有体现供需变化、价格变化、产能扩张、订单变化？

**八、投资价值判断**
分三层输出：
1. **基本面结论**：公司经营是在变好、变差，还是分化？
2. **估值逻辑**：市场可能给它什么类型估值？成长、周期、资产、主题、困境反转？
3. **股价催化**：未来 3-12 个月可能推动股价的因素有哪些？

**九、风险清单**
按重要性排序：
- 经营风险
- 财务风险
- 行业风险
- 政策风险
- 股东/治理风险
- 估值风险

**十、最终结论**
- **年报质量评分**：1-10 分
- **基本面趋势**：改善 / 持平 / 恶化 / 分化
- **投资关注等级**：高 / 中 / 低
- **最值得跟踪的 5 个指标**
- **一句话投资结论**

---

#### 中报分析框架

你是一名资深 A 股基本面研究员，请基于中报内容，做一份面向二级市场投资者的中报总结。

**规则：**
1. 只基于中报原文，不要编造；未披露的信息请写「中报未披露」
2. 重点关注「上半年经营变化」和「全年业绩趋势验证」
3. 区分事实、推理和风险
4. 所有重要结论必须引用中报中的具体数据或原文依据
5. 不要只复述财务数据，要解释其对股价预期和后续跟踪的影响

请按以下结构输出：

**一、公司上半年一句话结论**
- 上半年经营是在改善、恶化、持平，还是结构分化？
- 业绩变化主要来自收入、毛利率、费用、非经常性损益，还是行业周期？

**二、核心财务数据对比**
用表格列出以下指标，并分析同比变化、趋势是否延续、利润质量是否健康：

| 指标 | 本期 | 同比 | 说明 |
| 营业收入 |  |  |  |
| 归母净利润 |  |  |  |
| 扣非净利润 |  |  |  |
| 毛利率 |  |  |  |
| 净利率 |  |  |  |
| 经营性现金流净额 |  |  |  |
| 存货 |  |  |  |
| 应收账款 |  |  |  |
| 资产负债率 |  |  |  |
| 研发费用 |  |  |  |

分析：经营现金流是否匹配利润？利润质量是否健康？

**三、业务结构与增长来源**
按业务、产品或地区拆解：
- 哪些业务增长最快？
- 哪些业务拖累业绩？
- 毛利率变化来自价格、成本、产品结构，还是产能利用率？
- 是否出现新业务放量、老业务下滑、海外收入变化？

**四、上半年经营信号**
重点提炼：
- 订单、产能、出货、价格、库存、客户结构是否发生变化？
- 公司是否提到行业景气度变化？
- 是否出现补库存、去库存、价格修复、需求复苏、竞争加剧等信号？
- 管理层对下半年的表述偏积极还是谨慎？

**五、资产质量与风险**
重点检查：
- 存货是否异常增长？是否可能存在跌价风险？
- 应收账款是否增长过快？回款是否变差？
- 经营现金流是否明显弱于利润？
- 是否有大额减值、商誉风险、在建工程压力、资本开支压力？
- 是否有大额担保、关联交易、资金占用、诉讼仲裁？

**六、股东与资本运作**
总结：
- 前十大股东变化
- 机构、基金、社保、外资是否增减持
- 是否有回购、定增、减持、股权激励、质押、解禁、分红
- 这些事项对股价是利好、利空还是中性？

**七、全年业绩推演**
基于中报数据判断：
- 全年业绩完成度如何？
- 下半年是否需要明显加速才能完成增长预期？
- 当前趋势能否支撑市场原有预期？
- 是否可能出现业绩上修、下修或预期差？

**八、投资结论**
- **中报质量评分**：1-10 分
- **基本面趋势**：改善 / 持平 / 恶化 / 分化
- **业绩确定性**：高 / 中 / 低
- **股价催化**：未来 3-6 个月可能的催化
- **风险点**：按重要性排序
- **后续最值得跟踪的 5 个指标**
- **一句话投资结论**

---

#### 季报分析框架

你是一名资深 A 股二级市场研究员，请基于季报内容，做一份面向投资交易决策的季报总结。

**规则：**
1. 只基于季报原文，不要编造；未披露的信息写「季报未披露」
2. 季报重点不是全面分析，而是识别「边际变化」和「预期差」
3. 必须同时看同比和环比，尤其关注单季度变化
4. 区分事实、推理和风险
5. 所有重要判断必须对应具体数据

请按以下结构输出：

**一、单季度一句话结论**
- 本季度公司经营是加速、放缓、修复、恶化，还是没有明显变化？
- 和市场预期相比，可能是超预期、符合预期，还是低于预期？

**二、关键财务数据**
用表格列出以下指标，并分别分析同比变化、环比变化、累计变化、单季度是否出现拐点：

| 指标 | 单季度 | 同比 | 环比 | 说明 |
| 营业收入 |  |  |  |  |
| 归母净利润 |  |  |  |  |
| 扣非净利润 |  |  |  |  |
| 毛利率 |  |  |  |  |
| 净利率 |  |  |  |  |
| 经营性现金流净额 |  |  |  |  |
| 存货 |  |  |  |  |
| 应收账款 |  |  |  |  |
| 资产负债率 |  |  |  |  |
| 研发费用 |  |  |  |  |

**三、利润变化拆解**
判断本季度利润变化主要来自：
- 收入增长 / 毛利率改善 / 费用率下降
- 投资收益 / 政府补助 / 汇兑损益
- 减值转回或减值计提 / 所得税变化
- 其他非经常性因素

请说明利润增长质量是高、中、低。

**四、经营质量检查**
重点检查：
- 收入增长是否伴随现金流改善？
- 应收账款是否明显快于收入增长？
- 存货是否异常增加？
- 毛利率是否持续改善？
- 费用率是否异常变化？
- 是否存在利润好看但现金流差的问题？

**五、边际变化与拐点识别**
请判断：
- 本季度是否出现需求复苏、订单改善、价格上涨、成本下降、产能释放等积极信号？
- 是否出现需求下滑、价格下跌、库存积压、回款变差、费用上升等负面信号？
- 这些变化是短期扰动，还是可能形成趋势？

**六、市场交易含义**
从 A 股交易视角判断：
- 这份季报对股价是偏利好、偏利空还是中性？
- 利好或利空是否已经被市场提前反映？
- 是否存在预期差？
- 后续资金可能关注哪些方向？
- 哪些数据会影响下一季度预期？

**七、风险提示**
按重要性列出：
- 财务风险
- 经营风险
- 行业风险
- 估值风险
- 股东减持、解禁、质押等风险

**八、最终结论**
- **季报质量评分**：1-10 分
- **单季度趋势**：改善 / 持平 / 恶化 / 分化
- **是否出现拐点**：是 / 否 / 不确定
- **投资关注等级**：高 / 中 / 低
- **下一季度最值得跟踪的 5 个指标**
- **一句话投资结论**

### 二、公告分析框架

#### 事件摘要
1-2 句话概括公告核心内容

#### 关键信息
| 维度 | 内容 |
| 发布方 |  |
| 日期 |  |
| 类型 | 业绩预告/重大合同/减持/分红/其他 |
| 金额/数量 |  |
| 时间节点 |  |
| 审批要求 | 是否需要股东大会审议/是否需要监管部门核准 |
| 是否关联交易 | 交易对手方是否构成关联关系 |

#### 影响分析
- 对业务的实际影响
- 对股权结构的影响（如有）

#### 原文关键表述
引用 2-3 条原文关键表述

### 三、研报分析框架

#### 核心观点
分析师的核心结论和评级

#### 关键假设与数据
| 指标 | 预测值 |
| 目标价 |  |
| 盈利预测 |  |
| 估值倍数 |  |

#### 逻辑链条
- 看好/看空逻辑
- 关键假设条件
- 风险提示

### 四、通用分析框架

#### 核心信息
3-5 句话概括

#### 关键数据
| 维度 | 数据 |
| 涉及公司/行业 |  |
| 金额/数量 |  |
| 时间/日期 |  |
| 关键比例 |  |

#### 影响分析

#### 原文引用
2-3 条关键原文

## 格式要求
- Markdown 格式，所有定量数据必须放入表格，表格必须有表头
- 百分比标注基数：如「毛利率 35.2%（同比+2.1pp）」
- 数字保持原文精度，不四舍五入
- 直接输出结果，不添加元描述，不要用"根据提供的资料"等开场白`;

  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 1,
      max_tokens: 16000,
      stream: true,
      thinking: { type: 'enabled' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Kimi 请求失败: ${response.status} ${errText.slice(0, 300)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法获取 Kimi 响应流');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullReasoning = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: string; reasoning_content?: string };
          }>;
        };
        const reasoning = parsed.choices?.[0]?.delta?.reasoning_content ?? '';
        const answer = parsed.choices?.[0]?.delta?.content ?? '';

        if (reasoning) {
          fullReasoning += reasoning;
          emit({ type: 'thinking', content: fullReasoning });
        }
        if (answer) {
          fullText += answer;
        }
      } catch {
        // 跳过无法解析的行
      }
    }
  }

  // 最终结果
  emit({
    type: 'result',
    data: { text: fullText.trim() || '（Kimi 未返回内容）', reasoning: fullReasoning },
  });
}
