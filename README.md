# Fabre (ファブル) - Flow-based Agent Builder & Runtime Engine

**Fabre** は、ブラウザ上で直感的に LLM AI エージェントのワークフローを視覚的にデザイン・実行・デバッグできる、サーバーレスのノードベース型エージェントビルド環境＆実行エンジンです。

名前の由来は昆虫学者のジャン＝アンリ・ファーブル（Jean-Henri Fabre）。自律エージェントの動態観察やプログラムの「バグ」を観察・デバッグするための実験観察キットとして命名されました。

---

## ✨ 主な特徴 (Key Features)

- 🚀 **完全フロントエンド完結 (Zero-Dependency & Pure Vanilla JS)**
  - バックエンドサーバー不要。HTML / CSS / JavaScript のみで動作し、高いパフォーマンスとセキュアなローカル完結動作を実現。
- 🎨 **ノードベースのワークフローエディタ**
  - ベジェ曲線接続、キャンバスのパン・ズーム、実行中のシグナルアニメーション（データ／フローの移動）、リアルタイムデバッグログ機能。
- 🧠 **構造化対話セッション管理 (Session Manager)**
  - 会話履歴（`role: 'user' | 'assistant' | 'system' | 'tool'`）を構造化保持。
  - スライディングウィンドウによる履歴上限（`maxHistoryTurns`）制御や、セッションごとの LLM モデル/エンドポイント上書きをサポート。
- 🛠️ **ネイティブ Tool Calling & MCP (Model Context Protocol) 連携**
  - OpenAI Function Calling 互換の `tool-call-out` ポートによる直接ツール呼び出し。
  - JS Sandbox、ファイル操作（`read_file`, `write_file`, `list_files`）、ウェブ検索モック、および外付け MCP サーバーとの動的ツール連携環境（`Tool Config`）。
- 🤖 **柔軟な LLM プロバイダー対応**
  - Ollama、OpenAI 互換 REST API、Chrome Built-in AI (`window.ai` / Gemini Nano) に対応。
- ✏️ **AI アシスト付きプロンプト最適化**
  - Prompt ノードにて「プロンプト精錬 (Refine)」や「コメント指定修正 (Revise)」を AI が自動アシスト。
- 📁 **ローカルファイルシステム連携 (File System Access API)**
  - ブラウザからローカルフォルダを直接選択・接続し、ライブファイルツリー表示および読み書き操作が可能。
- 🌐 **多言語インターフェース (i18n)**
  - 日本語 / 英語のワンクリック切り替えに対応。

---

## 📦 同梱サンプルワークフロー (Sample Workflows)

画面上の「サンプル読み込み」または `samples/` ディレクトリから、以下の高度な AI エージェントパターンをすぐに試すことができます：

1. **Tool Calling Agent (`tool-calling-agent.fabre`)**
   - OpenAI Function Calling 互換の 2-Pass エージェント。`tool-call-out` ポートから直接ツール（JS Sandbox）を実行し、その結果を Session Manager に記録した上で、2回目の LLM が自然言語で回答を要約します。
2. **End-to-End Infinite Chat (`e2e-infinite-chat.fabre`)**
   - Session Manager と Tool Config 環境を備えた無限ターン対話チャットエージェント。Stream View タイムラインにリアルタイムで会話履歴が表示されます。
3. **JS Sandbox Browser Alert Agent (`js-sandbox-alert-agent.fabre`)**
   - プロンプト生成 ➔ コード抽出 (Extractor) ➔ JS Sandbox 実行 ➔ エラー時分岐 (flow-error) を備えた耐久型自動化エージェント。
4. **Self-Debugging Agent Loop (`self-fixing-loop.fabre`)**
   - コード実行エラーを条件分岐 (Condition) で検知し、エラーメッセージをプロンプトにフィードバックして自律的に修正・再実行するループ構造。
5. **Condition Branching & Flow (`condition-branching.fabre`)**
   - テキストの判定結果（PASS / FAIL）に応じて動的に処理フローを切り替える基本パターン。

---

## 🚀 クイックスタート (Getting Started)

### 1. ローカルでの実行

バックエンドビルド手順は不要です。任意の静的ファイルサーバーでルートディレクトリをホストするか、ブラウザで直接 `index.html` を開きます。

**Python を使う場合:**
```bash
python3 -m http.server 8080
```
ブラウザで `http://localhost:8080` にアクセスします。

**Node.js (npx) を使う場合:**
```bash
npx servor . 8080
```

---

## 🧪 テストの実行 (Testing)

Node.js 標準のテストランナーを使用して、モデル状態遷移、コンポーネント連携、およびサンプルワークフローの統合テストを一括実行できます。

```bash
npm test
```

すべての統合テストはモック LLM およびローカルランタイム上で検証されます。

---

## 📚 ドキュメント (Documentation)

- [ノード詳細リファレンス (docs/nodes.md)](file:///home/toyoshim/Work/self/docs/nodes.md) - 各ノードの仕様、ポート一覧、プロパティ設定ガイド

---

## 📄 ライセンス

MIT License
