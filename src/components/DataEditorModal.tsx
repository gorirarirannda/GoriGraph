import { ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

interface DataEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  setData: (data: any[]) => void;
  headers: string[];
  setHeaders: (headers: string[]) => void;
}

export const DataEditorModal: React.FC<DataEditorModalProps> = ({
  isOpen,
  onClose,
  data,
  setData,
  headers,
  setHeaders,
}) => {
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [tempHeaderName, setTempHeaderName] = useState('');
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  if (!isOpen) return null;

  // --- 値の編集 ---
  const handleValueChange = (rowIndex: number, key: string, value: string) => {
    const newData = [...data];
    const numValue = parseFloat(value);
    newData[rowIndex] = {
      ...newData[rowIndex],
      [key]: Number.isNaN(numValue) && value !== '' && value !== '-' ? value : value,
    };
    setData(newData);
  };

  // --- 行操作 ---
  const handleAddRow = () => {
    const newRow: any = { _id: Date.now().toString() + Math.random() };
    headers.forEach((h) => {
      newRow[h] = 0;
    });
    setData([...data, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    if (confirm('この行を削除しますか？')) {
      setData(data.filter((_, i) => i !== index));
    }
  };

  // --- 列操作 ---
  const handleAddColumn = () => {
    const name = prompt('新しい列名を入力してください', `NewCol${headers.length + 1}`);
    if (name && !headers.includes(name)) {
      setHeaders([...headers, name]);
      // 全行に初期値を追加
      const newData = data.map((row) => ({ ...row, _id: row._id || Date.now().toString() + Math.random(), [name]: 0 }));
      setData(newData);
    } else if (headers.includes(name || '')) {
      alert('その列名は既に存在します');
    }
  };

  const startRenameHeader = (header: string) => {
    setEditingHeader(header);
    setTempHeaderName(header);
  };

  const saveRenameHeader = () => {
    if (editingHeader && tempHeaderName && tempHeaderName !== editingHeader) {
      if (headers.includes(tempHeaderName)) {
        alert('その列名は既に存在します');
        return;
      }
      // ヘッダー配列更新
      const newHeaders = headers.map((h) => (h === editingHeader ? tempHeaderName : h));
      setHeaders(newHeaders);
      // データ内のキーも全て更新
      const newData = data.map((row) => {
        const newRow = { ...row };
        newRow[tempHeaderName] = newRow[editingHeader]; // 新しいキーに値をコピー
        delete newRow[editingHeader]; // 古いキーを削除
        return newRow;
      });
      setData(newData);
    }
    setEditingHeader(null);
  };

  const handleDeleteColumn = (header: string) => {
    if (headers.length <= 1) {
      alert('これ以上列を削除できません');
      return;
    }
    if (confirm(`列「${header}」を削除しますか？\n含まれるデータも失われます。`)) {
      setHeaders(headers.filter((h) => h !== header));
      const newData = data.map((row) => {
        const newRow = { ...row };
        delete newRow[header];
        return newRow;
      });
      setData(newData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              データ編集
              <button
                type="button"
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 flex items-center"
              >
                {showColumnMenu ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 列メニュー
              </button>
            </h2>
            <p className="text-xs text-gray-500">
              {data.length} 行 x {headers.length} 列
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Column Tools */}
        {showColumnMenu && (
          <div className="bg-blue-50/50 p-2 border-b border-blue-100 flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={handleAddColumn}
              className="flex items-center gap-1 text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-50 whitespace-nowrap"
            >
              <Plus size={14} /> 新しい列を追加
            </button>
            <div className="text-xs text-gray-400 flex items-center px-2">
              ※列名をダブルクリックで変更、右側のゴミ箱で削除
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 border text-left font-semibold text-gray-600 w-12 bg-gray-100">#</th>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="p-2 border text-left font-semibold text-gray-600 min-w-35 bg-gray-100 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      {editingHeader === header ? (
                        <input
                          className="w-full px-1 py-0.5 text-sm border border-blue-400 rounded"
                          value={tempHeaderName}
                          onChange={(e) => setTempHeaderName(e.target.value)}
                          onBlur={saveRenameHeader}
                          onKeyDown={(e) => e.key === 'Enter' && saveRenameHeader()}
                        />
                      ) : (
                        <button
                          type="button"
                          className="cursor-pointer hover:text-blue-600 flex-1 truncate text-left"
                          onDoubleClick={() => startRenameHeader(header)}
                          title="ダブルクリックで名称変更"
                        >
                          {header}
                        </button>
                      )}

                      {/* 列削除ボタン（列が多い時やメニュー表示時のみ出すと親切だが、今回は常時ホバーで） */}
                      {headers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteColumn(header)}
                          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="列を削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-2 border text-center w-12 bg-gray-100">行削除</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={row._id || `row-${rowIndex}`} className="hover:bg-blue-50 transition-colors">
                  <td className="p-2 border text-center text-gray-400 bg-gray-50">{rowIndex + 1}</td>
                  {headers.map((header) => (
                    <td key={`${rowIndex}-${header}`} className="p-0 border">
                      <input
                        type="text"
                        value={row[header] !== undefined ? row[header] : ''}
                        onChange={(e) => handleValueChange(rowIndex, header, e.target.value)}
                        className="w-full h-full p-2 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-blue-400 inset-0"
                      />
                    </td>
                  ))}
                  <td className="p-2 border text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(rowIndex)}
                      className="text-gray-300 hover:text-red-500 p-1 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
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
