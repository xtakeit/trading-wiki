import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callDeepSeekStructuredOutput } from '@/lib/ai/model';
import { materialTypes } from '@/lib/types/material';
import { evidenceLevels } from '@/lib/types/fact';

const extractMaterialSchema = z.object({
  title: z.string().min(1),
  stocks: z.array(z.string()),
  themes: z.array(z.string()),
  materialType: z.enum(materialTypes),
  evidenceLevel: z.enum(evidenceLevels),
});

export async function POST(request: Request) {
  try {
    const { content } = await request.json() as { content: string };
    if (!content?.trim()) {
      return NextResponse.json({ ok: false, error: '内容不能为空' }, { status: 400 });
    }

    const system = '你是投研素材分析助手。从以下素材内容中提取关键信息，只输出JSON。';
    const user = [
      `素材内容:\n${content.slice(0, 3000)}`,
      '',
      '请输出以下字段:',
      '- title: 简洁标题（不超过25字，概括核心事件/信息）',
      '- stocks: 涉及的A股股票名称数组（如["京东方"]，没有则[]）',
      '- themes: 涉及的行业/主题数组（如["玻璃基板","显示面板"]，没有则[]）',
      `- materialType: 素材类型（${materialTypes.join(' | ')}）`,
      `- evidenceLevel: 证据强度（${evidenceLevels.join(' | ')}）`,
      '直接输出JSON，不要多余文字。',
    ].join('\n');

    const result = await callDeepSeekStructuredOutput(extractMaterialSchema, { system, user });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '提取失败' },
      { status: 500 },
    );
  }
}
