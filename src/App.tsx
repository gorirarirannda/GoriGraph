import { toPng } from 'html-to-image';
import {
  Download,
  FileSpreadsheet,
  FolderOpen,
  Github,
  LayoutGrid,
  MoreVertical,
  Save,
  Settings,
  Upload,
} from 'lucide-react';
import Papa from 'papaparse';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Label as RechartsLabel,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button, Card, Input, Label, NativeSelect } from './components/ui/common';
import { type AxisConfig, type ChartConfig, cn, type SeriesConfig } from './lib/utils';

// --- 初期定数 ---
const DEFAULT_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777'];

export default function App() {
  // --- State ---
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'config' | 'data'>('config');

  const [config, setConfig] = useState<ChartConfig>({
    title: 'Experimental Data',
    xAxisKey: '',
    showGrid: true,
    axes: {
      left: { label: 'Value', unit: '', min: '', max: '' },
      right: { label: 'Secondary', unit: '', min: '', max: '' },
      bottom: { label: 'Time', unit: '', min: '', max: '' },
    },
    series: [],
  });

  const graphRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers: File I/O ---

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<any>) => {
        const rawData = results.data as any[];
        const keys = results.meta.fields || [];

        if (rawData.length === 0 || keys.length === 0) {
          alert('有効なデータが見つかりませんでした。');
          return;
        }

        setData(rawData);
        setHeaders(keys);

        // 自動設定生成
        const xAxis = keys[0];
        const yKeys = keys.slice(1);

        setConfig((prev) => ({
          ...prev,
          xAxisKey: xAxis,
          axes: {
            ...prev.axes,
            bottom: { ...prev.axes.bottom, label: xAxis },
          },
          series: yKeys.map((key: string, index: number) => ({
            id: crypto.randomUUID(),
            dataKey: key,
            name: key,
            type: 'line',
            yAxisId: 'left',
            color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
            visible: true,
            strokeWidth: 2,
            showDot: false,
          })),
        }));
      },
      error: (err: Error) => {
        alert(`CSVの読み込みに失敗しました: ${err.message}`);
      },
    });
    // Reset input
    e.target.value = '';
  };

  const saveProject = () => {
    const project = { version: 1, date: new Date().toISOString(), data, config, fileName };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gorigraph-project-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (json.data && json.config) {
          setData(json.data);
          setConfig(json.config);
          setFileName(json.fileName || 'Project');
          setHeaders(Object.keys(json.data[0] || {}));
        } else {
          throw new Error('Invalid format');
        }
      } catch (_err) {
        alert('プロジェクトファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportImage = useCallback(async (scale = 2) => {
    if (!graphRef.current) return;
    try {
      // 描画が追いつくのを待つ
      await new Promise((resolve) => setTimeout(resolve, 100));
      const dataUrl = await toPng(graphRef.current, {
        cacheBust: true,
        pixelRatio: scale,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `gorigraph-export-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert('画像生成に失敗しました。');
    }
  }, []);

  // --- Handlers: Configuration ---

  const updateAxis = (axis: keyof ChartConfig['axes'], field: keyof AxisConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      axes: {
        ...prev.axes,
        [axis]: { ...prev.axes[axis], [field]: value },
      },
    }));
  };

  const updateSeries = (index: number, updates: Partial<SeriesConfig>) => {
    setConfig((prev) => {
      const newSeries = [...prev.series];
      newSeries[index] = { ...newSeries[index], ...updates };
      return { ...prev, series: newSeries };
    });
  };

  const updateDataCell = (rowIndex: number, colKey: string, val: string) => {
    const num = parseFloat(val);
    const newVal = Number.isNaN(num) ? val : num;
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [colKey]: newVal };
    setData(newData);
  };

  // --- Render Helpers ---

  // UI: Empty State
  if (data.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-foreground p-4">
        <Card className="w-full max-w-lg p-12 flex flex-col items-center text-center space-y-6 shadow-xl">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <LayoutGrid size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">GoriGraph</h1>
            <p className="text-muted-foreground mt-2">
              GitHub Pages対応・完全クライアントサイド。
              <br />
              実験データの可視化とレポート作成のためのツール。
            </p>
          </div>
          <div className="flex flex-col w-full gap-3 pt-4">
            <Button size="lg" className="w-full h-12 text-lg gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload size={20} /> CSVファイルをインポート
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => projectInputRef.current?.click()}>
              <FolderOpen size={18} /> プロジェクトを開く
            </Button>
            <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleCsvUpload} />
            <input type="file" accept=".json" ref={projectInputRef} className="hidden" onChange={loadProject} />
          </div>
          <a
            href="https://github.com/gorirarirannda/GoriGraph"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pt-4"
          >
            <Github size={18} />
            <span>View on GitHub</span>
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-white shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white font-bold">G</div>
          <span className="font-semibold hidden sm:inline-block">GoriGraph</span>
          <span className="text-muted-foreground text-sm border-l pl-2 ml-2 truncate max-w-50">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} className="mr-2" /> 新規CSV
          </Button>
          <Button variant="outline" size="sm" onClick={saveProject}>
            <Save size={14} className="mr-2" /> プロジェクト保存
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button size="sm" onClick={() => exportImage(3)}>
            <Download size={14} className="mr-2" /> 画像出力 (高解像度)
          </Button>
        </div>
        <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleCsvUpload} />
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Controls */}
        <aside className="w-100 border-r border-border bg-gray-50/50 flex flex-col shrink-0">
          <div className="flex border-b border-border bg-white">
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={cn(
                'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'config'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-gray-50',
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Settings size={16} /> グラフ設定
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('data')}
              className={cn(
                'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'data'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-gray-50',
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet size={16} /> データ編集
              </div>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-8">
            {activeTab === 'config' ? (
              <>
                {/* 軸設定セクション */}
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <MoreVertical size={14} /> 軸・グリッド設定
                  </h3>

                  <div className="grid grid-cols-1 gap-4">
                    {/* X軸 */}
                    <Card className="p-3 space-y-3">
                      <Label className="text-primary font-bold">X軸 (横軸)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>使用カラム</Label>
                          <NativeSelect
                            value={config.xAxisKey}
                            onChange={(e) => setConfig({ ...config, xAxisKey: e.target.value })}
                          >
                            {headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        <div>
                          <Label>ラベル名</Label>
                          <Input
                            value={config.axes.bottom.label}
                            onChange={(e) => updateAxis('bottom', 'label', e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>単位 (Unit)</Label>
                        <Input
                          placeholder="(例: sec, min)"
                          value={config.axes.bottom.unit}
                          onChange={(e) => updateAxis('bottom', 'unit', e.target.value)}
                        />
                      </div>
                    </Card>

                    {/* Y軸 (左) */}
                    <Card className="p-3 space-y-3 border-l-4 border-l-blue-500">
                      <div className="flex justify-between">
                        <Label className="text-blue-600 font-bold">左 Y軸 (第1軸)</Label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>ラベル</Label>
                          <Input
                            value={config.axes.left.label}
                            onChange={(e) => updateAxis('left', 'label', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>単位</Label>
                          <Input
                            placeholder="(例: V, A)"
                            value={config.axes.left.unit}
                            onChange={(e) => updateAxis('left', 'unit', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>最小値</Label>
                          <Input
                            type="number"
                            placeholder="Auto"
                            value={config.axes.left.min}
                            onChange={(e) =>
                              updateAxis('left', 'min', e.target.value === '' ? '' : Number(e.target.value))
                            }
                          />
                        </div>
                        <div>
                          <Label>最大値</Label>
                          <Input
                            type="number"
                            placeholder="Auto"
                            value={config.axes.left.max}
                            onChange={(e) =>
                              updateAxis('left', 'max', e.target.value === '' ? '' : Number(e.target.value))
                            }
                          />
                        </div>
                      </div>
                    </Card>

                    {/* Y軸 (右) */}
                    <Card className="p-3 space-y-3 border-l-4 border-l-orange-500">
                      <div className="flex justify-between">
                        <Label className="text-orange-600 font-bold">右 Y軸 (第2軸)</Label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>ラベル</Label>
                          <Input
                            value={config.axes.right.label}
                            onChange={(e) => updateAxis('right', 'label', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>単位</Label>
                          <Input
                            placeholder="(例: ℃, %)"
                            value={config.axes.right.unit}
                            onChange={(e) => updateAxis('right', 'unit', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>最小値</Label>
                          <Input
                            type="number"
                            placeholder="Auto"
                            value={config.axes.right.min}
                            onChange={(e) =>
                              updateAxis('right', 'min', e.target.value === '' ? '' : Number(e.target.value))
                            }
                          />
                        </div>
                        <div>
                          <Label>最大値</Label>
                          <Input
                            type="number"
                            placeholder="Auto"
                            value={config.axes.right.max}
                            onChange={(e) =>
                              updateAxis('right', 'max', e.target.value === '' ? '' : Number(e.target.value))
                            }
                          />
                        </div>
                      </div>
                    </Card>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="gridToggle"
                        className="w-4 h-4"
                        checked={config.showGrid}
                        onChange={(e) => setConfig({ ...config, showGrid: e.target.checked })}
                      />
                      <label htmlFor="gridToggle" className="text-sm font-medium">
                        方眼(グリッド)を表示
                      </label>
                    </div>
                  </div>
                </section>

                <hr className="border-border" />

                {/* 系列設定セクション */}
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">データ系列 (Series)</h3>
                  {config.series.map((series, idx) => (
                    <Card key={series.id} className="p-3 space-y-3 transition-all hover:shadow-md">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="h-4 w-4 rounded-full shadow-sm ring-1 ring-black/10"
                          style={{ backgroundColor: series.color }}
                        />
                        <Input
                          value={series.name}
                          onChange={(e) => updateSeries(idx, { name: e.target.value })}
                          className="h-8 font-semibold"
                        />
                        <div className="flex items-center ml-auto">
                          <input
                            type="checkbox"
                            className="w-5 h-5 accent-primary"
                            checked={series.visible}
                            onChange={(e) => updateSeries(idx, { visible: e.target.checked })}
                            title="表示切替"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                        <div>
                          <Label>タイプ</Label>
                          <NativeSelect
                            value={series.type}
                            onChange={(e) => updateSeries(idx, { type: e.target.value as any })}
                          >
                            <option value="line">折れ線 (Line)</option>
                            <option value="bar">棒グラフ (Bar)</option>
                          </NativeSelect>
                        </div>
                        <div>
                          <Label>所属軸</Label>
                          <NativeSelect
                            value={series.yAxisId}
                            onChange={(e) => updateSeries(idx, { yAxisId: e.target.value as any })}
                          >
                            <option value="left">左軸 (Main)</option>
                            <option value="right">右軸 (Sub)</option>
                          </NativeSelect>
                        </div>
                        <div>
                          <Label>色</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={series.color}
                              onChange={(e) => updateSeries(idx, { color: e.target.value })}
                              className="h-8 w-full cursor-pointer"
                            />
                          </div>
                        </div>
                        {series.type === 'line' && (
                          <>
                            <div>
                              <Label>線の太さ</Label>
                              <NativeSelect
                                value={series.strokeWidth}
                                onChange={(e) => updateSeries(idx, { strokeWidth: Number(e.target.value) })}
                              >
                                <option value="1">細い (1px)</option>
                                <option value="2">普通 (2px)</option>
                                <option value="3">太い (3px)</option>
                                <option value="4">極太 (4px)</option>
                              </NativeSelect>
                            </div>
                            <div className="col-span-2 flex items-center gap-2 mt-1">
                              <input
                                type="checkbox"
                                id={`dot-${series.id}`}
                                checked={series.showDot}
                                onChange={(e) => updateSeries(idx, { showDot: e.target.checked })}
                              />
                              <label htmlFor={`dot-${series.id}`} className="cursor-pointer">
                                データポイント(点)を表示
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    </Card>
                  ))}
                </section>
              </>
            ) : (
              // データ編集テーブル
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-100 text-xs font-bold text-gray-700 uppercase sticky top-0 z-10">
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="px-3 py-2 border-b border-border border-r last:border-r-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, rIdx) => (
                      <tr
                        key={`row-${rIdx}-${JSON.stringify(row)}`}
                        className="border-b border-border last:border-0 hover:bg-blue-50/50"
                      >
                        {headers.map((col) => (
                          <td key={`${rIdx}-${col}`} className="border-r border-border last:border-r-0 p-0">
                            <input
                              className="w-full px-3 py-1 bg-transparent outline-none focus:bg-blue-100 focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-all"
                              value={row[col]}
                              onChange={(e) => updateDataCell(rIdx, col, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-2 text-center text-xs text-muted-foreground bg-gray-50 border-t border-border">
                  {data.length} 行のデータ
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main: Preview Area */}
        <main className="flex-1 bg-gray-100 p-8 flex flex-col items-center justify-center overflow-auto relative">
          <div
            className="bg-white shadow-2xl rounded-xl p-8 w-full max-w-5xl aspect-[1.414/1] relative flex flex-col"
            ref={graphRef}
          >
            {/* グラフタイトル */}
            <input
              className="text-2xl font-bold text-center w-full mb-4 outline-none hover:bg-gray-50 focus:bg-gray-50 rounded"
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              placeholder="グラフタイトル"
            />

            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 20, right: 30, left: 30, bottom: 40 }}>
                  {config.showGrid && <CartesianGrid stroke="#f3f4f6" strokeWidth={1} />}

                  {/* X軸 */}
                  <XAxis dataKey={config.xAxisKey} height={60} tick={{ fontSize: 12, fill: '#666' }} tickMargin={10}>
                    <RechartsLabel
                      value={`${config.axes.bottom.label} ${config.axes.bottom.unit ? `[${config.axes.bottom.unit}]` : ''}`}
                      position="insideBottom"
                      offset={0}
                      style={{ textAnchor: 'middle', fontSize: 14, fontWeight: 500, fill: '#333' }}
                    />
                  </XAxis>

                  {/* 左Y軸 */}
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 12, fill: '#666' }}
                    domain={[
                      config.axes.left.min !== '' ? config.axes.left.min : 'auto',
                      config.axes.left.max !== '' ? config.axes.left.max : 'auto',
                    ]}
                  >
                    <RechartsLabel
                      value={`${config.axes.left.label} ${config.axes.left.unit ? `[${config.axes.left.unit}]` : ''}`}
                      angle={-90}
                      position="insideLeft"
                      style={{
                        textAnchor: 'middle',
                        fontSize: 14,
                        fontWeight: 500,
                        fill: config.series.some((s) => s.yAxisId === 'left') ? '#2563eb' : '#333',
                      }}
                    />
                  </YAxis>

                  {/* 右Y軸 */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12, fill: '#666' }}
                    domain={[
                      config.axes.right.min !== '' ? config.axes.right.min : 'auto',
                      config.axes.right.max !== '' ? config.axes.right.max : 'auto',
                    ]}
                  >
                    <RechartsLabel
                      value={`${config.axes.right.label} ${config.axes.right.unit ? `[${config.axes.right.unit}]` : ''}`}
                      angle={90}
                      position="insideRight"
                      style={{
                        textAnchor: 'middle',
                        fontSize: 14,
                        fontWeight: 500,
                        fill: config.series.some((s) => s.yAxisId === 'right') ? '#d97706' : '#333',
                      }}
                    />
                  </YAxis>

                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />

                  {config.series
                    .filter((s) => s.visible)
                    .map((s) => {
                      if (s.type === 'bar') {
                        return (
                          <Bar
                            key={s.id}
                            dataKey={s.dataKey}
                            name={s.name}
                            yAxisId={s.yAxisId}
                            fill={s.color}
                            barSize={30}
                            radius={[4, 4, 0, 0]}
                          />
                        );
                      }
                      return (
                        <Line
                          key={s.id}
                          type="monotone"
                          dataKey={s.dataKey}
                          name={s.name}
                          yAxisId={s.yAxisId}
                          stroke={s.color}
                          strokeWidth={s.strokeWidth}
                          dot={s.showDot ? { r: 4, fill: s.color, strokeWidth: 0 } : false}
                          activeDot={{ r: 6 }}
                        />
                      );
                    })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute bottom-2 right-4 text-xs text-gray-300 pointer-events-none">
              Generated by GoriGraph
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
