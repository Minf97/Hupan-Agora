import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Users, MessageSquareText } from 'lucide-react';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">欢迎来到斯坦福小镇</h1>
        <p className="text-xl text-muted-foreground">
          一个 multi-agent 数字人小镇，数字人拥有记忆、反思和交流能力
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card rounded-lg p-6 shadow-sm">
          <div className="mb-4 text-3xl">
            <Users className="inline-block mr-2" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">小镇居民</h2>
          <p className="mb-6 text-muted-foreground">
            探索小镇居民，了解他们的个性、背景故事和目标。每个数字人都有自己独特的性格和行为模式。
          </p>
          <Link href="/agents">
            <Button>查看居民</Button>
          </Link>
        </div>

        <div className="bg-card rounded-lg p-6 shadow-sm">
          <div className="mb-4 text-3xl">
            <MessageSquareText className="inline-block mr-2" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">对话交流</h2>
          <p className="mb-6 text-muted-foreground">
            与小镇居民进行对话，他们会根据自己的记忆和性格与您交流，并会记住您的对话内容。
          </p>
          <Link href="/conversations">
            <Button>开始对话</Button>
          </Link>
        </div>
      </div>

      <div className="mt-12 bg-card rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">关于斯坦福小镇</h2>
        <p className="mb-4">
          斯坦福小镇是一个基于先进AI技术的数字小镇模拟项目，灵感来源于斯坦福大学的研究。
          在这里，每个数字人都有自己的个性、记忆和目标，可以独立思考并与其他数字人和访客交流。
        </p>
        <p>
          数字人的记忆存储在向量数据库中，使他们能够检索相关记忆并根据过去的经历做出反应。
          通过交流，您可以了解每个数字人的独特视角和故事。
        </p>
      </div>
    </div>
  );
}
