# 動作圖片提示詞(柴犬版)

給 AI 生圖工具(例如 ChatGPT)用的提示詞。每個區塊都是完整的,整段複製貼上就能用。

## 規格

| 項目 | 建議 |
|---|---|
| 尺寸 | 生成後縮到 **384×384**,正方形 |
| 格式 | PNG,純白背景 |
| 放哪裡 | `mobile/assets/exercise/`(單數) |
| 檔名 | 每個區塊標題的代稱,例如 `barbell-back-squat.png` |
| 起始姿勢 | 要另外做起始圖,就把提示詞裡的姿勢改成起始的樣子,檔名加 `-start`(結束圖加 `-end`) |

縮圖(macOS 內建),在 `assets/exercise/` 裡執行:

```bash
sips -Z 384 *.png
```

## 轉成 WebP(建議)

PNG 平均約 146 KB,轉成 WebP(品質 88)後約 16 KB,畫質幾乎看不出差別。專案裡目前放的就是 WebP,原始 PNG 備份在桌面的 `exercise-png-original/`。

之後新增的圖,縮到 384 之後轉一次(需要先 `brew install webp`),PNG 和 WebP 二選一放進資料夾,不要同時放同名的兩個:

```bash
for f in *.png; do cwebp -q 88 "$f" -o "${f%.png}.webp" && rm "$f"; done
```

## 放進 App

圖放進 `mobile/assets/exercise/` 之後,在 `mobile/` 執行一次:

```bash
npm run exercise-images
```

這會重新產生圖片清單。新增、改名或刪掉圖檔都要再跑一次,沒有圖的動作會自動用程式畫的人物圖代替。

## 步驟

1. 在**同一個對話**裡完成全部圖片,角色才會一致。
2. 先貼「步驟 1:基準角色」,挑一張滿意的當基準,後面每張都以它為參考。
3. 再依序貼「步驟 2」的各個區塊。
4. 角色走樣時,貼「補救提示詞」,再重生成。
5. 生好的圖縮到 384、改成標題上的檔名,放進 `mobile/assets/exercise/`。

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

### 下肢

#### 1. `barbell-back-squat` — 槓鈴深蹲

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, deep squat with thighs parallel to the floor, barbell resting on the upper back, chest up.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 2. `barbell-romanian-deadlift` — 槓鈴羅馬尼亞硬舉

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, hips pushed back, torso leaning forward about 75 degrees, knees soft, barbell hanging at shin level, back flat.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 3. `barbell-hip-thrust` — 槓鈴臀推

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, upper back resting on a flat bench, hips lifted high, thighs parallel to the floor, barbell across the hips.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 4. `dumbbell-goblet-squat` — 啞鈴高腳杯深蹲

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, deep squat holding one dumbbell vertically at the chest with both paws.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 5. `dumbbell-reverse-lunge` — 啞鈴後撤弓箭步

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, lunge with front knee bent 90 degrees and back knee near the floor, a dumbbell in each paw at the sides.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 6. `dumbbell-bulgarian-split-squat` — 啞鈴保加利亞分腿蹲

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, rear foot resting on a bench behind, front knee bent 90 degrees, a dumbbell in each paw.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 7. `leg-press-machine` — 腿推機

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, reclined on a leg press machine seat, legs pushing the platform, knees almost straight.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 8. `leg-extension-machine` — 腿屈伸機

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, seated on a leg extension machine, both legs extended straight forward, pad on the shins.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 9. `seated-leg-curl-machine` — 坐姿腿彎舉機

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, seated leg curl machine, lower legs curled back under the seat, pad behind the ankles.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 10. `standing-calf-raise-machine` — 站姿提踵機

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, standing on tiptoes with heels up, shoulder pads of a calf raise machine on the shoulders.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 11. `bodyweight-squat` — 徒手深蹲

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, deep squat with both arms stretched forward for balance.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 12. `bodyweight-walking-lunge` — 徒手行走弓箭步

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, long-stride lunge, back knee near the floor, hands on hips.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 13. `glute-bridge` — 臀橋

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, lying on the back on the floor, knees bent, hips lifted high, shoulders on the floor.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 上肢

#### 14. `barbell-bench-press` — 槓鈴臥推

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, lying on a bench, barbell lowered to the chest, elbows bent.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 15. `barbell-overhead-press` — 槓鈴肩推

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, standing, barbell pressed straight overhead, arms locked out.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 16. `barbell-bent-over-row` — 槓鈴俯身划船

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, torso bent forward about 70 degrees, barbell pulled to the belly, elbows back.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 17. `dumbbell-incline-press` — 啞鈴上斜臥推

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, lying on an incline bench, dumbbells pressed up above the chest.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 18. `dumbbell-shoulder-press` — 啞鈴肩推

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, standing, a dumbbell in each paw pressed overhead.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 19. `dumbbell-one-arm-row` — 單手啞鈴划船

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, one paw and one knee on a bench, the other paw pulling a dumbbell to the hip, back flat.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 20. `dumbbell-lateral-raise` — 啞鈴側平舉

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, arms raised straight out to the sides at shoulder height, a dumbbell in each paw.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 21. `lat-pulldown-machine` — 下拉機

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, seated at a lat pulldown machine, bar pulled down to the upper chest, elbows pointing down.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 22. `seated-cable-row` — 坐姿滑輪划船

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, seated at a cable row machine, handle pulled to the belly, chest up, elbows back.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 23. `chest-press-machine` — 胸推機

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, seated at a chest press machine, arms pushed forward, handles extended.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 24. `push-up` — 伏地挺身

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, plank push-up at the lowest point, chest near the floor, body in a straight line.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 25. `pull-up` — 引體向上

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, hanging from a pull-up bar with the chin above the bar.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 26. `dip` — 雙槓撐體

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, on parallel bars, arms bent, body lowered.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 27. `inverted-row` — 反向划船

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, body straight under a low bar, chest pulled up to the bar.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 伸展與活動度

#### 28. `cat-cow` — 貓牛式

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, on all fours, back arched upward like a cat.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 29. `worlds-greatest-stretch` — 世界上最偉大的伸展

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, deep lunge with one paw on the floor and the other arm reaching to the sky, chest rotated open.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 30. `hip-flexor-stretch` — 髖屈肌伸展

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, half-kneeling lunge, torso upright, both arms raised overhead.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 31. `thoracic-rotation` — 胸椎旋轉

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, on all fours, one arm reaching up to the sky while the chest rotates open.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 32. `band-pull-apart` — 彈力帶拉開

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, arms stretched wide at shoulder height, pulling a resistance band apart.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 33. `shoulder-circles` — 肩關節繞圈

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, arms out to the sides making big circles, with small curved motion lines.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

### 有氧

#### 34. `incline-treadmill-walk` — 上坡跑步機快走

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, brisk walking on an inclined treadmill.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 35. `cycling-stationary` — 飛輪車

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, riding a stationary spin bike, hands on the handlebar.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 36. `rowing-erg` — 划船機

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, seated on a rowing machine at the finish, leaning slightly back, handle at the chest.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 37. `elliptical` — 橢圓機

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, standing on an elliptical machine, holding the handles.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 38. `stair-climber` — 登階機

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, climbing on a stair climber machine.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 39. `jump-rope` — 跳繩

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: front view, mid-jump with a jump rope swinging under the feet.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 40. `running-outdoor` — 戶外跑步

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, running mid-stride outdoors.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 41. `cycling-outdoor` — 戶外騎車

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, riding a road bike outdoors, wearing a helmet.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 42. `swimming-freestyle` — 自由式游泳

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, swimming freestyle with one arm reaching forward and water splashes.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 43. `tennis-singles` — 網球單打

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, forehand swing with a tennis racket.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 44. `badminton` — 羽球

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, jumping smash with a badminton racket.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

#### 45. `basketball` — 籃球

```
The same Shiba Inu character and the same outfit as the reference image,
same flat cartoon style. Pose: side view, dribbling a basketball.
Any equipment is simple, flat gray, minimal detail.
Full body visible, centered, square 1:1, plain pure white background, no text.
```

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
