"use client";
import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Bot, Paperclip, X, Send } from "lucide-react";

interface Message { role: "user"|"model"; content: string; image?: string; }

export default function AIAssistantPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([
    { role:"model", content:"Hello! I'm your Construction AI Assistant. I can help with anything construction-related:\n\n• **Quantity estimation** — materials for walls, slabs, foundations, roofs\n• **Cost estimation** in PKR with 2026 Pakistan market rates\n• **Blueprint / floor plan analysis** — share an image for material take-off\n• **Project planning** — CPM scheduling, Gantt charts, WBS, milestones\n• **Contract management** — FIDIC, PPRA, variations, claims, EOT\n• **Health & Safety (HSE)** — risk assessments, method statements, PPE\n• **Procurement** — BOQ, tendering, vendor evaluation\n• **Finance & billing** — running bills, retention, GST/WHT, cash flow\n• **Labor management** — crew planning, Pakistani labor laws\n• **Equipment** — selection, productivity rates, hire costs\n\nYou can also **attach an image** (JPG, PNG, WebP) of a blueprint or drawing for analysis!" }
  ]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<File|null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Scroll so the TOP of the newest message is in view, not the bottom of
  // the whole thread — for a long AI response that means landing on its
  // first line instead of jumping past the end of it.
  useEffect(()=>{ lastMessageRef.current?.scrollIntoView({behavior:"smooth", block:"start"}); },[messages]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setImage(f);
      const reader = new FileReader();
      reader.onload = ev=>setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    }
  }

  function removeImage() { setImage(null); setImagePreview(""); if(fileRef.current) fileRef.current.value=""; }

  async function handleSend(ev?: React.FormEvent) {
    ev?.preventDefault();
    if (!input.trim() && !image) return;

    const userMsg: Message = { role:"user", content:input, image:imagePreview };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setImagePreview("");
    setLoading(true);

    const history = messages.slice(1).map(m=>({ role:m.role, content:m.content, image:m.image || null }));

    try {
      const formData = new FormData();
      formData.append("message", input);
      formData.append("history", JSON.stringify(history));
      if (image) formData.append("image", image);

      const res = await fetch("/api/ai-chat", { method:"POST", body:formData });
      const data = await res.json();

      setMessages(prev=>[...prev,{ role:"model", content:data.response||data.error||"Sorry, I encountered an error. Please try again." }]);
      setImage(null);
      if(fileRef.current) fileRef.current.value="";
    } catch {
      setMessages(prev=>[...prev,{role:"model",content:"Network error. Please check your connection and try again."}]);
    } finally { setLoading(false); }
  }

  function formatContent(text: string) {
    return text.split("\n").map((line,i)=>{
      const bold = line.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>");
      const bullet = line.startsWith("• ")||line.startsWith("- ");
      if (bullet) return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{__html:bold.replace(/^[•\-]\s*/,"")}} />;
      return <p key={i} className={line.trim()?"":"h-2"} dangerouslySetInnerHTML={{__html:bold}} />;
    });
  }

  const sampleQuestions = [
    "Calculate bricks, cement and sand for a 20×30 ft room with 10 ft walls",
    "Estimate cement, sand, aggregate for 500 sq ft RCC slab (M20)",
    "What is the cost to build a 1000 sq ft house in Pakistan 2026?",
    "How do I prepare a CPM schedule for a 6-month residential project?",
    "What are FIDIC contract clauses for extension of time (EOT)?",
    "Explain WHT and GST on construction contracts in Pakistan",
    "What PPE is required for concrete pouring work?",
    "How to prepare a BOQ for road construction per PPRA guidelines?"
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-sm"><Bot className="w-5 h-5" /></div>
        <div>
          <h1 className="font-semibold text-gray-900">Construction AI Assistant</h1>
          <p className="text-xs text-gray-500">Powered by Google Gemini · Construction, Project Management & ERP Expert</p>
        </div>
        <button onClick={()=>setMessages([{role:"model",content:"Chat cleared. How can I help you?"}])} className="ml-auto text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors">Clear Chat</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length<=1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            {sampleQuestions.map((q,i)=>(
              <button key={i} onClick={()=>{setInput(q);}} className="text-left p-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-colors">{q}</button>
            ))}
          </div>
        )}

        {messages.map((m,i)=>(
          <div key={i} ref={i===messages.length-1 ? lastMessageRef : undefined} className={`flex gap-3 ${m.role==="user"?"justify-end":""}`}>
            {m.role==="model" && <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0"><Bot className="w-4 h-4" /></div>}
            <div className={`max-w-3xl rounded-2xl px-4 py-3 ${m.role==="user"?"bg-blue-600 text-white ml-auto":"bg-white border border-gray-200 text-gray-800"}`}>
              {m.image && <img src={m.image} className="max-h-48 rounded-lg mb-2 object-contain" alt="uploaded" />}
              <div className={`text-sm space-y-1 leading-relaxed ${m.role==="user"?"text-white":""}`}>{formatContent(m.content)}</div>
            </div>
            {m.role==="user" && <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">{session?.user?.name?.[0]||"U"}</div>}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white"><Bot className="w-4 h-4" /></div>
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">{[0,1,2].map(i=><span key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.1}s`}}></span>)}</div>
              <span className="text-sm text-gray-500">Calculating...</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-4">
        {imagePreview && (
          <div className="mb-3 flex items-start gap-2">
            <img src={imagePreview} className="h-20 rounded-lg object-contain border border-gray-200" alt="preview" />
            <button onClick={removeImage} className="text-red-400 hover:text-red-600 p-1"><X className="w-4 h-4" /></button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-2 items-end">
          <button type="button" onClick={()=>fileRef.current?.click()} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 flex-shrink-0 transition-colors" title="Attach blueprint/image (JPG, PNG, WebP)"><Paperclip className="w-4 h-4" /></button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" onChange={handleImageChange} className="hidden" />
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}} placeholder="Ask about materials, costs, project planning, contracts, HSE, procurement, finance..." rows={2} className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={loading} />
          <button type="submit" disabled={loading||(!input.trim()&&!image)} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 flex-shrink-0 hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />Send</button>
        </form>
        <p className="text-xs text-gray-400 mt-2 text-center">Covers construction, project management, contracts, HSE, procurement, finance & more · Attach blueprints as images (JPG, PNG, WebP)</p>
      </div>
    </div>
  );
}
