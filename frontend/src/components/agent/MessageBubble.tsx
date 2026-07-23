import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { AgentMark } from './AgentIdentity';

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
      
      <div className={`flex flex-col ${isUser ? 'max-w-[78%] items-end sm:max-w-[72%]' : 'max-w-[92%] items-start'}`}>
        {!isUser && (
          <div className="mb-2 flex items-center gap-2">
            <AgentMark compact />
            <div><p className="text-[11px] font-semibold text-[#c8cad3]">Vitael Agent</p><p className="text-[9px] text-[#656c80]">Onchain intelligence</p></div>
          </div>
        )}
        <div
          className={`px-5 py-4 rounded-3xl ${
            isUser
              ? 'bg-[#20212a] border border-white/[0.08] text-white rounded-br-md'
              : 'bg-transparent border border-transparent text-[#d7d9e0] px-0'
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
                    <code className="bg-white/[0.07] px-1.5 py-0.5 rounded text-[#c9c3ed] font-mono text-sm">
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
                  return <th className="border-b border-white/10 bg-white/5 px-4 py-3 font-semibold text-[#d5d7df]" {...props} />
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
              className="p-1 text-[#71788c] transition-colors hover:text-white"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#8bd7b7]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
