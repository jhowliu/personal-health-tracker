# 動作圖片提示詞:器械補充

這一批 9 個新動作(大腿外展機、肩推機、蝴蝶機夾胸、反向飛鳥機、滑輪夾胸、滑輪臉拉、跪姿滑輪捲腹、Pallof 抗旋轉推、壺鈴擺盪)的生圖提示詞。角色跟舊圖同一隻柴犬,其他動作見 [exercise-image-prompts.md](exercise-image-prompts.md)。

每個動作要生五張:起始、結束,以及動畫用的三張中間圖(25%、50%、75%)。

## 規格

| 項目 | 規格 |
|---|---|
| 尺寸 | 384×384,純白背景 |
| 靜態圖 | 起始、結束兩張,轉成 WebP(品質 88)放進 `mobile/assets/exercise/`,檔名 `<代稱>-start.webp`、`<代稱>-end.webp` |
| 動畫 | 8 格,每格 200ms(**5fps**),無限循環,有損 WebP 品質 88,放進 `mobile/assets/exercise-anim/<代稱>.webp` |
| 動畫順序 | 起始 → 25% → 50% → 75% → 結束 → 75% → 50% → 25%,再回到起始 |

中間圖只拿來組動畫,**不要**放進 `assets/exercise/`(那裡每張圖都會被列進清單)。

## 步驟

1. 開一個新的對話,先貼「步驟 1:基準角色」,挑一張滿意的當基準。
2. 依序貼每個動作的五段提示詞。同一個動作的五張要連著生,中間圖才對得上起始和結束的構圖。
3. 角色走樣時,貼「補救提示詞」,再重生成。
4. 照「步驟 3」縮圖、轉檔、組動畫,最後在 `mobile/` 執行 `npm run exercise-images`。

## 步驟 1:基準角色

```
A cute chibi Shiba Inu character standing upright on two legs like a person,
flat vector-style cartoon illustration. Orange-tan fur with a cream muzzle,
cream chest and cream paws, small triangle ears, a black nose, tiny happy eyes,
pink blush on the cheeks, and a curly tail. It wears a raspberry-pink (#A3245F)
short-sleeve gym tee, dark-gray shorts and black sneakers.
Smooth thick outlines, flat colors with very soft shading, friendly and energetic.
Full body visible, centered, square 1:1 image, plain pure white background,
no text, no watermark, only a small soft ground shadow.
Show it in a neutral standing pose, front view.
```

## 步驟 2:各個動作

### 1. `hip-abduction-machine` — 大腿外展機

起始(`hip-abduction-machine-start`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, seated upright on a hip abduction machine, back against the backrest, knees together with the pads on the outside of the knees, hands on the side handles.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

結束(`hip-abduction-machine-end`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, seated upright on a hip abduction machine, back against the backrest, knees pushed wide apart against the pads, hands on the side handles.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 25%(`hip-abduction-machine-25`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: front view, seated upright on a hip abduction machine, back against the backrest, hands on the side handles, knees just starting to open, a small gap between them.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 50%(`hip-abduction-machine-50`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: front view, seated upright on a hip abduction machine, back against the backrest, hands on the side handles, knees pushed halfway apart against the pads.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 75%(`hip-abduction-machine-75`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: front view, seated upright on a hip abduction machine, back against the backrest, hands on the side handles, knees almost fully apart against the pads.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 2. `shoulder-press-machine` — 肩推機

起始(`shoulder-press-machine-start`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, seated on a shoulder press machine, back against the pad, hands on the handles at shoulder height, elbows bent below the hands.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

結束(`shoulder-press-machine-end`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, seated on a shoulder press machine, back against the pad, handles pressed overhead, arms almost straight.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 25%(`shoulder-press-machine-25`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: side view, seated on a shoulder press machine, back against the pad, handles pushed a little above shoulder height, elbows still deeply bent.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 50%(`shoulder-press-machine-50`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: side view, seated on a shoulder press machine, back against the pad, handles at head height, elbows half straight.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 75%(`shoulder-press-machine-75`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: side view, seated on a shoulder press machine, back against the pad, handles just above the head, arms nearly straight.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 3. `pec-deck-machine` — 蝴蝶機夾胸

起始(`pec-deck-machine-start`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, seated on a pec deck machine, back against the pad, arms opened wide to the sides at shoulder height, elbows slightly bent, hands on the handles.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

結束(`pec-deck-machine-end`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, seated on a pec deck machine, back against the pad, arms brought together in front of the chest, the two handles meeting in the middle.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 25%(`pec-deck-machine-25`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: front view, seated on a pec deck machine, back against the pad, elbows slightly bent, hands on the handles, arms starting to swing inward, a quarter of the way from wide open toward the middle.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 50%(`pec-deck-machine-50`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: front view, seated on a pec deck machine, back against the pad, elbows slightly bent, hands on the handles, arms halfway closed, angled forward at about 45 degrees.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 75%(`pec-deck-machine-75`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: front view, seated on a pec deck machine, back against the pad, elbows slightly bent, hands on the handles, arms nearly together, the handles a hand's width apart in front of the chest.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 4. `reverse-pec-deck-machine` — 反向飛鳥機

起始(`reverse-pec-deck-machine-start`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: three-quarter view, seated facing a pec deck machine with the chest against the pad, arms reaching straight forward to the handles at shoulder height.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

結束(`reverse-pec-deck-machine-end`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: three-quarter view, seated facing a pec deck machine with the chest against the pad, arms swept back and out to the sides at shoulder height, shoulder blades squeezed.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 25%(`reverse-pec-deck-machine-25`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: three-quarter view, seated facing a pec deck machine with the chest against the pad, elbows slightly bent, arms at shoulder height, arms starting to open from straight forward.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 50%(`reverse-pec-deck-machine-50`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: three-quarter view, seated facing a pec deck machine with the chest against the pad, elbows slightly bent, arms at shoulder height, arms opened halfway, angled out at about 45 degrees.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 75%(`reverse-pec-deck-machine-75`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: three-quarter view, seated facing a pec deck machine with the chest against the pad, elbows slightly bent, arms at shoulder height, arms almost out to the sides.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 5. `cable-fly` — 滑輪夾胸

起始(`cable-fly-start`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, standing between two cable pulleys set at shoulder height, one handle in each hand, arms open wide to the sides, elbows slightly bent, one foot a little forward.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

結束(`cable-fly-end`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, standing between two cable pulleys set at shoulder height, handles brought together in front of the chest, arms in a hugging arc.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 25%(`cable-fly-25`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: front view, standing between two cable pulleys set at shoulder height, one handle in each hand, elbows slightly bent, one foot a little forward, arms starting to sweep inward, a quarter of the way from wide open toward the middle.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 50%(`cable-fly-50`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: front view, standing between two cable pulleys set at shoulder height, one handle in each hand, elbows slightly bent, one foot a little forward, arms halfway closed, angled forward at about 45 degrees.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 75%(`cable-fly-75`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: front view, standing between two cable pulleys set at shoulder height, one handle in each hand, elbows slightly bent, one foot a little forward, arms nearly together, the handles a hand's width apart in front of the chest.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 6. `cable-face-pull` — 滑輪臉拉

起始(`cable-face-pull-start`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: three-quarter view, standing facing a cable pulley set at face height, holding a rope attachment with both hands, arms extended forward toward the pulley.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

結束(`cable-face-pull-end`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: three-quarter view, standing facing a cable pulley set at face height, rope pulled toward the forehead, elbows high and flared out, hands beside the ears.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 25%(`cable-face-pull-25`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: three-quarter view, standing facing a cable pulley set at face height, holding a rope attachment with both hands, elbows starting to bend, the rope pulled a short way back from arm's length.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 50%(`cable-face-pull-50`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: three-quarter view, standing facing a cable pulley set at face height, holding a rope attachment with both hands, rope halfway to the face, elbows bent and rising out to the sides.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 75%(`cable-face-pull-75`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: three-quarter view, standing facing a cable pulley set at face height, holding a rope attachment with both hands, rope close to the face, elbows high and wide.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 7. `cable-crunch` — 跪姿滑輪捲腹

起始(`cable-crunch-start`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, kneeling on a mat facing a high cable pulley, holding a rope attachment beside the head with both hands, torso upright.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

結束(`cable-crunch-end`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, kneeling on a mat facing a high cable pulley, torso curled down with a rounded back, elbows moving toward the knees, rope still beside the head.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 25%(`cable-crunch-25`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: side view, kneeling on a mat facing a high cable pulley, rope held beside the head with both hands, torso starting to round forward, only slightly bent.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 50%(`cable-crunch-50`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: side view, kneeling on a mat facing a high cable pulley, rope held beside the head with both hands, torso curled halfway down, back rounding.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 75%(`cable-crunch-75`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: side view, kneeling on a mat facing a high cable pulley, rope held beside the head with both hands, torso almost fully curled, elbows close to the knees.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 8. `cable-pallof-press` — Pallof 抗旋轉推

起始(`cable-pallof-press-start`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: three-quarter view, standing side-on to a cable pulley at chest height, feet shoulder-width apart, knees soft, both hands holding the handle against the middle of the chest.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

結束(`cable-pallof-press-end`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: three-quarter view, standing side-on to a cable pulley at chest height, arms pressed straight out in front of the chest, torso square and not twisting toward the pulley.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 25%(`cable-pallof-press-25`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: three-quarter view, standing side-on to a cable pulley at chest height, feet shoulder-width apart, knees soft, torso square and not twisting, handle pushed a short way out from the chest, elbows still deeply bent.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 50%(`cable-pallof-press-50`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: three-quarter view, standing side-on to a cable pulley at chest height, feet shoulder-width apart, knees soft, torso square and not twisting, arms halfway extended in front of the chest.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 75%(`cable-pallof-press-75`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: three-quarter view, standing side-on to a cable pulley at chest height, feet shoulder-width apart, knees soft, torso square and not twisting, arms almost straight in front of the chest.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 9. `kettlebell-swing` — 壺鈴擺盪

起始(`kettlebell-swing-start`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, feet a bit wider than hip-width, hips hinged back, knees slightly bent, flat back, both hands holding a kettlebell swung back between the legs.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

結束(`kettlebell-swing-end`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, standing tall with the hips locked out and glutes squeezed, arms straight, the kettlebell floated forward to chest height.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 25%(`kettlebell-swing-25`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: side view, feet a bit wider than hip-width, both hands holding a kettlebell, arms straight, hips starting to drive forward out of the hinge, the kettlebell coming forward from between the legs.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 50%(`kettlebell-swing-50`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: side view, feet a bit wider than hip-width, both hands holding a kettlebell, arms straight, torso halfway up at about 45 degrees, the kettlebell passing in front of the knees.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

中間 75%(`kettlebell-swing-75`):

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Keep the camera angle, framing, character size and equipment exactly as in
the start and end pictures of this exercise; change only the moving body parts.
Pose: side view, feet a bit wider than hip-width, both hands holding a kettlebell, arms straight, almost standing, hips nearly locked out, the kettlebell rising past the waist toward chest height.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```
## 步驟 3:縮圖、轉檔、組動畫

需要先 `brew install webp`。把每個動作的五張 PNG 放在同一個工作資料夾(檔名用每段提示詞上標的代稱,例如 `pec-deck-machine-25.png`),在裡面執行:

```bash
sips -Z 384 *.png
app=~/Developer/personal-health-tracker/mobile  # 專案的 mobile 資料夾

for s in hip-abduction-machine shoulder-press-machine pec-deck-machine reverse-pec-deck-machine \
         cable-fly cable-face-pull cable-crunch cable-pallof-press kettlebell-swing; do
  # 5fps 動畫:每格 200ms,起始 → 結束 → 倒回起始
  img2webp -loop 0 -lossy -q 88 -d 200 \
    $s-start.png $s-25.png $s-50.png $s-75.png $s-end.png $s-75.png $s-50.png $s-25.png \
    -o $app/assets/exercise-anim/$s.webp
  # 靜態圖:起始、結束
  cwebp -q 88 $s-start.png -o $app/assets/exercise/$s-start.webp
  cwebp -q 88 $s-end.png -o $app/assets/exercise/$s-end.webp
done

cd $app && npm run exercise-images
```

用 `webpmux -info <檔名>.webp` 檢查動畫:畫布 384 x 384、`Loop Count : 0`,每格 `duration` 是 200(內容相同的相鄰影格會被合併成一格,時間跟著加總)。

## 補救提示詞(角色走樣時)

```
Keep the exact same character design as the reference image: the same face, the same orange-tan and cream
fur, the same small triangle ears, the same curly tail, and the same raspberry-pink tee, dark-gray shorts and
black sneakers. Do not change the art style. Redraw the pose only.
```

## 檢查清單

- [ ] 全身都在畫面裡,沒有被切掉
- [ ] 背景是純白,沒有陰影方塊或文字
- [ ] 器材是簡單的灰色平塗
- [ ] 服裝顏色一致(莓紅上衣、深灰短褲、黑鞋)
- [ ] 縮成 384×384 後,姿勢還認得出來
- [ ] 動畫的五張圖構圖一致(角色大小、位置、器材都沒跑),播起來不會跳動
