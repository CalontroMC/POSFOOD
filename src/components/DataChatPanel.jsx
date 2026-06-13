import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2, MessageSquare, AlertCircle } from "lucide-react";
import { getToken } from "../lib/api.js";

export default function DataChatPanel() {
  const token = getToken();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Add empty assistant message that will be populated via SSE
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ messages: newMessages })
      });

      if (!res.ok) {
        throw new Error("Failed to connect to chat API");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              if (dataStr === "[DONE]") {
                done = true;
                break;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.error) {
                  setMessages((prev) => {
                    const next = [...prev];
                    next[next.length - 1].content += `\n\n**Error:** ${data.error}`;
                    return next;
                  });
                } else if (data.content) {
                  setMessages((prev) => {
                    const next = [...prev];
                    next[next.length - 1].content += data.content;
                    return next;
                  });
                }
              } catch (e) {
                // partial JSON, wait for next buffer (though SSE normally sends full JSON per line)
                console.error("Parse error:", e, dataStr);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1].content = `**Error:** Could not connect to AI service. (${error.message})`;
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-[500px] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
          <MessageSquare size={16} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">FoodPOS AI</h3>
          <p className="text-xs text-gray-500">สอบถามวิเคราะห์ข้อมูลร้านอาหาร</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquare size={40} className="mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-600">ยังไม่มีข้อความ</p>
            <p className="mt-1 text-xs text-gray-400">
              ลองถามว่า: "วันนี้ขายอะไรดีที่สุด", "วัตถุดิบอะไรใกล้หมดบ้าง"
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-none"
                  : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"
              }`}
            >
              {m.role === "user" ? (
                <div className="whitespace-pre-wrap">{m.content}</div>
              ) : (
                <div className="prose prose-sm prose-indigo max-w-none [&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:mt-1 [&>ul]:mb-2 [&>li]:my-0.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-tl-none bg-white border border-gray-100 px-4 py-3 text-sm text-gray-500 shadow-sm">
              <Loader2 size={14} className="animate-spin text-indigo-600" />
              กำลังวิเคราะห์ข้อมูล...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-100 bg-white p-3">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500"
        >
          <textarea
            rows={1}
            className="max-h-32 min-h-[40px] w-full resize-none bg-transparent py-2 pl-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            placeholder="ถามเกี่ยวกับยอดขาย หรือข้อมูลร้าน..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="mb-1 mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
