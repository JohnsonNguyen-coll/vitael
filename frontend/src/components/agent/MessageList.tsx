import React from 'react';
import { type ChatMessage } from './ChatWindow';
import { MessageBubble } from './MessageBubble';
import { ToolCallCard } from './ToolCallCard';
import { TransactionPreviewCard } from './TransactionPreviewCard';

interface MessageListProps {
  messages: ChatMessage[];
  onStrategyStepSuccess?: () => void;
}

// Write tools that return unsigned transactions
const WRITE_TOOLS = [
  'deposit', 'withdraw', 'borrow', 'repay', 
  'swap', 'bridge', 'addLiquidity', 'removeLiquidity'
];

export function MessageList({ messages, onStrategyStepSuccess }: MessageListProps) {
  return (
    <div className="flex-1 w-full space-y-4">
      {messages.map((m) => (
        <div key={m.id}>
          {/* Render Text Content */}
          {m.content && m.content.trim().length > 0 && (
            <MessageBubble
              role={m.role as 'user' | 'assistant'}
              content={m.content}
              hasFollowUp={Boolean(m.toolInvocations?.length)}
            />
          )}

          {/* Render Tool Invocations */}
          <div className={m.role === "user" ? "" : "ml-10 max-w-[calc(100%-2.5rem)]"}>
          {m.toolInvocations?.map((toolInvocation) => {
            const toolCallId = toolInvocation.toolCallId;
            const toolName = toolInvocation.toolName;
            const isWriteTool = WRITE_TOOLS.includes(toolName);

            // Only show ToolCallCard if it's currently calling. 
            // Hide read tool results once they are done to reduce UI clutter.
            if (toolInvocation.state === 'call') {
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
                  <div key={toolCallId} className="mt-1">
                    <TransactionPreviewCard 
                      toolName={toolName} 
                      args={toolInvocation.args} 
                      unsignedTx={unsignedTx} 
                      onStrategyStepSuccess={m.strategyExecution ? onStrategyStepSuccess : undefined}
                    />
                  </div>
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
        </div>
      ))}
    </div>
  );
}
