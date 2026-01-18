
# Forfettario Pro 🚀

**Forfettario Pro** è una dashboard gestionale professionale progettata su misura per i professionisti italiani in **Regime Forfettario**. 

Questa è una **Single Page Application (SPA)** standard basata su React. I dati vengono salvati localmente nel browser (LocalStorage).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg)

## ✨ Funzionalità Principali

*   **📊 Dashboard Finanziaria**: Monitoraggio in tempo reale di incassato, residuo plafond (85k), tasse stimate e contributi.
*   **🧾 Gestione Fatture**: Creazione e archiviazione locale delle fatture.
*   **🏦 Gestione Contributi**: Registro dei versamenti INPS/Cassa.
*   **🤖 AI Advisor**: Assistente fiscale basato su **Google Gemini**.
*   **📑 Quadro LM Simulator**: Generazione automatica di un fac-simile del Quadro LM.

## 🛠️ Stack Tecnologico

*   **Frontend**: React 19, Tailwind CSS, Lucide React, Recharts.
*   **AI**: Google Gemini API (tramite `@google/genai`).

## 🚀 Installazione e Avvio

L'applicazione può essere eseguita in qualsiasi ambiente web moderno che supporti i moduli ES (ESM).

1.  Assicurati di avere una API Key valida per Google Gemini impostata nella variabile d'ambiente `API_KEY`.
2.  Servi la cartella root tramite un server statico (es. Live Server, Vite, Python SimpleHTTPServer).

## ⚠️ Nota sui Dati

Questa versione salva i dati esclusivamente nel **LocalStorage** del tuo browser. Se cancelli la cache o cambi browser, i dati andranno persi.

AIzaSyA6uuUAnAv6SkL1ZXmfoxFWyAwHynhDEb4 - 300345022748-i89q3vp1gs783vg4ddm7uqaunhfd7r05.apps.googleusercontent.com
