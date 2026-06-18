import React, { useEffect, useRef } from 'react';
import { type ChatMessage } from './ChatWindow';
import { MessageBubble } from './MessageBubble';
import { ToolCallCard } from './ToolCallCard';
import { TransactionPreviewCard } from './TransactionPreviewCard';

interface MessageListProps {
  messages: ChatMessage[];
}

// Write tools that return unsigned transactions
const WRITE_TOOLS = [
  'deposit', 'withdraw', 'borrow', 'repay', 
  'swap', 'bridge', 'addLiquidity', 'removeLiquidity'
];

export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      {messages.map((m) => (
        <div key={m.id}>
          {/* Render Text Content */}
          {m.content && m.content.trim().length > 0 && (
            <MessageBubble role={m.role as 'user' | 'assistant'} content={m.content} />
          )}

          {/* Render Tool Invocations */}
          {m.toolInvocations?.map((toolInvocation) => {
            const toolCallId = toolInvocation.toolCallId;
            const toolName = toolInvocation.toolName;
            const isWriteTool = WRITE_TOOLS.includes(toolName);

            // If it's a read tool or currently "calling", show ToolCallCard
            if (toolInvocation.state === 'call' || (!isWriteTool && toolInvocation.state === 'result')) {
              // Optionally, hide read tool results once they are done by only showing if state === 'call'.
              // But for transparency, we can show CheckCircle2.
              return (
                <ToolCallCard 
                  key={toolCallId} 
                  toolName={toolName} 
                  state={toolInvocation.state} 
                />
              );
            }

            // If it's a write tool and has a result (unsigned tx), show Transaction Preview
            if (isWriteTool && toolInvocation.state === 'result') {
              const unsignedTx = toolInvocation.result;
              // Ensure we received a valid tx payload before rendering
              if (unsignedTx && unsignedTx.to) {
                return (
                  <TransactionPreviewCard 
                    key={toolCallId} 
                    toolName={toolName} 
                    args={toolInvocation.args} 
                    unsignedTx={unsignedTx} 
                  />
                );
              } else {
                return (
                  <MessageBubble 
                    key={`${toolCallId}-err`} 
                    role="assistant" 
                    content={`Failed to generate transaction: ${JSON.stringify(unsignedTx)}`} 
                  />
                );
              }
            }

            return null;
          })}
        </div>
      ))}
    </div>
  );
}
