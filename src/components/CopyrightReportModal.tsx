import React, { useState } from 'react';

const CopyrightReportModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (report: {
    url: string;
    titularity: string;
    proof: string;
    contact: string;
  }) => Promise<{ success: boolean; message?: string; filename?: string }>;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    url: '',
    titularity: '',
    proof: '',
    contact: ''
  });
  const [submitStatus, setSubmitStatus] = useState<{ 
    success: boolean | null; 
    message: string | null;
    filename: string | null 
  }>({ success: null, message: null, filename: null });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus({ success: null, message: null, filename: null });
    try {
      const result = await onSubmit(form);
      setSubmitStatus({
        success: result.success,
        message: result.message ?? (result.success ? 'Report saved successfully.' : 'Failed to save report.'),
        filename: result.filename ?? null
      });
    } catch (err) {
      setSubmitStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
        filename: null
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-slate-900 rounded-lg p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-slate-100">Relatório de Direitos Autorais</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 mb-2 font-medium">URL do conteúdo allegedly infrator:</label>
            <input
              type="url"
              name="url"
              value={form.url}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2 font-medium">Titularidade (quem detém os direitos):</label>
            <input
              type="text"
              name="titularity"
              value={form.titularity}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2 font-medium">Prova da titularidade (documento, registro, etc.):</label>
            <textarea
              name="proof"
              value={form.proof}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2 font-medium">Contato para comunicação:</label>
            <input
              type="text"
              name="contact"
              value={form.contact}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitStatus.success === null && !form.url && !form.titularity && !form.proof && !form.contact}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-900 font-medium px-4 py-2 rounded-md transition-colors"
          >
            {submitStatus.success === null ? 'Enviar Relatório' : submitStatus.success ? 'Relatório Salvo' : 'Falha ao Salvar'}
          </button>
        </form>
        {submitStatus.success !== null && (
          <div className={`mt-4 p-3 rounded-md ${submitStatus.success ? 'bg-green-900 border border-green-800' : 'bg-red-900 border border-red-800'}`}>
            <p className="text-slate-100">{submitStatus.message}</p>
            {submitStatus.filename && (
              <p className="text-slate-300 text-sm mt-1">Salvo em: {submitStatus.filename}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CopyrightReportModal;
