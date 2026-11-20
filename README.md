# www.ad-sheet.com の元データ

`main` ブランチ（公開中のファイル）を作るための元データとビルドの仕組みです。

## 中身

| 場所 | 中身 |
|---|---|
| `lp2/project/Main.dc.html` | セカンドオピニオンのページ（/）の元データ（Claude Design の x-dc 形式） |
| `adsheet/project/Main.dc.html` | アドシートのページ（/tool/）の元データ |
| `site_src/pages/` | 旧Googleサイトから移した本文（利用規約・プライバシー・特商法・FAQ・使い方・お問い合わせ） |
| `site_build/src/dc-lite.js` | x-dc を静的サイトで動かす小さな実行環境 |
| `site_build/build.js` | 書き出し（サーバー側で描画した HTML を焼き込む） |
| `site_build/qa.js` | 動作チェック（ハイドレーション・クリック操作・スマホ表示など） |
| `site_build/og/` | OGP画像のもと |

## 書き出し方

```sh
cd site_build
node build.js   # dist/ に書き出し（Playwright の Chromium を使います）
node qa.js      # 動作チェック
```

`dist/` の中身を `main` ブランチのルートにコピーして push すると公開されます。
