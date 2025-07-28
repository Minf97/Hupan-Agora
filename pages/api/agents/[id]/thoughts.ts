// pages/api/agents/[id]/thoughts.ts - 获取Agent思考记录的API
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const agentId = parseInt(id as string);

  if (isNaN(agentId)) {
    return res.status(400).json({ error: 'Invalid agent ID' });
  }

  try {
    console.log(`🧠 获取Agent ${agentId} 的思考记录`);
    
    // 从Supabase获取思考记录，按时间倒序，限制最近100条
    const { data: thoughts, error } = await supabase
      .from('thoughts')
      .select('*')
      .eq('agentId', agentId)
      .order('createdAt', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    console.log(`✅ 成功获取Agent ${agentId} 的 ${thoughts?.length || 0} 条思考记录`);
    return res.status(200).json(thoughts || []);

  } catch (error) {
    console.error(`❌ 获取Agent ${agentId} 思考记录失败:`, error);
    return res.status(500).json({ 
      error: 'Failed to fetch agent thoughts', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}