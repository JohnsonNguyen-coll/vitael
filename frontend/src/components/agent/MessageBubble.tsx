import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Copy, CheckCircle2, RotateCw } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#A998FF]/10 flex items-center justify-center border border-[#A998FF]/20 mr-4 shrink-0 mt-1 shadow-[0_0_15px_rgba(169,152,255,0.1)]">
          <Bot className="w-4 h-4 text-[#A998FF]" />
        </div>
      )}

      <div className={`flex flex-col ${isUser ? 'max-w-[78%] items-end sm:max-w-[72%]' : 'max-w-[88%] items-start'}`}>
        <div
          className={`px-5 py-4 rounded-3xl ${
            isUser
              ? 'bg-[#A998FF]/10 border border-[#A998FF]/20 text-white rounded-br-sm'
              : 'bg-black/20 border border-white/5 text-gray-200'
          }`}
        >
          <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                code(props) {
                  const {children, className} = props
                  const match = /language-(\w+)/.exec(className || '')
                  return match ? (
                    <div className="rounded-xl overflow-hidden my-4 border border-white/10">
                      <div className="bg-black/50 px-4 py-2 text-xs text-[#8991AF] font-mono flex justify-between items-center">
                        {match[1]}
                      </div>
                      <SyntaxHighlighter PreTag="div" language={match[1]} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', background: 'rgba(0,0,0,0.3)' }}>
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-[#A998FF] font-mono text-sm">
                      {children}
                    </code>
                  )
                },
                table(props) {
                  return (
                    <div className="overflow-x-auto my-4 rounded-xl border border-white/10 bg-black/20">
                      <table className="w-full text-left text-sm" {...props} />
                    </div>
                  )
                },
                th(props) {
                  return <th className="border-b border-white/10 bg-white/5 px-4 py-3 font-semibold text-[#A998FF]" {...props} />
                },
                td(props) {
                  return <td className="border-b border-white/5 px-4 py-3 text-gray-300 last:border-b-0" {...props} />
                }
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Message Actions */}
        {!isUser && (
          <div className="flex items-center space-x-2 mt-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={handleCopy}
              className="text-[#8991AF] hover:text-[#A998FF] transition-colors p-1"
              title="Copy message"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-[#A998FF]" /> : <Copy className="w-4 h-4" />}
            </button>
            <button 
              className="text-[#8991AF] hover:text-[#A998FF] transition-colors p-1"
              title="Regenerate"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
