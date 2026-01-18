import React from 'react';
import { GlobalTaxConfig } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { Save } from 'lucide-react';

interface ParametersManagerProps {
  config: GlobalTaxConfig;
  setConfig: (config: GlobalTaxConfig) => void;
}

export const ParametersManager: React.FC<ParametersManagerProps> = ({ config, setConfig }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig({
      ...config,
      [name]: Number(value)
    });
  };

  const handleSave = () => {
    alert('Parametri globali aggiornati con successo. Questi valori saranno usati per tutti i calcoli.');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Parametri Fiscali Globali</h2>
      </div>

      <Card title="Configurazione Regime Forfettario">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Limite Ricavi Annuo (€)</label>
            <p className="text-xs text-gray-500 mb-2">Soglia massima per la permanenza nel regime (es. 85.000 €).</p>
            <input
              type="number"
              name="annualRevenueLimit"
              value={config.annualRevenueLimit}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aliquota INPS Standard (Gestione Separata)</label>
            <p className="text-xs text-gray-500 mb-2">Usata per le stime (es. 0.2607 per 26.07%).</p>
            <input
              type="number"
              step="0.0001"
              name="standardInpsRate"
              value={config.standardInpsRate}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-yellow-50 p-4 rounded-md text-sm text-yellow-800">
            <strong>Attenzione:</strong> Modificando questi parametri influenzerai i calcoli di <strong>tutti</strong> i clienti gestiti dallo studio.
          </div>

          <div className="flex justify-end">
             <Button onClick={handleSave}>
               <Save className="w-4 h-4 mr-2" />
               Salva Parametri
             </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};