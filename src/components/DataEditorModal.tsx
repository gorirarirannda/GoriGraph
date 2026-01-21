import { Plus, Trash2, X } from 'lucide-react';
import type React from 'react';

interface DataEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  setData: (data: any[]) => void;
  headers: string[];
}

export const DataEditorModal: React.FC<DataEditorModalProps> = ({ isOpen, onClose, data, setData, headers }) => {
  if (!isOpen) return null;

  // 値の変更
  const handleValueChange = (rowIndex: number, key: string, value: string) => {
    const newData = [...data];
    // 数値変換できるかトライ、できなければ文字列のまま
    const numValue = parseFloat(value);
    newData[rowIndex] = {
      ...newData[rowIndex],
      [key]: Number.isNaN(numValue) && value !== '' && value !== '-' ? value : value,
    };
    setData(newData);
  };

  // 行の追加
  const handleAddRow = () => {
    const newRow: any = { _id: Date.now().toString() + Math.random() };
    headers.forEach((header) => {
      newRow[header] = 0; // 初期値
    });
    setData([...data, newRow]);
  };

  // 行の削除
  const handleDeleteRow = (index: number) => {
    if (confirm('この行を削除してもよろしいですか？')) {
      const newData = data.filter((_, i) => i !== index);
      setData(newData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">データ編集</h2>
            <p className="text-xs text-gray-500">{data.length} 行のデータ</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* テーブル本体 */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 border text-left font-semibold text-gray-600 w-12">#</th>
                {headers.map((header) => (
                  <th key={header} className="p-3 border text-left font-semibold text-gray-600 min-w-30">
                    {header}
                  </th>
                ))}
                <th className="p-3 border text-center w-12">削除</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={row._id || rowIndex} className="hover:bg-blue-50 transition-colors group">
                  <td className="p-2 border text-center text-gray-400 bg-gray-50">{rowIndex + 1}</td>
                  {headers.map((header) => (
                    <td key={`${rowIndex}-${header}`} className="p-0 border">
                      <input
                        type="text"
                        value={row[header]}
                        onChange={(e) => handleValueChange(rowIndex, header, e.target.value)}
                        className="w-full h-full p-2 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-blue-400 inset-0"
                      />
                    </td>
                  ))}
                  <td className="p-2 border text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(rowIndex)}
                      className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors"
                      title="行を削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* フッター（アクションボタン） */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
          >
            <Plus className="w-4 h-4" /> 行を追加
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
