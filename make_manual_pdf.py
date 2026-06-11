# -*- coding: utf-8 -*-
"""利用マニュアルPDFを生成（日本語CIDフォント使用・追加インストール不要）"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, ListFlowable, ListItem
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT

# 日本語フォント登録（reportlab同梱のCIDフォント）
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))   # ゴシック
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiMin-W3'))      # 明朝
JP = 'HeiseiKakuGo-W5'
JP_MIN = 'HeiseiMin-W3'

ACCENT = colors.HexColor('#2563eb')
DARK = colors.HexColor('#1e293b')
GRAY = colors.HexColor('#64748b')
LIGHT = colors.HexColor('#f1f5f9')

styles = getSampleStyleSheet()

def s(name, **kw):
    base = dict(fontName=JP, leading=16, textColor=DARK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(name, **base)

title_style   = s('t', fontSize=22, leading=28, textColor=ACCENT, spaceAfter=4)
sub_style     = s('sub', fontSize=10.5, textColor=GRAY, spaceAfter=18)
h2_style      = s('h2', fontSize=14, leading=20, textColor=ACCENT, spaceBefore=16, spaceAfter=8)
body_style    = s('body', fontSize=10, leading=16, spaceAfter=6)
small_style   = s('small', fontSize=9, leading=14, textColor=GRAY, spaceAfter=4)
note_style    = s('note', fontSize=9.5, leading=15, textColor=colors.HexColor('#92400e'))
cell_style    = s('cell', fontSize=9, leading=13)
cellb_style   = s('cellb', fontSize=9, leading=13, textColor=DARK)

story = []

def H2(t): story.append(Paragraph(t, h2_style))
def P(t): story.append(Paragraph(t, body_style))
def SP(h=8): story.append(Spacer(1, h))

def bullets(items):
    lf = ListFlowable(
        [ListItem(Paragraph(i, body_style), leftIndent=6) for i in items],
        bulletType='bullet', start='•', leftIndent=14, bulletColor=ACCENT,
    )
    story.append(lf); SP(4)

def table(headers, rows, col_widths):
    data = [[Paragraph(h, ParagraphStyle('th', fontName=JP, fontSize=9, textColor=colors.white)) for h in headers]]
    for r in rows:
        data.append([Paragraph(c, cell_style) for c in r])
    t = Table(data, colWidths=col_widths, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), ACCENT),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(t); SP(8)

def note(t):
    box = Table([[Paragraph(t, note_style)]], colWidths=[170*mm])
    box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#fef3c7')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#fcd34d')),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(box); SP(8)

# ── 表紙ヘッダ ──
story.append(Paragraph('コンテンツ制作管理アプリ', title_style))
story.append(Paragraph('利用マニュアル　／　社内向け', sub_style))
P('社内でコンテンツ（Instagram・X・イベント等）の制作進捗を管理するためのツールです。URLにアクセスするだけで、誰でもブラウザから使えます。')

# 1
H2('1. 画面の見かた')
P('トップページにプロジェクトが「カード」で並びます。上のタブで <b>進行中 / 完了 / すべて</b> を切り替えられます。')
P('各カードに表示される情報：')
bullets([
    '種別（Instagram・X・イベント・LINE誘導 など）',
    'タイトル',
    'コード（担当者・案件コード）',
    '納期',
    '進捗バー（◯/◯ ステップ完了）',
])

# 2
H2('2. 探す・絞り込む')
table(['操作', '場所'],
    [['キーワード検索', '上の「タイトル・コードで検索」欄'],
     ['種別で絞る', 'Instagram / X / イベント などのボタン'],
     ['コードで絞る', '「コード:」の行のボタン'],
     ['並び替え', '登録順 / 締切順 / コード順'],
     ['表示切替', '制作管理 / スケジュール']],
    [55*mm, 115*mm])
P('<b>自分の担当だけ見たいとき</b>：「コード:」の行で自分のコードを押すと、その案件だけ表示されます。さらに「リンクをコピー」を押すと、そのコードだけ表示される専用URLが作れます。チームメンバーにそのURLを渡せば、最初からその人の案件だけ見える状態になります。')

# 3
H2('3. ステップ（作業工程）を進める')
P('カードの <b>「ステップを表示」</b> を押すと、各工程が一覧で出ます。各ステップの右側のメニューから状態を選べます。')
table(['ステータス', '意味'],
    [['未着手', 'まだ手をつけていない'],
     ['素材待ち', 'クライアント/外注からの素材待ち'],
     ['素材受領', '素材が届いた'],
     ['進行中', '制作作業中'],
     ['確認待ち', '確認・チェック待ち'],
     ['完了', 'このステップ終了'],
     ['ロック中', '前の工程が終わるまで着手できない']],
    [45*mm, 125*mm])
note('ステータスを変えると即座に反映され、進捗バーも自動更新されます。設定によってはChatwork/Discordに通知が飛びます。ステップにはURL・ファイル・メモを添付できます。')

P('<b>ロック（鍵）と工程の紐付け</b>')
P('ステップ同士には「順番」を設定できます。あるステップを別のステップに<b>紐付ける</b>と、紐付け先が「完了」になるまで、そのステップは<b>ロック中</b>（着手不可）になります。')
bullets([
    '例：「デザイン制作」を「素材受領」に紐付けると、素材が揃うまでデザインはロック中',
    '紐付け先が完了すると、ロックは自動で解除され「未着手」になります',
    '前の工程が終わっていないのに先に進むミスを防げます',
])

# 4
H2('4. 新しいプロジェクトを作る')
P('<b>方法A：1件ずつ作る</b>')
P('右上の「＋ 新規プロジェクト」から作成します（管理者用の合言葉URLが必要。管理者に確認してください）。タイトル・制作種別・コード・納期・説明を入力します。')
SP(4)
P('<b>方法B：CSVでまとめて作る</b>')
bullets([
    '右上の「CSV取込」を押す',
    '「サンプルCSV」をダウンロードして形式を確認',
    '表計算ソフト（Excel・スプレッドシート）で作成 → CSVで保存',
    'ファイルをドロップ → プレビュー確認 → 「一括作成」',
])
P('CSVの形式： <font name="%s">タイトル, 種別, コード, 納期, ステップ名, 担当, ステップ期日, 備考</font>' % JP_MIN)
bullets([
    '同じタイトルの行は、1つのプロジェクトのステップとしてまとまります',
    '同じタイトルが既にある場合は<b>上書き</b>されます（最新版に更新）',
    '「担当」は登録済みの役割名（クライアント/外注/自社 など）を入れるとマッチします',
])

# 5
H2('5. 表示の切り替え（制作管理 / スケジュール）')
P('右上のボタンで2つの表示を切り替えられます。')
bullets([
    '<b>制作管理</b>：プロジェクトをカードで並べて、進捗やステップを管理する通常の画面',
    '<b>スケジュール</b>：納期やステップ期日をカレンダー形式で確認できる画面。いつ何があるか一覧で見たいときに便利',
])

# 6
H2('6. 設定（右上の歯車ボタン）')
P('歯車ボタンを押すと、3つのタブで各種設定ができます。')

P('<b>役割タブ</b>')
bullets([
    '担当の役割（クライアント・外注・自社 など）の名前と色を変更できます',
    '「役割を追加」で新しい役割を増やせます',
    '不要な役割は削除できます',
    '上下の矢印で並び替えできます',
])

P('<b>ステータスタブ</b>')
bullets([
    'ステータス（未着手・進行中・完了 など）の名前・色を変更・追加・削除できます',
    '名前を変えると既存のステップにも反映されます',
    '並び替えもできます',
])

P('<b>通知タブ</b>')
P('ステータス更新や新規作成時に、ChatworkまたはDiscordへ自動通知を送れます。')
bullets([
    'まず「通知なし / Chatwork / Discord」から送り先を選びます',
    '<b>Chatworkの場合</b>：APIトークンと、通知したいルームの番号（ルームID）を入力',
    '<b>Discordの場合</b>：チャンネルで作成したWebhook URLを貼り付け',
    '「テスト通知を送る」ボタンで、ちゃんと届くか確認できます',
])
note('Chatworkのルームidは、通知したいチャットを開いたときのURL末尾の数字です。DiscordのWebhook URLは、チャンネル設定→連携サービス→ウェブフックで作成できます。')

# 7. その他の操作
H2('7. その他の操作')
table(['やりたいこと', '操作'],
    [['プロジェクトを複製', 'カード右上のコピーアイコン'],
     ['プロジェクトを削除', 'カード右上のゴミ箱アイコン（ゴミ箱へ移動）'],
     ['タイトルを編集', 'タイトル横の鉛筆アイコン'],
     ['削除を取り消す', '上部の「ゴミ箱」ボタン → 元に戻す'],
     ['完全に削除する', '「ゴミ箱」ボタン → ×（取り消し不可）']],
    [55*mm, 115*mm])
P('削除してもすぐに消えるわけではなく、まず<b>ゴミ箱</b>に移動します。上部のゴミ箱ボタン（削除件数のバッジ付き）から、いつでも「元に戻す」ことができます。本当に消したいものだけ「完全に削除」してください。')

# 8
H2('8. よくある質問')
qa = [
    ('Q. 編集した内容は自動で保存される？', 'A. はい。ステータス変更・編集はすべて自動保存されます。保存ボタンは不要です。'),
    ('Q. 他の人が変更したら自分の画面にも反映される？', 'A. はい。リアルタイムで反映されます（ページを開いたままでOK）。'),
    ('Q. 間違えて削除した', 'A. 上部の「ゴミ箱」ボタンを開き、「元に戻す」を押せば復元できます。完全に消したいときはゴミ箱内で「×（完全に削除）」を押します。'),
    ('Q. 役割名（クライアント名など）を変えたい', 'A. 右上の設定（歯車）→「役割」タブで変更できます。'),
    ('Q. 通知をChatworkからDiscordに変えたい', 'A. 右上の設定（歯車）→「通知」タブで送り先を切り替えられます。'),
]
for q, a in qa:
    story.append(Paragraph('<b>%s</b>' % q, body_style))
    story.append(Paragraph(a, small_style))
    SP(4)

SP(10)
story.append(Paragraph('困ったときは管理者（システム担当）に連絡してください。', small_style))

doc = SimpleDocTemplate(
    '利用マニュアル.pdf', pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm, topMargin=18*mm, bottomMargin=16*mm,
    title='コンテンツ制作管理アプリ 利用マニュアル',
)
doc.build(story)
print('done')
