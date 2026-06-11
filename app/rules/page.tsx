import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";

export default function RulesPage() {
  const rulePath = path.join(process.cwd(), "rule.md");
  const markdown = fs.readFileSync(rulePath, "utf8");

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-ink shadow-sm ring-1 ring-ink/10"
      >
        <ArrowLeft size={16} />
        返回首页
      </Link>
      <article className="markdown-body rounded-lg bg-white/88 p-5 shadow-soft ring-1 ring-ink/10 sm:p-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>
    </main>
  );
}
