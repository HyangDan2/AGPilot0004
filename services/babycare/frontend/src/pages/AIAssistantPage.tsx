import React, { useState, useEffect, useRef } from 'react';
import { useChild } from '../context/ChildContext';
import { api } from '../services/api';
import { AIChatMessage, SourceCitation } from '../types';
import {
  Send,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Bot,
  User as UserIcon,
  HelpCircle,
  Flag
} from 'lucide-react';

const SUGGESTED_PROMPTS = [
  '생후 3개월 아기가 침을 많이 흘리고 손을 빨아요',
  '분유 수유 후 트림을 안 하고 바로 잠들었는데 괜찮을까요?',
  '첫 이유식은 언제부터 시작해야 하나요?',
  '아기 체온이 38.3도인데 해열제 교차복용 기준이 궁금해요',
];

export const AIAssistantPage: React.FC = () => {
  const { activeChild } = useChild();

  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '안녕하세요! HD²LAB BabyCare 육아 AI 도우미 **향단이(HyangDani Baby AI)**입니다.\n\n대한민국 질병관리청, 보건복지부, 대한소아청소년과학회의 공인 표준 지침을 바탕으로 신뢰할 수 있는 육아 정보를 안내해 드립니다.\n궁금하신 점을 편하게 물어보세요!',
      created_at: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [useChildContext, setUseChildContext] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isSending) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const resp = await api.chatAI(
        text.trim(),
        activeChild?.id,
        useChildContext && !!activeChild
      );

      const assistantMsg: AIChatMessage = {
        id: resp.message_id || `asst-${Date.now()}`,
        role: 'assistant',
        content: resp.reply,
        sources: resp.sources,
        is_emergency: resp.is_emergency,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: AIChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '죄송합니다. 일시적인 통신 오류로 답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-6.5rem)] max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900">HyangDani Baby AI</h2>
              <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                RAG 공인 가이드 연동
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {activeChild ? `${activeChild.name} (생후 ${activeChild.months_since_birth ?? 0}개월) 맞춤 상담` : '일반 육아 상담'}
            </p>
          </div>
        </div>

        {/* Child Context Consent Switch */}
        {activeChild && (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={useChildContext}
              onChange={(e) => setUseChildContext(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>아이 프로필(월령·성장) 참조 동의</span>
          </label>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 shadow-sm text-sm leading-relaxed ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-xs'
                    : msg.is_emergency
                    ? 'bg-rose-50 border border-rose-300 text-rose-950 rounded-bl-xs'
                    : 'bg-slate-100/80 text-slate-800 rounded-bl-xs'
                }`}
              >
                {/* Emergency Flag */}
                {msg.is_emergency && (
                  <div className="flex items-center gap-2 mb-2 font-black text-rose-600 border-b border-rose-200 pb-1">
                    <AlertTriangle className="w-4 h-4" />
                    응급 징후 감지 안내
                  </div>
                )}

                <div className="whitespace-pre-line prose-sm">{msg.content}</div>

                {/* Source Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-1.5 text-xs">
                    <div className="font-bold text-slate-500 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      근거 자료 (공인 출처):
                    </div>
                    {msg.sources.map((s, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/70 p-2 rounded-xl">
                        <span className="font-medium text-slate-700 truncate mr-2">
                          [{s.organization}] {s.title}
                        </span>
                        {s.url && (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex-shrink-0 flex items-center gap-0.5 font-bold"
                          >
                            링크 <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 flex-shrink-0 mt-1">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isSending && (
          <div className="flex gap-3 justify-start items-center text-xs text-slate-400">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <span>향단이가 공인 육아 지침을 검색하여 답변을 생성 중입니다...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 whitespace-nowrap">
          <HelpCircle className="w-3 h-3" />
          추천 질문:
        </span>
        {SUGGESTED_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            className="text-xs bg-white border border-slate-200/80 px-3 py-1 rounded-full text-slate-600 whitespace-nowrap hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input box */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="아기 증상, 수유, 수면, 이유식 관련 질문을 입력하세요..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isSending}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white disabled:bg-slate-200 transition-all shadow-sm hover:bg-indigo-700"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[10px] text-slate-400 mt-2 text-center">
          ※ 본 AI 답변은 참고용 육아 정보이며 의학적 진단 및 처방을 대신할 수 없습니다. 응급 증상 시 즉시 119 또는 소아응급센터를 방문하세요.
        </p>
      </div>
    </div>
  );
};
