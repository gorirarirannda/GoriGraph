import { toPng, toSvg } from 'html-to-image';
import {
  Database,
  Download,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  MoreVertical,
  Save,
  Type,
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
import { DataEditorModal } from './components/DataEditorModal';
import { Button, Card, Input, Label, NativeSelect } from './components/ui/common';
import type { AxisConfig, ChartConfig, SeriesConfig } from './lib/utils';

// --- 初期定数 ---
const APP_VERSION = 'v1.2.0'; // リリース時に更新してからリリース

const DEFAULT_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777'];

export default function App() {
  // --- State ---
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');

  // ★追加: エクスポート中の状態管理
  const [isExporting, setIsExporting] = useState(false);

  // ★タブ管理のStateは不要になったので削除しました

  const [config, setConfig] = useState<ChartConfig>({
    title: 'Experimental Data',
    xAxisKey: '',
    showGrid: true,
    // フォントサイズ設定の初期値
    style: {
      fontSize: {
        title: 24,
        axisLabel: 14,
        axisTick: 12,
        legend: 14,
      },
    },
    axes: {
      left: { label: 'Value', unit: '', min: '', max: '' },
      right: { label: 'Secondary', unit: '', min: '', max: '' },
      bottom: { label: 'Time', unit: '', min: '', max: '' },
    },
    series: [],
  });

  const [fontType, setFontType] = useState<'sans' | 'serif'>('sans'); // フォント管理
  const [isEditorOpen, setIsEditorOpen] = useState(false); // モーダル開閉管理
  const [isEditingTitle, setIsEditingTitle] = useState(false); // タイトル編集状態管理

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
            lineType: 'linear',
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
    e.target.value = '';
  };

  const saveProject = () => {
    const project = { version: 1, date: new Date().toISOString(), data, config, fileName };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gorigraph-${new Date().toISOString().slice(0, 10)}.json`;
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
          // 既存プロジェクトにstyleが無い場合の互換性維持
          const loadedConfig = json.config;
          if (!loadedConfig.style) {
            loadedConfig.style = { fontSize: { title: 24, axisLabel: 14, axisTick: 12, legend: 14 } };
          }
          setConfig(loadedConfig);
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

  // ★修正: 画像エクスポート処理 (軽量化 & UX改善)
  const exportImage = useCallback(
    async (format: 'png' | 'svg', scale = 2) => {
      if (!graphRef.current || isExporting) return; // 連打防止

      try {
        setIsExporting(true); // ローディング開始

        // UIレンダリング(ローディングアイコン表示)のために一瞬待機
        await new Promise((resolve) => setTimeout(resolve, 50));

        let dataUrl = '';
        let ext = '';

        if (format === 'svg') {
          dataUrl = await toSvg(graphRef.current); // cacheBust削除
          ext = 'svg';
        } else {
          dataUrl = await toPng(graphRef.current, {
            pixelRatio: scale,
            backgroundColor: '#ffffff',
            // cacheBust: true を削除 (ここがラグの原因でした)
          });
          ext = 'png';
        }

        const link = document.createElement('a');
        link.download = `gorigraph-export-${Date.now()}.${ext}`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error(err);
        alert('画像生成に失敗しました。');
      } finally {
        setIsExporting(false); // 処理完了
      }
    },
    [isExporting],
  );

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

  // ★追加: ^数字 を上付き文字に、_数字 を下付き文字に変換する関数
  const formatText = (text: string) => {
    if (!text) return '';

    // 変換用マップ
    const supers: { [key: string]: string } = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
      '+': '⁺', '-': '⁻',
    };
    const subs: { [key: string]: string } = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
      '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
      '+': '₊', '-': '₋',
    };

    return text
      // ^ の後ろの数字・記号を上付きに変換 (例: m/s^2 -> m/s²)
      .replace(/\^([0-9+\-]+)/g, (_, match) => {
        return match.split('').map((c: string) => supers[c] || c).join('');
      })
      // _ の後ろの数字・記号を下付きに変換 (例: CO_2 -> CO₂)
      .replace(/_([0-9+\-]+)/g, (_, match) => {
        return match.split('').map((c: string) => subs[c] || c).join('');
      });
  };

  // --- Handler: 列追加時に系列を自動追加 ---
  const handleColumnAdd = (columnName: string) => {
    // X軸として使われている列なら系列追加はしない
    if (columnName === config.xAxisKey) return;

    // 既に同じdataKeyの系列があれば追加しない
    if (config.series.some((s) => s.dataKey === columnName)) return;

    // 新しい系列を追加
    const newSeries: SeriesConfig = {
      id: crypto.randomUUID(),
      dataKey: columnName,
      name: columnName,
      type: 'line',
      lineType: 'linear',
      yAxisId: 'left',
      color: DEFAULT_COLORS[config.series.length % DEFAULT_COLORS.length],
      visible: true,
      strokeWidth: 2,
      showDot: false,
    };

    setConfig((prev) => ({
      ...prev,
      series: [...prev.series, newSeries],
    }));
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
            <span className="text-sm font-mono font-normal text-gray-500 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full">
              {APP_VERSION}
            </span>
            <p className="text-muted-foreground mt-2">
              インストール不要・完全クライアントサイド。
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            <span>View on GitHub</span>
          </a>
        </Card>
      </div>
    );
  }

  const updateFontSize = (key: keyof ChartConfig['style']['fontSize'], value: number) => {
    setConfig((prev) => ({
      ...prev,
      style: {
        ...prev.style,
        fontSize: {
          ...prev.style.fontSize,
          [key]: value,
        },
      },
    }));
  };
  return (
    <div className="flex flex-col min-h-screen lg:h-screen bg-gray-50">
      {/* Header - モバイル・PC共通 */}
      <header className="h-14 border-b border-border items-center justify-between px-4 bg-white shrink-0 z-20 w-full flex lg:absolute lg:top-0 lg:left-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white font-bold">G</div>
          <span className="font-semibold">GoriGraph</span>
          <span className="text-muted-foreground text-sm border-l pl-2 ml-2 truncate max-w-32 lg:max-w-50">
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} className="mr-0 lg:mr-2" /> <span className="hidden lg:inline">新規CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={saveProject}>
            <Save size={14} className="mr-0 lg:mr-2" /> <span className="hidden lg:inline">プロジェクト保存</span>
          </Button>

          {/* ...保存ボタンの後... */}
          <div className="h-4 w-px bg-border mx-1 hidden lg:block" />

          {/* Desktop: 詳細ボタン */}
          <div className="hidden lg:flex items-center gap-2">
            {/* PNG(軽) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportImage('png', 1)}
              disabled={isExporting}
              title="軽量サイズ (1x)"
            >
              {isExporting ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <ImageIcon size={14} className="mr-1" />
              )}
              PNG(軽)
            </Button>

            {/* PNG(高) */}
            <Button size="sm" onClick={() => exportImage('png', 3)} disabled={isExporting} title="高解像度 (3x)">
              {isExporting ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Download size={14} className="mr-2" />
              )}
              PNG(高)
            </Button>

            {/* SVG */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportImage('svg')}
              disabled={isExporting}
              title="ベクター形式"
            >
              {isExporting ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <span className="text-xs font-bold mr-1">SVG</span>
              )}
              出力
            </Button>
          </div>

          {/* Mobile Header 内のボタンエリア */}
          <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
            <Button size="sm" onClick={() => exportImage('png', 1)} disabled={isExporting}>
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : 'PNG'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportImage('svg')} disabled={isExporting}>
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : 'SVG'}
            </Button>
          </div>
        </div>
        <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleCsvUpload} />
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-auto lg:overflow-hidden lg:mt-14">
        {/* Main: Preview Area */}
        <main className="flex-1 flex flex-col min-w-0 order-1 lg:order-2 bg-gray-50/50">
          <div className="p-2 lg:p-8 flex items-center justify-center lg:flex-1 lg:overflow-y-auto">
            <div
              className="bg-white shadow-xl rounded-xl p-2 lg:p-8 w-full max-w-5xl aspect-[1.414/1] relative flex flex-col"
              ref={graphRef}
              style={{
                fontFamily: fontType === 'serif' ? '"Noto Serif JP", serif' : '"Noto Sans JP", sans-serif',
              }}
            >
              {/* --- タイトル (編集/表示切り替え) --- */}
              {isEditingTitle ? (
                // 編集モード: 生のテキストを表示 (編集しやすくするため)
                <input
                  autoFocus
                  className="text-center w-full mb-4 outline-none bg-gray-50 rounded font-bold border-b border-primary text-gray-900"
                  style={{ fontSize: config.style.fontSize.title }}
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                />
              ) : (
                // 表示モード: 整形されたテキストを表示 (クリックで編集へ)
                <h2
                  className="text-center w-full mb-4 font-bold hover:bg-gray-50 rounded cursor-text min-h-[1.5em] text-gray-900"
                  style={{ fontSize: config.style.fontSize.title }}
                  onClick={() => setIsEditingTitle(true)}
                  title="クリックしてタイトルを編集"
                >
                  {formatText(config.title) || <span className="text-gray-300">タイトルを入力</span>}
                </h2>
              )}

              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data}
                    margin={{
                      top: window.innerWidth < 1024 ? 10 : 20,
                      right: window.innerWidth < 1024 ? 15 : 30,
                      left: window.innerWidth < 1024 ? 15 : 30,
                      bottom: window.innerWidth < 1024 ? 20 : 40,
                    }}
                  >
                    {config.showGrid && <CartesianGrid stroke="#f3f4f6" strokeWidth={1} />}

                    {/* X軸 (フォントサイズ適用) */}
                    <XAxis
                      dataKey={config.xAxisKey}
                      height={60}
                      tick={{ fontSize: config.style.fontSize.axisTick, fill: '#666' }}
                      tickMargin={10}
                    >
                      <RechartsLabel
                        // ★修正: formatText(...) で囲む
                        value={formatText(`${config.axes.bottom.label} ${config.axes.bottom.unit ? `[${config.axes.bottom.unit}]` : ''}`)}
                        position="insideBottom"
                        offset={0}
                        style={{ textAnchor: 'middle', fontSize: config.style.fontSize.axisLabel, fontWeight: 500, fill: '#333' }}
                      />
                    </XAxis>

                    {/* 左Y軸 (フォントサイズ適用) */}
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: config.style.fontSize.axisTick, fill: '#666' }}
                      domain={[
                        config.axes.left.min !== '' ? config.axes.left.min : 'auto',
                        config.axes.left.max !== '' ? config.axes.left.max : 'auto',
                      ]}
                    >
                      <RechartsLabel
                        value={formatText(`${config.axes.left.label} ${config.axes.left.unit ? `[${config.axes.left.unit}]` : ''}`)}
                        angle={-90}
                        position="insideLeft"
                        style={{
                          textAnchor: 'middle',
                          fontSize: config.style.fontSize.axisLabel,
                          fontWeight: 500,
                          fill: config.series.some((s) => s.yAxisId === 'left') ? '#2563eb' : '#333',
                        }}
                      />
                    </YAxis>

                    {/* 右Y軸 (フォントサイズ適用) */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: config.style.fontSize.axisTick, fill: '#666' }}
                      domain={[
                        config.axes.right.min !== '' ? config.axes.right.min : 'auto',
                        config.axes.right.max !== '' ? config.axes.right.max : 'auto',
                      ]}
                    >
                      <RechartsLabel
                        value={formatText(`${config.axes.right.label} ${config.axes.right.unit ? `[${config.axes.right.unit}]` : ''}`)}
                        angle={90}
                        position="insideRight"
                        style={{
                          textAnchor: 'middle',
                          fontSize: config.style.fontSize.axisLabel,
                          fontWeight: 500,
                          fill: config.series.some((s) => s.yAxisId === 'right') ? '#d97706' : '#333',
                        }}
                      />
                    </YAxis>

                    <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        // 値の名前(name)と、X軸の値(label)の両方にformatTextを適用
                        formatter={(value: any, name: any) => [value, formatText(String(name))]}
                        labelFormatter={(label) => formatText(String(label))}
                    />

                    <Legend 
                        verticalAlign="top" 
                        height={36} 
                        iconType="circle" 
                        wrapperStyle={{ fontSize: config.style.fontSize.legend }}
                        // 凡例の項目名にformatTextを適用
                        formatter={(value) => <span className="text-gray-700 font-medium">{formatText(value)}</span>}
                    />

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
                            type={s.lineType || 'linear'}
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
              <div className="absolute bottom-1 right-2 lg:bottom-2 lg:right-4 text-[10px] lg:text-xs text-gray-300 pointer-events-none">
                Generated by GoriGraph
              </div>
            </div>
          </div>
        </main>

        {/* Sidebar: Controls */}
        <aside className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-r border-gray-200 flex flex-col flex-none order-2 lg:order-1 z-10">
          <div className="lg:flex-1 lg:overflow-y-auto p-4 space-y-8">
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
                        onChange={(e) => updateAxis('left', 'min', e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>最大値</Label>
                      <Input
                        type="number"
                        placeholder="Auto"
                        value={config.axes.left.max}
                        onChange={(e) => updateAxis('left', 'max', e.target.value === '' ? '' : Number(e.target.value))}
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

            {/* フォント設定 */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Type size={14} /> フォント設定
              </h3>

              {/* フォント種類 */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFontType('sans')}
                  className={`flex-1 py-1 text-xs font-medium rounded ${fontType === 'sans' ? 'bg-white shadow' : 'text-gray-500'}`}
                >
                  ゴシック
                </button>
                <button
                  type="button"
                  onClick={() => setFontType('serif')}
                  className={`flex-1 py-1 text-xs font-medium rounded ${fontType === 'serif' ? 'bg-white shadow' : 'text-gray-500'}`}
                >
                  明朝体
                </button>
              </div>

              {/* フォントサイズ調整 */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <Label>タイトル</Label>
                  <Input
                    type="number"
                    value={config.style.fontSize.title}
                    onChange={(e) => updateFontSize('title', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>凡例 (Legend)</Label>
                  <Input
                    type="number"
                    value={config.style.fontSize.legend}
                    onChange={(e) => updateFontSize('legend', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>軸ラベル</Label>
                  <Input
                    type="number"
                    value={config.style.fontSize.axisLabel}
                    onChange={(e) => updateFontSize('axisLabel', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>軸目盛り</Label>
                  <Input
                    type="number"
                    value={config.style.fontSize.axisTick}
                    onChange={(e) => updateFontSize('axisTick', Number(e.target.value))}
                  />
                </div>
              </div>
            </section>

            <hr className="border-border" />

            {/* データ編集ボタン (これが唯一の編集手段になります) */}
            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              disabled={data.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              データを編集・確認
            </button>

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
                        <div className="col-span-2">
                          <Label>線の形状</Label>
                          <NativeSelect
                            value={series.lineType || 'linear'}
                            onChange={(e) => updateSeries(idx, { lineType: e.target.value as any })}
                          >
                            <option value="linear">直線 (Linear)</option>
                            <option value="monotone">滑らか (Smooth)</option>
                            <option value="step">階段状 (Step)</option>
                          </NativeSelect>
                        </div>
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
                        <div className="flex items-center gap-2 mt-4">
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
          </div>
        </aside>
      </div>

      {/* データ編集モーダル */}
      <DataEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        data={data}
        setData={setData}
        headers={headers}
        setHeaders={setHeaders}
        onColumnAdd={handleColumnAdd}
      />
    </div>
  );
}
