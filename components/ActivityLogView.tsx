
import React from 'react';
import { LogEntry } from '../types';
import { Card } from './Card';
import { History, PlusCircle, Edit, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ActivityLogViewProps {
  logs: LogEntry[];
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ logs }) => {
  // Sort logs by date descending
  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <PlusCircle className="w-4 h-4 text-green-600" />;
      case 'UPDATE': return <Edit className="w-4 h-4 text-blue-600" />;
      case 'DELETE': return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'STATUS_CHANGE': return <CheckCircle2 className="w-4 h-4 text-orange-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEntityLabel = (entity: string) => {
    switch (entity) {
      case 'INVOICE': return 'Fattura';
      case 'CLIENT': return 'Cliente';
      case 'PAYMENT': return 'Versamento';
      case 'SETTINGS': return 'Impostazioni';
      default: return entity;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Registro Attività</h2>
          <p className="text-gray-500">Cronologia delle operazioni effettuate nel sistema.</p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Ora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azione</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entità</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrizione</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 flex flex-col items-center">
                    <History className="w-10 h-10 text-gray-300 mb-2" />
                    <p>Nessuna attività registrata finora.</p>
                  </td>
                </tr>
              ) : (
                sortedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {new Date(log.timestamp).toLocaleString('it-IT')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                         {getIcon(log.action)}
                         <span className="text-xs font-bold text-gray-700">{log.action}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {getEntityLabel(log.entity)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {log.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-medium">
                      {log.clientName || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
