
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Client, Invoice } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface AiAdvisorProps {
  client: Client;
  invoices: Invoice[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const AiAdvisor: React.FC<AiAdvisorProps> = ({ client, invoices }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Ciao! Sto analizzando la posizione fiscale di ${client.name}. Come posso aiutarti oggi?` }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
     setMessages([{ role: 'model', text: `Ciao! Sto analizzando la posizione fiscale di ${client.name}. Come posso aiutarti oggi?` }]);
  }, [client.id]);

  const handleSend = async () => {
    if (!input.trim() || !process.env.API_KEY) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const contextData = JSON.stringify({
        clientProfile: client,
        financialSummary: {
          totalInvoices: invoices.length,
          paidAmount: invoices.filter(i => i.status === 'Incassata').reduce((sum, i) => sum + i.amount, 0),
          pendingAmount: invoices.filter(i => i.status !== 'Incassata').reduce((sum, i) => sum + i.amount, 0)
        },
        recentInvoices: invoices.slice(-3)
      });

      const systemInstruction = `
        Sei un esperto Commercialista Italiano che utilizza un dashboard professionale dello Studio Palmas.
        Stai assistendo un collega nell'analisi dei dati di un cliente specifico (${client.name}).
        
        Contesto Cliente: ${contextData}
        
        Regole:
        1. Rispondi solo a domande relative alla normativa fiscale italiana, contabilità o dati specifici del cliente.
        2. Ricorda all'utente che sei un'intelligenza artificiale.
        3. Spiega i calcoli in modo semplice ma professionale.
        4. Focus principale: Regime Forfettario (L. 190/2014).
        5. Parla esclusivamente in Italiano.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
          { role: 'user', parts: [{ text: userMsg }] }
        ],
        config: {
          systemInstruction: systemInstruction,
          thinkingConfig: { thinkingBudget: 4000 } // Abilitiamo il ragionamento profondo per consulenza complessa
        }
      });

      const text = response.text || "Mi dispiace, non riesco a elaborare una risposta al momento.";
      setMessages(prev => [...prev, { role: 'model', text }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Errore di connessione. Controlla la tua API Key o riprova più tardi." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[600px] flex flex-col space-y-4">
      <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8 text-indigo-300" />
          <div>
            <h2 className="text-xl font-bold">AI Commercialista Pro</h2>
            <p className="text-indigo-200 text-sm">Analisi Avanzata per: {client.name}</p>
          </div>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
              }`}>
                {msg.role === 'model' && <Bot className="w-4 h-4 mb-1 opacity-50" />}
                <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-xs text-gray-500">Sto analizzando la normativa fiscale...</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-100">
           {!process.env.API_KEY ? (
             <div className="text-center text-red-500 text-sm p-2 bg-red-50 rounded">
               API Key non trovata. Configura process.env.API_KEY per usare l'assistente.
             </div>
           ) : (
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Chiedi qualcosa su ${client.name}...`}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
           )}
        </div>
      </Card>
    </div>
  );
};
