import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `Você é um Engenheiro de Qualidade e Especialista em Normas Técnicas altamente experiente. Sua função é auxiliar o usuário a encontrar normas (ABNT/NBR), especificações técnicas e condições de execução para a construção civil, indústria e engenharia.

Sempre que o usuário solicitar uma informação, você deve estruturar sua resposta seguindo rigorosamente os seguintes critérios:

1. IDENTIFICAÇÃO DA NORMA: Informe o número exato da norma principal (ex: ABNT NBR 6118) e o título oficial. Se houver normas complementares vigentes, liste-as.
2. ESPECIFICAÇÕES TÉCNICAS: Resuma os principais requisitos técnicos, parâmetros, materiais aceitáveis e critérios de dimensionamento ou escolha estipulados pela norma.
3. CONDIÇÕES DE EXECUÇÃO: Detalhe o passo a passo prático de como o serviço deve ser executado no canteiro de obras ou fábrica, incluindo ferramentas necessárias, cuidados preliminares e a sequência ideal de trabalho.
4. CONTROLE TECNOLÓGICO E ACEITAÇÃO: Explique brevemente como deve ser feita a verificação visual, testes de ensaio (se aplicável) e os critérios para rejeição ou aceitação do serviço.

DIRETRIZES RÍGIDAS:
- Nunca invente números de normas. Se não tiver certeza do número exato da NBR vigente, diga explicitamente: "Recomendo verificar o número exato no catálogo da ABNT, mas os procedimentos técnicos gerais são...".
- Seja direto, técnico e utilize termos adequados da engenharia (ex: cura do concreto, regularização de base, caimento, etc.).
- Use listas (bullet points) para facilitar a leitura rápida em ambiente de trabalho/obra.
- Formate a resposta usando markdown com seções claras usando ## para títulos e bullet points para listas.`;

const QUICK_QUERIES = [
  { label: "Concreto Armado", query: "Normas para concreto armado em estruturas" },
  { label: "Impermeabilização", query: "Normas de impermeabilização de lajes e fundações" },
  { label: "Alvenaria", query: "Normas para execução de alvenaria de vedação" },
  { label: "Instalações Elétricas", query: "Normas para instalações elétricas prediais" },
  { label: "Revestimento Cerâmico", query: "Normas para assentamento de revestimento cerâmico" },
  { label: "Fundações", query: "Normas técnicas para fundações diretas e profundas" },
];

function formatMessage(text) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} style={{ color: "#F59E0B", fontSize: "0.85rem", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "1.2rem", marginBottom: "0.4rem", fontFamily: "'IBM Plex Mono', monospace", borderLeft: "3px solid #F59E0B", paddingLeft: "0.6rem" }}>
          {line.replace("## ", "")}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} style={{ color: "#D97706", fontSize: "0.8rem", fontWeight: "600", marginTop: "0.8rem", marginBottom: "0.3rem", fontFamily: "'IBM Plex Mono', monospace" }}>
          {line.replace("### ", "")}
        </h3>
      );
    } else if (line.match(/^(\*|-|•)\s/)) {
      const content = line.replace(/^(\*|-|•)\s/, "").replace(/\*\*(.*?)\*\*/g, "$1");
      elements.push(
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.25rem", alignItems: "flex-start" }}>
          <span style={{ color: "#F59E0B", flexShrink: 0, marginTop: "0.1rem" }}>▸</span>
          <span style={{ color: "#D1D5DB", fontSize: "0.82rem", lineHeight: "1.5" }}>{content}</span>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\./)[1];
      const content = line.replace(/^\d+\.\s/, "").replace(/\*\*(.*?)\*\*/g, "$1");
      elements.push(
        <div key={i} style={{ display: "flex", gap: "0.6rem", marginBottom: "0.3rem", alignItems: "flex-start" }}>
          <span style={{ color: "#1A1A2E", background: "#F59E0B", fontSize: "0.65rem", fontWeight: "700", width: "18px", height: "18px", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "0.1rem", fontFamily: "'IBM Plex Mono', monospace" }}>{num}</span>
          <span style={{ color: "#D1D5DB", fontSize: "0.82rem", lineHeight: "1.5" }}>{content}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: "0.4rem" }} />);
    } else if (line.trim()) {
      const formatted = line.replace(/\*\*(.*?)\*\*/g, (_, m) => `<strong style="color:#F59E0B;font-weight:600">${m}</strong>`);
      elements.push(<p key={i} style={{ color: "#D1D5DB", fontSize: "0.82rem", lineHeight: "1.6", margin: "0.15rem 0" }} dangerouslySetInnerHTML={{ __html: formatted }} />);
    }
    i++;
  }
  return elements;
}

// ── Gemini API call ──────────────────────────────────────────────
async function callGemini(messages, apiKey) {
  // Build contents array: system instruction + conversation
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { maxOutputTokens: 1500, temperature: 0.3 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta.";
}

// ── Setup screen ─────────────────────────────────────────────────
function SetupScreen({ onSave }) {
  const [key, setKey] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ maxWidth: "420px", width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "16px", padding: "2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚙️</div>
          <h1 style={{ color: "#F59E0B", fontSize: "1.1rem", fontWeight: "700", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
            NORMAS TÉCNICAS ABNT/NBR
          </h1>
          <p style={{ color: "#6B7280", fontSize: "0.78rem", lineHeight: "1.6" }}>
            Informe sua chave do Google Gemini para usar o app.<br />
            A chave é salva apenas no seu navegador.
          </p>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", color: "#9CA3AF", fontSize: "0.72rem", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>
            GOOGLE GEMINI API KEY
          </label>
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="AIza..."
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "0.65rem 0.75rem", color: "#E5E7EB", fontSize: "0.82rem", outline: "none", fontFamily: "'IBM Plex Mono', monospace", boxSizing: "border-box" }}
          />
        </div>

        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
          style={{ display: "block", textAlign: "center", color: "#D97706", fontSize: "0.72rem", marginBottom: "1.2rem", textDecoration: "none" }}>
          → Obter chave gratuita em aistudio.google.com
        </a>

        <button
          onClick={() => { if (key.trim()) { localStorage.setItem("gemini_key", key.trim()); onSave(key.trim()); } }}
          disabled={!key.trim()}
          style={{ width: "100%", background: key.trim() ? "linear-gradient(135deg, #F59E0B, #D97706)" : "rgba(245,158,11,0.15)", border: "none", borderRadius: "8px", padding: "0.75rem", color: key.trim() ? "#1A1A2E" : "#6B7280", fontWeight: "700", fontSize: "0.85rem", cursor: key.trim() ? "pointer" : "not-allowed", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>
          ACESSAR O APP →
        </button>

        <p style={{ color: "#4B5563", fontSize: "0.65rem", textAlign: "center", marginTop: "1rem", lineHeight: "1.5" }}>
          🔒 Sua chave fica salva localmente no navegador.<br />Gratuito: 15 req/min · 1.500 req/dia
        </p>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────
export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("gemini_key") || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    try {
      const reply = await callGemini(newMessages, apiKey);
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      setError("Erro: " + (err.message || "Verifique sua chave API e conexão."));
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const isEmpty = messages.length === 0;

  if (!apiKey) return <SetupScreen onSave={setApiKey} />;

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", display: "flex", flexDirection: "column", fontFamily: "'IBM Plex Sans', sans-serif", color: "#E5E7EB", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #F59E0B, #D97706, #92400E)", zIndex: 100 }} />

      {/* Header */}
      <header style={{ position: "fixed", top: "3px", left: 0, right: 0, background: "rgba(13,13,26,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(245,158,11,0.15)", padding: "0.75rem 1.5rem", zIndex: 90, display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ width: "36px", height: "36px", background: "linear-gradient(135deg, #F59E0B, #92400E)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0, boxShadow: "0 0 20px rgba(245,158,11,0.3)" }}>⚙</div>
        <div>
          <div style={{ fontSize: "0.85rem", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", color: "#F59E0B", fontFamily: "'IBM Plex Mono', monospace" }}>Normas Técnicas ABNT/NBR</div>
          <div style={{ fontSize: "0.65rem", color: "#6B7280", letterSpacing: "0.05em" }}>Especialista em Engenharia e Qualidade · Gemini AI</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
            <span style={{ fontSize: "0.65rem", color: "#6B7280" }}>Online</span>
          </div>
          <button onClick={() => { localStorage.removeItem("gemini_key"); setApiKey(""); setMessages([]); }}
            style={{ background: "transparent", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "6px", color: "#6B7280", fontSize: "0.65rem", padding: "0.2rem 0.5rem", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
            Trocar chave
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, overflowY: "auto", paddingTop: "80px", paddingBottom: "140px", position: "relative", zIndex: 1 }}>
        {isEmpty ? (
          <div style={{ maxWidth: "680px", margin: "0 auto", padding: "2rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <div style={{ width: "70px", height: "70px", background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(146,64,14,0.2))", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1rem", boxShadow: "0 0 40px rgba(245,158,11,0.15)" }}>📐</div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: "700", color: "#F9FAFB", marginBottom: "0.5rem", lineHeight: "1.3" }}>Consultor de Normas Técnicas</h1>
              <p style={{ fontSize: "0.82rem", color: "#6B7280", lineHeight: "1.6", maxWidth: "420px" }}>Consulte normas ABNT/NBR, especificações técnicas e procedimentos de execução para construção civil, indústria e engenharia.</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
              {["ABNT NBR", "ISO", "NR", "Execução", "Controle", "Ensaios"].map(tag => (
                <span key={tag} style={{ fontSize: "0.65rem", fontWeight: "600", letterSpacing: "0.08em", textTransform: "uppercase", color: "#D97706", border: "1px solid rgba(217,119,6,0.3)", borderRadius: "4px", padding: "0.2rem 0.5rem", fontFamily: "'IBM Plex Mono', monospace", background: "rgba(217,119,6,0.05)" }}>{tag}</span>
              ))}
            </div>
            <div style={{ width: "100%" }}>
              <p style={{ fontSize: "0.7rem", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>Consultas Rápidas</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem" }}>
                {QUICK_QUERIES.map(q => (
                  <button key={q.label} onClick={() => sendMessage(q.query)}
                    style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", padding: "0.65rem 0.75rem", cursor: "pointer", textAlign: "left", color: "#D1D5DB", fontSize: "0.78rem" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.12)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.05)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.2)"; }}>
                    <div style={{ color: "#F59E0B", fontSize: "0.7rem", fontWeight: "700", marginBottom: "0.2rem", fontFamily: "'IBM Plex Mono', monospace" }}>{q.label}</div>
                    <div style={{ lineHeight: "1.4" }}>{q.query}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: "760px", margin: "0 auto", padding: "1rem" }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: "1rem", display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: "0.6rem", alignItems: "flex-start" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "6px", flexShrink: 0, background: msg.role === "user" ? "linear-gradient(135deg, #1D4ED8, #1E40AF)" : "linear-gradient(135deg, #F59E0B, #92400E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", boxShadow: msg.role === "assistant" ? "0 0 12px rgba(245,158,11,0.2)" : "none" }}>
                  {msg.role === "user" ? "👤" : "⚙"}
                </div>
                <div style={{ maxWidth: "85%", background: msg.role === "user" ? "rgba(29,78,216,0.15)" : "rgba(255,255,255,0.03)", border: msg.role === "user" ? "1px solid rgba(29,78,216,0.3)" : "1px solid rgba(245,158,11,0.15)", borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px", padding: "0.8rem 1rem" }}>
                  {msg.role === "user" ? (
                    <p style={{ color: "#E5E7EB", fontSize: "0.82rem", lineHeight: "1.5", margin: 0 }}>{msg.content}</p>
                  ) : (
                    <div>{formatMessage(msg.content)}</div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "6px", background: "linear-gradient(135deg, #F59E0B, #92400E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}>⚙</div>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "4px 12px 12px 12px", padding: "0.8rem 1rem", display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F59E0B", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "0.75rem 1rem", color: "#FCA5A5", fontSize: "0.8rem", marginBottom: "1rem" }}>{error}</div>}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(13,13,26,0.97)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(245,158,11,0.15)", padding: "0.75rem 1rem 1rem", zIndex: 90 }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          {!isEmpty && (
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
              {QUICK_QUERIES.slice(0, 4).map(q => (
                <button key={q.label} onClick={() => sendMessage(q.query)}
                  style={{ background: "transparent", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "20px", padding: "0.2rem 0.7rem", color: "#9CA3AF", fontSize: "0.68rem", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono', monospace" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.5)"; e.currentTarget.style.color = "#F59E0B"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.2)"; e.currentTarget.style.color = "#9CA3AF"; }}>
                  {q.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "12px", padding: "0.5rem 0.5rem 0.5rem 0.9rem" }}>
            <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); adjustTextarea(); }} onKeyDown={handleKey}
              placeholder="Ex: Qual a norma para impermeabilização de piscinas?" rows={1}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#E5E7EB", fontSize: "0.82rem", lineHeight: "1.5", resize: "none", fontFamily: "'IBM Plex Sans', sans-serif", minHeight: "24px" }} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              style={{ width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0, background: input.trim() && !loading ? "linear-gradient(135deg, #F59E0B, #D97706)" : "rgba(245,158,11,0.15)", border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", boxShadow: input.trim() && !loading ? "0 0 16px rgba(245,158,11,0.3)" : "none" }}>
              {loading ? "⏳" : "▶"}
            </button>
          </div>
          <p style={{ fontSize: "0.6rem", color: "#374151", textAlign: "center", marginTop: "0.4rem" }}>
            Enter para enviar · Shift+Enter nova linha · Powered by Google Gemini (gratuito)
          </p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(245,158,11,0.3); border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
        input::placeholder { color: #4B5563; }
      `}</style>
    </div>
  );
}
