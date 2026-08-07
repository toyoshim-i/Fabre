# Fabre ノードタイプリファレンス (Node Reference Guide)

Fabre では、ワークフローを構築するために **フローポート (三角形)** と **データポート (丸形)** を繋ぎ合わせてノードを接続します。

- 🔺 **フローポート (Flow Ports)**: ノードの実行順序・制御の流れを決定します。
- 🟢/🔵 **データポート (Data Ports)**: テキスト、数値、構造化オブジェクトなどのデータを渡します。

---

## 📌 カテゴリ別ノード一覧

### 1. イベント・制御フロー (Event & Flow Control)

#### ⚡ ユーザー入力待機 (`event_wait`)
ユーザーからのチャット入力やイベント発火をトリガーにしてワークフローを開始・再開するノードです。
- **入力ポート**:
  - `flow-in` (Flow): ループ再開用のフロー入力
- **出力ポート**:
  - `flow-out` (Flow): イベント受信時に発火するフロー出力
  - `data-out` (Data): 受信したテキストデータ
- **プロパティ**:
  - **初期データ値**: デフォルトで保持する入力テキスト

#### 🚀 開始ノード (`start`)
ワークフローのスタート地点を定義します。
- **出力ポート**:
  - `flow-out` (Flow): 実行開始フロー
  - `data-out` (Data): 初期変数またはテキスト
- **プロパティ**:
  - **初期テキスト値**: ワークフロー開始時に出力ポートへ渡されるテキスト

#### 🔀 条件分岐 (`condition`)
入力テキストの内容に応じて処理フローを `True` / `False` に分岐します。
- **入力ポート**:
  - `flow-in` (Flow): 実行フロー
  - `text-in` (Data): 判定対象のテキスト
- **出力ポート**:
  - `flow-true` (Flow): 条件合致時のフロー
  - `flow-false` (Flow): 条件不一致時のフロー
  - `result-out` (Data): 判定結果テキスト (`"true"` または `"false"`)
- **プロパティ**:
  - **判定ルール**: `Contains` (含む), `Regex Match` (正規表現), `JS Expression` (JavaScript評価)
  - **一致パターン**: 判定に使用する文字列または正規表現 (例: `PASS`)

---

### 2. LLM & プロンプト (LLM & Prompt)

#### 📝 プロンプト構築 (`prompt`)
変数埋め込み（`{{variable_name}}`）に対応したプロンプトテンプレートを作成します。AIによる精錬・修正機能が付属しています。
- **入力ポート**:
  - `flow-in` (Flow): 実行フロー
  - `data-in` (Data): 埋め込み用データ
- **出力ポート**:
  - `flow-out` (Flow): 完了フロー
  - `prompt-out` (Data): コンパイル後のプロンプトテキスト
- **プロパティ**:
  - **プロンプトテンプレート**: `{{inputValue}}` などのプレースホルダーを含むテンプレート
  - **🪄 精錬 (Refine)**: 現在のプロンプトを LLM が自動的に最適化
  - **✏️ コメント修正 (Revise)**: 「もっと簡潔に」などの指示に基づいて LLM がテンプレートを修正

#### 🤖 LLM 呼び出し (`llm`)
大規模言語モデル (LLM) へリクエストを送信し、テキスト生成または Function Calling を実行します。
- **入力ポート**:
  - `flow-in` (Flow): 実行フロー
  - `prompt-in` (Data): プロンプト入力
  - `session-in` (Data, 任意): 接続された `Session Manager` オブジェクト
  - `tools-in` (Data, 任意): 接続された `Tool Config` オブジェクト
- **出力ポート**:
  - `flow-success` (Flow): 生成成功時のフロー
  - `flow-error` (Flow): エラー発生時のフロー (API失敗、CORS等)
  - `response-out` (Data): LLMの自然言語レスポンス
  - `tool-call-out` (Data): LLMが発行した Function Calling ペイロード (`tool_calls`)
- **プロパティ**:
  - **システム指示 (System Prompt)**: モデルへの役割・指示
  - **Temperature**: 生成のランダム性 (0.0 〜 1.0)
  - **ツール呼び出しの有効化**: Function Calling のオン/オフ
  - **プロバイダー / モデル / エンドポイント上書き**: グローバル設定の上書き

#### ✂️ 情報抽出 (`extractor`)
LLMの応答からコードブロックやJSON、特定文字列をパースして抽出します。
- **入力ポート**:
  - `flow-in` (Flow): 実行フロー
  - `text-in` (Data): 解析対象テキスト
- **出力ポート**:
  - `flow-out` (Flow): 完了フロー
  - `extracted-out` (Data): 抽出された文字列
- **プロパティ**:
  - **抽出タイプ**:
    - `code_block`: マークダウンの ```js ... ``` コードブロック内を抽出
    - `json_key`: JSONをパースし指定キーの値を取り出す
    - `regex`: 正規表現のキャプチャグループを取り出す
    - `delimiter`: 指定した開始・終了文字列の開示間を抽出

---

### 3. メモリ・セッション (Memory & Session)

#### 🧠 対話セッション管理 (`session`)
構造化された会話履歴（`Canonical Messages`）を一括管理し、LLMノードへ自動共有します。
- **入力ポート**:
  - `flow-in` (Flow): 実行フロー
  - `user-in` (Data): ユーザーの発話テキスト
  - `tool-result-in` (Data): ツール実行結果テキスト (`role: 'tool'`)
- **出力ポート**:
  - `flow-out` (Flow): 完了フロー
  - `session-out` (Data): セッションコンテキストオブジェクト (LLMの `session-in` へ接続)
  - `messages-out` (Data): 構造化メッセージ配列 (Stream View の `messages-in` へ接続)
- **プロパティ**:
  - **最大保持ターン数 (`maxHistoryTurns`)**: 履歴の上限（過去の古い発話を自動削除）
  - **モデル名 / エンドポイント名の上書き**: このセッションが使用する固有の LLM 設定

#### 💾 変数設定 (`set_var`)
ワークフロー全体のグローバル変数領域へ値を書き込み・保持します。
- **入力ポート**:
  - `flow-in` (Flow): 実行フロー
  - `value-in` (Data): 保存する値
- **出力ポート**:
  - `flow-out` (Flow): 完了フロー
  - `value-out` (Data): 保持している変数データ
- **プロパティ**:
  - **変数名**: 保存先の変数識別子 (例: `user_name`)

---

### 4. ツール & 環境 (Tools & Environment)

#### ⚙️ ツール環境設定 (`tool_config`)
LLMノードで利用可能なビルトインツールおよび MCP サーバーの設定を集約し、LLMに供給します。
- **出力ポート**:
  - `tools-out` (Data): 統合されたツールスキーマ設定 (LLMの `tools-in` へ接続)
- **プロパティ**:
  - **有効化ビルトインツール**: `js_sandbox`, `read_file`, `write_file`, `list_files`, `mock_search` などの個別トグル
  - **ツール呼び出しの強制 (`requireToolCall`)**: LLMに必ずツールを呼び出させる設定
  - **デフォルト設定の複製**: グローバル環境のデフォルトツール設定をノードにコピー

#### 🛠️ ツール実行 (`tool`)
指定されたツール (JS Sandbox、ファイル読み書き、モックツール) を実際に実行します。
- **入力ポート**:
  - `flow-in` (Flow): 実行フロー
  - `input-in` (Data): ツールに入力するコードまたは引数 (`tool-call-out` ポートと接続)
- **出力ポート**:
  - `flow-out` (Flow): 実行完了フロー
  - `output-out` (Data): ツールの実行結果テキスト (Session Manager の `tool-result-in` へ接続)
- **プロパティ**:
  - **ツール種別**: `js_sandbox` (JavaScript実行), `read_file`, `write_file`, `list_files`, `mock_search` 等

---

### 5. 表示・出力 (View & Output)

#### 📜 タイムライン表示 (`stream_view`)
リアルタイムのチャット会話ログやストリーミングテキストを表示するUIカードノードです。
- **入力ポート**:
  - `flow-in` (Flow): 実行フロー
  - `text-in` (Data): 追加表示するテキスト
  - `messages-in` (Data): Session Manager から受け取る構造化メッセージ配列
- **出力ポート**:
  - `flow-out` (Flow): 次のノードへのフロー

#### 🎯 最終結果出力 (`output`)
ワークフローの最終到達点として結果をカード上に表示します。
- **入力ポート**:
  - `flow-in` (Flow): 完了フロー
  - `data-in` (Data): 出力テキストデータ
- **プロパティ**:
  - **ラベル名**: カードヘッダーに表示するタイトル
