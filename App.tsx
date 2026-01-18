
import React, { useState, useEffect } from 'react';
import { CLIENT_MENU_ITEMS, MOCK_INVOICES, MOCK_CLIENTS, STUDIO_MENU_ITEMS, DEFAULT_TAX_CONFIG, MOCK_INPS_PAYMENTS } from './constants';
import { Invoice, Client, TaxRate, GlobalTaxConfig, InpsPayment, LogEntry, LogActionType, LogEntityType } from './types';
import { Dashboard } from './components/Dashboard';
import { InvoiceManager } from './components/InvoiceManager';
import { TaxSimulator } from './components/TaxSimulator';
import { AiAdvisor } from './components/AiAdvisor';
import { Settings } from './components/Settings';
import { StudioDashboard } from './components/StudioDashboard';
import { ParametersManager } from './components/ParametersManager';
import { QuadroLMGenerator } from './components/QuadroLMGenerator';
import { InpsManager } from './components/InpsManager';
import { ActivityLogView } from './components/ActivityLogView';
import { CloudBackup } from './components/CloudBackup'; // Import Cloud Backup
import { LogOut, Menu, ArrowLeft, Building2 } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // -- STATE MANAGEMENT --
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('forfettario_clients');
    return saved ? JSON.parse(saved) : MOCK_CLIENTS;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('forfettario_invoices');
    return saved ? JSON.parse(saved) : MOCK_INVOICES;
  });

  const [inpsPayments, setInpsPayments] = useState<InpsPayment[]>(() => {
    const saved = localStorage.getItem('forfettario_inps');
    return saved ? JSON.parse(saved) : MOCK_INPS_PAYMENTS;
  });

  const [globalConfig, setGlobalConfig] = useState<GlobalTaxConfig>(() => {
    const saved = localStorage.getItem('forfettario_config');
    return saved ? JSON.parse(saved) : DEFAULT_TAX_CONFIG;
  });

  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem('forfettario_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // -- PERSISTENCE --
  useEffect(() => {
    localStorage.setItem('forfettario_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('forfettario_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('forfettario_inps', JSON.stringify(inpsPayments));
  }, [inpsPayments]);

  useEffect(() => {
    localStorage.setItem('forfettario_config', JSON.stringify(globalConfig));
  }, [globalConfig]);

  useEffect(() => {
    localStorage.setItem('forfettario_logs', JSON.stringify(logs));
  }, [logs]);

  // -- LOGGING HELPER --
  const addLog = (action: LogActionType, entity: LogEntityType, description: string, clientId?: string) => {
    const clientName = clientId ? clients.find(c => c.id === clientId)?.name : undefined;
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action,
      entity,
      description,
      clientId,
      clientName
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // -- RESTORE HANDLER --
  const handleRestoreFromCloud = (data: any) => {
    if (data.clients) setClients(data.clients);
    if (data.invoices) setInvoices(data.invoices);
    if (data.inpsPayments) setInpsPayments(data.inpsPayments);
    if (data.globalConfig) setGlobalConfig(data.globalConfig);
    if (data.logs) setLogs(data.logs);
    addLog('UPDATE', 'SETTINGS', 'Ripristinato backup da Google Drive');
    alert("Dati ripristinati correttamente.");
  };

  // -- HANDLERS --
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveTab('dashboard');
    setMobileMenuOpen(false);
  };

  const handleBackToStudio = () => {
    setSelectedClientId(null);
    setActiveTab('studio-dashboard');
    setMobileMenuOpen(false);
  };

  const handleUpdateClient = (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
  };

  const handleAddClient = () => {
    const newClient: Client = {
      id: Date.now().toString(),
      name: 'Nuovo Cliente',
      fiscalCode: '',
      atecoCode: '', // Empty initially, forces selection
      profitabilityCoefficient: 0, // 0 initially
      taxRate: TaxRate.STARTUP,
      status: 'active'
    };
    setClients(prev => [...prev, newClient]);
    addLog('CREATE', 'CLIENT', 'Creato nuovo cliente', newClient.id);
    handleSelectClient(newClient.id);
    setActiveTab('settings'); // Jump to settings to configure
  };

  const handleDeleteClient = (clientId: string) => {
    const clientToRemove = clients.find(c => c.id === clientId);
    if (!clientToRemove) return;

    if (window.confirm(`Sei sicuro di voler eliminare definitivamente il cliente "${clientToRemove.name}"?\n\nVerranno eliminate anche tutte le fatture e i versamenti associati.`)) {
       // Remove client
       setClients(prev => prev.filter(c => c.id !== clientId));
       // Remove associated invoices
       setInvoices(prev => prev.filter(inv => inv.clientId !== clientId));
       // Remove associated payments
       setInpsPayments(prev => prev.filter(p => p.clientId !== clientId));
       
       addLog('DELETE', 'CLIENT', `Eliminato cliente ${clientToRemove.name}`, clientId);
       
       // If deleting the currently selected client, go back to dashboard
       if (selectedClientId === clientId) {
         setSelectedClientId(null);
         setActiveTab('studio-dashboard');
       }
    }
  };

  // -- DERIVED STATE --
  const activeClient = clients.find(c => c.id === selectedClientId);
  const clientInvoices = invoices.filter(i => i.clientId === selectedClientId);
  
  // -- RENDER CONTENT --
  const renderContent = () => {
    if (!selectedClientId) {
      // STUDIO VIEW
      switch (activeTab) {
        case 'studio-dashboard':
          return (
            <StudioDashboard 
              clients={clients} 
              invoices={invoices} 
              onSelectClient={handleSelectClient} 
              onAddClient={handleAddClient}
              onDeleteClient={handleDeleteClient}
              annualRevenueLimit={globalConfig.annualRevenueLimit}
            />
          );
        case 'activity-log':
          return <ActivityLogView logs={logs} />;
        case 'studio-params':
          return (
            <ParametersManager 
              config={globalConfig} 
              setConfig={setGlobalConfig}
            />
          );
        case 'cloud-backup':
          return (
            <CloudBackup 
              appState={{ clients, invoices, inpsPayments, globalConfig, logs }} 
              onRestore={handleRestoreFromCloud} 
            />
          );
        default:
          return (
            <StudioDashboard 
              clients={clients} 
              invoices={invoices} 
              onSelectClient={handleSelectClient} 
              onAddClient={handleAddClient}
              onDeleteClient={handleDeleteClient}
              annualRevenueLimit={globalConfig.annualRevenueLimit}
            />
          );
      }
    }

    if (!activeClient) return <div>Cliente non trovato</div>;

    // CLIENT VIEW
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard invoices={clientInvoices} client={activeClient} annualRevenueLimit={globalConfig.annualRevenueLimit} />;
      case 'invoices':
        return (
          <InvoiceManager 
            client={activeClient} 
            allInvoices={invoices} 
            setAllInvoices={setInvoices} 
            onLog={addLog} // Pass logger
          />
        );
      case 'inps':
        return (
          <InpsManager 
            clientId={activeClient.id} 
            payments={inpsPayments} 
            setPayments={setInpsPayments}
            onLog={addLog} // Pass logger
          />
        );
      case 'taxes':
        return <TaxSimulator invoices={clientInvoices} client={activeClient} taxConfig={globalConfig} />;
      case 'quadro-lm':
        return <QuadroLMGenerator client={activeClient} invoices={clientInvoices} inpsPayments={inpsPayments} />;
      case 'advisor':
        return <AiAdvisor client={activeClient} invoices={clientInvoices} />;
      case 'settings':
        return (
          <Settings 
            client={activeClient} 
            onUpdateClient={handleUpdateClient} 
            onLog={addLog} // Pass logger
          />
        );
      default:
        return <Dashboard invoices={clientInvoices} client={activeClient} annualRevenueLimit={globalConfig.annualRevenueLimit} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b p-4 flex justify-between items-center sticky top-0 z-20">
        <h1 className="font-bold text-xl text-indigo-700">Studio Pro</h1>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-md hover:bg-gray-100">
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-10 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* Logo Area */}
          <div className="h-16 flex items-center px-6 border-b border-gray-200">
            {selectedClientId ? (
               <button onClick={handleBackToStudio} className="flex items-center text-gray-500 hover:text-indigo-600 transition-colors">
                 <ArrowLeft className="w-5 h-5 mr-2" />
                 <span className="font-semibold text-sm">Torna allo Studio</span>
               </button>
            ) : (
               <div className="flex items-center">
                 <Building2 className="w-6 h-6 text-indigo-600 mr-2" />
                 <span className="text-xl font-bold text-gray-900">Studio Pro</span>
               </div>
            )}
          </div>

          {/* Context Header (Active Client) */}
          {selectedClientId && activeClient && (
            <div className="px-4 py-4 bg-indigo-50 border-b border-indigo-100">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">Cliente Selezionato</p>
              <p className="font-bold text-indigo-900 truncate">{activeClient.name}</p>
              <div className="flex justify-between items-center">
                 <p className="text-xs text-indigo-700">{activeClient.atecoCode || 'N.D.'}</p>
                 <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeClient.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                   {activeClient.status === 'active' ? 'Attivo' : 'Cessato'}
                 </span>
              </div>
            </div>
          )}

          {/* Menu Items */}
          <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {!selectedClientId ? (
               // STUDIO MENU
               STUDIO_MENU_ITEMS.map((item) => {
                 const Icon = item.icon;
                 const isActive = activeTab === item.id;
                 return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                    {item.label}
                  </button>
                 );
               })
            ) : (
              // CLIENT MENU
              CLIENT_MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                    {item.label}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut className="w-5 h-5 mr-3" />
              Esci
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto print:overflow-visible">
        <header className="bg-white shadow-sm sticky top-0 z-10 px-8 py-4 hidden md:block print:hidden">
           <h2 className="text-2xl font-bold text-gray-800">
             {!selectedClientId 
               ? STUDIO_MENU_ITEMS.find(i => i.id === activeTab)?.label 
               : CLIENT_MENU_ITEMS.find(i => i.id === activeTab)?.label
             }
           </h2>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto print:p-0 print:max-w-none">
          {renderContent()}
        </div>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-800 bg-opacity-50 z-0 md:hidden print:hidden"
          onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default App;
